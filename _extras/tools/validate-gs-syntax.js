const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const files = fs.readdirSync(root).filter(name => /\.(gs|html)$/.test(name));
let ok = 0;
let fail = 0;
const failures = [];
for (const file of files) {
  const full = path.join(root, file);
  const raw = fs.readFileSync(full, 'utf8');
  const chunks = file.endsWith('.html')
    ? Array.from(raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(m => m[1])
    : [raw];
  if (!chunks.length) continue;
  for (const chunk of chunks) {
    const sanitized = chunk.replace(/<\?(?:!=|=)?[\s\S]*?\?>/g, '');
    try {
      new vm.Script(sanitized, { filename: file });
      ok += 1;
    } catch (error) {
      fail += 1;
      failures.push({ file, message: error.message });
      break;
    }
  }
}
if (failures.length) {
  console.error(JSON.stringify({ total: ok + fail, ok, fail, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ total: ok + fail, ok, fail }, null, 2));
