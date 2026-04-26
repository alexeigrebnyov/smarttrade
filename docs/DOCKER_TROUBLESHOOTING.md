Этот документ содержит решения частых ошибок при деплое в Docker.

---

## ❓ Частые вопросы и решения

### 1. Ошибка: `Cargo.toml not found in /contracts`

**Проблема:**
```
error: failed to parse manifest at `/workspace/contracts/Cargo.toml`
Caused by:
  could not find `Cargo.toml` in `/workspace/contracts` or any parent directory
```

**Причина:** В проекте Anchor файл `Cargo.toml` находится в `contracts/programs/arb-bot/Cargo.toml`, а не в корне `contracts/`.

**Решение:** ✅ **Не перемещайте Cargo.toml!** Используйте правильную структуру:

```
contracts/
├── Anchor.toml          # ← Главный конфиг (в корне)
└── programs/
    └── arb-bot/
        └── Cargo.toml   # ← Rust конфиг (здесь и должен быть)
```

Наши Docker файлы уже настроены правильно:

```dockerfile
# docker/Dockerfile
COPY Desktop/My/GPTChats/Смарттрейд/smarttrade-starter-kit/contracts/Anchor.toml ./Anchor.toml
COPY Desktop/My/GPTChats/Смарттрейд/smarttrade-starter-kit/contracts/programs ./programs/
```

---

### 2. Ошибка: `Cargo.lock not found`

**Проблема:**
```
error: failed to load manifest for workspace member `/workspace/contracts`
Caused by:
  failed to read `/workspace/contracts/Cargo.lock`
```

**Причина:** `Cargo.lock` создается автоматически при первой сборке.

**Решение:** Не нужно создавать вручную! Просто запустите сборку:

```bash
# Вариант А: Через docker-compose
docker-compose -f docker/docker-compose.build.yml up --rm contract-builder

# Вариант Б: Через make
make -f docker/Makefile build-contracts-docker

# Вариант В: Если хотите предзаполнить локально
cd contracts/programs/arb-bot
cargo generate-lockfile
```

После первой сборки `Cargo.lock` появится в `contracts/programs/arb-bot/`.

---

### 3. Ошибка: `anchor: command not found` в Docker

**Проблема:**
```
/bin/sh: 1: anchor: not found
```

**Причина:** Неправильный базовый образ или PATH.

**Решение:** Используйте официальный образ Anchor:

```dockerfile
FROM ghcr.io/coral-xyz/anchor:v0.30.1
```

Наш `Dockerfile.contracts` уже использует правильный образ.

---

### 4. Ошибка: `failed to download solana CLI`

**Проблема:**
```
curl: (6) Could not resolve host: release.anza.xyz
```

**Причина:** Проблемы с DNS в Docker контейнере.

**Решение:**

**Вариант А:** Добавьте DNS в docker-compose:
```yaml
# docker/docker-compose.build.yml
services:
  contract-builder:
    dns:
      - 8.8.8.8
      - 1.1.1.1
```

**Вариант Б:** Запустите с флагом `--dns`:
```bash
docker run --dns 8.8.8.8 --dns 1.1.1.1 ...
```

**Вариант В:** Проверьте `/etc/resolv.conf` на хосте.

---

### 5. Ошибка: `permission denied` при монтировании томов

**Проблема:**
```
Error response from daemon: error while creating mount source path '/workspace/contracts/target': mkdir /workspace/contracts/target: permission denied
```

**Причина:** Docker не имеет прав на создание директории.

**Решение:**

```bash
# Создайте директорию заранее
mkdir -p contracts/target bot/idl

# Или измените права
chmod 777 contracts/target bot/idl

# Или используйте именованные тома в docker-compose
```

---

### 6. Ошибка: `IDL generation failed: .so file not found`

**Проблема:**
```
Error: Contract .so file not found. Make sure contract-builder completed successfully.
```

**Причина:** Сборка контракта не завершилась успешно.

**Решение:**

1. Проверьте логи сборки:
```bash
docker-compose -f docker/docker-compose.build.yml logs contract-builder
```

2. Убедитесь, что `contracts/target/deploy/arb_bot.so` существует:
```bash
ls -la contracts/target/deploy/
```

3. Если файла нет, пересоберите:
```bash
make -f docker/Makefile clean-docker
make -f docker/Makefile build-contracts-docker
```

---

### 7. Ошибка: `deployer failed: keypair not found`

**Проблема:**
```
Error: Keypair file not found: /root/.config/solana/id.json
```

**Причина:** Файл кошелька не смонтирован в контейнер.

**Решение:**

```bash
# Укажите путь к кошельку
export SOLANA_KEYPAIR=/absolute/path/to/your/keypair.json

# Запустите с переменной окружения
SOLANA_KEYPAIR=$SOLANA_KEYPAIR \
  docker-compose -f docker/docker-compose.build.yml --profile deploy up --rm deployer
```

Или обновите `docker-compose.build.yml`:
```yaml
deployer:
  volumes:
    - ${SOLANA_KEYPAIR}:/root/.config/solana/id.json:ro
```

---

### 8. Ошибка: `insufficient funds for transaction fee`

**Проблема:**
```
Error: Account does not have enough SOL for transaction fees
```

**Причина:** На кошельке недостаточно SOL для оплаты комиссий.

**Решение:**

**Для devnet:**
```bash
# Получите бесплатные SOL
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

**Для mainnet:**
- Пополните кошелёк через биржу
- Минимум 0.1 SOL для деплоя + резерв на транзакции

---

### 9. Ошибка: `Docker build failed: COPY failed: file not found`

**Проблема:**
```
ERROR [build 3/5] COPY contracts/Anchor.toml ./Anchor.toml: COPY failed: file not found in build context
```

**Причина:** Неправильный контекст сборки или путь.

**Решение:**

Убедитесь, что запускаете из корня проекта:
```bash
cd /workspace
docker build -f docker/Dockerfile -t arb-contract-builder .
#                                                        ↑ Обратите внимание на точку
```

Или в docker-compose:
```yaml
contract-builder:
  build:
    context: ..  # ← Родительская директория относительно docker/
    dockerfile: docker/Dockerfile
```

---

### 10. Ошибка: `container exited with code 101`

**Проблема:**
```
contract-builder exited with code 101
```

**Причина:** Ошибка компиляции Rust (код 101 = panic).

**Решение:**

1. Посмотрите полные логи:
```bash
docker-compose -f docker/docker-compose.build.yml logs --tail=100 contract-builder
```

2. Частые причины:
   - Несовместимость версий Rust (нужен 1.76+)
   - Ошибки в коде контракта
   - Нехватка памяти (увеличьте лимит Docker)

3. Попробуйте собрать локально для отладки:
```bash
cd contracts
anchor build
```

---

## 🔧 Полезные команды для отладки

### Просмотр логов
```bash
# Последние логи
docker-compose -f docker/docker-compose.build.yml logs

# Логи конкретного сервиса
docker-compose -f docker/docker-compose.build.yml logs contract-builder

# Follow режим
docker-compose -f docker/docker-compose.build.yml logs -f
```

### Проверка артефактов
```bash
# Проверить target директорию
ls -R contracts/target/

# Проверить IDL
cat bot/idl/arb_bot.json | head -50
```

### Очистка и пересборка
```bash
# Очистить Docker
make -f docker/Makefile clean-docker

# Удалить target
rm -rf contracts/target

# Пересобрать
make -f docker/Makefile build-contracts-docker
```

### Вход в контейнер для отладки
```bash
# Запустить интерактивный контейнер
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  ghcr.io/coral-xyz/anchor:v0.30.1 \
  bash

# Внутри контейнера:
cd contracts
anchor build
```

---

## 📊 Контрольный чеклист перед деплоем

- [ ] `contracts/Anchor.toml` существует
- [ ] `contracts/programs/arb-bot/Cargo.toml` существует
- [ ] `contracts/programs/arb-bot/src/lib.rs` существует
- [ ] Директория `contracts/target` создана (или будет создана при сборке)
- [ ] Директория `bot/idl` существует
- [ ] Docker установлен (`docker --version`)
- [ ] Docker Compose установлен (`docker compose version`)
- [ ] Достаточно места на диске (`df -h`, нужно ~2GB)
- [ ] Кошелёк создан и имеет SOL
- [ ] Переменная `SOLANA_KEYPAIR` установлена

---

## 🆘 Всё ещё проблемы?

1. **Проверьте версию Docker:**
   ```bash
   docker --version  # Должно быть 20.10+
   docker compose version  # Должно быть 2.0+
   ```

2. **Перезапустите Docker демон:**
   ```bash
   sudo systemctl restart docker
   ```

3. **Очистите кэш Docker:**
   ```bash
   docker system prune -a --volumes
   ```

4. **Попробуйте альтернативный метод:**
   - Если не работает docker-compose, попробуйте прямой `docker build`
   - Если не работает Docker, попробуйте локальную установку (см. DEPLOYMENT_GUIDE.md)

5. **Создайте issue** с полными логами ошибки.

---

**Удачи! 🚀**