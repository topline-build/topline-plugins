const { spawn } = require("node:child_process");
const args = ["-y","@topline-build/harness-mcp@0.9.1"];
const env = { ...process.env, TOPLINE_WORKSPACE_ROOT: process.env.TOPLINE_WORKSPACE_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd() };
const address = String(env.TOPLINE_API_URL || "").trim();
try { if (address) env.TOPLINE_API_URL = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `https://${address}`).origin; } catch {}
const child = process.platform === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", "npx", ...args], { stdio: "inherit", windowsHide: true, env })
  : spawn("npx", args, { stdio: "inherit", env });
child.on("error", () => { process.stderr.write("Could not start Topline. Install Node.js and npm.\n"); process.exit(1); });
child.on("exit", code => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
