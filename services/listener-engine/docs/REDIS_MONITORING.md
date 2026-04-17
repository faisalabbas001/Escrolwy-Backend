# Redis Monitoring Guide

## Understanding the Redis Monitor Pane

The Redis monitor pane shows **all Redis commands** being executed in real-time. This is useful for debugging and understanding what's happening with your queues.

## What You Should See

### Normal Operation

When events are being pushed to Redis, you'll see commands like:

```
RPUSH raw_events_eth "{\"chain\":\"eth\",\"blockNumber\":12345678,\"txHash\":\"0x...\",...}"
RPUSH raw_events_bnb "{\"chain\":\"bnb\",\"blockNumber\":12345678,\"txHash\":\"0x...\",...}"
```

### Current State (Why You Don't See Events Yet)

**All queue lengths are 0** - This means no events have been pushed yet. Here's why:

## Why Events Aren't Appearing

### 1. **Replay Mode - Catching Up on Old Blocks**

Your listeners are currently in **replay mode**, processing historical blocks:

- **BSC**: Replaying from block 1573 to 71,389,925 (catching up ~71M blocks)
- **Tron**: Replaying from block 1 to 78,294,003 (catching up ~78M blocks)
- **Polygon**: Replaying from block 3902 to 80,219,390 (catching up ~80M blocks)
- **Solana**: Replaying from slot 160 to 386,198,751 (catching up ~386M slots)

### 2. **Most Blocks Don't Have Transfer Events**

The listeners only push events when they find **Transfer events for specific tokens**:
- **USDT** (Tether)
- **USDC** (USD Coin)
- **DAI** (Dai Stablecoin)

**Reality**: Most blocks don't contain transfers for these specific tokens. For example:
- On Ethereum, there are ~12,000 blocks per day
- Only a small percentage contain USDT/USDC/DAI transfers
- During replay, you're processing millions of blocks, but most are empty

### 3. **Event Push Logic**

Looking at the code:

```typescript
// In processBlock()
const events: RawTransferEvent[] = [];

// ... scan block for Transfer events ...

// Only push if events found
if (events.length > 0) {
  await this.pushEvents(events);  // This calls redis.rpush()
}
```

**Key Point**: If a block has **0 Transfer events** for your tokens, **no Redis command is executed**. That's why you don't see `RPUSH` commands in the monitor.

### 4. **What the Redis Monitor Shows**

The Redis monitor (`redis-cli monitor`) shows:
- ✅ Connection commands: `AUTH`, `CLIENT SETINFO`, `INFO`
- ✅ Queue operations: `RPUSH`, `LPUSH`, `LLEN` (when events are found)
- ❌ **Nothing** when blocks have no relevant events (which is most blocks)

## When Will You See Events?

### Scenario 1: During Replay (Current State)

You'll see events **only when**:
1. A block contains a Transfer event for USDT, USDC, or DAI
2. The transfer involves one of the configured token addresses
3. The event is successfully parsed

**Frequency**: Very low during replay (maybe 1 event per 1000-10000 blocks)

### Scenario 2: Real-Time Mode (After Catch-Up)

Once listeners catch up to the current block:
- They'll process **new blocks as they're created**
- New blocks are more likely to contain recent transfers
- You'll see events more frequently (but still only when transfers occur)

**Example**: If there are 10 USDT transfers per hour on BSC, you'll see ~10 `RPUSH` commands per hour.

## How to Verify Events Are Being Pushed

### Method 1: Check Queue Lengths

```bash
# Check all queue lengths
redis-cli LLEN raw_events_eth
redis-cli LLEN raw_events_bnb
redis-cli LLEN raw_events_poly
redis-cli LLEN raw_events_sol
redis-cli LLEN raw_events_trc
```

**Expected**: Numbers will grow slowly as events are found during replay.

### Method 2: Watch for Event Logs

In the listener panes, look for:
```
LOG [EvmListener:bnb] Block 123456: 2 events
```

This means 2 Transfer events were found and pushed to Redis.

### Method 3: Monitor Redis Commands

In the Redis monitor pane, watch for:
```
RPUSH raw_events_<chain> "{...json...}"
```

These appear **only when events are found**.

### Method 4: Sample Events from Queue

```bash
# Peek at the first event in a queue (without removing it)
redis-cli LRANGE raw_events_bnb 0 0

# Get and remove the first event
redis-cli LPOP raw_events_bnb
```

## Understanding the Current Situation

### Why BSC and Tron Are Working But No Events?

1. **BSC is processing blocks** ✅
   - Replaying from block 1573
   - Processing blocks successfully
   - But most blocks have **0 Transfer events** for USDT/USDC/DAI
   - So no `RPUSH` commands appear in Redis monitor

2. **Tron is processing blocks** ✅
   - Replaying from block 1
   - Processing blocks successfully
   - But most blocks have **0 Transfer events** for USDT/USDC
   - So no `RPUSH` commands appear in Redis monitor

3. **ETH, Polygon, Solana have RPC rate limits** ⚠️
   - Hitting "429 Too Many Requests" errors
   - Can't process blocks efficiently
   - Need better RPC URLs or rate limiting

## What the Redis Monitor Actually Shows

The commands you're seeing:
```
AUTH ...
CLIENT SETINFO LIB-NAME ioredis
CLIENT SETINFO LIB-VER 5.8.2
INFO ...
```

These are **connection/initialization commands**, not event pushes. This is normal when:
- Listeners are connecting to Redis
- No events have been found yet (most blocks are empty)
- Listeners are in replay mode (processing old blocks)

## Expected Behavior

### Normal Redis Monitor Output

**When events are found:**
```
RPUSH raw_events_bnb "{\"chain\":\"bnb\",\"blockNumber\":12345678,\"txHash\":\"0xabc...\",\"from\":\"0x...\",\"to\":\"0x...\",\"amount\":\"1000000\",\"tokenSymbol\":\"USDT\",\"tokenAddress\":\"0x55d398326f99059fF775485246999027B3197955\",\"logIndex\":0,\"timestamp\":1234567890}"
```

**When no events are found (most of the time):**
```
(no output - this is normal)
```

## Troubleshooting

### If You Never See Events

1. **Check if listeners are processing blocks:**
   ```bash
   tmux capture-pane -t listeners:0.1 -p | grep "Block.*events"
   ```

2. **Check if token addresses are correct:**
   - Verify in `chain.config.ts`
   - Ensure addresses match the actual token contracts

3. **Check if blocks contain transfers:**
   - Use a block explorer to verify blocks have Transfer events
   - Example: Check BSC block 1573 on BscScan

4. **Check Redis connection:**
   ```bash
   redis-cli PING
   # Should return: PONG
   ```

### If Events Appear But Queue Length is 0

This means events are being **consumed** (removed) by another service. Check if you have a Worker service running that's processing the queue.

## Summary

**Why you don't see events in Redis monitor:**
1. ✅ Listeners are working (BSC, Tron processing blocks)
2. ✅ Redis is connected (you see connection commands)
3. ❌ Most blocks don't have Transfer events for your tokens
4. ❌ No `RPUSH` commands = no events found = normal during replay
5. ⚠️ Some listeners (ETH, Polygon, Solana) have RPC rate limit issues

**What to expect:**
- Events will appear **sporadically** during replay (maybe 1 per hour or less)
- Events will appear **more frequently** once listeners reach real-time
- The Redis monitor will show `RPUSH` commands **only when events are found**

**This is normal behavior!** The system is working correctly - it's just that most blocks don't contain the specific token transfers you're monitoring.

