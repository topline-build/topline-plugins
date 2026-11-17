---
name: topline-company-memory
description: Read and write Topline company memory through the Topline MCP `memory` tool. Use when the user states a company decision, policy, owner, process, customer fact or correction, asks you to remember something for the company or for themselves, or asks what the company decided about something.
---

# Topline company memory

Company memory holds attributed facts people in this company stated. Use the
`memory` tool on the `topline` server (or a named Topline Workspace MCP). It is
listed only when company memory is on for the account; if it is missing, say so
and stop.

## Read

Use `action: "search"` with a short `query` before answering a question about how
the company works, and before any save. A result of `kind: "contested"` holds two
memories that disagree: use both, say who said what and when, and suggest the user
settles it in Topline chat.

## When to save

`action: "save"` publishes immediately with the user as author. Use it **only when
the user asked in their own words** ("remember that…", "save this for the team").
Otherwise, when the user states something durable, suggest it in chat and save
only if they say yes:

- a decision, policy, owner, process or customer fact;
- a correction ("no, actually…");
- a standing rule: "going forward", "we always", "we never".

Never save your own inference, code or data you read, or casual chat.

## How to save

1. **Search first.** Skip the save if the fact is already there; reuse an existing
   subject's exact name.
2. **Quote the user** in `quote`, word for word.
3. **Subject and attribute.** `subject` is the thing ("ARX billing"), `attribute`
   the property ("invoice day"), `value` the answer ("25th"); `claim` is one plain
   sentence a teammate could read cold.
4. **Validity** when the user gives one: `validUntil` `{kind:"date",at}` for "until
   Dec 31", `{kind:"condition",text}` for "while Dana owns billing".
5. **Scope.** Default is `personal`. Use `scope: "company"` only when the user says
   it is for the team; it needs company memory write access.
6. **Batch related facts:** one save per fact, not one merged claim.

The result says `corroborated` (already known), `superseded` (replaced the user's
own older value) or `contested` (disagrees with a teammate): tell the user which.

## Examples

| User says | Do |
| --- | --- |
| "Remember for the team: ARX invoices go out on the 25th." | Search, then save with `scope: "company"`, quoting them. |
| "Going forward we never book Saturday installs." | Suggest saving it; save only after they agree. |
| "No, actually Kyle owns Greenlogic now. Save that." | Search "Greenlogic owner", then save the correction. |
| You infer from the code that deploys run nightly. | Do not save: your inference. |
| "thanks, that worked" | Do not save: casual chat. |

Report what you saved (subject, scope, outcome) or why you did not.
