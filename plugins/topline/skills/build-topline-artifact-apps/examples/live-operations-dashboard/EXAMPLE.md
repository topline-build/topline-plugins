# Live operations dashboard

## Request and classification

**Request:** "Show dispatchers current branch workload and the oldest open work, updating during the day." This is a high-velocity, read-only live dashboard: users need current operational state, the result sets are modest, and the cold queries can be kept bounded.

## Blessed template and topology

Start from `scripts/artifacts/templates/multi-source-dashboard`. Adapt both its source and manifest. The page fetches `./_artifact/data/operations-by-branch` for stable-ID branch metrics and `./_artifact/data/open-work` for the oldest-open table. The browser never connects to Postgres, a source API, object storage, or global `/api/*` routes.

The manifest uses bounded read-only SQL datasets with `sourceBindings: []`. A 60-second TTL supports a poll no faster than once per minute while the page is visible. A minimal client keeps the two responses together:

```js
const paths = ["operations-by-branch", "open-work"];
const responses = await Promise.all(paths.map((name) => fetch(`./_artifact/data/${name}`)));
if (responses.some((response) => !response.ok)) throw new Error("operations_data_unavailable");
const [branchSummary, openWork] = await Promise.all(responses.map((response) => response.json()));
render({ branchSummary, openWork }); // consume rows, generatedAt, truncated, and warnings
```

## Freshness, bounds, and failure states

`generatedAt` says when Topline produced the response; it does not prove when the upstream source changed. Verify the source sync SLA and display a catalog-confirmed source-as-of value. Retain the last successful rows and `generatedAt` during refresh, pause polling when the document is hidden, and make a failed refresh visibly stale with retry.

When the runtime reports `truncated`, show `Showing first N` and require a narrower scope rather than implying an exhaustive table. Never seed the UI with sample operational rows or clear loading text before both requests settle.

## Manifest and controls

The specimen SQL counts every open item, uses a separate seven-day completion window, groups by stable branch ID plus label, and orders the work table oldest-first. Before committing, discover the actual catalog resources, confirm every example column, inspect relationships, and run each exact final SQL statement with its limits.

Replace the template's original route and add structured tests for both datasets, loading, retained refresh, stale/error, source freshness, truncation, and no sample fallback. Validate headline branch counts, the oldest open item, and one representative branch with independent bounded control queries.

Run `node scripts/artifacts/validate-local --dir <appDir>` from the repository root. Then complete commit, source sync, draft deploy, rendered smoke, direct data controls, validation preparation, and validation request. Smoke must prove representative values render without stuck loading or fallback data at desktop and mobile widths.

## Limitations and graduation boundary

This pattern is not for large exports or queries that cannot finish cold within five seconds. Move those reads to `mode: "precomputed"` with an enabled `refresh_live_cache` schedule. Never use `mode: "snapshot"`, bake tenant rows into source/assets, or use `precompute_static` for this live dashboard.
