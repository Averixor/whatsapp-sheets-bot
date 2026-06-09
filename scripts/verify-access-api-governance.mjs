#!/usr/bin/env node
/**
 * Access API governance — complete public API inventory, role policy, guards,
 * client reachability, routing metadata, bundle index, and production manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const contract = loadContract('access-api.contract.json');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

function sameSet(left, right) {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function extractFreezeArray(text, fieldName, bucketName) {
  const start = text.indexOf(`const ${fieldName}`);
  if (start < 0) throw new Error(`${fieldName} not found`);
  const slice = text.slice(start, start + 14000);
  const re = new RegExp(
    `${bucketName}:\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`,
    'm',
  );
  const match = slice.match(re);
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : [];
}

function extractPublicApiMap(text) {
  const canonicalField = contract.canonicalApiField;
  const publicField = contract.publicApiField;
  return {
    application: extractFreezeArray(text, canonicalField, 'application'),
    spreadsheet: extractFreezeArray(text, publicField, 'spreadsheet'),
    maintenance: extractFreezeArray(text, canonicalField, 'maintenance'),
    compatibility: extractFreezeArray(text, canonicalField, 'compatibility'),
  };
}

function extractRolePolicyMap(text) {
  const start = text.indexOf(`const ${contract.rolePolicyField}`);
  if (start < 0) throw new Error(`${contract.rolePolicyField} not found`);
  const end = text.indexOf(`const ${contract.publicApiField}`, start);
  const slice = text.slice(start, end > start ? end : start + 20000);
  const policy = {};
  const entryRe = /(api[A-Za-z0-9_]+):\s*Object\.freeze\(\{([\s\S]*?)\}\)/g;
  let match;
  while ((match = entryRe.exec(slice))) {
    const body = match[2];
    policy[match[1]] = {
      guestAllowed: /guestAllowed:\s*true/.test(body),
      minRole: (body.match(/minRole:\s*"([^"]+)"/) || [])[1] || null,
      policy: (body.match(/policy:\s*"([^"]+)"/) || [])[1] || null,
    };
  }
  return policy;
}

function buildContractRolePolicy(errors, publicSet) {
  const expected = {};
  for (const [group, names] of Object.entries(contract.rolePolicyGroups || {})) {
    for (const name of names) {
      if (expected[name]) {
        errors.push(`rolePolicyGroups contains duplicate endpoint: ${name}`);
        continue;
      }
      expected[name] = {
        guestAllowed: group === 'guest',
        minRole: group === 'guest' ? null : group,
        policy: (contract.rolePolicyOverrides || {})[name] || null,
      };
    }
  }
  for (const name of publicSet) {
    if (!expected[name]) {
      errors.push(`public endpoint missing from rolePolicyGroups: ${name}`);
    }
  }
  for (const name of Object.keys(expected)) {
    if (!publicSet.has(name)) {
      errors.push(`rolePolicyGroups contains non-public endpoint: ${name}`);
    }
  }
  return expected;
}

function rolePolicyMatches(actual, expected) {
  return (
    !!actual.guestAllowed === !!expected.guestAllowed &&
    (actual.minRole || null) === (expected.minRole || null) &&
    (actual.policy || null) === (expected.policy || null)
  );
}

function buildApiFunctionIndex() {
  const index = {};
  const files = fs
    .readdirSync(repoRoot)
    .filter((name) => name.endsWith('.gs'))
    .sort();

  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(/^function\s+(api[A-Za-z0-9_]+)\s*\(/gm)) {
      (index[match[1]] ||= []).push(file);
    }
  }
  return index;
}

function extractFunctionBody(fileRel, fnName) {
  const text = read(fileRel);
  const start = text.indexOf(`function ${fnName}`);
  if (start < 0) return '';
  const tail = text.slice(start);
  const nextFn = tail.slice('function '.length).search(/\nfunction\s+[A-Za-z_$]/);
  return nextFn >= 0 ? tail.slice(0, nextFn + 'function '.length) : tail;
}

function extractClientApiRuns(text) {
  return unique(
    [...text.matchAll(/Api\.run\s*\(\s*["'](api[A-Za-z0-9_]+)["']/g)].map(
      (match) => match[1],
    ),
  ).sort();
}

function extractRoutingApiMethods(text) {
  return unique(
    [...text.matchAll(/publicApiMethod:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
}

function extractMetadataRoutingGroupMethods(text) {
  const start = text.indexOf(`const ${contract.clientRoutingGroupsField}`);
  if (start < 0) throw new Error(`${contract.clientRoutingGroupsField} not found`);
  const end = text.indexOf('\nconst ', start + 1);
  const slice = text.slice(start, end > start ? end : start + 20000);
  return unique(
    [...slice.matchAll(/:\s*"(api[A-Za-z0-9_]+)"/g)].map((match) => match[1]),
  );
}

function extractBundleFiles(text) {
  const start = text.indexOf('const PROJECT_BUNDLE_FILE_INDEX_');
  if (start < 0) throw new Error('PROJECT_BUNDLE_FILE_INDEX_ not found');
  const end = text.indexOf(']);', start);
  const slice = text.slice(start, end > start ? end + 3 : start + 30000);
  return [...slice.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function main() {
  const errors = [];
  const metaText = read(contract.metadataSource);
  const publicMap = extractPublicApiMap(metaText);
  const publicFromMetadata = Object.values(publicMap).flat();
  const publicFromContract = contract.publicEndpoints || [];
  const publicSet = new Set(publicFromContract);
  const rolePolicy = extractRolePolicyMap(metaText);
  const contractRolePolicy = buildContractRolePolicy(errors, publicSet);
  const apiIndex = buildApiFunctionIndex();

  for (const duplicate of findDuplicates(publicFromMetadata)) {
    errors.push(`duplicate endpoint in public metadata: ${duplicate}`);
  }
  for (const duplicate of findDuplicates(publicFromContract)) {
    errors.push(`duplicate endpoint in contract publicEndpoints: ${duplicate}`);
  }
  if (!sameSet(publicFromMetadata, publicFromContract)) {
    for (const name of publicFromMetadata.filter((item) => !publicSet.has(item))) {
      errors.push(`public metadata endpoint missing from contract: ${name}`);
    }
    const metadataSet = new Set(publicFromMetadata);
    for (const name of publicFromContract.filter((item) => !metadataSet.has(item))) {
      errors.push(`contract public endpoint missing from metadata: ${name}`);
    }
  }

  for (const required of contract.requiredGovernanceEndpoints || []) {
    if (!publicSet.has(required)) {
      errors.push(`required governance endpoint missing from public contract: ${required}`);
    }
  }

  for (const name of publicFromContract) {
    const files = apiIndex[name] || [];
    if (files.length !== 1) {
      errors.push(
        `${name} must have exactly one public definition; found ${files.length}: ${files.join(', ')}`,
      );
      continue;
    }

    const policy = rolePolicy[name];
    if (!policy) {
      errors.push(`${name} missing from ${contract.rolePolicyField}`);
      continue;
    }
    const expectedPolicy = contractRolePolicy[name];
    if (expectedPolicy && !rolePolicyMatches(policy, expectedPolicy)) {
      errors.push(
        `${name} role policy mismatch: contract=${JSON.stringify(expectedPolicy)} metadata=${JSON.stringify(policy)}`,
      );
    }

    const body = extractFunctionBody(files[0], name);
    if (policy.guestAllowed === false) {
      if (!policy.minRole) {
        errors.push(`${name} is guest-denied but has no minRole`);
      }
      const marker =
        (contract.guardOverrides || {})[name] ||
        String(contract.defaultProtectedEndpointGuard || '').replace(
          '{minRole}',
          policy.minRole || '',
        );
      if (!marker || !body.includes(marker)) {
        errors.push(`${name} missing protected endpoint guard marker: ${marker || '<none>'}`);
      }
    }

    for (const marker of (contract.requiredServerMarkers || {})[name] || []) {
      if (!body.includes(marker)) {
        errors.push(`${name} missing required server marker: ${marker}`);
      }
    }
    for (const marker of (contract.forbiddenServerMarkers || {})[name] || []) {
      if (body.includes(marker)) {
        errors.push(`${name} contains forbidden server marker: ${marker}`);
      }
    }
  }

  for (const name of Object.keys(rolePolicy)) {
    if (!publicSet.has(name)) {
      errors.push(`${contract.rolePolicyField} contains non-public endpoint: ${name}`);
    }
  }

  const excluded = new Map(
    (contract.excludedEntrypoints || []).map((item) => [item.name, item]),
  );
  for (const [name, files] of Object.entries(apiIndex)) {
    if (publicSet.has(name)) continue;
    const disposition = excluded.get(name);
    if (!disposition) {
      errors.push(`unclassified api entrypoint: ${name} (${files.join(', ')})`);
    } else if (!String(disposition.reason || '').trim()) {
      errors.push(`excluded api entrypoint lacks reason: ${name}`);
    }
  }
  for (const [name] of excluded) {
    if (!apiIndex[name]) {
      errors.push(`excluded api entrypoint does not exist: ${name}`);
    }
    if (publicSet.has(name)) {
      errors.push(`excluded api entrypoint is also public: ${name}`);
    }
  }

  const clientRuns = extractClientApiRuns(read(contract.clientApiFile));
  for (const name of clientRuns) {
    if (!publicSet.has(name)) {
      errors.push(`${contract.clientApiFile} calls non-public endpoint: ${name}`);
    }
  }

  const routingMethods = new Set(
    extractRoutingApiMethods(read(contract.routingRegistryFile)),
  );
  const metadataRoutingMethods = new Set(extractMetadataRoutingGroupMethods(metaText));
  for (const name of contract.requiredRoutingEndpoints || []) {
    if (!routingMethods.has(name)) {
      errors.push(`${name} missing from ${contract.routingRegistryFile}`);
    }
    if (!metadataRoutingMethods.has(name)) {
      errors.push(`${name} missing from ${contract.clientRoutingGroupsField}`);
    }
  }

  for (const deprecated of contract.deprecatedEndpoints || []) {
    if (publicSet.has(deprecated.name)) {
      errors.push(`${deprecated.name} is deprecated but still public`);
    }
    if (deprecated.removed === true && apiIndex[deprecated.name]) {
      errors.push(`${deprecated.name} is marked removed but still exists`);
    }
  }

  const signalPolicy = contract.clientSignalPolicy || {};
  if (signalPolicy.forbiddenPublicEndpoint && clientRuns.includes(signalPolicy.forbiddenPublicEndpoint)) {
    errors.push(
      `${signalPolicy.forbiddenPublicEndpoint} must not be reachable through ${contract.clientApiFile}`,
    );
  }
  if (signalPolicy.uiReporterFile && signalPolicy.uiReporterFunction) {
    const uiText = read(signalPolicy.uiReporterFile);
    const start = uiText.indexOf(`function ${signalPolicy.uiReporterFunction}`);
    const body = start >= 0 ? uiText.slice(start, start + 900) : '';
    if (start < 0) {
      errors.push(`${signalPolicy.uiReporterFunction} missing in ${signalPolicy.uiReporterFile}`);
    } else if (!body.includes('reportClientAccessSignal')) {
      errors.push(
        `${signalPolicy.uiReporterFunction} must call MaintenanceApi.reportClientAccessSignal`,
      );
    }
  }

  for (const file of extractBundleFiles(metaText)) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      errors.push(`PROJECT_BUNDLE_FILE_INDEX_ references missing file: ${file}`);
    }
  }

  const manifest = JSON.parse(read(contract.productionManifestFile));
  const actualAccess = manifest.executionApi && manifest.executionApi.access;
  if (actualAccess !== contract.productionExecutionApiAccess) {
    errors.push(
      `${contract.productionManifestFile} executionApi.access must be ${contract.productionExecutionApiAccess}; found ${actualAccess || '<missing>'}`,
    );
  }

  const smokeManifest = JSON.parse(read(contract.smokeManifestFile));
  const smokeAccess =
    smokeManifest.executionApi && smokeManifest.executionApi.access;
  if (smokeAccess !== contract.smokeExecutionApiAccess) {
    errors.push(
      `${contract.smokeManifestFile} executionApi.access must be ${contract.smokeExecutionApiAccess}; found ${smokeAccess || '<missing>'}`,
    );
  }

  const productionClaspIgnore = read(contract.productionClaspIgnoreFile);
  for (const file of contract.smokeOnlyFiles || []) {
    if (!productionClaspIgnore.split(/\r?\n/).includes(file)) {
      errors.push(`${file} must be excluded by ${contract.productionClaspIgnoreFile}`);
    }
  }

  if (errors.length) {
    console.error('verify-access-api-governance: FAIL');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('verify-access-api-governance: OK');
  console.log(`  public endpoints: ${publicFromContract.length}`);
  console.log(`  explicitly excluded entrypoints: ${excluded.size}`);
  console.log(`  client-reachable endpoints: ${clientRuns.length}`);
}

main();
