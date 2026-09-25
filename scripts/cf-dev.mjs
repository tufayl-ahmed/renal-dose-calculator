// Runs the built app plus Pages Functions locally.
//
// Workers AI bindings always run remotely, so `wrangler pages dev` with the
// repo's wrangler.toml requires a Cloudflare login. By default this script
// starts Functions from a staging directory without wrangler.toml, so the API
// runs with no AI binding (curated rules, label parsing and source review still
// work). Set CF_REMOTE_AI=1 after `wrangler login` to use the real AI binding.
import { spawn } from "node:child_process";
import { mkdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "8788";
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
const common = ["pages", "dev", "dist", "--port", port, "--compatibility-date=2026-05-06"];

let cwd = root;
let args = common;

if (process.env.CF_REMOTE_AI !== "1") {
  // Wrangler searches parent directories for wrangler.toml, so stage outside the repo.
  cwd = path.join(os.tmpdir(), "renal-dose-calculator-local-dev");
  await rm(cwd, { recursive: true, force: true });
  await mkdir(cwd, { recursive: true });
  for (const entry of ["dist", "functions", "src", "node_modules"]) {
    await symlink(path.join(root, entry), path.join(cwd, entry));
  }
  args = [...common, "--binding", "AI_FREE_MODE=true", "--binding", "FREE_AI_DAILY_REQUEST_LIMIT=200"];
  console.log("Starting Pages Functions without Workers AI (set CF_REMOTE_AI=1 to enable).");
}

const child = spawn(wrangler, args, { cwd, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
