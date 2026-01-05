#!/usr/bin/env bash
#
# Test script to run all listeners without tmux
# Useful for testing before setting up tmux
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Testing Listener Engine Setup"
echo "=================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found"
  exit 1
fi
echo "✅ Node.js: $(node -v)"

if ! command -v npm &> /dev/null; then
  echo "❌ npm not found"
  exit 1
fi
echo "✅ npm: $(npm -v)"

if ! command -v redis-cli &> /dev/null; then
  echo "⚠️  redis-cli not found (Redis monitoring won't work)"
else
  echo "✅ redis-cli available"
fi

if [ ! -f "services/listener-engine/.env" ]; then
  echo "❌ .env file missing. Creating from .env.example..."
  cp services/listener-engine/.env.example services/listener-engine/.env
  echo "⚠️  Please update services/listener-engine/.env with your RPC URLs"
fi
echo "✅ .env file exists"

echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Run: npm install"
  exit 1
fi
echo "✅ Dependencies installed"

echo ""
echo "🧪 Testing listener startup (5 second test)..."
echo ""

# Test ETH listener startup
echo "Testing ETH listener..."
CHAIN=eth npm run start:dev -w listener-engine &
ETH_PID=$!
sleep 5
if kill -0 $ETH_PID 2>/dev/null; then
  echo "✅ ETH listener started successfully"
  kill $ETH_PID 2>/dev/null || true
else
  echo "❌ ETH listener failed to start"
  exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "To run all listeners with tmux:"
echo "  1. Install tmux: brew install tmux"
echo "  2. Run: services/listener-engine/tools/tmux/run_listeners.sh"
echo ""
echo "To run without tmux (in separate terminals):"
echo "  Terminal 1: CHAIN=eth npm run start:dev -w listener-engine"
echo "  Terminal 2: CHAIN=bnb npm run start:dev -w listener-engine"
echo "  Terminal 3: CHAIN=poly npm run start:dev -w listener-engine"
echo "  Terminal 4: CHAIN=sol npm run start:dev -w listener-engine"
echo "  Terminal 5: CHAIN=trc npm run start:dev -w listener-engine"
echo "  Terminal 6: redis-cli monitor"

