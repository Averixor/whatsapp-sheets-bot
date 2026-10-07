#!/usr/bin/env node
/**
 * Strict Stage7UseCases_ facade contract vs snapshot + RoutingRegistry cross-check.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadContract,
  loadEnvelopeFieldTypes,
  repoRoot,
} from './lib/load-contract.mjs';
import { findFileByBasename } from './lib/gas-files.mjs';

const facadeContract = loadContract('facade.contract.json');
const DEFAULT_ENVELOPE = loadEnvelopeFieldTypes();
const snapshotPath = path.join(repoRoot, facadeContract.snapshotPath);

function resolveRepoRel(rel) {
  if (fs.existsSync(path.join(repoRoot, rel))) return rel;
  return findFileByBasename(repoRoot, path.basename(rel), ['.gs']) || rel;
}

function read(rel) {
  const resolved = resolveRepoRel(rel);
  return fs.readFileSync(path.join(repoRoot, resolved), 'utf8');
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
    const resolved = resolveRepoRel(rel);
    const full = path.join(repoRoot, resolved);
    if (!fs.existsSync(full)) continue;
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

function buildPublicFacadeContract(exportNames, implementations) {
  const contract = {};
  exportNames.forEach((name) => {
    if (implementations[name]) contract[name] = implementations[name];
  });
  return contract;
}

function extractRegistryUseCases(registryText) {
  const prefix = facadeContract.crossCheckSources.registryPrefix;
  const out = [];
  const re = /useCase:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(registryText))) {
    if (m[1].startsWith(prefix)) out.push(m[1].slice(prefix.length));
  }
  return [...new Set(out)];
}

function loadSnapshot() {
  if (!fs.existsSync(snapshotPath)) return null;
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
}

function compareEnvelope(liveEnvelope, snapEnvelope, name, errors) {
  if (!snapEnvelope || !liveEnvelope) return;
  Object.keys(snapEnvelope).forEach((field) => {
    if (liveEnvelope[field] !== snapEnvelope[field]) {
      errors.push(
        `${name}: envelope.${field} "${liveEnvelope[field]}" !== snapshot "${snapEnvelope[field]}"`,
      );
    }
  });
}

function compareContract(live, snapshot) {
  const errors = [];
  const snapMethods = snapshot.methods || snapshot;
  const snapNames = Array.isArray(snapMethods)
    ? snapMethods.map((x) => x.name)
    : Object.keys(snapMethods);

  snapNames.forEach((name) => {
    const snap = Array.isArray(snapMethods)
      ? snapMethods.find((x) => x.name === name)
      : snapMethods[name];
    const cur = live[name];
    if (!cur) {
      errors.push(`missing facade method: ${name}`);
      return;
    }
    if (snap.paramCount !== undefined && cur.paramCount !== snap.paramCount) {
      errors.push(`${name}: paramCount ${cur.paramCount} !== snapshot ${snap.paramCount}`);
    }
    if (Array.isArray(snap.paramOrder) && snap.paramOrder.length) {
      const a = snap.paramOrder.join(',');
      const b = cur.paramOrder.join(',');
      if (a !== b) errors.push(`${name}: paramOrder "${b}" !== snapshot "${a}"`);
    }
    compareEnvelope(cur.envelope, snap.envelope, name, errors);
  });

  Object.keys(live).forEach((name) => {
    if (!snapNames.includes(name)) {
      errors.push(`facade method not in snapshot (run bootstrap + CHANGELOG): ${name}`);
    }
  });

  return errors;
}

function main() {
  const useCasesText = read(facadeContract.crossCheckSources.facadeFile);
  const registryText = read(facadeContract.crossCheckSources.registryFile);
  const exports = extractFacadeExports(useCasesText);
  const implementations = extractDomainImplementations();
  const live = buildPublicFacadeContract(exports, implementations);
  const errors = [];

  exports.forEach((name) => {
    if (!live[name] && !name.startsWith('_')) {
      errors.push(`export without implementation: ${name}`);
    }
  });

  extractRegistryUseCases(registryText).forEach((name) => {
    if (!live[name]) errors.push(`RoutingRegistry references missing facade method: ${name}`);
  });

  const snapshot = loadSnapshot();
  if (!snapshot) {
    console.error('verify-usecase-facade: FAIL — snapshot missing');
    console.error(
      `  Run: node scripts/bootstrap-facade-snapshot.mjs`,
    );
    console.error(
      `  Then append an entry to contracts/SNAPSHOT_CHANGELOG.md before merging.`,
    );
    process.exit(1);
  }

  errors.push(...compareContract(live, snapshot));

  if (errors.length) {
    console.error('verify-usecase-facade: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('verify-usecase-facade: OK');
  console.log(`  methods: ${Object.keys(live).length}`);
}

main();
