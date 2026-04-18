# 🔐 Гайд по конфигурации секретов и окружения

Этот документ содержит **полный список всех значений**, которые необходимо настроить перед запуском бота. 

> ⚠️ **ВАЖНО:** Никогда не коммитьте файлы с реальными секретами в Git! Используйте `.env` файлы (добавлены в `.gitignore`) или менеджеры секретов.

---

## 📋 Оглавление

1. [Быстрый чеклист](#-быстрый-чеклист)
2. [Кошельки и ключи](#-кошельки-и-ключи)
3. [RPC эндпоинты](#-rpc-эндпоинты)
4. [Адреса программ и пулов](#-адреса-программ-и-пулов)
5. [Мониторинг и алерты](#-мониторинг-и-алерты)
6. [Где хранить секреты](#-где-хранить-секреты)
7. [Пошаговая инструкция настройки](#-пошаговая-инструкция-настройки)

---

## ✅ Быстрый чеклист

Перед запуском убедитесь, что заполнены:

| Категория | Файл | Переменная | Статус |
|-----------|------|------------|--------|
| **Wallet** | `bot/.env` | `WALLET_SECRET_KEY` | ❌ |
| **RPC** | `bot/.env` | `SOLANA_RPC_URL` | ❌ |
| **RPC** | `bot/.env` | `SOLANA_WS_URL` | ❌ |
| **Program** | `bot/.env` | `PROGRAM_ID` | ❌ |
| **Pools** | `bot/config/pairs.mainnet.json` | Адреса пулов | ❌ |
| **Telegram** | `bot/.env` | `TELEGRAM_BOT_TOKEN` | ⭕ |
| **Telegram** | `bot/.env` | `TELEGRAM_CHAT_ID` | ⭕ |
| **Discord** | `bot/.env` | `DISCORD_WEBHOOK_URL` | ⭕ |
| **Helius** | `bot/.env` | `HELIUS_API_KEY` | ⭕ |

**Легенда:** ❌ = Критично (без этого не запустится), ⭕ = Опционально (только для мониторинга)

---

## 👛 Кошельки и ключи

### 1. Основной торговый кошелек (`WALLET_SECRET_KEY`)

**Что это:** Приватный ключ кошелька, с которого бот будет совершать сделки.

**Где взять:**
```bash
cd bot
npm run generate-wallet
# Или вручную:
solana-keygen grind --starts-with trade:1
```

**Формат значения:**
- **Вариант A (Base58 строка):** `"5Kt...xyz"` (начинается с цифры/буквы, 32-88 символов)
- **Вариант B (JSON массив):** `[12,45,67,...,234]` (массив из 64 чисел 0-255)

**Куда записать:**
```bash
# Файл: bot/.env
WALLET_SECRET_KEY="5Kt...xyz"  # <-- Вставьте сюда
```

**Требования к кошельку:**
- ✅ Минимум 0.5 SOL для комиссий (devnet)
- ✅ Минимум 2-5 SOL для комиссий (mainnet)
- ✅ Наличие токенов для торговли (или USDC для свопов)
- ✅ Не используйте основной кошелек! Создайте отдельный для бота.

**Пример генерации:**
```bash
# Генерация нового кошелька
solana-keygen new -o ~/trade-wallet.json

# Просмотр публичного ключа
solana-keygen pubkey ~/trade-wallet.json

# Экспорт в Base58 (для .env)
solana-keygen export ~/trade-wallet.json --outfile -
```

---

### 2. Деплой кошелек (`DEPLOYER_SECRET_KEY`)

**Что это:** Кошелек для деплоя смарт-контракта (может совпадать с торговым, но лучше разделить).

**Где взять:** Тот же процесс генерации, что и выше.

**Куда записать:**
```bash
# Файл: contracts/.env (если используется отдельно)
DEPLOYER_SECRET_KEY="9Xx...abc"
```

**Требования:**
- ✅ Минимум 2-3 SOL на балансе (деплой программы стоит ~1.5-2 SOL)
- ✅ Должен быть тем же кошельком, что указан в `Anchor.toml`

---

## 🌐 RPC эндпоинты

### 1. Основной RPC (`SOLANA_RPC_URL`)

**Что это:** HTTP эндпоинт для взаимодействия с Solana блокчейном.

**Варианты:**

| Провайдер | Devnet | Mainnet | Тариф |
|-----------|--------|---------|-------|
| **Public (медленно)** | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` | Бесплатно |
| **Helius** | `https://devnet.helius-rpc.com/?api-key=KEY` | `https://mainnet.helius-rpc.com/?api-key=KEY` | Free/Paid |
| **QuickNode** | `https://xxx-yyy.devnet.discover.quiknode.pro/KEY/` | `https://xxx-yyy.mainnet.discover.quiknode.pro/KEY/` | Paid |
| **Triton** | `https://devnet.rpc.triton.one/KEY` | `https://mainnet.rpc.triton.one/KEY` | Paid |
| **Shyft** | `https://devnet.shyft.to/?api_key=KEY` | `https://mainnet.shyft.to/?api_key=KEY` | Free/Paid |

**Рекомендация для продакшена:** Helius или QuickNode (paid план от $49/мес)

**Куда записать:**
```bash
# Файл: bot/.env
SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
SOLANA_WS_URL="wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
```

### 2. WebSocket RPC (`SOLANA_WS_URL`)

**Что это:** WebSocket эндпоинт для подписки на события в реальном времени.

**Важно:** Должен быть от того же провайдера, что и HTTP RPC.

**Формат:** Замените `https://` на `wss://` в URL основного RPC.

---

### 3. API ключи сторонних сервисов

#### Helius API Key (`HELIUS_API_KEY`)
- **Зачем:** Улучшенные RPC, вебхуки, энричмент транзакций
- **Где взять:** https://helius.dev/dashboard
- **Куда:** `bot/.env` → `HELIUS_API_KEY="xxx-yyy-zzz"`

#### Jupiter API (`JUPITER_API_URL`)
- **Зачем:** Агрегация цен, лучшие маршруты
- **Значение:** `https://quote-api.jup.ag/v6` (публичный, ключ не нужен)
- **Куда:** `bot/.env` → `JUPITER_API_URL="https://quote-api.jup.ag/v6"`

#### Birdeye API (`BIRDEYE_API_KEY`)
- **Зачем:** Данные о токенах, ликвидности, ценах
- **Где взять:** https://birdeye.so/api
- **Куда:** `bot/.env` → `BIRDEYE_API_KEY="xxx"`

---

## 📍 Адреса программ и пулов

### 1. ID вашей программы (`PROGRAM_ID`)

**Что это:** Адрес вашего смарт-контракта после деплоя.

**Где взять:**
```bash
# После деплоя на devnet:
solana program show <PATH_TO_SO> | grep "Program Id"

# Или посмотреть в Anchor.toml после anchor deploy
```

**Формат:** Base58 строка, например: `"ArbBot1234567890abcdefABCDEF1234567890"`

**Куда записать:**
```bash
# Файл: bot/.env
PROGRAM_ID="ArbBot1234567890abcdefABCDEF1234567890"
```

⚠️ **Важно:** Это значение становится известным ТОЛЬКО после деплоя контракта!

---

### 2. Адреса DEX программ

Эти адреса уже прописаны в коде, но полезно знать их:

| DEX | Программа (Mainnet) | Программа (Devnet) |
|-----|---------------------|-------------------|
| **Raydium AMM** | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` | `HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8` |
| **Orca Whirlpool** | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` |
| **Token Program** | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Тот же |
| **Associated Token** | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | Тот же |

---

### 3. Адреса пулов ликвидности (`pairs.mainnet.json`)

**Что это:** Конкретные пулы для арбитража между Raydium и Orca.

**Где найти:**

#### Способ 1: Через скрипт проекта
```bash
cd bot
npm run find-pools -- --dex raydium --token1 SOL --token2 USDC
```

#### Способ 2: Raydium UI
1. Зайдите на https://raydium.io/pools/
2. Выберите пару (например, SOL/USDC)
3. Нажмите на пул → скопируйте адрес из URL или деталей

#### Способ 3: Orca UI
1. Зайдите на https://www.orca.so/pools
2. Выберите пул Whirlpool
3. Скопируйте адрес пула

#### Способ 4: Solscan/SolanaFM
1. Найдите токен (например, SOL)
2. Перейдите во вкладку "Pairs" или "Pools"
3. Отфильтруйте по DEX (Raydium/Orca)

**Формат файла `bot/config/pairs.mainnet.json`:**
```json
[
  {
    "name": "SOL-USDC",
    "tokenMintA": "So11111111111111111111111111111111111111112",
    "tokenMintB": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "raydium": {
      "poolId": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
      "ammAuthority": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
      "baseVault": "H7cQ2xE8vzrVT9dR9aF4xQm3...",
      "quoteVault": "J8dR3yF9wAs4uYn5bG6xZp2..."
    },
    "orca": {
      "poolAddress": "F1cLhBeVckWb6zXh9aK3qT...",
      "whirlpool": "F1cLhBeVckWb6zXh9aK3qT...",
      "tokenVaultA": "K9mN2oP3qR4sT5uV6wX7yZ...",
      "tokenVaultB": "L0nO3pQ4rS5tU6vW7xY8zA..."
    },
    "minLiquidityUsd": 100000,
    "enabled": true
  }
]
```

**Обязательные поля для каждого пула:**
- `raydium.poolId` - Адрес пула на Raydium
- `orca.poolAddress` - Адрес пула на Orca
- `tokenMintA`, `tokenMintB` - Mint адреса токенов
- `enabled: true` - Активировать пул

---

## 📢 Мониторинг и алерты

### 1. Telegram Bot

**Что нужно:**
- `TELEGRAM_BOT_TOKEN` - Токен бота
- `TELEGRAM_CHAT_ID` - ID чата для уведомлений

**Как получить:**

1. **Создать бота:**
   - Напишите @BotFather в Telegram
   - Отправьте `/newbot`
   - Придумайте имя и юзернейм
   - Получите токен: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

2. **Узнать Chat ID:**
   - Добавьте бота в чат/канал
   - Напишите любое сообщение
   - Отправьте @getmyid_bot или посмотрите в веб-версии Telegram
   - Формат: `-1001234567890` (для каналов/групп) или `123456789` (для личных)

**Куда записать:**
```bash
# Файл: bot/.env
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="-1001234567890"
```

---

### 2. Discord Webhook

**Что нужно:**
- `DISCORD_WEBHOOK_URL` - URL вебхука

**Как получить:**
1. Зайдите в настройки канала Discord
2. Перейдите во вкладку "Интеграции" → "Вебхуки"
3. Создайте новый вебхук
4. Скопируйте URL: `https://discord.com/api/webhooks/123456789/ABCdef...`

**Куда записать:**
```bash
# Файл: bot/.env
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/123456789/ABCdef..."
```

---

### 3. Prometheus & Grafana (опционально)

**Что нужно:**
- `METRICS_PORT` - Порт для метрик (по умолчанию 9300)
- Адреса Prometheus/Grafana (если внешние)

**Куда записать:**
```bash
# Файл: bot/.env
METRICS_PORT="9300"
GRAFANA_URL="http://localhost:3000"  # Если используется внешний Grafana
```

---

## 🗄️ Где хранить секреты

### Вариант 1: Локальные `.env` файлы (для разработки)

```bash
bot/
├── .env              # ← Секреты (в .gitignore!)
├── .env.example      # ← Шаблон (можно коммитить)
└── .env.prod         # ← Продакшен секреты
```

**Правила:**
- ✅ `.env` добавлен в `.gitignore`
- ✅ Копируйте `.env.example` в `.env` и заполняйте
- ✅ Используйте разные файлы для dev/prod

---

### Вариант 2: Менеджеры секретов (для продакшена)

#### AWS Secrets Manager
```bash
# Пример получения секрета
aws secretsmanager get-secret-value \
  --secret-id smarttrade-bot-prod \
  --query SecretString --output text > .env
```

#### HashiCorp Vault
```bash
vault kv get -field=wallet_secret secret/smarttrade/bot > WALLET_SECRET_KEY
```

#### Doppler / Railway / Render
- Используйте встроенные UI для управления секретами
- Автоматическая инъекция в окружение

---

### Вариант 3: Docker Secrets

```yaml
# docker-compose.yml
services:
  bot:
    secrets:
      - wallet_key
      - rpc_url

secrets:
  wallet_key:
    file: ./secrets/wallet.txt
  rpc_url:
    file: ./secrets/rpc.txt
```

---

## 📝 Пошаговая инструкция настройки

### Шаг 1: Подготовка кошелька (5 мин)

```bash
# 1. Создать директорию для кошельков
mkdir -p bot/wallets

# 2. Сгенерировать новый кошелек
cd bot
npm run generate-wallet

# 3. Скопировать приватный ключ из вывода
# Пример вывода: Wallet created: 5Kt...xyz

# 4. Пополнить кошелек (devnet)
solana airdrop 2 5Kt...xyz --url devnet

# 5. Проверить баланс
solana balance 5Kt...xyz --url devnet
```

---

### Шаг 2: Настройка RPC (3 мин)

```bash
# 1. Зарегистрироваться на Helius (https://helius.dev)
# 2. Создать новый проект
# 3. Скопировать API ключ
# 4. Создать файл .env

cat > bot/.env << EOF
SOLANA_RPC_URL="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
SOLANA_WS_URL="wss://devnet.helius-rpc.com/?api-key=YOUR_KEY"
HELIUS_API_KEY="YOUR_KEY"
EOF
```

---

### Шаг 3: Создание конфигурации пулов (10 мин)

```bash
# 1. Найти пулы через Solscan или UI
# 2. Заполнить pairs.devnet.json

cat > bot/config/pairs.devnet.json << EOF
[
  {
    "name": "SOL-USDC",
    "tokenMintA": "So11111111111111111111111111111111111111112",
    "tokenMintB": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "raydium": {
      "poolId": "RAYDIUM_POOL_DEVNET_ADDRESS",
      "ammAuthority": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
    },
    "orca": {
      "poolAddress": "ORCA_POOL_DEVNET_ADDRESS"
    },
    "minLiquidityUsd": 10000,
    "enabled": true
  }
]
EOF
```

---

### Шаг 4: Сборка и деплой контракта (15 мин)

```bash
# См. docs/DEPLOYMENT_GUIDE.md для деталей

cd contracts
anchor build
anchor deploy

# Скопировать PROGRAM_ID из вывода
echo "PROGRAM_ID=\"COPIED_PROGRAM_ID\"" >> ../bot/.env
```

---

### Шаг 5: Настройка мониторинга (5 мин)

```bash
# 1. Создать Telegram бота (см. выше)
# 2. Добавить в .env

cat >> bot/.env << EOF
TELEGRAM_BOT_TOKEN="123456:ABCdef..."
TELEGRAM_CHAT_ID="-1001234567890"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
EOF
```

---

### Шаг 6: Валидация конфигурации (2 мин)

```bash
cd bot
npm run validate-env

# Проверить вывод на ошибки
# Все проверки должны быть ✅
```

---

### Шаг 7: Первый запуск (testnet/devnet)

```bash
cd bot
npm install
npm run start:dev

# Следить за логами:
# - Подключение к RPC
# - Загрузка пулов
# - Поиск возможностей
# - Ошибки (если есть)
```

---

## 🔍 Чеклист перед mainnet

Перед запуском на mainnet проверьте:

- [ ] Кошелек пополнен (минимум 5 SOL)
- [ ] Используется paid RPC (не public)
- [ ] PROGRAM_ID скопирован после деплоя на mainnet
- [ ] Адреса пулов актуальны для mainnet
- [ ] Телеграм/Discord алерты работают
- [ ] CircuitBreaker настроен (лимиты убытков)
- [ ] Запущен на devnet минимум 24 часа без ошибок
- [ ] Проведен бэктест на исторических данных
- [ ] Приватные ключи не закоммичены в Git
- [ ] Есть план экстренной остановки (kill switch)

---

## 🆘 Troubleshooting

### Ошибка: "Invalid wallet secret key"
**Решение:** Проверьте формат ключа. Должен быть Base58 строкой или JSON массивом из 64 чисел.

### Ошибка: "RPC rate limit exceeded"
**Решение:** Перейдите на paid тариф RPC или уменьшите частоту опроса в конфиге.

### Ошибка: "Program not found"
**Решение:** Проверьте `PROGRAM_ID` в `.env`. Убедитесь, что контракт задеплоен в эту сеть.

### Ошибка: "Insufficient funds"
**Решение:** Пополните кошелек SOL для комиссий.

---

## 📞 Полезные ссылки

- [Solana CLI Documentation](https://docs.solana.com/cli)
- [Anchor Framework Docs](https://www.anchor-lang.com/docs)
- [Helius Documentation](https://docs.helius.dev)
- [Raydium SDK](https://github.com/raydium-io/raydium-sdk)
- [Orca Whirlpool SDK](https://orca-so.github.io/whirlpool/)

---

**Последнее обновление:** Декабрь 2024  
**Версия документа:** 1.0
