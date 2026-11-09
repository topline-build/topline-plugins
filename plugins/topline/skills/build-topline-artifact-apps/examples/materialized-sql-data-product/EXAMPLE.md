# Materialized SQL data product

## Request and classification

**Request:** "Build a 30-day service-health dashboard from the certified daily relation maintained by Data Operations." The upstream relation is artifact-adjacent; the artifact owns only a bounded read and UI.

## Preconditions and topology

Start from `scripts/artifacts/templates/multi-source-dashboard`, then replace its route, normalization, UI, and structured tests with `service-health`. Do not create, refresh, or migrate the upstream relation from artifact code or `refreshSchedules[]`.

Before using the illustrative `analytics.service_health_daily_v1` name, require the data owner and catalog to prove:

- the platform read-only service can access it and its tenant isolation/RLS is enforced independently of browser parameters;
- stable branch identity and certified metric definitions are documented;
- the daily completion deadline, timezone, retention, owner, and escalation path are known;
- `source_updated_at` represents the upstream data-product as-of time.

If tenant isolation is not proven for this custom relation, stop. `viewerPolicy: "private"` is page authorization, not a SQL tenant predicate.

## Metric and freshness contract

The dataset exposes numerators and denominators rather than pre-averaged rates. Compute 30-day completion as `sum(completedVisitCount) / sum(eligibleVisitCount)` and average duration as `sum(totalDurationMinutes) / sum(durationObservationCount)`, handling zero denominators explicitly. Validate the same weighted formulas with independent control queries.

Display `generatedAt` as delivery time and `sourceUpdatedAt` as data-product time. Define a visible stale state relative to the documented daily deadline. Retain last successful rows during refresh, show errors/empty states, and surface runtime `truncated` as partial data. Do not use a SQL-side `LIMIT` that hides truncation.

## Validation and controls

- Confirm catalog ownership, tenant isolation, metric formulas, cadence, and column types; run the exact final bounded SQL.
- Adapt template tests for the route, weighted KPI math, zero denominators, stale/partial/error/empty states, and no sample fallback.
- Compare all-company and one representative branch against direct weighted controls.
- Run `node scripts/artifacts/validate-local --dir <appDir>`, source sync, draft deploy, desktop/mobile rendered smoke, validation preparation, and validation request.

## Limitations and graduation boundary

The artifact cannot repair, schedule, or silently replace an upstream materialization. Data-quality or cadence failures remain with the documented producer. If this artifact read becomes too slow after upstream optimization, precompute only the artifact's bounded read with `refresh_live_cache`; upstream ownership does not move.
