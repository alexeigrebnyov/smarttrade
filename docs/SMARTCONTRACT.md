# Смарт‑контракт (Anchor)
## Сборка и деплой на Devnet
```bash
make build-contracts
make deploy-devnet
make idl
```
Скрипт деплоя обновит `PROGRAM_ID` в `.env` и `.env.prod`.
## Структура
- `contracts/programs/arb-bot/src/lib.rs` — инструкция `execute_swap(...)` (демо: `transfer_checked`). Замените на CPI конкретного DEX.
- IDL копируется в `bot/idl/arb_bot.json` командой `make idl`.
## Обновление контракта
Внесли изменения → `make build-contracts && make deploy-devnet && make idl`.
