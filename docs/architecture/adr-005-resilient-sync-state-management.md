# ADR-005: Resilient Sync State Management and Job Cancellation

## Context

TiniX Trending relies on BullMQ and Redis to orchestrate heavy, long-running background tasks such as `daily-discovery` and `daily-update`. The administration interface manages these jobs, showing their running states and providing manual "Run" and "Cancel" buttons. 

However, the previous implementation suffered from several state-desynchronization issues:
1. **Orphaned BullMQ Locks (Stalled Jobs):** When a worker process was restarted or crashed, jobs remained in the "active" list in BullMQ due to lingering locks (up to 10 minutes). The UI continued to show "Cancel" even though no worker was processing.
2. **Lingering Redis Sync Flags:** Flags like `crawler:sync:github:running` were set on start and cleared in a `finally` block. If a process was terminated abruptly, the keys remained in Redis forever, permanently showing the green "running" banner on the UI.
3. **Stale/Orphaned Cancel Signals:** Cancel signals were set for 1 hour. A new run of a job would immediately read the old cancel signal and abort.
4. **Duplicate Worker Processes:** Multiple worker processes (e.g. `combined-worker.ts` and standalone workers) competed for jobs, leading to fractured log outputs and race conditions during repeatable job synchronization on startup.

## Proposed Architecture

To solve these issues thoroughly, we propose a decoupled, **Heartbeat-based State Machine** and a standardized **Job Lifecycle Manager**.

```mermaid
graph TD
    subgraph UI (Next.js Server Actions)
        Trigger[Run Button] -->|Delete stale signal + Add Job| BullMQ
        Cancel[Cancel Button] -->|Set cancel_signal = true + Expire Heartbeat| Redis
        Fetch[loadStats API] -->|Read active_heartbeat keys| UIState[UI Button State]
    end

    subgraph Workers (Background Nodes)
        BullMQ -->|Process Job| WorkerLoop[Worker Loops]
        WorkerLoop -->|Start Heartbeat Interval| Heartbeat[Set job:active:name EX 30]
        WorkerLoop -->|Loop Iteration| CheckCancel[Check cancel_signal]
        CheckCancel -->|Yes| Abort[Clean up + Exit]
        CheckCancel -->|No| Continue[Continue Processing]
        WorkerLoop -->|Finally| Clear[Delete job:active:name + Clear sync flags]
    end
    
    Heartbeat -.->|Every 15s| Renew[Renew job:active:name EX 30]
```

### 1. Heartbeat-Based Running State (Single Source of Truth)
Instead of relying on BullMQ's `getActive()` (which has a long lock timeout of 10 minutes) or static Redis keys, we will implement a heartbeat:
* When a job starts, it sets a Redis key `job:active:${name}` with a value of the worker's PID and an expiration (TTL) of **30 seconds**.
* A background interval inside the running worker ticks every **10 seconds** to renew this key (`EX 30`).
* When the job finishes (or is aborted/fails), the worker deletes the key.
* If the worker crashes, the key naturally expires in 30 seconds, restoring the UI to "Run" state automatically.
* The UI queries `redis.get('job:active:${name}')` to determine if a job is actively running.

### 2. Standalone Cron Synchronization Guard
To prevent race conditions where multiple workers try to clear and re-add repeatable cron jobs concurrently on startup:
* We will use a Redis distributed lock (`scheduler:setup-lock`) with a 10-second TTL when running `setupRepeatableJobs()`.
* Only the worker that successfully acquires the lock will perform the repeatable jobs sync.

### 3. Bulletproof Cancellation Flow
When a user requests a cancellation:
1. The UI sets the `cancel_signal:${name}` flag in Redis.
2. The UI immediately deletes the `job:active:${name}` heartbeat key. This causes the UI to snap back to the "Run" button state instantly.
3. The running worker checks `cancel_signal:${name}` at the beginning of every loop iteration.
4. If the flag is set, the worker clears its active intervals, clears its sync flags, and exits early.

## Concurrency and Deployment Guard

To avoid running duplicate workers in the same environment:
* In development, `npm run dev:all` remains the recommended command which runs individual workers.
* The `combined-worker.ts` should be clearly documented as an alternative for low-resource environments and should never be run concurrently with `dev:all`.
* We will add a startup check in workers: if another worker is already running (checked via a persistent heartbeat), it will log a warning.
