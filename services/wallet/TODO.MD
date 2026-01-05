# TODO: Scale AWS queue (memory based, e.g. create a new queue after 5MB)
# - If the wallet service is down for a long time, ensure scalability upon restart:
#   - On rerun, allow spawning multiple temporary wallet service instances.
#   - Each instance should listen to and process a separate queue partition (e.g., SQS, memory-based queue).
#   - Make queues "roll over" (split) after reaching a limit (e.g. 5MB), so backlog can be processed in parallel.
#   - Goal: enable fast rollback/catch-up by parallelization, minimizing downtime impact on event processing.
# - Design queue naming/partitioning logic so scaling up/down is easy and data loss is avoided during catch-up.
