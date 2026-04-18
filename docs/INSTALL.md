# Установка
## 1) Зависимости
- Rust + Cargo
- Solana CLI (`solana-install init 1.17.0`)
- Anchor CLI (`cargo install --locked anchor-cli --git https://github.com/coral-xyz/anchor`)
- Node.js LTS, `npm`, `ts-node`, `typescript`
Windows: используйте WSL2 (Ubuntu) и те же команды.
## 2) Проверка
```bash
solana --version
anchor --version
node -v && npm -v
```
## 3) Кошелёк
```bash
solana-keygen new
cat ~/.config/solana/id.json
```
Содержимое id.json скопируйте в `.env` → `WALLET_SECRET=[...]`.
Devnet airdrop:
```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
solana balance
```
