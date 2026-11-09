# Precomputed object-storage report

## Request and classification

**Request:** "Build a 30/90-day branch service report. It may be several hours behind, and refresh it every four hours so opening the report never runs the expensive query." This is an artifact-native `precomputed` dataset, not static source data or a direct S3 integration.

## Topology and freshness

Start from `scripts/artifacts/templates/react-dashboard` and adapt its source, route, parameters, and structured tests. Browser code fetches `./_artifact/data/service-performance-report?windowDays=30` or `90`. The platform worker runs each `warmParams` variant and stores private tenant/artifact-scoped JSON in platform object storage; the browser never receives a bucket or object URL.

The enabled `refresh_live_cache` schedule runs every four hours. Before the first successful warm, render the explicit unavailable response. After success, the route serves last-known-good data even if a later warm fails. The route does not expose refresh-task health, so show `generatedAt` and catalog-confirmed `sourceUpdatedAt`; mark the report stale when it exceeds the agreed six-hour threshold and direct operators to schedule/task status for refresh failures.

Render `truncated` as partial data and require narrower scope. Validate that intended tenant cardinality fits the declared 5,000-row/5 MB bounds; do not hide completeness with a SQL-side `LIMIT`.

## Manifest and schedule

`mode: "precomputed"` requires an enabled `refresh_live_cache` schedule. `warmParams` covers both allowed parameter variants. The schedule only recomputes stored dataset JSON; it does not create a source revision, rebuild, redeploy, or use `precompute_static`.

After a new or changed dataset, commit it and request `refreshNow: true` so both variants exist before smoke. Do not retry through a slow live query or embed tenant rows in the bundle.

## Validation and controls

- Confirm actual catalog columns and tenant boundary, then run the exact SQL for 30 and 90 days with the declared limits and 60-second worker timeout.
- Run `node scripts/artifacts/validate-local --dir <appDir>` and tailored structured tests from the repository root.
- Prove both variants, first-warm unavailable behavior, last-known-good stale behavior, `truncated` handling, no object URL, and unauthenticated denial.
- Complete source sync, draft deploy, desktop/mobile rendered smoke, independent headline controls, validation preparation, and validation request.

## Limitations and graduation boundary

This is not a public export, arbitrary S3 integration, or static artifact build. Split drill-downs requiring fresher data into bounded live datasets. Never use `mode: "snapshot"` or `precompute_static` for dataset refresh.
