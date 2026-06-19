#!/usr/bin/env node
/**
 * Full release: local CI → git commit/push → clasp push (prod) → smoke push+run.
 *
 * Usage:
 *   npm run release -- "fix: vacation sidebar bootstrap"
 *   WASB_RELEASE_MSG="fix: ..." npm run release
 *
 * Flags:
 *   --no-commit     skip git commit (fails if tree dirty unless combined with intent)
 *   --no-git-push   skip git push
 *   --skip-smoke    skip smoke project push + apiRunSmokeChecks
 *   --allow-dirty   proceed without commit when tree has changes (--no-commit implied)
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const messageArg = argv.find((a) => !a.startsWith("--")) || "";
const message = messageArg || process.env.WASB_RELEASE_MSG || "";

const skipCommit = flags.has("--no-commit") || flags.has("--allow-dirty");
const skipGitPush = flags.has("--no-git-push");
const skipSmoke = flags.has("--skip-smoke");
const allowDirty = flags.has("--allow-dirty");

if (flags.has("--help") || flags.has("-h")) {
  console.log(`WASB release — CI, git, clasp prod, smoke

  npm run release -- "опис змін"
  WASB_RELEASE_MSG="опис" npm run release

  --allow-dirty   deploy без commit (якщо є незакомічені файли)
  --no-git-push   без git push
  --skip-smoke    без smoke project
  --help          ця довідка
`);
  process.exit(0);
}

function run(label, cmd, args) {
  if (label) {
    console.log(`\n=== ${label} ===`);
  }
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

function gitPorcelain() {
  return capture("git", ["status", "--porcelain"]);
}

function stepCount() {
  let n = 2; // CI + prod push
  if (!skipCommit) n += 1;
  if (!skipGitPush) n += 1;
  if (!skipSmoke) n += 1;
  return n;
}

const total = stepCount();
let step = 0;
function nextLabel(name) {
  step += 1;
  return `${step}/${total} ${name}`;
}

console.log("WASB release pipeline");
console.log(`Root: ${root}`);

run(nextLabel("CI (npm run ci)"), "npm", ["run", "ci"]);

const dirty = gitPorcelain();
if (dirty) {
  if (!skipCommit) {
    if (!message) {
      console.error(
        "\n✗ Є незакомічені зміни. Передайте message:\n" +
          '  npm run release -- "короткий опис змін"\n' +
          "  або WASB_RELEASE_MSG=... npm run release\n" +
          "  або --allow-dirty щоб пропустити commit",
      );
      process.exit(1);
    }
    const commitLabel = nextLabel("Git commit");
    console.log(`\n=== ${commitLabel} ===`);
    run("", "git", ["add", "-A"]);
    run("", "git", ["commit", "-m", message]);
  } else if (!allowDirty) {
    console.warn("\n⚠ Робоче дерево не чисте (--no-commit). Продовжую без commit.");
  } else {
    console.log("\n— Git commit пропущено (--allow-dirty).");
  }
} else {
  console.log("\n— Немає локальних змін для commit.");
}

if (!skipGitPush) {
  const branch = capture("git", ["branch", "--show-current"]);
  run(nextLabel(`Git push (origin ${branch})`), "git", ["push", "-u", "origin", branch]);
} else {
  console.log("\n— Git push пропущено (--no-git-push).");
}

const claspProd = resolve(root, ".clasp.json");
if (!existsSync(claspProd)) {
  console.error("\n✗ Немає .clasp.json — виконайте clasp login і прив’яжіть production project.");
  process.exit(1);
}
run(nextLabel("clasp push (production)"), "npx", ["clasp", "push"]);

if (!skipSmoke) {
  const claspSmoke = resolve(root, ".clasp.smoke.json");
  if (!existsSync(claspSmoke)) {
    console.warn("\n⚠ Немає .clasp.smoke.json — smoke deploy пропущено.");
  } else {
    run(nextLabel("deploy:smoke (push + apiRunSmokeChecks)"), "npm", ["run", "deploy:smoke"]);
  }
} else {
  console.log("\n— Smoke deploy пропущено (--skip-smoke).");
}

console.log("\n=== Release complete ===");
console.log("Production GAS (обов’язково після deploy): apiStage7ClearPhoneCache()");
console.log("Опційно: apiStage7QuickHealthCheck() або apiRunStage7Diagnostics({ mode: 'quick' })");
