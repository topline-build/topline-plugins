# Viewer-scoped customer portal

## Example user request

"Give each signed-in tenant customer a small portal showing only their own current account status."

## Fit and template

This is the narrow viewer-scoped, read-only binding path: the data is already exposed as `customers`, every returned row can be matched to the signed-in viewer's email, and every descriptor field returned by that resource is safe for that viewer. Start from `scripts/artifacts/templates/viewer-scoped-dashboard`.

Do not use this specimen for staff-wide search, arbitrary row-level rules, joins, writes, or a resource containing fields that must not reach the matched viewer. Those require a bounded dataset, an approved backend, runtime projection enforcement, or platform-service work.

## Topology and contract decisions

- `/` is tenant-viewable for signed-in tenant users; `viewerPolicy: "tenant"` admits the page before row filtering.
- The live `viewer` binding requires `customers.email` to equal the signed-in viewer email. Never accept an email or customer ID parameter as an authorization substitute.
- The current connector path returns its descriptor row after filtering. Manifest `projection` is not a field-level security boundary, so this example omits it and requires the entire descriptor to be safe. Render an explicit UI allowlist anyway.
- Viewer bindings are served `no-store`. Display returned source freshness/warnings rather than claiming a TTL guarantee.
- This is read-only and has no app-owned state, datasets, schedules, secrets, or background work.

## Token bootstrap and relative fetch

Preserve the blessed template's token bootstrap. The platform proxy supplies `x-artifact-binding-tokens` to the server handler; the handler parses the `customers` token and injects only that serialized value into the page. The browser uses it on the relative request:

```js
function customerFetch(customersToken) {
  return fetch("./_artifact/data/customers", {
    headers: { "x-artifact-binding-token": customersToken }
  });
}
```

Do not invent a client token endpoint or log the token. Map `403 viewer_policy_no_authorized_rows` for a signed-in nonmatching viewer to `No customer record is linked to this email`; never broaden the query or substitute example rows.

## Validation and controls

- Confirm current source metadata has `customers.email`, identity semantics match the platform viewer email, and every returned descriptor field is approved for viewer exposure.
- Test a matching viewer receives `200` with only their rows, a nonmatching viewer receives `403 viewer_policy_no_authorized_rows`, and no session receives `401`.
- Run the template tests and `node scripts/artifacts/validate-local --dir <appDir>` from the repository root.
- Complete commit, source sync, draft deployment, rendered smoke, validation preparation, and validation request. Prove the token bootstrap without logging tokens, no sample rows, and useful loading, no-record, freshness, and unavailable states.

## Limitations and graduation boundary

Manifest v2 supports this narrow `customers`/`email` viewer filter only. Field minimization, multi-resource joins, other ownership rules, writes, invitations, or public access require an explicitly reviewed backend or platform change.
