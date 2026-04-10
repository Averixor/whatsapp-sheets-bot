const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = fs.readdirSync(root).filter(name => /\.(gs|html|md|json)$/.test(name));
const issues = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/WAPB_WHATSAPP_SENDER_TAB/.test(text)) {
    issues.push(`${file}: legacy whatsapp target name found`);
  }
}
const result = { ok: issues.length === 0, issues };
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
