# Cache-warmed multi-source dashboard

## Request and classification

**Request:** "Build a branch service dashboard over two joined relations, keep its live cache warm every five minutes, and show when the delivered data is stale." This explicitly authorizes recurring cache warming. The dataset remains `mode: "live"`; a cache miss still executes bounded SQL.

## Template and implementation

Start from `scripts/artifacts/templates/multi-source-dashboard`, then replace the template's `route-churn` fetch/handler/test with `branch-service-summary` and its actual columns. The template is a minimal JavaScript scaffold, not React. Its source and structured checks must change with the manifest.

For an open tab, poll at the requested five-minute cadence while visible using `fetch("./_artifact/data/branch-service-summary", { cache: "no-store" })`; display the runtime `generatedAt` rather than browser fetch time. Browser `no-store` avoids retaining a prior HTTP response, while the server-side live cache still applies its 300-second TTL.

## Warming and failure behavior

The manifest-owned `refresh_live_cache` schedule calls `warm-artifact-datasets` without creating a source revision. Warming is best effort, not a freshness guarantee. Before enabling it, verify Redis is configured, the serialized result fits the Redis value limit, and the exact cold query fits 5 seconds.

The UI cannot see task-level warm failures. It should mark `generatedAt` stale after the agreed threshold and continue to expose live-route errors. Operators inspect schedule/task status for `redis_unconfigured`, value-too-large, or query failures. Do not claim an explicit UI refresh-failure signal.

## Validation and controls

- Ground and run the exact final SQL; group by stable branch identity and confirm result bounds.
- Tailor source tests for the new relative route, columns, loading, retained data, stale/error, truncation, and no sample fallback.
- Run `node scripts/artifacts/validate-local --dir <appDir>`, commit/source sync, draft deploy, rendered smoke, direct data controls, validation preparation, and validation request.
- Confirm manifest sync creates one schedule with the same name; never add a duplicate manual or Coding-agent schedule.

## Limitations and graduation boundary

Use this when live SQL is already fast and cache warming is an explicitly requested optimization. If the query is expensive or must retain a computed report without live fallback, move to `mode: "precomputed"` plus `refresh_live_cache`. Never use `precompute_static` or `snapshot` for cache-only work.
