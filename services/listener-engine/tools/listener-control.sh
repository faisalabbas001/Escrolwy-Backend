#!/usr/bin/env bash
#
# Listener Control Script
# Start/Stop/Status commands for blockchain listeners
#
# Usage:
#   ./listener-control.sh start    # Start all listeners in tmux
#   ./listener-control.sh stop     # Stop all listeners
#   ./listener-control.sh restart  # Restart all listeners
#   ./listener-control.sh status   # Show listener status
#   ./listener-control.sh attach   # Attach to tmux session
#   ./listener-control.sh logs     # Show logs from database

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TMUX_SESSION="listeners"
RUN_SCRIPT="$SCRIPT_DIR/tmux/run_listeners.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_status() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

function print_error() {
    echo -e "${RED}❌${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function start_listeners() {
    print_status "Starting blockchain listeners..."
    
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_warning "Tmux session '$TMUX_SESSION' already exists!"
        echo "  Use 'stop' first, or 'attach' to view existing session"
        return 1
    fi
    
    if [ ! -f "$RUN_SCRIPT" ]; then
        print_error "Tmux run script not found: $RUN_SCRIPT"
        return 1
    fi
    
    cd "$ROOT_DIR"
    bash "$RUN_SCRIPT"
    
    sleep 2
    
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_success "Listeners started in tmux session '$TMUX_SESSION'"
        echo ""
        echo "To view logs:"
        echo "  tmux attach -t $TMUX_SESSION"
        echo "  Or run: ./listener-control.sh attach"
    else
        print_error "Failed to start tmux session"
        return 1
    fi
}

function stop_listeners() {
    print_status "Stopping blockchain listeners..."
    
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_warning "Tmux session '$TMUX_SESSION' not found. Nothing to stop."
        return 0
    fi
    
    # Send Ctrl+C to all panes
    print_status "Sending stop signal to all listeners..."
    for pane in $(tmux list-panes -t "$TMUX_SESSION" -F "#{pane_index}"); do
        tmux send-keys -t "$TMUX_SESSION":0.$pane C-c 2>/dev/null || true
    done
    
    sleep 2
    
    # Kill the session
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    
    print_success "All listeners stopped"
}

function restart_listeners() {
    print_status "Restarting blockchain listeners..."
    stop_listeners
    sleep 1
    start_listeners
}

function show_status() {
    print_status "Listener Status:"
    echo ""
    
    # Check tmux session
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_success "Tmux session '$TMUX_SESSION' is running"
        echo ""
        echo "Active panes:"
        tmux list-panes -t "$TMUX_SESSION" -F "  ${GREEN}●${NC} Pane #{pane_index}: #{pane_title}"
    else
        print_warning "Tmux session '$TMUX_SESSION' is not running"
    fi
    
    echo ""
    
    # Check database status
    if command -v psql >/dev/null 2>&1; then
        export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
        if psql -U escrowly_dev -d escrowly -c "SELECT 1" >/dev/null 2>&1; then
            print_success "Database connection: OK"
            echo ""
            echo "Last processed blocks:"
            psql -U escrowly_dev -d escrowly -c "SELECT chain, last_processed_block, updated_at FROM listener_engine_db.listener_state ORDER BY chain;" 2>/dev/null || print_warning "Could not query database"
        else
            print_warning "Database connection: Failed"
        fi
    else
        print_warning "psql not found - cannot check database"
    fi
    
    echo ""
    
    # Check Redis
    if redis-cli -a escrowly_redis_password ping >/dev/null 2>&1; then
        print_success "Redis connection: OK"
    elif docker ps | grep -q escrowly-redis; then
        print_warning "Redis container running but connection failed"
    else
        print_warning "Redis: Not running"
    fi
}

function attach_to_session() {
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_error "Tmux session '$TMUX_SESSION' not found"
        echo "  Start listeners first: ./listener-control.sh start"
        return 1
    fi
    
    print_status "Attaching to tmux session '$TMUX_SESSION'..."
    echo "  Press Ctrl+B then D to detach (session will continue running)"
    echo ""
    tmux attach -t "$TMUX_SESSION"
}

function show_logs() {
    print_status "Recent listener activity from database:"
    echo ""
    
    if ! command -v psql >/dev/null 2>&1; then
        print_error "psql not found"
        return 1
    fi
    
    export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
    
    psql -U escrowly_dev -d escrowly << 'EOF'
SELECT 
    chain,
    last_processed_block,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at))::int as seconds_ago
FROM listener_engine_db.listener_state
ORDER BY chain;
EOF
}

# Main command handler
case "${1:-}" in
    start)
        start_listeners
        ;;
    stop)
        stop_listeners
        ;;
    restart)
        restart_listeners
        ;;
    status)
        show_status
        ;;
    attach)
        attach_to_session
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Listener Control Script"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|attach|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all listeners in tmux session"
        echo "  stop    - Stop all listeners and kill tmux session"
        echo "  restart - Stop and start listeners"
        echo "  status  - Show current status of listeners"
        echo "  attach  - Attach to tmux session to view logs"
        echo "  logs    - Show recent activity from database"
        echo ""
        exit 1
        ;;
esac

