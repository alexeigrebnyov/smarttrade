use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, Mint, transfer_checked, TransferChecked};
use solana_program::instruction::{Instruction, AccountMeta};
use solana_program::program::invoke_signed;
use solana_program::pubkey::Pubkey;

declare_id!("Arb111111111111111111111111111111111111111");

pub const RAYDIUM_PROGRAM: &str = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
pub const ORCA_WHIRLPOOL_PROGRAM: &str = "whirLbMiicVdio4qvUfM5KAg6wG7x5cK6FVLEwLB5N8"; // mainnet
pub const ORCA_WHIRLPOOL_DEVNET: &str = "whirLbMiicVdio4qvUfM5KAg6wG7x5cK6FVLEwLB5N8"; // replace with actual devnet

/// Raydium AMM swap instruction discriminator
pub const RAYDIUM_SWAP_DISCRIMINATOR: [u8; 8] = [9, 0, 0, 0, 0, 0, 0, 0]; // swap instruction

/// Whirlpool swap instruction discriminator  
pub const WHIRLPOOL_SWAP_DISCRIMINATOR: [u8; 8] = [0x7b, 0x88, 0x15, 0xe0, 0x13, 0x2e, 0x5a, 0x4e]; // swap_v2

#[program]
pub mod arb_bot {
    use super::*;

    /// Assert that (current_balance - before_balance) >= min_profit.
    /// Read balance from a user token account after all swaps.
    pub fn assert_profit(ctx: Context<AssertProfit>, before_balance: u64, min_profit: u64, _decimals: u8) -> Result<()> {
        // Read current SPL token amount from account
        let current = ctx.accounts.user_profit_token.amount;
        require!(current >= before_balance, ArbError::NoProfit);
        let delta = current.checked_sub(before_balance).ok_or(ArbError::Overflow)?;
        require!(delta >= min_profit, ArbError::ProfitTooLow);
        Ok(())
    }

    /// Execute swap on Raydium or Orca Whirlpool via CPI
    /// This is the main instruction that performs atomic arbitrage
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        amount_in: u64,
        min_amount_out: u64,
        decimals: u8,
        dex_type: u8, // 0 = Raydium, 1 = Whirlpool
    ) -> Result<()> {
        let target_key = ctx.accounts.dex_program.key();
        let target_str = target_key.to_string();
        
        // Validate DEX program is whitelisted
        require!(
            target_str == RAYDIUM_PROGRAM || 
            target_str == ORCA_WHIRLPOOL_PROGRAM ||
            target_str == ORCA_WHIRLPOOL_DEVNET,
            ArbError::ProgramNotWhitelisted
        );

        match dex_type {
            0 => execute_raydium_swap(&ctx, amount_in, min_amount_out, decimals),
            1 => execute_whirlpool_swap(&ctx, amount_in, min_amount_out, decimals),
            _ => Err(ArbError::InvalidDexType.into()),
        }
    }

    /// Generic CPI passthrough to a whitelisted target program (Raydium/Whirlpool).
    /// Accounts for the target instruction MUST be passed in `remaining_accounts`
    /// in the exact order expected by the target program.
    pub fn cpi_passthrough(ctx: Context<CpiPassthrough>, ix_data: Vec<u8>) -> Result<()> {
        let target_key = ctx.accounts.target_program.key();
        require!(
            target_key.to_string() == RAYDIUM_PROGRAM || 
            target_key.to_string() == ORCA_WHIRLPOOL_PROGRAM ||
            target_key.to_string() == ORCA_WHIRLPOOL_DEVNET,
            ArbError::ProgramNotWhitelisted
        );

        // Build AccountMeta from remaining accounts (signer/writable flags inferred)
        let metas: Vec<AccountMeta> = ctx.remaining_accounts.iter().map(|acc| {
            AccountMeta {
                pubkey: *acc.key,
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            }
        }).collect();

        let ix = Instruction {
            program_id: target_key,
            accounts: metas,
            data: ix_data,
        };

        // Forward CPI
        invoke_signed(&ix, &ctx.remaining_accounts, &[])?;
        Ok(())
    }
}

/// Execute swap on Raydium AMM
fn execute_raydium_swap(
    ctx: &Context<ExecuteSwap>,
    amount_in: u64,
    min_amount_out: u64,
    _decimals: u8,
) -> Result<()> {
    // Raydium swap instruction layout:
    // [discriminator (8)] + [amount_in (8)] + [min_amount_out (8)]
    let mut data = Vec::new();
    data.extend_from_slice(&RAYDIUM_SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_amount_out.to_le_bytes());

    // Build required accounts for Raydium swap
    // Note: This is simplified - real Raydium requires specific account structure
    let metas = vec![
        AccountMeta::new(*ctx.accounts.token_program.key, false),
        AccountMeta::new(ctx.accounts.amm_pool.key(), false),
        AccountMeta::new_readonly(ctx.accounts.amm_authority.key(), false),
        AccountMeta::new(ctx.accounts.user_token_account.key(), false),
        AccountMeta::new(ctx.accounts.pool_token_account.key(), false),
        // Add more accounts as needed based on Raydium's actual swap instruction
    ];

    let ix = Instruction {
        program_id: ctx.accounts.dex_program.key(),
        accounts: metas,
        data,
    };

    invoke_signed(
        &ix,
        &[
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.amm_pool.to_account_info(),
            ctx.accounts.amm_authority.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.pool_token_account.to_account_info(),
        ],
        &[],
    )?;

    Ok(())
}

/// Execute swap on Orca Whirlpool
fn execute_whirlpool_swap(
    ctx: &Context<ExecuteSwap>,
    amount_in: u64,
    min_amount_out: u64,
    _decimals: u8,
) -> Result<()> {
    // Whirlpool swap_v2 instruction layout:
    // [discriminator (8)] + [amount (8)] + [other_amount_threshold (8)] + ...
    let mut data = Vec::new();
    data.extend_from_slice(&WHIRLPOOL_SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_amount_out.to_le_bytes());
    // Add: sqrt_price_limit (u128), amount_specified_is_input (bool), a_to_b (bool)
    data.extend_from_slice(&0u128.to_le_bytes()); // sqrt_price_limit (0 = no limit)
    data.push(1); // amount_specified_is_input = true
    data.push(1); // a_to_b = true (should be determined from pool direction)

    // Whirlpool requires whirlpool state account and tick arrays
    let metas = vec![
        AccountMeta::new(*ctx.accounts.token_program.key, false),
        AccountMeta::new(ctx.accounts.amm_pool.key(), false), // whirlpool state
        AccountMeta::new(ctx.accounts.user_token_account.key(), false),
        AccountMeta::new(ctx.accounts.pool_token_account.key(), false),
        // Add tick arrays and oracle as needed
    ];

    let ix = Instruction {
        program_id: ctx.accounts.dex_program.key(),
        accounts: metas,
        data,
    };

    invoke_signed(
        &ix,
        &[
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.amm_pool.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.pool_token_account.to_account_info(),
        ],
        &[],
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: DEX program (Raydium/Whirlpool) - validated in instruction
    pub dex_program: UncheckedAccount<'info>,

    /// CHECK: AMM pool state account
    pub amm_pool: UncheckedAccount<'info>,

    /// CHECK: AMM authority (PDA for Raydium)
    pub amm_authority: UncheckedAccount<'info>,

    /// CHECK: Token program
    pub token_program: UncheckedAccount<'info>,

    #[account(signer)]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CpiPassthrough<'info> {
    /// CHECK: target DEX program (Raydium/Whirlpool)
    pub target_program: UncheckedAccount<'info>,
    #[account(signer)]
    pub signer: Signer<'info>,
}

#[error_code]
pub enum ArbError {
    #[msg("Target program is not whitelisted")]
    ProgramNotWhitelisted,
    #[msg("Invalid DEX type specified (0=Raydium, 1=Whirlpool)")]
    InvalidDexType,
    #[msg("No profit detected in assert_profit check")]
    NoProfit,
    #[msg("Profit is below minimum threshold")]
    ProfitTooLow,
    #[msg("Arithmetic overflow occurred")]
    Overflow,
}

#[derive(Accounts)]
pub struct AssertProfit<'info> {
    /// CHECK: any
    pub target_program: UncheckedAccount<'info>, // not used, kept for symmetry if needed
    /// Token account of user holding the final asset of the route
    pub user_profit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(signer)]
    pub signer: Signer<'info>,
}
