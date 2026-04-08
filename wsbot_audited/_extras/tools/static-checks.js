const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const files = fs.readdirSync(root)
  .filter(name => /\.(gs|html|md|json)$/.test(name))
  .filter(name => name !== 'static-checks.js');
const issues = [];
const forbiddenBranding = /(?:WAPB|Wapb|wapb)/;
const staleRelease = /7\.1\.2-security-ops-hardened|stage7-1-2-security-ops-hardened-baseline|gas_wapb_/i;
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/WASB_WHATSAPP_SENDER_TAB/.test(text)) {
    issues.push(`${file}: legacy whatsapp target name found`);
  }
  if (forbiddenBranding.test(text)) {
    issues.push(`${file}: forbidden non-WASB naming found`);
  }
  if (staleRelease.test(text)) {
    issues.push(`${file}: stale release naming/version marker found`);
  }
}
const result = { ok: issues.length === 0, issues };
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
