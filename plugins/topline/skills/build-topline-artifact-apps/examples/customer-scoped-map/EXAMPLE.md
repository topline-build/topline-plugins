# Customer-scoped map

## Example request

"Let dispatchers search an address and edit pest-control service territories on a street or aerial map. Make it available to customers by default."

## Classification

This is a platform-service-backed UI, not an artifact-native integration. An ordinary artifact cannot grant itself Amazon Location permissions or call global `/api/*` routes. The platform must first provide a tenant-authenticated, same-origin broker whose AWS SDK clients use the runtime role in the owning customer's AWS account.

The maintained specimen is the default Scheduling Regions surface:

- browser behavior: `apps/scheduling-config-app/regions.js`
- broker: `apps/server/src/scheduling-map-api.ts`
- customer task-role grants: `infra/aws/platform/ecs.tf`

If another artifact needs maps, reuse an approved artifact capability or add a reviewed platform broker and IAM contract first. Do not copy the Scheduling route names into an ordinary artifact.

## Topology and authority

1. A tenant-authenticated browser requests only same-origin, allowlisted map paths.
2. The platform API selects the owning customer runtime and signs Amazon Location Maps and Places calls with that runtime's IAM role.
3. The browser receives rewritten style descriptors and bounded result shapes. It never receives AWS credentials, API keys, provider URLs, raw provider errors, or a customer/account selector.
4. Map tiles are presentation. Saved region geometry remains the scheduling payload and stays usable when the provider is unavailable.

For the current Scheduling implementation, the bounded contract is:

```text
GET  /api/scheduling/map/style?style=Standard|Hybrid
GET  /api/scheduling/map/tiles/{allowlisted-tileset}/{z}/{x}/{y}
GET  /api/scheduling/map/glyphs/{fontstack}/{range}.pbf
GET  /api/scheduling/map/sprites/{allowlisted-style}/{file}
POST /api/scheduling/map/search  { query, biasPosition? }
POST /api/scheduling/map/place   { placeId }
```

`Standard` is the default. `Hybrid` is an explicit labeled-aerial option for property and door-to-door context. Tile sets, styles, zoom coordinates, request sizes, result counts, and US country scope are allowlisted or bounded server-side.

## Address search without an implicit write

Use Amazon Location Places `Autocomplete` while the user types, with at least three characters, a short debounce, at most five results, and the current map center as `BiasPosition`. Resolve the selected `PlaceId` with `GetPlace`. Both calls use `SingleUse` because selecting a result only orients the map.

```js
const response = await fetch("/api/scheduling/map/search", {
  method: "POST",
  credentials: "same-origin",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query, biasPosition: [center.lng, center.lat] })
});
```

Keep the typed query visible through loading and failure. Show explicit loading, no-results, provider-unavailable, and selected states. Abort superseded requests and ignore results whose request id is no longer current. Render result labels as text nodes, not interpolated HTML.

Selecting a result may place a temporary marker and move the camera. It must not create a region, move a boundary, save provider output, or change scheduling eligibility. A separate, explicit save action owns region mutations.

## Basemap and overlay behavior

Fetch the provider style through the broker, then render domain overlays with MapLibre. Reject unrecognized provider tile URLs rather than silently substituting another tileset, and validate zoom/X/Y before calling Maps. When switching styles, remember that `setStyle` removes custom sources and layers; reinstall region, customer, and editing overlays on MapLibre's `style.load` event, not an earlier `styledata` event.

Amazon Location's AWS styles are already validated. Pass `validateStyle: false` when creating the MapLibre map, and keep source attribution visible with a compact attribution control:

```js
const map = new maplibregl.Map({
  container,
  style,
  validateStyle: false,
  attributionControl: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
```

Do not remove, cover, or replace the provider attribution carried by the AWS style.

Keep these visual priorities:

- region fill remains translucent so streets, structures, and customer dots are visible;
- invalid, uncovered, orphaned, and contested states use more prominent colors than healthy coverage;
- selected vertices and edit affordances remain usable with either basemap;
- region labels are optional in the network-free fallback because symbol layers require glyphs.

## Failure, accessibility, and cost boundaries

- On any Maps failure, use a local flat MapLibre style with no remote sources. Continue showing saved regions, customer points, warnings, and editing controls, with a visible retry action.
- Address-search failure must not clear the query or block manual pan/zoom and region editing.
- Give search a real label, expose its loading/result status through `aria-live`, use keyboard-focusable result buttons, and preserve MapLibre navigation and scale controls.
- Cache style, tile, glyph, and sprite responses in the authenticated user's browser. Emit `Cache-Control: private`, honor a shorter provider `max-age`, cap the local maximum, and pass through a validated provider `ETag`. Never emit `public` from the authenticated broker.
- Do not cache autocomplete or place responses when using `SingleUse`; return `Cache-Control: no-store`. Persisted or reused geocoding is a separate contract that must use the provider's storage-eligible intended use and a reviewed retention policy.
- Do not add a shared CDN cache unless authentication happens before cache lookup and the cache key is proven to partition by customer and every representation-changing input. Browser caching is the safe default here.
- Keep the normal street style as the default; Hybrid retrieves imagery plus labels and therefore consumes more tiles.
- Keep usage in the owning customer account through task-role IAM. Do not use a shared browser API key as a shortcut.
- Create customer-account `AWS/Location` `CallCount` alarms for `GetTile`, `Autocomplete`, and `GetPlace`, filtered by `OperationName`. Use `Sum`, `treat_missing_data = "notBreaching"`, two-of-three evaluation, and the existing operational SNS topic. Keep thresholds configurable per customer; the Scheduling defaults are 50,000 tile calls, 1,000 autocomplete calls, and 500 place resolutions per five minutes.
- Treat AWS request counts, budgets, alerts, and CloudTrail/CloudWatch evidence as platform operations. These alarms detect sustained spikes; they are not hard quotas or billing caps, and browser caching alone is not a cost cap.

## Validation

Test the broker and the rendered surface separately:

- unauthenticated, malformed, unsupported-style, unsupported-tileset, and oversized requests fail before any provider call;
- rewritten styles contain no provider URL and preserve Hybrid's raster and label tile sets;
- authenticated map assets are `private`, provider freshness can shorten the local cache cap, valid `ETag` values survive the broker, and `SingleUse` Places responses are `no-store`;
- attribution remains visible after first load and style changes;
- autocomplete and place lookup are US-scoped, bounded, biased when possible, and `SingleUse`;
- stale search results cannot replace newer ones, and query text survives loading and failure;
- selecting an address only recenters the map;
- switching styles reinstalls overlays and preserves unsaved geometry;
- unsupported provider tile URLs and out-of-range tile coordinates fail before a provider call;
- provider errors expose only a stable application error;
- a basemap failure still leaves region data and editing usable on the flat style;
- narrow-width layout, keyboard focus, status announcements, and contrast remain usable.
- Terraform creates the three `AWS/Location` usage alarms in the owning account with the expected dimensions, thresholds, evaluation policy, and SNS action.

## Graduation boundary

Route optimization, technician tracking, geofencing events, offline tile packs, persisted geocoding, or a general map capability for arbitrary artifacts are separate contracts. They require explicit data-retention, IAM, metering, privacy, and runtime design rather than expansion of this example.
