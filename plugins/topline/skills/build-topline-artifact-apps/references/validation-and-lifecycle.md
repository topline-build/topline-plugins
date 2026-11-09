# Validation and Lifecycle

The target outcome is a reviewed, smoke-tested draft with validation evidence.
It is not a live release: promotion is an operator action.

## Exact artifact-app sequence

1. Read operator instructions and inspect the approved data/tool surface.
2. Build or change the artifact app source from a blessed template.
3. Run local validation from the repository root and correct package/manifest
   failures.
4. Commit the artifact manifest/version with `commit_artifact`.
5. In AgentCore, run `topline-agent-source-sync`.
6. Call `sync_artifact_app_source` with the printed source archive.
7. Call `deploy_artifact_app_draft` using the committed artifact/version and
   app directory; if it is in flight, poll `artifact_app_deployment_status`.
8. Call `run_artifact_app_smoke` against that draft.
9. Call `prepare_artifact_app_validation` to assemble validation evidence.
10. Call `request_validation` and leave the validated draft for operator
    review/promotion.

Do not skip source sync, treat a build as a deploy, smoke an ambiguous version,
or use direct cloud commands. If an expected bridge tool is absent, stop with
the exact tool name and the blocker.

## Machine size and resource failures

An app's machine size lives in the manifest's optional `resources`. When it is
absent, the app gets 512 MB memory, 30 seconds per request, 512 MB of `/tmp`,
and a 1 vCPU / 2 GB build with up to 60 minutes.

```json
{
  "resources": {
    "memoryMb": 1024,
    "timeoutSeconds": 60,
    "ephemeralStorageMb": 1024,
    "build": { "cpu": 2048, "memoryMb": 4096 }
  }
}
```

- Leave `resources` out until something actually runs out. Do not ask the user
  about memory or time.
- When `deploy_artifact_app_draft`, `run_artifact_app_smoke`, or
  `artifact_app_logs` returns `resourceAdvice` with a `suggested` value, set
  that field in `artifact-app.json`, commit, redeploy the draft, and smoke it
  again. Do this at most twice for the same problem.
- When `resourceAdvice.atCeiling` is true, or the problem keeps coming back,
  change the code instead (page the work, stream, precompute) and tell the user
  in one plain sentence what changed.
- `resources_above_ceiling` means the value is above this customer's limit:
  lower it or make the code need less.
- `account_limit` means the customer's AWS account refused the size; keep the
  previous size and tell the user Topline needs to raise the account limit.
- Response size cannot be raised (about 5 MB per app response). Page, compress,
  or precompute large data.
- A live app that keeps running out of memory or time is raised one size
  automatically by Topline (same code, within the limit, at most three times
  per version). Its artifact problem names the new value, for example
  "Set resources.memoryMb to 1024". Put that value in `artifact-app.json`
  (or the part's `resources`) in the next draft so promoting it keeps the size,
  then resolve the problem.
- Build cpu and memory must be a valid pair: 1024 cpu with 2048-8192 MB, 2048
  cpu with 4096-16384 MB, 4096 cpu with 8192-30720 MB.

## Evidence gates

| Gate | What it proves | It does not prove |
| --- | --- | --- |
| Local validation/test | Package and manifest are locally coherent. | Deployment, source availability, viewer access, or data correctness. |
| Draft deployment | The committed version reached a draft runtime. | The UI works or data is valid. |
| Smoke | The draft's critical route/UI behavior is reachable. | User acceptance, required-check satisfaction, or live publication. |
| Data validation | Bounded source queries and visible metrics match the intended data contract. | Operator approval. |
| `request_validation` | Evidence is available for review. | Promotion. |

For dashboard work, validate an all-data view and a representative scoped view
against direct bounded read-only SQL, including metric definitions and freshness
state. Test the declared routes and security boundary, then inspect the draft at
desktop and mobile sizes when the app has a visual surface. Required checks
written by the operator and trusted deployment evidence remain publish blockers.

For an MCP server artifact, local validation must exercise the mounted ASGI/HTTP
route with fresh clients: initialize, `tools/list`, a representative
`tools/call`, stateless JSON behavior, and preserved annotations. Update the
expected discovery catalog, representative call, and annotation assertions when
tools change. Draft smoke still proves the private operational page and deployed
bundle. The authenticated machine ingress is live-only, so after operator
promotion a workspace manager must connect the artifact and run the real
connection check before reviewing or enabling tools. A successful local or
draft smoke is not evidence that the live broker credential, deployed route, or
tool grant works.

Only an operator may promote a reviewed draft. A deployment state may move
through `not_deployed`, `deploying`, `deployed`, `deploy_failed`,
`validation_failed`, `promoted`, or `rolled_back`; do not call `deployed` or
`validated` equivalent to `promoted`.
