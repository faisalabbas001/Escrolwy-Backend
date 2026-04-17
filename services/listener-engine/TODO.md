# Listener Engine - Current Flow

```mermaid
flowchart TD
    Start([Service Start]) --> LoadPos[Load Last Processed Block from DB]
    LoadPos --> GetHead[Fetch Current Head Block from Node]
    GetHead -->|Loop| Poll[Poll New Blocks]
    Poll --> HasNew{New Block(s)?}
    HasNew -- No --> Wait[Wait and Poll Again]
    HasNew -- Yes --> Parse[Parse Block Events]
    Parse --> Process[Process and Publish Events]
    Process --> UpdatePos[Update Last Processed Block in DB]
    UpdatePos --> Poll
```

**Description**:
- On startup, the listener loads the last processed block from the DB.
- Continuously fetches the current head block from the blockchain node.
- Loops over each new block (one at a time), parses transactions/events, processes and publishes them, then updates the latest processed block in the DB.
- Only one "live" thread processes blocks forward in a linear, real-time fashion (with a confirmation delay for safety).

---

# TODO: Handle Missing Blocks (Bulk Catch-Up Flow)

**Introduce a new background thread for missed block handling:**
- Add a new table `missed_blocks_tracker` in the DB with
  - `id`
  - `chain_id`
  - `last_processed_block`
  - `target_block`
  - `created_at`, `updated_at`
- The **main/live thread** updates `target_block = current_head_block - safe_confirmations` on every poll.
- The **missed block worker thread** reads from `missed_blocks_tracker`, and repeatedly attempts to fill the gap from `last_processed_block+1` up to `target_block` (in batches, can be large bulk).
- This enables rewind/rescan of large block ranges after long downtime.
- All results go through normal event processing.
- Once `last_processed_block >= target_block`, the missed block worker idles until a new gap is detected.

> This dual-thread model ensures real-time processing is snappy while missed/old range catch-up can proceed independently at max speed (no blocking).

**Example DB Table:**

| id | chain_id | last_processed_block | target_block | updated_at |
|----|----------|---------------------|--------------|------------|
| 1  | eth      | 17300000            | 17300999     | ...        |

---

