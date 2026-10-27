# Topline plugins

The Topline plugin for Claude Code and Codex: build and deploy Topline apps, and use your workspaces, chats and company knowledge.

## Claude Code

```sh
claude plugin marketplace add topline-build/topline-plugins
claude plugin install topline@topline --config topline_url=https://<your-account>.topline.build
```

Or in a session: `/plugin marketplace add topline-build/topline-plugins`, then install `topline` from `/plugin` and enter your Topline address when asked. Your address is in Topline Developer Access.

Node.js and npm are required. Start a new Claude Code session: your browser opens to sign in to Topline, and the Topline tools load after you choose Allow. On a computer with no browser, open the address the Topline server prints.

Turn on auto-update for this marketplace in `/plugin` > Marketplaces to get new versions.

## Codex

Replace https://<your-account>.topline.build in both commands below with the same address from Developer Access before running them.

```sh
node --version
npm --version
node -e "require('fs').mkdirSync(require('os').homedir() + '/.topline', { recursive: true }); require('fs').writeFileSync(require('os').homedir() + '/.topline/account', 'https://<your-account>.topline.build')"
npm exec --yes --package @topline-build/harness-mcp@0.9.2 -- topline-mcp login --surface topline --url https://<your-account>.topline.build
codex plugin marketplace add topline-build/topline-plugins
codex plugin marketplace upgrade topline
codex plugin add topline@topline
```

Check `node --version` (20 or newer) and `npm --version` first. This setup uses npm exec; npx is not required. On Windows, use npm.cmd if PowerShell blocks npm. If Node is present but npm is missing, repair/install Node.js LTS with the npm component, restart Codex, and check both commands again.

Use your exact Topline address from Developer Access. Its guided setup writes `~/.topline/account` before installing the plugin; this explicit account wins over TOPLINE_API_URL inherited by the desktop app. Without a saved choice, the launcher uses an explicitly configured address, else the one signed-in account. It stops rather than guessing between multiple accounts.

Sign-in is not assistant verification. Start a new Codex chat, check that the installed Topline plugin uses the intended account, and call `list_workspaces` with `limit: 1` through that plugin. The returned accountUrl must match the intended account; an empty list counts as success. Only then report connected. If tools cannot be invoked, keep verification pending and report the exact error; do not substitute a shell request or repeat approval. Run `codex plugin marketplace upgrade topline` to get new versions.

This repository is generated from Topline's source. It holds public setup files and skills only: no account addresses, tokens or user content.
