# Запуск в прод (Mainnet)
1) Замените демо‑инструкцию в контракте на реальные CPI вызовы DEX.
2) Настройте надёжный RPC.
3) Подготовьте кошелёк и пополните токены.
4) Заполните `.env.prod` (`RPC_URL`, `WALLET_SECRET`, `PROGRAM_ID`).
5) Обновите адреса пулов на mainnet.
6) Запускайте:
```bash
cd bot
npm ci && npm run build
NODE_ENV=production node dist/main.js
```
7) Настройте мониторинг/алерты.
## CI/CD
`.github/workflows/deploy.yml` — шаблон GitHub Actions.


## Mainnet конфиги и пулы
- Программы:
  - Raydium AMM: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
  - Orca Whirlpool: `whirLbMiicVdio4qvUfM5KAg6wG7x5cK6FVLEwLB5N8` (на Devnet отличается)
- Пулы: используйте скрипты:
  - Разрешить Whirlpool‑пул по минтам:  
    `cd bot && npm i && npx ts-node src/scripts/resolve-whirlpool-pool.ts --a <MINT_A> --b <MINT_B> --tick 64 --out ../config/pairs.mainnet.json`
  - Валидировать Raydium‑пул:  
    `cd bot && npx ts-node src/scripts/validate-raydium-pool.ts --pool <POOL_ID>`

> Я намеренно добавил шаблон `config/pairs.mainnet.example.json`. Замените `REPLACE_WITH_*` на фактические адреса или заполните через скрипты. Проверьте существование аккаунтов и ликвидность перед запуском.


## Profit Guard в проде
- Всегда прокладывайте `min_out` в своп-инструкциях DEX или используйте `assert_profit` в конце маршрута.
- Рекомендуем динамически подстраивать `slippage_bps` под текущую волатильность и нагрузку RPC.
