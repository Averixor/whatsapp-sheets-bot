import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const configPath = path.join(root, "jsconfig.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const JS_INPUT_EXT = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function globToRegex(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  let re = "^";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        re += ".*";
        i++;
        if (normalized[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += ".";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re);
}

const include = config.include || [];
const exclude = (config.exclude || []).map(globToRegex);
const allFiles = walk(root);
const matched = [];

for (const pattern of include) {
  const re = globToRegex(pattern.replace(/\\/g, "/"));
  for (const file of allFiles) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (!re.test(rel)) continue;
    if (exclude.some((ex) => ex.test(rel))) continue;
    matched.push(rel);
  }
}

const tsserverInputs = matched.filter((rel) =>
  JS_INPUT_EXT.has(path.extname(rel).toLowerCase()),
);

if (!tsserverInputs.length) {
  console.error("verify-jsconfig: FAIL — no .js/.mjs inputs for jsconfig");
  process.exit(1);
}

console.log(
  "verify-jsconfig: OK — tsserver inputs:",
  tsserverInputs.join(", "),
);
if (matched.length > tsserverInputs.length) {
  console.log(
    "verify-jsconfig: note — also matched (IDE/GAS, not tsserver):",
    matched.filter((r) => !tsserverInputs.includes(r)).length,
    "files",
  );
}
