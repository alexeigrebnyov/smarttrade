# Multi-stage build for Solana/Anchor Smart Contract
# Использование: docker build -f docker/Dockerfile.contracts -t arb-contract-builder .

# --- Stage 1: Build the Smart Contract ---
FROM ghcr.io/coral-xyz/anchor:v0.30.1 as builder

WORKDIR /build

# Copy project files
# Важно: Копируем структуру contracts целиком
COPY contracts/Anchor.toml ./Anchor.toml
COPY contracts/programs/ ./programs/

# Инициализация git (требуется некоторыми версиями anchor)
RUN git init || true

# Сборка контракта
# Это создаст target/deploy и target/idl
RUN anchor build --verifiable

# --- Stage 2: Runtime (для проверки артефактов) ---
FROM ubuntu:22.04 as runtime

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Установка Solana CLI (версия должна соответствовать anchor)
RUN sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.22/install)" \
    && echo "$HOME/.local/share/solana/install/active_release/bin" >> /etc/profile.d/solana.sh \
    && export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

WORKDIR /app

# Копирование артефактов из builder
COPY --from=builder /build/target/deploy/*.so ./target/deploy/
COPY --from=builder /build/target/idl/*.json ./target/idl/
COPY --from=builder /build/target/verifiable/*.so ./target/verifiable/

# Команда для проверки деплоя или запуска solana команд
CMD ["bash", "-c", "echo 'Build successful. Artifacts available in /app/target' && ls -R /app/target"]