# SmartTrade Starter Kit (Solana, Anchor, TS)
Готовый проект: смарт‑контракт (Anchor) + бот (TypeScript) для мульти‑DEX маршрутов (Raydium + Whirlpool как суррогат DLMM), бэктест, деплой в dev/prod, мониторинг.
## Быстрый старт
1. Прочитать `docs/INSTALL.md` и поставить зависимости.
2. Сгенерировать кошелёк: `solana-keygen new` (Devnet) и положить JSON в `.env` (`WALLET_SECRET`).
3. `make build-contracts && make deploy-devnet && make idl`
4. `make bot-install && make bot-build`
5. Запуск бота (Devnet): `make bot-start`
Подробные шаги: `docs/CONFIG.md`, `docs/SMARTCONTRACT.md`, `docs/TESTING.md`, `docs/PROD.md`.
