# Validation and Lifecycle

The target outcome is a reviewed, smoke-tested draft with validation evidence.
It is not a live release: promotion is an operator action.

## Exact artifact-app sequence

The steps are the same everywhere; the tool names depend on where you run.
Use the column for your surface, and check `tools/list` before relying on a
tool. If an expected tool is absent, stop with its exact name and the blocker.

| Step | Build MCP (Topline plugin, Codex, Claude Code, Cursor) | Topline coding task (bridge tools) |
| --- | --- | --- |
| 1. Find or start | `platform_capability_status`, `platform_list_artifact_apps`, then `platform_start_build_session` (save `sessionId`, `artifactVersionId`, `sourceHash`); `platform_checkout_artifact_app` for an existing app | Read operator instructions and the approved data/tool surface |
| 2. Source | `platform_init_artifact_app` (optionally with a `starter`) for a new app, or edit the checkout | Copy a template from `scripts/artifacts/templates/` |
| 3. Local checks | `npm test` in the app dir, then `platform_inspect_artifact_app`; fix every `problems` entry and keep its bundle SHA-256 | `node scripts/artifacts/validate-local --dir <appDir>` from the repository root |
| 4. Save and deploy the draft | `platform_deploy_artifact_app` with `sessionId`, `artifactVersionId`, `inspectedSourceHash` and `expectedBundleSha256`; then `platform_wait_artifact_deploy` or `platform_deploy_operation` | `commit_artifact`, then `topline-agent-source-sync` and `sync_artifact_app_source` with the printed archive, then `deploy_artifact_app_draft`; poll `artifact_app_deployment_status` until it settles |
| 5. Data (precomputed or cached datasets) | `platform_refresh_artifact_data` | `refresh_artifact_data`, then again with its `refreshTaskName` until the warm settles |
| 6. Smoke and checks | `platform_run_acceptance_checks` (and `platform_run_artifact_smoke` when asked); `platform_read_artifact_logs` for failures | `run_artifact_app_smoke`; `artifact_app_logs` for failures |
| 7. Review | `platform_prepare_artifact_validation`, `platform_request_artifact_validation`, then poll `platform_artifact_validation_status` | `prepare_artifact_app_validation`, then `request_validation` |
| 8. Hand off | `platform_open_artifact`, then `platform_close_build_session` | Leave the validated draft for operator review |

A deploy that is still building is not a platform blocker: wait on the same
operation (each wait call is bounded), and never start a second deploy to
retry an unknown state. Each committed deploy moves a build session to a new
`artifactVersionId`; use the new one next.

A build failure coded `CHECKER_CRASHED` is Topline's, not the app's: its
message names where Topline's build checker crashed. Don't edit the app or
deploy again for it. In a coding task, call `report_platform_blocker` with
category `build_runner`; from a Build MCP client, tell Topline. A failure coded
`CHECK_INTERRUPTED` is an unexpected error the checker did not throw: fix what
it names, and report it only if it names nothing in the app and a second deploy
stops the same way.

Do not skip source sync or inspect, treat a build as a deploy, smoke an
ambiguous version, or use direct cloud commands.

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
- When a deploy, smoke or log read (`platform_deploy_artifact_app`,
  `platform_run_artifact_smoke`, `platform_read_artifact_logs`, or in a coding
  task `deploy_artifact_app_draft`, `run_artifact_app_smoke`,
  `artifact_app_logs`) returns `resourceAdvice` with a `suggested` value, set
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
| Review request (`platform_request_artifact_validation` or `request_validation`) | Evidence is available for review. | Promotion. |

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

## What the reviewer can check

The validation reviewer checks each brief requirement against the page's
rendered text as it first loads, plus the captured console errors and failed
requests. It cannot click, scroll past its reading limit, or read numbers off
a picture. Build the page so every requirement is visible in that text:

- Show required content on load, not behind a button, tab or disclosure, and
  within the first 16,000 characters of page text.
- Use quoted brief wording word for word. A required heading such as
  "How to read this board" must appear exactly; a reworded heading does not
  count.
- A required section needs its own heading and content. The page title or
  subtitle does not count as a section.
- Every request the page makes must succeed. A console error or failed request
  is a needs_fix even when the visible content is complete.

### Charts the reviewer can check

A chart is drawn, so the reviewer can only check it through the text around it.
For every chart a brief asks for:

- Give it a visible title or caption that says what it compares (for example
  "Open jobs by office").
- Label each bar, point or series with its name and value as visible text (for
  example "North 42"), or put a small data table with the same values next to
  it.
- Do not hide the chart's text from the page with `aria-hidden`, and do not
  rely on color, tooltips or hover to carry a required value.

A chart with no text fails review, and a caption alone does not show the values
it compares. For chart design beyond this (scales, comparisons, palette,
contrast, missing data), read the chart system reference in the
`design-dashboard-interfaces` skill.

Only an operator may promote a reviewed draft. A deployment state may move
through `not_deployed`, `deploying`, `deployed`, `deploy_failed`,
`validation_failed`, `promoted`, or `rolled_back`; do not call `deployed` or
`validated` equivalent to `promoted`.
