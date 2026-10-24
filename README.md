# Topline plugins

The Topline plugin for Claude Code: build and deploy Topline apps, and use your workspaces, chats and company knowledge.

```sh
claude plugin marketplace add topline-build/topline-plugins
claude plugin install topline@topline --config topline_url=https://<your-account>.topline.build
```

Or in a session: `/plugin marketplace add topline-build/topline-plugins`, then install `topline` from `/plugin` and enter your Topline address when asked. Your address is in Topline Developer Access.

Node.js and npm are required. Then sign in once: run `npx -y @topline-build/harness-mcp@0.9.1 login --url https://<your-account>.topline.build`. Your browser opens; choose Allow.

Turn on auto-update for this marketplace in `/plugin` > Marketplaces to get new versions.

This repository is generated from Topline's source. It holds public setup files and skills only: no account addresses, tokens or user content.
