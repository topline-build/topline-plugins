# Knowledge Base-backed app

## Example user request

"Build a private field-manual finder that searches our published safety manuals and opens the cited procedure without copying those manuals into the app."

## Fit and template

Start from `scripts/artifacts/templates/react-dashboard`. This is a normal private artifact with a small search-and-read interface, not a hosted MCP server, connector, retrieval service, or Bedrock client. The Knowledge Base already owns ingestion, release membership, citations, and retrieval; the app consumes only its published read contract.

Before editing the manifest, require all of the following:

- the exact customer account and artifact ID are known;
- the Knowledge Base has a current published release and is not paused or archived;
- an authorized operator grants that exact base to `consumerType: "artifact_app"` and the exact artifact ID; and
- after that grant, an authorized operator creates, validates, and publishes a fresh Knowledge Base candidate whose connection review includes the artifact; and
- the requested operations are a subset of the grant.

Use the opaque `kb_...` public ID supplied by the authorized Knowledge Base workflow. Do not infer it from the slug, HTML endpoint, tenant, database, Bedrock, S3, browser state, or an old task.

## Manifest binding

Replace the template dataset with the platform-owned Knowledge Base binding. The alias is local to this app and becomes the route segment:

```json
{
  "kind": "tool",
  "routes": [
    { "path": "/", "kind": "page", "handler": "artifactApp" }
  ],
  "sourceBindings": [],
  "knowledgeBases": [
    {
      "alias": "manuals",
      "knowledgeBaseId": "kb_7Kp3qV9mN2xR5tY8",
      "release": "current_published",
      "operations": ["search", "fetch"]
    }
  ],
  "datasets": [],
  "refreshSchedules": [],
  "viewerPolicy": "private"
}
```

Keep the rest of the copied template manifest intact. Do not declare the broker paths in `routes[]`; Topline reserves and serves them from `knowledgeBases[]`. Ask for `list` only when the interface actually browses the whole collection.

Deployment validation fails closed when the base is missing, cross-tenant, not live, stale after a grant rotation, or approved for fewer operations. Fix the grant or manifest instead of adding a credential or bypass route.

The connection is draft-only when first approved. Do not reuse a candidate created before the connection: create and validate a new candidate, confirm the artifact appears in its frozen connection review, and publish that version before validating or deploying the artifact.

## Browser reads

Use relative paths so draft, version, live, and custom-domain routing remain intact. The platform applies artifact viewer authorization and the Knowledge Base delivery policy before returning data.

```js
async function searchManuals(query) {
  const response = await fetch(
    `./_artifact/knowledge/manuals/search?q=${encodeURIComponent(query.trim())}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`manual_search_${response.status}`);
  const payload = await response.json();
  return payload.results;
}

async function fetchManual(documentId) {
  const response = await fetch(
    `./_artifact/knowledge/manuals/documents/${encodeURIComponent(documentId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`manual_fetch_${response.status}`);
  const payload = await response.json();
  return payload.document;
}
```

Render result titles, excerpts, citations, and freshness before fetching a document. If the app renders `document.html`, use only the broker-returned, platform-sanitized field in a dedicated content container; never concatenate query text, provider output, or URL parameters into it.

Do not call `/knowledge/<slug>`, request or forward a Knowledge Base bearer, call Bedrock/S3 directly, or expose tenant/database IDs, AWS identifiers, source credentials, or object references. Those paths bypass the artifact contract or leak server-only authority.

## States and recovery

- Empty query: validate locally and do not send it.
- No results: show the searched terms and a clear reset action; do not claim the collection is empty.
- `400`: keep the query and ask the user to shorten or correct it.
- `403` or `404`: show that the approved Knowledge Base is unavailable and direct an operator to verify the live release, delivery policy, exact artifact grant, and operation set.
- `429`: keep the results already shown and offer a bounded retry after the server window.
- `502` or `503`: preserve the last successful view and offer retry without exposing provider details.

Do not silently fall back to hardcoded manuals, Company Knowledge, public HTML, a model answer, or another Knowledge Base.

## Validation and controls

- Test the exact manifest with a valid opaque public ID, `current_published`, unique alias, and least-privilege operations. Assert a hosted `kind: "mcp_server"` version is rejected.
- Mock list/search/fetch responses. Test relative URLs, encoded query/document IDs, empty, denied, missing, rate-limited, provider-unavailable, and successful citation/freshness states.
- Assert browser bundles and rendered error copy contain no bearer, tenant/database ID, Bedrock ID, region, S3 path, source credential, raw provider error, or fallback document content.
- Run the template checks and `node scripts/artifacts/validate-local --dir <appDir>` from the repository root.
- Confirm the artifact connection is included in the current published Knowledge Base release. A mutable approval alone is not deployable authority.
- After source sync, deploy only a draft. Smoke search and fetch as an allowed viewer, then revoke or rotate the grant and confirm the same draft fails closed. Restore an exact current grant before validation.
- Prepare validation, request review, and leave live promotion to the operator.

## Limitations and graduation boundary

`release: "current_published"` follows the base's atomic live pointer; draft edits do not affect the app. Pause, archive, source detachment, rollback, or grant rotation may make an existing draft fail closed until its exact grant is current again.

Hosted MCP artifacts must keep `knowledgeBases` empty. If a machine-ingress tool needs Topline-owned Knowledge Base data, stop and request a separately reviewed platform-service authorization design rather than routing back through artifact browser endpoints.
