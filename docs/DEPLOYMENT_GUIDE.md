# 📘 Гайд по сборке и деплою SmartTrade Starter Kit

Этот гайд описывает полный процесс сборки смарт-контракта, генерации IDL, деплоя на devnet и mainnet. Доступны два варианта: **локальная установка** и **Docker**.

---

## 📋 Оглавление

1. [Вариант 1: Локальная установка](#вариант-1-локальная-установка)
2. [Вариант 2: Docker](#вариант-2-docker)
3. [Сборка контракта](#сборка-контракта)
4. [Генерация IDL](#генерация-idl)
5. [Деплой на devnet](#деплой-на-devnet)
6. [Тестирование](#тестирование)
7. [Деплой на mainnet](#деплой-на-mainnet)
8. [Чеклист перед продакшеном](#чеклист-перед-продакшеном)
9. [Troubleshooting](#troubleshooting)

---

## Вариант 1: Локальная установка

### Шаг 1.1: Установка системных зависимостей

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    clang \
    llvm \
    curl \
    git
```

#### macOS
```bash
xcode-select --install
brew install openssl
```

### Шаг 1.2: Установка Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# Проверка версии (требуется 1.76+)
rustc --version

# Установка нужной версии (если требуется)
rustup install 1.76.0
rustup default 1.76.0
```

### Шаг 1.3: Установка Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.22/install)"
source ~/.local/share/solana/install/active_release/bin/path

# Проверка
solana --version

# Инициализация конфига
solana config set --url localhost
```

### Шаг 1.4: Установка Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force --locked
avm install 0.30.0
avm use 0.30.0

# Проверка
anchor --version
```

### Шаг 1.5: Установка Node.js зависимостей проекта

```bash
cd /workspace/bot
npm install

# Генерация кошелька (если нет)
npm run generate-wallet
```

---

## Вариант 2: Docker

### Шаг 2.1: Предварительные требования

Убедитесь, что установлены:
- Docker Engine 20.10+
- Docker Compose 2.0+

```bash
docker --version
docker compose version
```

### Шаг 2.2: Использование готового Dockerfile

Проект включает `Dockerfile.dev` для разработки и `Dockerfile.prod` для продакшена.

#### Сборка образа для разработки

```bash
cd /workspace
docker build -f Dockerfile.dev -t smarttrade-dev .
```

#### Запуск контейнера

```bash
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  smarttrade-dev \
  bash
```

Или используйте docker-compose:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec dev bash
```

### Шаг 2.3: Структура Dockerfile.dev

```dockerfile
FROM rust:1.76-bookworm

# Установка Solana CLI
RUN sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.22/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Установка Anchor
RUN cargo install --git https://github.com/coral-xyz/anchor avm --force --locked
RUN avm install 0.30.0 && avm use 0.30.0

# Установка Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Рабочая директория
WORKDIR /workspace

# Кэширование зависимостей Rust
COPY contracts/Cargo.toml contracts/Cargo.lock ./contracts/
COPY contracts/programs/arb-bot/Cargo.toml ./contracts/programs/arb-bot/
RUN cd contracts && cargo fetch

# Кэширование зависимостей Node.js
COPY bot/package.json bot/package-lock.json ./bot/
RUN cd bot && npm ci

# Копирование исходников
COPY . .

# Команда по умолчанию
CMD ["bash"]
```

### Шаг 2.4: Make-команды для Docker

Создайте файл `Makefile.docker`:

```makefile
# Docker команды

.PHONY: docker-build
docker-build:
	docker build -f Dockerfile.dev -t smarttrade-dev .

.PHONY: docker-run
docker-run:
	docker run -it --rm \
		-v $(PWD):/workspace \
		-w /workspace \
		smarttrade-dev \
		bash

.PHONY: docker-build-contract
docker-build-contract:
	docker run --rm -v $(PWD):/workspace -w /workspace/contracts smarttrade-dev anchor build

.PHONY: docker-deploy-devnet
docker-deploy-devnet:
	docker run --rm -v $(PWD):/workspace -w /workspace/contracts smarttrade-dev \
		sh -c "solana config set --url devnet && anchor deploy --provider.cluster devnet"

.PHONY: docker-compose-up
docker-compose-up:
	docker compose -f docker-compose.dev.yml up -d

.PHONY: docker-compose-down
docker-compose-down:
	docker compose -f docker-compose.dev.yml down
```

### Шаг 2.5: docker-compose.dev.yml

```yaml
version: '3.8'

services:
  dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/workspace
      - solana-config:/root/.config/solana
    working_dir: /workspace
    stdin_open: true
    tty: true
    environment:
      - ANCHOR_PROVIDER_URL=http://api.devnet.solana.com
      - ANCHOR_WALLET=/workspace/bot/wallets/devnet-wallet.json
    ports:
      - "8899:8899"  # Local validator (если используется)
      - "9300:9300"  # Metrics

volumes:
  solana-config:
```

---

## Сборка контракта

### Шаг 3.1: Переход в директорию контрактов

```bash
cd /workspace/contracts
```

### Шаг 3.2: Сборка

```bash
# Для локальной сети
anchor build

# Для devnet
anchor build --provider.cluster devnet

# Для mainnet
anchor build --provider.cluster mainnet
```

### Шаг 3.3: Проверка артефактов

После успешной сборки должны появиться:

```
contracts/target/
├── deploy/
│   └── arb_bot.so          # Скомпилированный контракт
├── idl/
│   └── arb_bot.json        # IDL файл
└── typescript/
    └── arb_bot.ts          # TypeScript типы
```

Проверьте наличие файлов:

```bash
ls -lh target/deploy/arb_bot.so
ls -lh target/idl/arb_bot.json
```

---

## Генерация IDL

### Шаг 4.1: Автоматическая генерация (при сборке)

IDL генерируется автоматически при выполнении `anchor build`.

### Шаг 4.2: Ручная генерация (если нужно)

```bash
cd /workspace/contracts
anchor idl fetch <PROGRAM_ID> --provider.cluster devnet --out-file target/idl/arb_bot.json
```

### Шаг 4.3: Копирование IDL в bot

```bash
mkdir -p /workspace/bot/idl
cp /workspace/contracts/target/idl/arb_bot.json /workspace/bot/idl/
```

### Шаг 4.4: Генерация TypeScript типов

```bash
cd /workspace/contracts
anchor build --verifiable

# Копирование сгенерированных типов
cp -r target/types/* ../bot/src/types/
```

---

## Деплой на devnet

### Шаг 5.1: Создание кошелька для devnet

```bash
cd /workspace/bot

# Создание нового кошелька
solana-keygen new --outfile wallets/devnet-wallet.json

# Или использование существующего
# solana-keygen recover --outfile wallets/devnet-wallet.json
```

### Шаг 5.2: Получение SOL на devnet

```bash
# Адрес кошелька
solana address --keypair wallets/devnet-wallet.json

# Запрос эирдропа (2 SOL)
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Проверка баланса
solana balance --url devnet
```

### Шаг 5.3: Настройка окружения

Создайте/обновите `.env` в `/workspace/bot`:

```bash
# .env для devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=/workspace/bot/wallets/devnet-wallet.json
RPC_URL=https://api.devnet.solana.com
WALLET_SECRET_KEY=<BASE58_PRIVATE_KEY>
NETWORK=devnet
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PROMETHEUS_PORT=9300
CIRCUIT_BREAKER_MAX_LOSS_SOL=1.0
CIRCUIT_BREAKER_MAX_ERRORS=5
```

### Шаг 5.4: Обновление Anchor.toml

Проверьте `/workspace/contracts/Anchor.toml`:

```toml
[features]
seeds = false
skip-lint = false

[programs.devnet]
arb_bot = "<БУДЕТ_ЗАПОЛНЕНО_ПОСЛЕ_ДЕПЛОЯ>"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "devnet"
wallet = "../bot/wallets/devnet-wallet.json"

[scripts]
test = "npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### Шаг 5.5: Деплой контракта

```bash
cd /workspace/contracts

# Деплой
anchor deploy --provider.cluster devnet

# После деплоя скопируйте PROGRAM_ID из вывода
# Пример: "Program id: YourProgramIDxxxxxxxxxxxxxxxxxxxxxx"
```

### Шаг 5.6: Обновление PROGRAM_ID

После деплоя обновите файлы:

**contracts/Anchor.toml:**
```toml
[programs.devnet]
arb_bot = "YourProgramIDxxxxxxxxxxxxxxxxxxxxxx"
```

**bot/.env:**
```bash
PROGRAM_ID=YourProgramIDxxxxxxxxxxxxxxxxxxxxxx
```

**bot/config/pairs.devnet.json:**
```json
{
  "programId": "YourProgramIDxxxxxxxxxxxxxxxxxxxxxx",
  "pairs": [...]
}
```

### Шаг 5.7: Верификация деплоя

```bash
# Проверка что контракт задеплоен
solana program show <PROGRAM_ID> --url devnet

# Проверка баланса программы
solana balance <PROGRAM_ID> --url devnet
```

---

## Тестирование

### Шаг 6.1: Unit-тесты контракта

```bash
cd /workspace/contracts
anchor test --provider.cluster devnet
```

### Шаг 6.2: Интеграционные тесты бота

```bash
cd /workspace/bot
npm run test:unit
npm run test:integration
```

### Шаг 6.3: Тестовая транзакция

Создайте скрипт `/workspace/bot/scripts/test-swap.ts`:

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { loadWallet } from '../src/utils/wallet';
import { ArbBotClient } from '../src/core';

async function main() {
  const connection = new Connection(process.env.RPC_URL!, 'confirmed');
  const wallet = loadWallet(process.env.WALLET_SECRET_KEY!);
  
  const client = new ArbBotClient(connection, wallet);
  
  console.log('🧪 Тестовый свап...');
  // Минимальный тестовый свап
  await client.executeSwap({
    amountIn: 1000000, // 0.001 SOL в лампортах
    tokenMintIn: 'So11111111111111111111111111111111111111112',
    tokenMintOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    dexType: 'raydium',
    poolAddress: '<TEST_POOL_ADDRESS>',
    slippageBps: 50,
  });
  
  console.log('✅ Тест завершён');
}

main().catch(console.error);
```

Запуск:

```bash
cd /workspace/bot
npx ts-node scripts/test-swap.ts
```

### Шаг 6.4: Бэктестинг

```bash
cd /workspace/bot
npm run backtest -- --pair SOL-USDC --days 7 --output report.json
```

---

## Деплой на mainnet

### ⚠️ Важно перед деплоем на mainnet

1. **Тщательно протестируйте на devnet** (минимум 50 успешных транзакций)
2. **Проведите аудит кода** (самостоятельно или через стороннюю компанию)
3. **Настройте CircuitBreaker** с консервативными лимитами
4. **Подготовьте мониторинг** (Prometheus + алерты)
5. **Начните с минимальных сумм** (0.1-0.5 SOL)

### Шаг 7.1: Создание mainnet кошелька

```bash
cd /workspace/bot

# НОВЫЙ кошелек для mainnet (никогда не используйте devnet!)
solana-keygen new --outfile wallets/mainnet-wallet.json

# Сохраните сид-фразу в безопасном месте!
# Рекомендуется использовать аппаратный кошелек (Ledger)
```

### Шаг 7.2: Пополнение SOL

```bash
# Переведите SOL на адрес кошелька
solana address --keypair wallets/mainnet-wallet.json
# Отправьте минимум 2-3 SOL для комиссий + рабочий капитал
```

### Шаг 7.3: Обновление конфигурации

**bot/.env.prod:**
```bash
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com
ANCHOR_WALLET=/workspace/bot/wallets/mainnet-wallet.json
RPC_URL=https://api.mainnet-beta.solana.com
WALLET_SECRET_KEY=<BASE58_PRIVATE_KEY>
NETWORK=mainnet
PROGRAM_ID=YourMainnetProgramIDxxxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=your_prod_bot_token
TELEGRAM_CHAT_ID=your_prod_chat_id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PROMETHEUS_PORT=9300
CIRCUIT_BREAKER_MAX_LOSS_SOL=0.5
CIRCUIT_BREAKER_MAX_ERRORS=3
MAX_POSITION_SIZE_SOL=1.0
```

### Шаг 7.4: Деплой на mainnet

```bash
cd /workspace/contracts

# Деплой на mainnet
anchor deploy --provider.cluster mainnet

# Сохраните PROGRAM_ID из вывода
```

### Шаг 7.5: Верификация на Solscan

Перейдите на https://solscan.io/program/<PROGRAM_ID> и проверьте:
- Контракт опубликован
- Исходный код верифицирован (опционально, но рекомендуется)

### Шаг 7.6: Запуск бота в production

```bash
cd /workspace/bot

# В режиме production
npm run start:prod

# Или через PM2 для продакшена
npm install -g pm2
pm2 start npm --name "arb-bot" -- run start:prod
pm2 save
pm2 startup
```

### Шаг 7.7: Мониторинг

```bash
# Проверка метрик
curl http://localhost:9300/metrics

# Проверка логов
pm2 logs arb-bot

# Проверка статуса
pm2 status
```

---

## Чеклист перед продакшеном

### Безопасность
- [ ] Приватные ключи хранятся в зашифрованном виде
- [ ] Используется отдельный кошелек для prod
- [ ] CircuitBreaker настроен с консервативными лимитами
- [ ] Реализован graceful shutdown
- [ ] Есть валидация всех входных данных
- [ ] Проведён аудит кода

### Тестирование
- [ ] Все unit-тесты проходят
- [ ] Интеграционные тесты на devnet успешны
- [ ] Бэктесты показывают положительный результат
- [ ] Минимум 50 тестовых транзакций на devnet
- [ ] Протестированы сценарии ошибок

### Инфраструктура
- [ ] Выделенный сервер/VPS с статическим IP
- [ ] Настроен Prometheus + Grafana
- [ ] Настроены алерты в Telegram/Discord
- [ ] Есть резервное копирование конфигов
- [ ] Настроен лог ротейшн

### Мониторинг
- [ ] Метрики PnL отслеживаются
- [ ] Алерты на ошибки срабатывают
- [ ] Метрики задержек (latency) настроены
- [ ] Дашборд Grafana создан

### Документация
- [ ] Инструкция по экстренной остановке
- [ ] Контакты ответственных лиц
- [ ] План действий при инцидентах

---

## Troubleshooting

### Ошибка: `error: package ID specification ... did not match any packages`

**Решение:**
```bash
cd /workspace/contracts
cargo clean
cargo fetch
anchor build
```

### Ошибка: `Error: Account does not exist`

**Причина:** Аккаунт токена не инициализирован

**Решение:**
```typescript
// В коде бота добавьте создание ATA если не существует
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';

await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  tokenMint,
  owner
);
```

### Ошибка: `Error: Program log: Error: Insufficient liquidity`

**Причина:** Недостаточно ликвидности в пуле

**Решение:**
- Уменьшите размер позиции
- Выберите пулы с большей ликвидностью
- Увеличьте порог минимальной ликвидности в конфиге

### Ошибка: `Error: Transaction simulation failed`

**Причина:** Неправильные аккаунты или дискриминаторы

**Решение:**
```bash
# Включите детальное логирование
export RUST_LOG=debug
anchor test --provider.cluster devnet --skip-deploy

# Проверьте дискриминаторы в контракте
grep -n "discriminator" contracts/programs/arb-bot/src/lib.rs
```

### Ошибка: `Error: Custom program error: 0x...`

**Решение:** Расшифруйте ошибку по коду:

```typescript
// Добавьте в бот расшифровку ошибок
const ERROR_CODES = {
  0x1: 'InsufficientProfit',
  0x2: 'InvalidPool',
  0x3: 'SlippageExceeded',
  0x4: 'CircuitBreakerOpen',
  // ... другие коды из контракта
};
```

### Долгая сборка контракта

**Решение:** Используйте кэширование в Docker:

```dockerfile
# Добавьте в Dockerfile
RUN cargo fetch
RUN cargo build --release
```

Или используйте `sccache`:

```bash
cargo install sccache
export RUSTC_WRAPPER=sccache
cargo build
```

### Ошибка CORS при подключении к RPC

**Решение:** Используйте приватный RPC нод:
- Helius (https://helius.dev)
- QuickNode (https://quicknode.com)
- Alchemy (https://alchemy.com)

```bash
# Обновите в .env
RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

---

## Дополнительные ресурсы

- [Anchor Documentation](https://www.anchor-lang.com/docs)
- [Solana Cookbook](https://solanacookbook.com/)
- [Raydium SDK](https://github.com/raydium-io/raydium-sdk)
- [Orca Whirlpool SDK](https://github.com/orca-so/whirlpool)
- [Solana Program Library](https://github.com/solana-labs/solana-program-library)

---

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `tail -f logs/bot.log`
2. Проверьте метрики: `curl http://localhost:9300/metrics`
3. Изучите документацию в `/workspace/docs/`
4. Создайте issue в репозитории

**Удачи в деплое! 🚀**
