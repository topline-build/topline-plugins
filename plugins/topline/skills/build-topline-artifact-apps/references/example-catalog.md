# Example Catalog

Use these names as routing examples, not as promises of a new platform
capability. Each starts from the smallest current template and follows the
draft-only lifecycle in `validation-and-lifecycle.md`.

| Golden example | Route to | Core boundary |
| --- | --- | --- |
| `worked-walkthrough` | `python-api` | End-to-end application of every skill step to one request; also the minimal single-Converse-call reference. |
| `live-operations-dashboard` | `multi-source-dashboard` + live SQL datasets | Bounded joins/metrics and visible TTL freshness. |
| `viewer-scoped-customer-portal` | `viewer-scoped-dashboard` | Signed-in viewer; currently only `customers.email` row filtering. |
| `internal-action-tool` | `internal-tool` | Private tool whose external API owns the decision; records people edit go in tables. |
| `private-api-first-app` | `python-api` | Private `/_artifact/api/*` routes and server-side integrations. |
| `replace-a-spreadsheet` | `table-editor` + manifest `tables[]` | One-time import into tables with credential columns left out; platform-served row saves on the live app only; conflicts surface as 409. |
| `customer-scoped-map` | Platform-service-backed UI | MapLibre browser surface over a tenant-authenticated, customer-account Amazon Location Maps and Places broker; no browser credentials or implicit location writes. |
| FastMCP server | `fastmcp-server` | Live-only exact MCP ingress, platform-owned credential, and customer-managed tool review for chat/coding. |
| `bounded-bedrock-assistant` | `python-api` | Private route, one bounded Bedrock Converse call, no agentic extras. |
| `knowledge-base-backed-app` | `react-dashboard` + an exact published Knowledge Base grant | Normal artifact reads one approved live release through relative `/_artifact/knowledge/*` broker routes; no token, provider ID, or direct public endpoint. |
| `signed-webhook-boundary` | Platform service boundary | Current artifact routing cannot expose provider-verifiable, durable machine ingress. |
| `cache-warmed-multi-source-dashboard` | `multi-source-dashboard` + live dataset | Explicit recurring `refresh_live_cache`, Redis preflight, live fallback, and visible `generatedAt`. |
| `precomputed-s3-report` | `artifact-draft` or `react-dashboard` + precomputed dataset | Platform-managed private object storage through declared routes; never expose object URLs. |
| `materialized-sql-data-product` | `multi-source-dashboard` after upstream work | Upstream materialized table/view is separately owned and cataloged; app performs bounded read-only access. |
| `customer-api-source-pipeline` | Data Sources build + `platform.connector.rest.v1` | The operational connector, credentials, checkpoints and tables are first-class Data Source objects; with the workspace on, scheduling it creates its data pipeline artifact. |
| `data-pipeline-artifact` | Built-in data pipeline artifact (no template) | One artifact per connector instance: tables and named schedules (including PestRoutes hard-delete schedules) in a `pipelineManifest`; the coder saves drafts, a person publishes. |

Template choice may change if the visual surface changes, but the stated
security and data boundary must not. In particular, do not use the aggregate
template for multi-source math, use a precompute schedule merely as a cache
warmer, or turn a webhook into a viewer-authenticated route.
