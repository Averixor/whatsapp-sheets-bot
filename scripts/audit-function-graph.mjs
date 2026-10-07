#!/usr/bin/env node
/**
 * Validates bound GAS entry points: menu, triggers, gsRun, Api.run, google.script.run.
 * Internal helpers (_prefix) and documented compatibility aliases are allowlisted.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "whatsapp-sheets-bot-git"]);

function walk(dir, exts, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(repoRoot, p).replace(/\\/g, "/");
}

function topLevelGsDefs(file, text) {
  const defs = [];
  text.split("\n").forEach((line, i) => {
    const m = line.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) defs.push({ name: m[1], file, line: i + 1 });
  });
  return defs;
}

function collectBoundRefs(file, text) {
  const refs = [];
  const add = (name, kind, index) => {
    refs.push({
      name,
      file,
      line: text.slice(0, index).split("\n").length,
      kind,
    });
  };
  let m;
  const patterns = [
    {
      re: /\.add(?:Item|SubMenu)\s*\([^,]+,\s*['"]([A-Za-z_$][\w$]*)['"]/g,
      kind: "menu",
    },
    {
      re: /ScriptApp\.newTrigger\s*\(\s*['"]([A-Za-z_$][\w$]*)['"]/g,
      kind: "trigger",
    },
    {
      re: /(?:gsRun|Api\.run)\s*\(\s*['"]([A-Za-z_$][\w$]*)['"]/g,
      kind: "client",
    },
  ];
  for (const { re, kind } of patterns) {
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text))) add(m[1], kind, m.index);
  }

  // google.script.run is a fluent client bridge. Handler calls may contain nested
  // functions, arrows, or google.script.host.close(), so a single regex can
  // mistake withSuccessHandler/withFailureHandler for a server endpoint.
  const bridgeHelpers = new Set([
    "withSuccessHandler",
    "withFailureHandler",
    "withUserObject",
  ]);
  const runRe = /google\.script\.run/g;
  while ((m = runRe.exec(text))) {
    const start = m.index;
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const commentStart = text.indexOf("//", lineStart);
    if (commentStart >= 0 && commentStart < start) continue;
    const endCandidates = [";\n", ";", "\n</script>"].map((token) => {
      const idx = text.indexOf(token.replace("\\n", "\n"), start);
      return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
    });
    const end = Math.min(...endCandidates, text.length);
    const stmt = text.slice(start, end);
    const methodRe = /\.([A-Za-z_$][\w$]*)\s*\(/g;
    let method;
    let target = null;
    while ((method = methodRe.exec(stmt))) {
      const name = method[1];
      if (!bridgeHelpers.has(name)) target = { name, offset: method.index };
    }
    if (target) add(target.name, "client", start + target.offset);
  }
  return refs;
}

const ALLOW_ORPHAN = [
  /^_/,
  /^test[A-Z]/,
  /^debug[A-Z]/,
  /^runStage7/,
  /^runAll/,
  /^runScenario/,
  /^runHistorical/,
  /^runRegression/,
  /^runAccess/,
  /^runDuplicates/,
  /^runFiles/,
  /^runFull/,
  /^runSheets/,
  /^runTests/,
  /^apiStage4/,
  /^apiStage5/,
  /^apiStage7.*Manual$/,
  /^apiExecute_$/,
  /^apiLoadCalendarDay$/,
  /^apiBuildSendPanelFast$/,
  /^apiGenerateSendPanelForDateFast$/,
  /^apiResetAllSentFast$/,
  /^apiMarkRowSentFast$/,
  /^showLinkDialog/,
  /^showMultipleDialog/,
  /^showSingleDialog/,
  /^stage7PreviewTemplate/,
  /^stage7RenderTemplate/,
  /^wasbInstall/,
  /^wasbRepair/,
  /^wasbAccessAutoFill/,
  /^testNotifyWithTemplate/,
  /^testVacationEngine/,
  /^testWasbAccess/,
  /^testAccessControl/,
  /^testCommanderPhone/,
  /^testInclude/,
  /^testDiagnostics/,
];

const gsFiles = walk(repoRoot, [".gs"]);
const htmlFiles = walk(repoRoot, [".html"]);

const defNames = new Set();
for (const file of gsFiles) {
  for (const d of topLevelGsDefs(file, fs.readFileSync(file, "utf8"))) {
    defNames.add(d.name);
  }
}

const boundRefs = [];
for (const file of [...gsFiles, ...htmlFiles]) {
  boundRefs.push(...collectBoundRefs(file, fs.readFileSync(file, "utf8")));
}

const refsByName = new Map();
for (const r of boundRefs) {
  if (!refsByName.has(r.name)) refsByName.set(r.name, []);
  refsByName.get(r.name).push(r);
}

const missing = [];
for (const [name, refs] of refsByName) {
  if (defNames.has(name)) continue;
  missing.push({ name, refs });
}
missing.sort((a, b) => a.name.localeCompare(b.name));

function isAllowedOrphan(name) {
  return ALLOW_ORPHAN.some((re) => re.test(name));
}

const PUBLIC_ORPHAN_TARGETS = [
  "sendFromSidebar",
  "sendAllFromSidebar",
  "addAlert",
  "addAlertsBatch",
  "clearOldAlerts",
  "getAlertsStatistics",
  "getRecentAlerts",
  "resetAlertsSchemaCache",
];

const publicOrphans = PUBLIC_ORPHAN_TARGETS.filter(
  (n) => defNames.has(n) && !refsByName.has(n),
);

let exitCode = 0;
console.log(
  "function-graph-audit: bound refs",
  boundRefs.length,
  "| defs",
  defNames.size,
);

if (missing.length) {
  exitCode = 1;
  console.error("\nMISSING (bound ref without top-level function):");
  for (const m of missing) {
    const s = m.refs[0];
    console.error(`  ${m.name} <- ${s.kind} ${rel(s.file)}:${s.line}`);
  }
} else {
  console.log("MISSING: none");
}

process.exit(exitCode);
