#!/bin/bash
# ─── Soroban Testnet Deployment Script ────────────────────────────────────────
set -e

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

echo "🚀 Building contracts..."
cargo build --target wasm32-unknown-unknown --release

echo "📦 Optimizing WASM..."
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/escrow.wasm
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/dispute_resolution.wasm
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/escrow_factory.wasm

echo "🔑 Setting up identity..."
soroban keys generate --global deployer --network $NETWORK || true
DEPLOYER=$(soroban keys address deployer)
echo "Deployer: $DEPLOYER"

echo "💰 Funding account on testnet..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER" > /dev/null

echo "📤 Uploading WASM files..."
ESCROW_WASM_HASH=$(soroban contract upload \
  --network $NETWORK \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/escrow.optimized.wasm)
echo "Escrow WASM Hash: $ESCROW_WASM_HASH"

DISPUTE_WASM_HASH=$(soroban contract upload \
  --network $NETWORK \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/dispute_resolution.optimized.wasm)
echo "Dispute WASM Hash: $DISPUTE_WASM_HASH"

FACTORY_WASM_HASH=$(soroban contract upload \
  --network $NETWORK \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/escrow_factory.optimized.wasm)
echo "Factory WASM Hash: $FACTORY_WASM_HASH"

echo "🏗️  Deploying DisputeResolution contract..."
DISPUTE_CONTRACT_ID=$(soroban contract deploy \
  --network $NETWORK \
  --source deployer \
  --wasm-hash $DISPUTE_WASM_HASH)
echo "DisputeResolution Contract ID: $DISPUTE_CONTRACT_ID"

echo "🔧 Initializing DisputeResolution..."
soroban contract invoke \
  --network $NETWORK \
  --source deployer \
  --id $DISPUTE_CONTRACT_ID \
  -- initialize \
  --admin $DEPLOYER

echo "🏗️  Deploying EscrowFactory contract..."
FACTORY_CONTRACT_ID=$(soroban contract deploy \
  --network $NETWORK \
  --source deployer \
  --wasm-hash $FACTORY_WASM_HASH)
echo "EscrowFactory Contract ID: $FACTORY_CONTRACT_ID"

echo "🔧 Initializing EscrowFactory..."
soroban contract invoke \
  --network $NETWORK \
  --source deployer \
  --id $FACTORY_CONTRACT_ID \
  -- initialize \
  --admin $DEPLOYER \
  --escrow-wasm-hash $ESCROW_WASM_HASH

# Use native XLM token on testnet
NATIVE_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

echo "✅ Deployment complete!"
echo ""
echo "─── Contract IDs ───────────────────────────────────────"
echo "VITE_DISPUTE_CONTRACT_ID=$DISPUTE_CONTRACT_ID"
echo "VITE_FACTORY_CONTRACT_ID=$FACTORY_CONTRACT_ID"
echo "VITE_TOKEN_ADDRESS=$NATIVE_TOKEN"
echo "VITE_NETWORK=testnet"
echo "VITE_RPC_URL=$RPC_URL"
echo "VITE_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE"
echo "────────────────────────────────────────────────────────"
echo ""
echo "📝 Copy the above into frontend/.env"

# Write .env file
cat > frontend/.env << EOF
VITE_DISPUTE_CONTRACT_ID=$DISPUTE_CONTRACT_ID
VITE_FACTORY_CONTRACT_ID=$FACTORY_CONTRACT_ID
VITE_TOKEN_ADDRESS=$NATIVE_TOKEN
VITE_NETWORK=testnet
VITE_RPC_URL=$RPC_URL
VITE_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE
EOF

echo "✅ frontend/.env written!"
