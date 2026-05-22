#!/usr/bin/env node
/**
 * One-time opt-in: write stage7-usecases-facade.json from live code.
 * Does NOT run in default CI. Requires manual contracts/SNAPSHOT_CHANGELOG.md entry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, loadEnvelopeFieldTypes, repoRoot } from './lib/load-contract.mjs';

const facadeContract = loadContract('facade.contract.json');
const DEFAULT_ENVELOPE = loadEnvelopeFieldTypes();
const snapshotPath = path.join(repoRoot, facadeContract.snapshotPath);

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function extractNamedFunctionsBeforeReturn(text, iifeMarker) {
  const start = text.indexOf(iifeMarker);
  if (start < 0) return {};
  const iifeEnd = text.indexOf('})();', start);
  if (iifeEnd < 0) throw new Error(`${iifeMarker} close not found`);
  const iifeBody = text.slice(start, iifeEnd);
  const returnIdx = iifeBody.lastIndexOf('  return {');
  if (returnIdx < 0) throw new Error(`${iifeMarker} return block not found`);
  const body = iifeBody.slice(0, returnIdx);
  const methods = {};
  const fnRe = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(body))) {
    const name = m[1];
    const params = m[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split('=')[0].trim());
    methods[name] = {
      name,
      paramCount: params.length,
      paramOrder: params,
      envelope: { ...DEFAULT_ENVELOPE },
    };
  }
  return methods;
}

function extractDomainImplementations() {
  const methods = {};
  for (const [rel, marker] of facadeContract.domainFiles) {
    if (!fs.existsSync(path.join(repoRoot, rel))) continue;
    Object.assign(methods, extractNamedFunctionsBeforeReturn(read(rel), marker));
  }
  return methods;
}

function extractFacadeExports(useCasesText) {
  const marker = facadeContract.crossCheckSources.facadeMarker;
  const start = useCasesText.indexOf(marker);
  const end = useCasesText.indexOf('})();', start);
  if (start < 0 || end < 0) return [];
  const tail = useCasesText.slice(start, end);
  const returnIdx = tail.lastIndexOf('  return {');
  if (returnIdx < 0) return [];
  const block = tail.slice(returnIdx);
  const names = [];
  const re = /^\s+([A-Za-z_$][\w$]*)\s*:/gm;
  let m;
  while ((m = re.exec(block))) names.push(m[1]);
  return names;
}

function main() {
  if (fs.existsSync(snapshotPath) && process.env.FORCE_BOOTSTRAP !== '1') {
    console.error('bootstrap-facade-snapshot: snapshot already exists');
    console.error('  Set FORCE_BOOTSTRAP=1 to overwrite.');
    process.exit(1);
  }

  const useCasesText = read(facadeContract.crossCheckSources.facadeFile);
  const exports = extractFacadeExports(useCasesText);
  const implementations = extractDomainImplementations();
  const live = {};
  exports.forEach((name) => {
    if (implementations[name]) live[name] = implementations[name];
  });

  const baseline = {
    version: 1,
    schemaRef: 'contracts/facade.contract.json',
    reviewedAt: new Date().toISOString().slice(0, 10),
    changeReason: process.env.CHANGE_REASON || 'bootstrap-facade-snapshot.mjs initial write',
    generatedNote: 'PR6 facade contract baseline (bootstrap)',
    methods: Object.values(live).sort((a, b) => a.name.localeCompare(b.name)),
  };

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`bootstrap-facade-snapshot: wrote ${path.relative(repoRoot, snapshotPath)}`);
  console.log(`  methods: ${baseline.methods.length}`);
  console.log('  Next: append contracts/SNAPSHOT_CHANGELOG.md before opening PR.');
}

main();
