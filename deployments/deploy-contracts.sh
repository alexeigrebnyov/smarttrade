#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cd contracts
anchor build
anchor deploy --provider.cluster devnet
PID=$(anchor keys list | grep arb-bot | awk '{print $2}')
cd ..
if ! grep -q '^PROGRAM_ID=' .env; then echo "PROGRAM_ID=$PID" >> .env; else sed -i "s/^PROGRAM_ID=.*/PROGRAM_ID=$PID/" .env; fi
if ! grep -q '^PROGRAM_ID=' .env.prod; then echo "PROGRAM_ID=$PID" >> .env.prod; else sed -i "s/^PROGRAM_ID=.*/PROGRAM_ID=$PID/" .env.prod; fi
echo "Deployed Program ID: $PID"
