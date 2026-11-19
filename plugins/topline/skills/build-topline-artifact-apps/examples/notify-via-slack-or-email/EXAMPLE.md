# Notify via Slack or email

## Example user request

"When a new lead comes in, post it to our #sales Slack channel, and email the
manager a daily summary."

## Fit and template

Start from `scripts/artifacts/templates/python-api` (or the Node server part
of the template you already use). Topline does not send notifications for an
app and has no sender of its own: the app sends through the customer's own
Slack workspace or email provider, with a key the person provides through a
request card. Nothing here is a Topline-paid service.

## Getting the key

Follow "Getting a key" in `references/security-and-runtime-boundaries.md`:

- **Slack:** `platform_request_build_secret` with `name: "slack_webhook_url"`,
  `label: "Slack webhook for new-lead alerts"`, a reason such as "So the app
  can post each new lead to #sales", and `hint: "Slack › Apps › Incoming
  Webhooks › Add New Webhook to Workspace, pick #sales, copy the URL"`.
- **Email:** request the provider's server API key, e.g. `name:
  "postmark_server_token"` (Postmark), `"resend_api_key"` (Resend) or
  `"sendgrid_api_key"` (SendGrid), with a hint naming where the provider shows
  it. The sender address must be on the customer's own verified domain; ask the
  person which address to use and keep it in app settings, not in source.

Tell the person to open `threadUrl` and fill the card. Keep building; poll
`platform_list_build_secrets` before deploying and bind each approved key
exactly as listed:

```json
"secretBindings": [
  { "name": "slack_webhook_url", "env": "SLACK_WEBHOOK_URL_SECRET_ARN", "secretArn": "<secretArn from platform_list_build_secrets>" }
]
```

## Sending

Send from a server route or a schedule only. The browser never sees the key or
calls the provider.

```py
import httpx
from platform_artifact_secrets import get_secret

def post_to_slack(text: str) -> None:
    url = get_secret("slack_webhook_url")
    # Bounded: one message, one attempt, a short timeout.
    response = httpx.post(url, json={"text": text[:3000]}, timeout=5.0)
    response.raise_for_status()
```

For email, call the provider's HTTPS send endpoint the same way (one request,
a short timeout, the provider key from `get_secret`), with a bounded subject
and body.

## Rules

- Send from server routes or schedules only, never from the page.
- Keep each message bounded: cap its length and the number of recipients.
- A failed send is visible app state: record it (for example a `last_send`
  row with status and time in a table) and show it on the admin page. Never
  fail silently.
- No retry storms: at most one retry with a delay, and never retry inside a
  schedule that runs again soon anyway.
- Never log the key, the webhook URL or a full provider response.

## Send test

Give the app's admin page a **Send test** button that calls a private route
(`POST ./_artifact/api/notify/test`) sending one fixed message, and shows the
result. The person uses it to confirm delivery before publishing.

## Limits, stated plainly

- No inbound replies: a Slack reply or an email answer does not reach the app.
- No per-recipient preferences or unsubscribe management.
- Rotating the key: fill a new request card (or replace the value on the app's
  settings when that is available); removing it takes effect on the next deploy.
