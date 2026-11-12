---
name: build-topline-artifact-apps
description: Design, build, extend, or review applications on the Topline artifact-app contract. Use for dashboards, reports, internal tools, tenant or viewer-scoped portals, private APIs, FastMCP servers, external webhook boundaries, bounded Bedrock features, customer-published Storybook and brand references, live or precomputed SQL datasets, cache warming, materialized data products, scheduled refreshes, and questions about whether work belongs in an artifact app, connector, Scheduled Work task, or platform service.
---

# Build Topline Artifact Apps

Build the smallest truthful application that fits the artifact contract. Start from a blessed template, keep runtime authority behind platform routes and brokers, and leave a deployed, smoked, validated draft for operator-controlled promotion.

First time using this skill — or unsure what a step produces? Read [Worked walkthrough](examples/worked-walkthrough/EXAMPLE.md): one small request ("summarize a visit note") taken through every section below in order, ending at the operator-controlled draft. It doubles as the minimal one-Bedrock-call reference for artifacts that do not need an agent loop.

## Classify the request before coding

1. State the user, recurring job, decision or action, data grain, freshness need, viewer boundary, writes or side effects, and failure cost.
2. Read [Capability map](references/capability-map.md) to classify the work as artifact-native, artifact-adjacent, or platform-service work.
3. Read [Choosing an app pattern](references/choosing-an-app-pattern.md) and select one blessed template from `scripts/artifacts/templates/`.
4. Do not force a long-running worker, arbitrary ETL process, queue consumer, or truly headless service into an artifact app. An API-first artifact keeps a minimal private operational or documentation page at `/`.
5. One app is one artifact. When an app needs a website plus an API, or code in two languages, declare `parts` in one manifest (start from the `web-and-api` template) instead of splitting it into two artifacts. Each part builds in its own directory; static parts serve built files, server parts run on their own machine size, and routes pick the part. Use relative asset URLs and hash routes (`#/reports`) for pages inside a static part.
6. When the request is to connect a system, keep data synced, change what syncs or when, or create a new ingestion pipeline, do not select an artifact app template. With the Data Sources workspace on, each connector instance is a **data pipeline artifact** (a built-in artifact type, not an app): read [Data pipeline artifact](examples/data-pipeline-artifact/EXAMPLE.md) and use `list_pipeline_artifacts`, `read_pipeline_artifact` and `save_pipeline_artifact_draft`; a person publishes the draft. A new custom API is built first with the chat data-source tools in [Customer API source pipeline](examples/customer-api-source-pipeline/EXAMPLE.md) (secure credential and table approval cards, API details derived by you), and becomes its pipeline artifact when scheduled. Use the `topline-connector-certification` skill when it is available; a coding harness handoff must read `skills/topline-connector-certification/SKILL.md`. Connections, secret references, checkpoints, sync handlers, materialized tables and scheduler jobs stay platform-owned in every case.
7. When a normal artifact app needs a published customer document collection, open [Knowledge Base-backed app](examples/knowledge-base-backed-app/EXAMPLE.md). Declare only the exact approved base and read operations in `knowledgeBases[]`; use the platform broker instead of a source binding, public HTML endpoint, bearer token, or direct Bedrock call. Hosted MCP artifacts cannot declare Knowledge Bases.
8. When people need to add or edit records in the app, or the request replaces a spreadsheet, open [Replace a spreadsheet](examples/replace-a-spreadsheet/EXAMPLE.md). Tables hold that data. While tables are on there are no private workspace tables: every table, scratch included, is a table.

## Design the data and freshness contract

Read [Data freshness and materialization](references/data-freshness-and-materialization.md) before declaring datasets, source bindings, cache policy, precomputation, materialized relations, browser polling, or schedules.

- Use bounded live SQL plus a nonzero cache TTL for ordinary read-heavy dashboards.
- Use `refresh_live_cache` to warm live caches or recompute `mode: "precomputed"` datasets without creating an artifact revision.
- Let the platform worker store precomputed results as private tenant-scoped JSON in platform object storage. Keep browser reads on relative declared `/_artifact/data/*` routes.
- Keep reusable ingestion and transformation in connector-owned or pipeline-owned materialized tables or views. An artifact app's schedule does not become an arbitrary ETL engine; recurring ingestion is scheduled through the source's data pipeline artifact.
- Use `precompute_static` only when the intended output is a new static artifact revision.
- Show last successful update, current scope, partial or stale state, and recovery behavior in the application.

## Preserve runtime and security boundaries

Read [Security and runtime boundaries](references/security-and-runtime-boundaries.md) before adding APIs, secrets, viewer scoping, webhooks, Bedrock, state, or writes.

- Fetch artifact routes relatively; never call global platform `/api/*` routes from browser code.
- Keep database connections, source credentials, raw secrets, AWS credentials, and Bedrock calls out of browser bundles.
- Use declared secret bindings and server-side artifact routes for third-party APIs.
- Require platform viewer or tenant authorization for normal app routes.
- For the current viewer's profile in browser code, fetch `_artifact/me` under the app's base URL. It includes their display name and Auth0 subject when available. For server-side authorization and audit, use the proxy-set `x-platform-viewer-email` header. See [Viewer identity](references/viewer-identity.md).
- Route external webhooks to platform-service work. The only artifact machine ingress is a live validated `kind: "mcp_server"` app at exact `/_artifact/mcp`, authenticated by a platform-managed bearer that artifact code never receives. It is not a general webhook/header-forwarding contract or idempotency store.
- For an MCP server, use `fastmcp-server`, keep FastMCP 3.4.7 hash-locked with stateless JSON Streamable HTTP, and leave connection, tool review, coding/chat enablement, and agent assignment to Developer Access. MCP artifacts cannot currently declare `sourceBindings`, `datasets`, or refresh schedules because machine ingress cannot authorize artifact-data callbacks; use approved secret-bound external APIs or platform-service work instead.
- Keep simple artifact chat to one bounded server-side Bedrock `Converse` call unless the operator explicitly requests a larger supported architecture.

## Build from maintained sources

1. Copy the selected directory from `scripts/artifacts/templates/` into `artifact-apps/<stable-slug>`.
2. Treat the package-local `artifact-app.json` as authoritative.
3. For UI-bearing apps, read [Customer brand and Storybook](references/customer-brand-and-storybook.md), inspect the customer's published design-system Storybook through its MCP, and use the vendored implementation under `src/design-system/`.
4. Use real domain language and verified data shapes. Do not ship hardcoded task, tenant, sample, or fallback rows.
5. Keep implementation notes, query mechanics, tool names, and validation markers out of the user-facing UI.

The customer can describe its brand in the design-system Storybook. Treat that published description, its rendered stories, components, tokens, and approved assets as the visual reference for app design. Also apply `$design-dashboard-interfaces` for dashboard composition and Storybook validation. Do not substitute generic styling when a published customer reference exists.

Read [Example catalog](references/example-catalog.md) and open only the closest golden specimen under `examples/`. Examples teach decisions and contract shape; blessed templates remain the copyable source foundation.

For a map, territory editor, address search, or other location-aware surface, open [Customer-scoped map](examples/customer-scoped-map/EXAMPLE.md). It shows the platform-service boundary required for customer-account Amazon Location access; it is not permission for an ordinary artifact to call Scheduling's global `/api/*` routes.

## Validate in layers

Read [Validation and lifecycle](references/validation-and-lifecycle.md) before the first commit or deployment.

1. Ground every source or relation with current catalog and schema tools.
2. Run the exact final SQL with production and warm parameter variants and declared bounds.
3. Run the package's local validation from the repository root.
4. Commit the artifact manifest/version, synchronize the exact source package, and deploy the draft through bridge tools.
5. Poll the existing deployment when a deploy response is delayed; do not create duplicate versions or deployments to retry unknown state.
   When a tool returns `resourceAdvice`, the app ran out of memory, time, or disk: apply the suggested `resources` value and redeploy (at most twice per problem), otherwise change the code. Never ask the user about machine size. If an open problem says Topline raised the live app's size, carry that value into the manifest. See "Machine size and resource failures" in the validation reference.
6. Run rendered smoke and fix loading, browser, dataset, auth, overflow, and fallback-data failures.
7. Compare displayed headline values with bounded direct control queries.
8. Prepare validation, request review, and stop on escalation or unavailable reviewer infrastructure. The reviewer reads the page's text as it first loads; build every brief requirement, including charts, so it shows there (see "What the reviewer can check" in the validation reference).
9. Leave live promotion to the operator.

## Keep the contract maintainable

- Prefer one clear pattern over speculative flexibility.
- Add a golden example only when it teaches a materially distinct topology or boundary.
- Label proposed capabilities as proposed; never present them as current runtime behavior.
- Update the closest reference and example when the manifest or platform contract changes.
- Preserve source integration, draft deployment, validation, live promotion, and customer rollout as separate outcomes.

## Reference index

- [Capability map](references/capability-map.md)
- [Choosing an app pattern](references/choosing-an-app-pattern.md)
- [Data freshness and materialization](references/data-freshness-and-materialization.md)
- [Customer brand and Storybook](references/customer-brand-and-storybook.md)
- [Security and runtime boundaries](references/security-and-runtime-boundaries.md)
- [Viewer identity](references/viewer-identity.md)
- [Validation and lifecycle](references/validation-and-lifecycle.md)
- [Example catalog](references/example-catalog.md)
