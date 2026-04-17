#!/usr/bin/env bash
#
# Enhanced Redis Monitor for Listener Engine
# Shows formatted, readable event data and queue statistics
#

clear
echo -e '\033[0;34m'
echo '╔════════════════════════════════════════════════════════════════╗'
echo '║  📊 Redis Queue Monitor - Formatted Event Viewer              ║'
echo '║  Started: '"$(date '+%Y-%m-%d %H:%M:%S')"'                                    ║'
echo '╚════════════════════════════════════════════════════════════════╝'
echo -e '\033[0m'
echo ''

# Redis password
REDIS_PASS="escrowly_redis_password"

# Function to get queue length
get_queue_len() {
  local queue="$1"
  redis-cli -a "$REDIS_PASS" LLEN "$queue" 2>/dev/null | grep -v "Warning\|AUTH" || echo "0"
}

# Function to extract chain and block from JSON
extract_chain_block() {
  local json="$1"
  
  # Try using jq if available
  if command -v jq >/dev/null 2>&1; then
    chain=$(echo "$json" | jq -r '.chain' 2>/dev/null | tr '[:lower:]' '[:upper:]')
    block=$(echo "$json" | jq -r '.blockNumber' 2>/dev/null)
    echo "${chain}|${block}"
  else
    # Fallback: simple extraction
    chain=$(echo "$json" | grep -o '"chain":"[^"]*"' | cut -d'"' -f4 | tr '[:lower:]' '[:upper:]')
    block=$(echo "$json" | grep -o '"blockNumber":[0-9]*' | cut -d':' -f2)
    echo "${chain}|${block}"
  fi
}

# Function to process new events and display grouped by block
process_new_events() {
  local queue="$1"
  local prev_count="$2"
  local curr_count="$3"
  
  if [ "$curr_count" -le "$prev_count" ]; then
    return
  fi
  
  # Collect all chain|block pairs from new events
  local temp_file=$(mktemp)
  for i in $(seq $((prev_count + 1)) $curr_count); do
    json=$(redis-cli -a "$REDIS_PASS" LINDEX "$queue" $((i - 1)) 2>/dev/null | grep -v "Warning\|AUTH")
    if [ -n "$json" ]; then
      chain_block=$(extract_chain_block "$json")
      if [ -n "$chain_block" ] && [ "$chain_block" != "|" ] && [ "$chain_block" != "null|null" ]; then
        echo "$chain_block" >> "$temp_file"
      fi
    fi
  done
  
  # Group by block and count, then display
  if [ -s "$temp_file" ]; then
    sort "$temp_file" | uniq -c | while read count chain_block; do
      chain=$(echo "$chain_block" | cut -d'|' -f1)
      block=$(echo "$chain_block" | cut -d'|' -f2)
      if [ -n "$chain" ] && [ -n "$block" ] && [ "$chain" != "null" ] && [ "$block" != "null" ]; then
        plural=""
        [ "$count" -gt 1 ] && plural="s"
        echo "📤 $chain | Block $block | $count event$plural | $(date '+%H:%M:%S')"
      fi
    done
  fi
  
  rm -f "$temp_file"
}

# Initialize with current queue lengths (so we only show NEW events)
prev_eth=$(get_queue_len "raw_events_eth")
prev_bnb=$(get_queue_len "raw_events_bnb")
prev_poly=$(get_queue_len "raw_events_poly")
prev_sol=$(get_queue_len "raw_events_sol")
prev_trc=$(get_queue_len "raw_events_trc")

echo "📊 Queue Status (updating every 2 seconds):"
echo "📊 Queues: ETH=$prev_eth | BNB=$prev_bnb | POLY=$prev_poly | SOL=$prev_sol | TRC=$prev_trc"
echo ""
echo "Waiting for new events..."
echo ""

# Main monitoring loop
while true; do
  # Get current queue lengths
  curr_eth=$(get_queue_len "raw_events_eth")
  curr_bnb=$(get_queue_len "raw_events_bnb")
  curr_poly=$(get_queue_len "raw_events_poly")
  curr_sol=$(get_queue_len "raw_events_sol")
  curr_trc=$(get_queue_len "raw_events_trc")
  
  # Process new events for each queue
  if [ "$curr_eth" -gt "$prev_eth" ]; then
    process_new_events "raw_events_eth" "$prev_eth" "$curr_eth"
    prev_eth=$curr_eth
  fi
  
  if [ "$curr_poly" -gt "$prev_poly" ]; then
    process_new_events "raw_events_poly" "$prev_poly" "$curr_poly"
    prev_poly=$curr_poly
  fi
  
  if [ "$curr_bnb" -gt "$prev_bnb" ]; then
    process_new_events "raw_events_bnb" "$prev_bnb" "$curr_bnb"
    prev_bnb=$curr_bnb
  fi
  
  if [ "$curr_sol" -gt "$prev_sol" ]; then
    process_new_events "raw_events_sol" "$prev_sol" "$curr_sol"
    prev_sol=$curr_sol
  fi
  
  if [ "$curr_trc" -gt "$prev_trc" ]; then
    process_new_events "raw_events_trc" "$prev_trc" "$curr_trc"
    prev_trc=$curr_trc
  fi
  
  # Show queue status on a new line (don't overwrite event output)
  total=$((curr_eth + curr_bnb + curr_poly + curr_sol + curr_trc))
  printf "\r📊 Queues: ETH=%s | BNB=%s | POLY=%s | SOL=%s | TRC=%s | Total: %s" \
    "$curr_eth" "$curr_bnb" "$curr_poly" "$curr_sol" "$curr_trc" "$total"
  
  sleep 2
done
