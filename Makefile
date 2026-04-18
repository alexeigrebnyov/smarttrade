SHELL := /bin/bash
.PHONY: help build-contracts deploy-devnet bot-install bot-build bot-start idl backtest
help:
	@echo "Targets:"
	@echo "  make build-contracts   - Anchor build"
	@echo "  make deploy-devnet     - Deploy contract to Devnet and update .env"
	@echo "  make bot-install       - npm install in bot/"
	@echo "  make bot-build         - tsc build bot"
	@echo "  make bot-start         - start bot (dev)"
	@echo "  make idl               - copy IDL to bot/idl"
	@echo "  make backtest          - run CLI backtester on sample CSV"
build-contracts:
	cd contracts && anchor build
deploy-devnet:
	bash deployments/deploy-contracts.sh
bot-install:
	cd bot && npm ci
bot-build:
	cd bot && npm run build
idl:
	cd bot && npm run idl
bot-start:
	cd bot && npm run start:dev
backtest:
	python3 backtest_cli.py --csv data/devnet_prices_sample.csv --out-prefix out/backtest
