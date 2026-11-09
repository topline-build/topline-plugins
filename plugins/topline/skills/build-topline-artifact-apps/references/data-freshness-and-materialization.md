# Data Freshness and Materialization

Freshness is a product contract, not just a cache setting. State the source,
metric window, expected latency, TTL, and what the UI shows before deciding on a
pattern. Validate the final metric against bounded read-only SQL before calling
it ready.

## Four supported delivery shapes

| Shape | Request path | Freshness behavior | Best for |
| --- | --- | --- | --- |
| TTL-cached live SQL | Declared route runs bounded SQL on a cache miss. | TTL normally 60 to 300 seconds; use `0` only for a proven sub-minute need. | Interactive reports and joins. |
| Scheduled live-cache warming | `refresh_live_cache` fills Redis before viewer reads; live SQL remains the miss path. | Best effort; UI uses `generatedAt`, while operators monitor warm tasks. | Explicitly requested predictable live reads. |
| Precomputed dataset | Worker runs bounded SQL and writes private tenant-scoped JSON; route reads it. | No live fallback; unavailable before first warm, then last-known-good data. | Dense computation and large reports. |
| Upstream materialized table/view | Approved source/analytics data product is queried as a bounded live dataset. | Its upstream refresh cadence defines source freshness; app TTL adds its own delivery window. | Shared, durable transformations. |

`mode: "precomputed"` requires an enabled `refresh_live_cache` schedule and
`warmParams` for every declared variant. The same schedule mode may warm a live
dataset only when recurring refresh was explicitly requested. Do not use
`precompute_static` for cache-only work. Pass `refreshNow: true` after a new or
changed precomputed dataset so the first private object exists before smoke.

`precompute_static` is for rebuilding precomputed HTML/assets; its schedule is
part of the manifest-owned app contract. `maintenance` is available for
maintenance work. All schedules declare a five-field cron, timezone, prompt,
and optional enabled/output-strategy settings. `commit_artifact` syncs them as
manifest-owned Platform schedules; do not create a raw scheduler job or a
separate duplicate manual schedule.

## Implementation checklist

1. Discover catalog resources, describe the chosen resource, and prototype a
   bounded read-only query with `run_psql`.
2. Declare the final dataset SQL, matching route, and limits (`maxRows`,
   `maxBytes`, `timeoutMs`), plus TTL or precompute parameters.
3. Make the UI label its update/freshness state and handle unavailable, empty,
   partial, stale, and error results.
4. For precomputed data, declare enabled `refresh_live_cache`, use
   `refreshNow: true` when applicable, and smoke only after the route has data.
5. For upstream materialization, separately verify the upstream cadence and
   data quality; the artifact app does not own that producer.
