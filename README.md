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

```sh
codex plugin marketplace add topline-build/topline-plugins
codex plugin add topline@topline
npx -y @topline-build/harness-mcp@0.9.2 login --url https://<your-account>.topline.build
```

Codex doesn't ask for an address when it installs a plugin, so sign in once with the last command, using your Topline address from Developer Access. If this computer is signed in to one Topline account, the plugin uses it. To use another, put its address in `~/.topline/account` (the plugin says how when it needs one). Start a new Codex chat afterwards. Run `codex plugin marketplace upgrade` to get new versions.

This repository is generated from Topline's source. It holds public setup files and skills only: no account addresses, tokens or user content.
