use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, Mint, transfer_checked, TransferChecked};
use solana_program::instruction::{Instruction, AccountMeta};
use solana_program::program::invoke;

declare_id!("Arb111111111111111111111111111111111111111");

pub const RAYDIUM_PROGRAM: &str = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
pub const ORCA_WHIRLPOOL_PROGRAM: &str = "whirLbMiicVdio4qvUfM5KAg6wG7x5cK6FVLEwLB5N8"; // mainnet; on devnet отличается — для тестов можно переопределить

#[program]
pub mod arb_bot {
    use super::*;


    /// Assert that (current_balance - before_balance) >= min_profit.
    /// Read balance from a user token account after all swaps.
    pub fn assert_profit(ctx: Context<AssertProfit>, before_balance: u64, min_profit: u64, _decimals: u8) -> Result<()> {
        // Read current SPL token amount from account
        let current = ctx.accounts.user_profit_token.amount;
        require!(current >= before_balance, ArbError::NoProfit);
        let delta = current - before_balance;
        require!(delta >= min_profit, ArbError::ProfitTooLow);
        Ok(())
    }

    /// Demo: simple token transfer (placeholder). Replace or keep for dry-run.
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        amount_in: u64,
        min_amount_out: u64,
        decimals: u8,
    ) -> Result<()> {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.dex_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.pool_token_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
            },
        );
        transfer_checked(cpi_ctx, amount_in, decimals)?;
        let _ = min_amount_out;
        Ok(())
    }

    /// Generic CPI passthrough to a whitelisted target program (Raydium/Whirlpool).
    /// Accounts for the target instruction MUST be passed in `remaining_accounts`
    /// in the exact order expected by the target program.
    pub fn cpi_passthrough(ctx: Context<CpiPassthrough>, ix_data: Vec<u8>) -> Result<()> {
        let target_key = ctx.accounts.target_program.key();
        require!(
            target_key.to_string() == RAYDIUM_PROGRAM || target_key.to_string() == ORCA_WHIRLPOOL_PROGRAM,
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
        invoke(&ix, &ctx.remaining_accounts)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: demo
    pub dex_program: UncheckedAccount<'info>,

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


#[derive(Accounts)]
pub struct AssertProfit<'info> {
    /// CHECK: any
    pub target_program: UncheckedAccount<'info>, // not used, kept for symmetry if needed
    /// Token account of user holding the final asset of the route
    pub user_profit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(signer)]
    pub signer: Signer<'info>,
}
pub enum ArbError {
    #[msg("Target program is not whitelisted")]
    ProgramNotWhitelisted,
}
