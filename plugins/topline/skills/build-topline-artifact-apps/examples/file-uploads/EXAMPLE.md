# File uploads

## Example user request

"Build an expense report app: people add expenses and attach receipt photos or
PDFs up to 25 MB, and approvers open the receipts for the expenses they approve."

## Fit and starting point

This is the golden example for apps that take files from people: receipts,
job-site photos, inspection reports, signed forms. Start from any Node
template that ships `src/vendor/artifact-uploads.js` (`artifact-draft`,
`internal-tool`, `react-dashboard`), or `table-approvals-app` when the files
belong to rows people approve. Records live in company tables through server
table SQL; files live in a storage binding with `uploads`.

## Topology and contract decisions

- One `read_write` storage binding with an `uploads` block, and an
  `onComplete` route the platform calls once a receipt passes its checks:

  ```json
  {
    "routes": [
      { "path": "/", "kind": "page", "handler": "artifactApp" },
      { "path": "/_artifact/api/*", "kind": "api", "handler": "artifactApp" }
    ],
    "serverTables": true,
    "storageBindings": [{
      "name": "receipts", "access": "read_write",
      "uploads": { "maxBytes": 26214400, "types": ["image/*", "application/pdf"],
                   "viewerAccess": "own", "onComplete": "/_artifact/api/receipts/uploaded" }
    }]
  }
  ```

- The page calls `upload(file, { binding: "receipts" })` from the vendored
  helper. The file goes straight to storage; no file body passes through the
  app's routes, and there is no chunking or stitching code.
- To tie the receipt to an expense, the page first creates the expense row
  (server code, server table SQL) and remembers its id. The `onComplete` route
  receives `{ key, size, type, filename, uploadedBy }`, checks the uploader
  owns an open expense, and writes the key on that row. If not, it answers
  422 `{ "reason": "no open expense" }`: the platform deletes the file and the
  page shows the reason. The route's JSON answer (for example the expense id)
  comes back to the page as `result.app`.
- If the callback times out, the page gets `status: "pending"`; the file is
  kept. Reconcile by listing files (`listFiles("receipts")`) against expense rows.
- `viewerAccess: "own"` means a person sees only their own receipts. An
  approver's page asks the server for receipt links, and the server checks the
  approver role, then calls
  `platformStorage.shareLink(req, "receipts", { key, viewerEmail: approver })`
  and returns the relative URL.

## Boundary

The platform picks keys and checks size, sniffed type and checksum before the
app hears about a file. Never accept files in your own routes (the proxy limit
is 4,500,000 bytes), never presign browser links for these files, and never
let the browser name a key. Public uploads (a quote form on a public route) are
not supported yet. Drafts keep their uploads apart from live for 7 days.
