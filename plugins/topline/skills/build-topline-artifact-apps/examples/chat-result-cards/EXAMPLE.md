# Chatbot that answers with charts

## Example user request

"Build our office managers a chat page where they can ask about this month's
jobs and see the answer as a chart or table, not just text."

## Fit and kit

Start from the `chat-assistant` template (`init-app --template chat-assistant`,
`workspace_initialize_app` with that template, or `platform_init_artifact_app`
with `starter: "chat-assistant"` from the Build MCP). It is already this pattern:
a React chat page, a Node server with one private `POST /_artifact/api/chat`
route, the Bedrock client, local checks, and the A2UI results kit vendored in
`src/vendor/a2ui-results/`. The kit is the same card catalog Topline chat
draws (A2UI v0.9, catalog `topline-results`), so there is no chart code to
write and nothing to invent. What you change:

1. `src/data.js`: replace `loadAnswerData` with a bounded read of the real
   numbers (server table SQL with `serverTables: true`, a declared source, or
   a live dataset) and a one-line description of what a row is. It returns
   `null` until then, and the chat says no data is connected.
2. `SYSTEM` in `src/chat-route.js`: say who asks and about what.
3. The title and intro in `src/app.jsx` and `src/index.js`, and the
   manifest `id` and `title`.
4. `src/check.mjs`: keep every check; add one for your data shape.

Never edit `src/vendor/a2ui-results/`, and never hand-write chart or card
components for chat answers. Cards: `BarChart` (compare amounts), `ShareBar`
(parts of a whole), `Trend` (change over time), `Stats` (up to 6 key numbers),
`Table` (rows) and `Text`. Display only: no buttons, forms or actions.

To add cards to an existing app instead, copy `scripts/artifacts/lib/a2ui-results/`
unchanged into the app's `src/vendor/a2ui-results/` (into both parts when the
page and the server are separate parts) and follow the route below. The
server half (`tool.js`) needs a Node server.

This is the one reviewed exception to "one Converse call, no tools" in
[Bounded Bedrock assistant](../bounded-bedrock-assistant/EXAMPLE.md): same
inference role, model variable and safe `503`, plus exactly one display tool
and a hard cap of 3 `Converse` calls per question. Use it when the person asks
for a chatbot or question box whose answers include charts or tables; any
other tool, model-run query or memory still needs review.

## Contract decisions

- The browser posts `{ question }` to `./_artifact/api/chat`. Follow-up
  questions ("and last month?") need history; add it only when the person asks
  for a conversation. Then the browser also sends `history` as
  `[{ role, text }]`, and the server rebuilds the Converse turns from it:
  text only, at most 6 turns of 4,000 characters, starting with `user`,
  alternating roles, ending with `assistant` (drop anything else). Cards are
  never sent back, and history never carries data.
- The server loads the numbers the answer needs (a bounded live SQL dataset,
  server table SQL or a declared source) and puts them in the system prompt as
  compact JSON or a small table. The model only arranges numbers it was given.
- The server calls `answerWithResults` from `tool.js` with its own `converse`
  function. That turn offers one tool, `show_result`, checks each call with
  `parseResultMessages`, sends every problem back once for a fix, and drops the
  cards (answer in words) if the retry fails. It never makes more than 3 model
  calls.
- The route returns `{ text, result: { messages } | null, truncated }`. Return
  the A2UI messages unchanged; the page checks them again before drawing.
- No other tools, no memory beyond the capped history, no streaming, no
  caller-supplied model or prompt.

## Server route (Node)

The template's `src/chat-route.js` and `src/bedrock.js` do this; the core is:

```js
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { answerWithResults } from "./vendor/a2ui-results/tool.js";

// bedrock() is the role-assuming client from the Bounded Bedrock assistant example.
const client = await bedrock();
const reply = await answerWithResults({
  converse: (params) => client.send(
    new ConverseCommand({ modelId: process.env.PLATFORM_ARTIFACT_BEDROCK_MODEL_ID, ...params }),
    { abortSignal: AbortSignal.timeout(36_000) }
  ),
  system: `You answer office managers' questions about this month's jobs.\nData (JSON): ${JSON.stringify(rows)}`,
  messages: [...history, { role: "user", content: [{ text: question }] }]
});
return json(200, { text: reply.text, result: reply.result, truncated: reply.truncated });
```

Keep the output budget and the per-call timeout together: the template passes
`maxTokens: 2500` (about 50 table rows) and gives each call 36 seconds
(`AbortSignal.timeout(36_000)`), so three calls fit `resources.timeoutSeconds:
120`. A call cut off at the token limit is answered with "too long, use fewer
rows" and counts as the one retry; a call that hits the timeout instead becomes
the safe 503, so don't raise `maxTokens` without raising the timeouts. Catch
every error into the safe unavailable response.

## Page (React)

```jsx
import { ResultCards } from "./vendor/a2ui-results/ResultCards.jsx";
import "./vendor/a2ui-results/result-cards.css";

function Answer({ reply }) {
  return (
    <div className="answer">
      {reply.result && <ResultCards messages={reply.result.messages} />}
      <p>{reply.text}</p>
    </div>
  );
}
```

esbuild writes the imported CSS next to the JS bundle. The template's build
inlines it into the page and fails when the card styles are missing; in
another app, link or inline that CSS file, or the cards draw with no bars. The cards use the customer's ProductUI
`--storyboard-*` tokens when the page also loads the vendored design-system
`tokens.css` (copy and link it the way `connector-app`'s `build.mjs` does);
without it they use neutral fallbacks. Restyle with your own rules after
`result-cards.css`, never by editing it.

## Validation and controls

- Stub `converse` in local checks (it is a plain function): a good
  `show_result` call returns cards in 2 calls; a bad one is retried once with
  the problems; two bad calls return `result: null` with words; never more
  than 3 calls; no session means 401 and zero calls.
- The template's `src/check.mjs` checks that the page uses the relative route
  and `ResultCards`, and that the built page carries the card styles; keep
  those checks in another app too.
- Rendered smoke: ask one comparison question and one plain question; the first
  shows a card with a Chart/Table switch, the second shows only text.
- Compare a card's headline number with a direct control query, as for any
  dashboard.

## Limitations

One display tool per answer. Data lookups by the model (SQL tools, retrieval),
actions from cards, streaming and saved conversations are outside this
pattern and need review as a larger architecture.
