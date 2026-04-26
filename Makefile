     1	#!/bin/bash
     2	# Makefile для Docker-операций (альтернатива Makefile.docker)
     3	# Использование: make build-contracts-docker, make deploy-docker
     4	
     5	.PHONY: help build-contracts-docker generate-idl-docker deploy-docker-docker clean-docker
     6	
     7	help:
     8		@echo "=== Docker Build & Deploy Commands ==="
     9		@echo "make build-contracts-docker   - Собрать смарт-контракт в Docker"
    10		@echo "make generate-idl-docker      - Сгенерировать IDL после сборки"
    11		@echo "make deploy-docker            - Задеплоить контракт на devnet (требует SOLANA_KEYPAIR)"
    12		@echo "make clean-docker             - Очистить Docker артефакты"
    13		@echo ""
    14		@echo "Примеры:"
    15		@echo "  make build-contracts-docker"
    16		@echo "  make generate-idl-docker"
    17		@echo "  SOLANA_KEYPAIR=~/.config/solana/id.json make deploy-docker"
    18	
    19	build-contracts-docker:
    20		@echo "🔨 Building smart contract in Docker..."
    21		docker-compose -f docker/docker-compose.build.yml build contract-builder
    22		docker-compose -f docker/docker-compose.build.yml up --rm contract-builder
    23		@echo "✅ Build complete! Check contracts/target/ for artifacts"
    24	
    25	generate-idl-docker:
    26		@echo "📄 Generating IDL..."
    27		@echo "⚠️  Make sure to run 'make build-contracts-docker' first!"
    28		mkdir -p bot/idl
    29		docker-compose -f docker/docker-compose.build.yml up --rm idl-generator
    30		@echo "✅ IDL generated! Check bot/idl/arb_bot.json"
    31	
    32	deploy-docker:
    33		@echo "🚀 Deploying to devnet..."
    34		@if [ -z "$(SOLANA_KEYPAIR)" ]; then \
    35			echo "❌ Error: SOLANA_KEYPAIR not set!"; \
    36			echo "Usage: SOLANA_KEYPAIR=/path/to/keypair.json make deploy-docker"; \
    37			exit 1; \
    38		fi
    39		docker-compose -f docker/docker-compose.build.yml --profile deploy up --rm deployer
    40		@echo "✅ Deployment complete!"
    41	
    42	clean-docker:
    43		@echo "🧹 Cleaning Docker artifacts..."
    44		docker-compose -f docker/docker-compose.build.yml down -v
    45		docker system prune -f
    46		@echo "✅ Clean complete!"
    47	
    48	# Команды для бота (если нужно)
    49	build-bot-docker:
    50		@echo "🤖 Building bot in Docker..."
    51		docker build -f docker/Dockerfile.bot -t arb-bot .
    52		@echo "✅ Bot built!"
    53	
    54	run-bot-docker:
    55		@echo "🏃 Running bot in Docker..."
    56		docker-compose -f docker/docker-compose.prod.yml up -d
    57		@echo "✅ Bot running! Check logs with: docker-compose -f docker/docker-compose.prod.yml logs -f"
    58	
    59	stop-bot-docker:
    60		@echo "🛑 Stopping bot..."
    61		docker-compose -f docker/docker-compose.prod.yml down
    62		@echo "✅ Bot stopped!"
    63	
