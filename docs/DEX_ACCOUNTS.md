# Аккаунты и пулы на DEX
Проект использует пулы Raydium и Whirlpool (Orca) на Devnet как источники котировок/ликвидности.
## Devnet
Пары: `config/pairs.devnet.json` (SOL/USDC, USDC/USDT). Проверьте аккаунты:
```bash
solana account <POOL_ADDRESS> --output json
```
## Ассоциированные токен‑аккаунты (ATA)
Создание ATA:
```bash
spl-token create-account <MINT>
spl-token accounts
```
Пополнение Devnet‑токенами через краны/минтеры (если доступны). В проде — мосты/биржи (соблюдайте требования вашей юрисдикции).
