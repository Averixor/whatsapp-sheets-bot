#!/usr/bin/env node
/**
 * Push committed code to GitHub and production Google Apps Script.
 *
 * Run checks first:
 *   npm run check
 *
 * Then deploy:
 *   npm run push:remote
 *
 * Requires: git remote origin, .clasp.json, clasp login.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root, env: process.env });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed${err ? `: ${err}` : ""}`);
  }
  return String(result.stdout || "").trim();
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`WASB push:remote — git push + clasp push (production)

  npm run check          усі локальні перевірки
  npm run push:remote    GitHub + GAS (без повторного CI)

  Потрібно: закомічені зміни, .clasp.json, clasp login.
  Після deploy у GAS: apiStage7ClearPhoneCache()
`);
  process.exit(0);
}

console.log("WASB push:remote");
console.log(`Root: ${root}`);

const dirty = capture("git", ["status", "--porcelain"]);
if (dirty) {
  console.error(
    "\n✗ Є незакомічені зміни. Спочатку commit, потім push:\n" +
      '  git add -A && git commit -m "опис змін"\n' +
      "  npm run push:remote\n" +
      "\nАбо повний pipeline з commit: npm run release -- \"опис змін\"",
  );
  process.exit(1);
}

let branch;
try {
  branch = capture("git", ["branch", "--show-current"]);
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}

if (!branch) {
  console.error("\n✗ Не вдалося визначити поточну git-гілку.");
  process.exit(1);
}

run(`Git push (origin ${branch})`, "git", ["push", "-u", "origin", branch]);

const claspProd = resolve(root, ".clasp.json");
if (!existsSync(claspProd)) {
  console.error("\n✗ Немає .clasp.json — clasp login і прив’яжіть production project.");
  process.exit(1);
}

run("clasp push (production)", "npx", ["clasp", "push"]);

console.log("\n=== push:remote complete ===");
console.log("GitHub: pushed");
console.log("GAS: clasp push done");
console.log("Production GAS (обов’язково): apiStage7ClearPhoneCache()");
