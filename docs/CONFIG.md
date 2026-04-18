# Конфигурация
Файлы:
- `.env` — Devnet
- `.env.prod` — Mainnet
Поля:
- `RPC_URL` — адрес RPC (Devnet/Mainnet).
- `WALLET_SECRET` — JSON‑массив приватного ключа кошелька.
- `PROGRAM_ID` — ID смарт‑контракта (заполняется скриптом деплоя).
Пулы Devnet: `config/pairs.devnet.json`. При желании поменяйте адреса пулов/минтов.
## Проверка окружения
```bash
solana config get
```
## Кошельки/ATA
Создайте ATA под нужные токены (Devnet):
```bash
spl-token accounts
# при необходимости: spl-token create-account <MINT>
```
