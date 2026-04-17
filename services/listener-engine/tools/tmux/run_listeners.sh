#!/usr/bin/env bash
#
# Launch a tmux session with 5 listeners + 1 Redis monitor
# Session name: listeners
set -euo pipefail

# Resolve project root (three levels up from this script)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SESSION="listeners"

# Function to create a header banner
create_header() {
    local chain_name="$1"
    local chain_full="$2"
    local color="$3"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  🔗 $chain_full Listener ($chain_name)                                    ║"
    echo "║  Started: $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
}

# Get current timestamp (macOS compatible)
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Commands for each chain with headers and unique ports to avoid conflicts
CMD_ETH="cd \"$ROOT_DIR\" && clear && echo -e '\033[0;36m' && echo '╔════════════════════════════════════════════════════════════════╗' && echo '║  🔗 Ethereum Listener (ETH)                                    ║' && echo \"║  Started: $TIMESTAMP                                    ║\" && echo '╚════════════════════════════════════════════════════════════════╝' && echo -e '\033[0m' && PORT=3003 CHAIN=eth npm run start:dev -w listener-engine"

CMD_BNB="cd \"$ROOT_DIR\" && clear && echo -e '\033[0;33m' && echo '╔════════════════════════════════════════════════════════════════╗' && echo '║  🔗 Binance Smart Chain Listener (BSC)                        ║' && echo \"║  Started: $TIMESTAMP                                    ║\" && echo '╚════════════════════════════════════════════════════════════════╝' && echo -e '\033[0m' && PORT=3004 CHAIN=bnb npm run start:dev -w listener-engine"

CMD_POLY="cd \"$ROOT_DIR\" && clear && echo -e '\033[0;35m' && echo '╔════════════════════════════════════════════════════════════════╗' && echo '║  🔗 Polygon Listener (POLY)                                    ║' && echo \"║  Started: $TIMESTAMP                                    ║\" && echo '╚════════════════════════════════════════════════════════════════╝' && echo -e '\033[0m' && PORT=3005 CHAIN=poly npm run start:dev -w listener-engine"

CMD_SOL="cd \"$ROOT_DIR\" && clear && echo -e '\033[0;32m' && echo '╔════════════════════════════════════════════════════════════════╗' && echo '║  🔗 Solana Listener (SOL)                                     ║' && echo \"║  Started: $TIMESTAMP                                    ║\" && echo '╚════════════════════════════════════════════════════════════════╝' && echo -e '\033[0m' && PORT=3006 CHAIN=sol npm run start:dev -w listener-engine"

CMD_TRC="cd \"$ROOT_DIR\" && clear && echo -e '\033[0;31m' && echo '╔════════════════════════════════════════════════════════════════╗' && echo '║  🔗 Tron Listener (TRC)                                      ║' && echo \"║  Started: $TIMESTAMP                                    ║\" && echo '╚════════════════════════════════════════════════════════════════╝' && echo -e '\033[0m' && PORT=3007 CHAIN=trc npm run start:dev -w listener-engine"

CMD_REDIS="cd \"$ROOT_DIR\" && ./services/listener-engine/tools/tmux/redis-monitor.sh"

# Kill existing session if present
tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION"

# Create new session
tmux new-session -d -s "$SESSION" -n chains

# Configure pane borders to show titles prominently
tmux set -g pane-border-format "#[fg=colour45,bold] #{pane_index} │ #{pane_title} #[fg=default]"
tmux set -g pane-active-border-style "fg=colour45,bg=default"

# Pane 1: ETH
tmux send-keys -t "$SESSION":0.0 "$CMD_ETH" C-m
tmux select-pane -t "$SESSION":0.0 -T "🔗 ETHEREUM"

# Pane 2: BSC
tmux split-window -h -t "$SESSION":0.0
tmux send-keys -t "$SESSION":0.1 "$CMD_BNB" C-m
tmux select-pane -t "$SESSION":0.1 -T "🔗 BINANCE SC"

# Pane 3: POLY
tmux split-window -h -t "$SESSION":0.1
tmux send-keys -t "$SESSION":0.2 "$CMD_POLY" C-m
tmux select-pane -t "$SESSION":0.2 -T "🔗 POLYGON"

# Pane 4: SOL (split from POLY pane 0.2)
tmux split-window -h -t "$SESSION":0.2
sleep 0.2  # Small delay to ensure pane is created
tmux send-keys -t "$SESSION":0.3 "$CMD_SOL" C-m
tmux select-pane -t "$SESSION":0.3 -T "🔗 SOLANA"

# Pane 5: TRC (split from SOL pane 0.3)
tmux split-window -h -t "$SESSION":0.3
sleep 0.2  # Small delay to ensure pane is created
tmux send-keys -t "$SESSION":0.4 "$CMD_TRC" C-m
tmux select-pane -t "$SESSION":0.4 -T "🔗 TRON"

# Pane 6: Redis monitor
tmux split-window -h -t "$SESSION":0.4
tmux send-keys -t "$SESSION":0.5 "$CMD_REDIS" C-m
tmux select-pane -t "$SESSION":0.5 -T "📊 REDIS"

# Tile layout for readability
tmux select-layout -t "$SESSION":0 tiled

# Focus first pane by default
tmux select-pane -t "$SESSION":0.0

echo "✅ Tmux session '$SESSION' started with visual headers"
echo "📋 Attach with: tmux attach -t $SESSION"
echo "💡 Each pane now has a clear header showing the chain name"


