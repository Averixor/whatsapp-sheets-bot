#!/usr/bin/env node
/**
 * Access API governance — contract vs canonical map, role policy, server guards, client routes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const contract = loadContract('access-api.contract.json');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function extractCanonicalApiMap(text) {
  const start = text.indexOf('const PROJECT_STAGE7_CANONICAL_API_MAP_');
  if (start < 0) throw new Error('PROJECT_STAGE7_CANONICAL_API_MAP_ not found');
  const slice = text.slice(start, start + 8000);
  const buckets = {};
  for (const bucket of ['application', 'maintenance']) {
    const re = new RegExp(`${bucket}:\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`, 'm');
    const match = slice.match(re);
    buckets[bucket] = match
      ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : [];
  }
  return buckets;
}

function extractRolePolicyMap(text) {
  const start = text.indexOf('const PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_');
  if (start < 0) throw new Error('PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_ not found');
  const end = text.indexOf('const PROJECT_STAGE7_PUBLIC_API_MAP_', start);
  const slice = text.slice(start, end > start ? end : start + 8000);
  const policy = {};
  const entryRe = /(api[A-Za-z0-9_]+):\s*Object\.freeze\(\{([\s\S]*?)\}\)/g;
  let match;
  while ((match = entryRe.exec(slice))) {
    const name = match[1];
    const body = match[2];
    policy[name] = {
      guestAllowed: /guestAllowed:\s*true/.test(body),
      minRole: (body.match(/minRole:\s*"([^"]+)"/) || [])[1] || null,
    };
  }
  return policy;
}

function functionExistsInFile(fileRel, fnName) {
  const text = read(fileRel);
  return new RegExp(`function\\s+${fnName}\\s*\\(`).test(text);
}

function extractFunctionBody(fileRel, fnName) {
  const text = read(fileRel);
  const start = text.indexOf(`function ${fnName}`);
  if (start < 0) return '';
  const tail = text.slice(start);
  const nextFn = tail.slice('function '.length).search(/\nfunction\s+[A-Za-z_$]/);
  return nextFn >= 0 ? tail.slice(0, nextFn + 'function '.length) : tail.slice(0, 4000);
}

function clientMethodUsesApiRun(clientSource, methodPath, apiName) {
  const method = methodPath.split('.').pop();
  const methodIdx = clientSource.indexOf(`${method}(`);
  if (methodIdx < 0) {
    const propIdx = clientSource.indexOf(`${method}:`);
    if (propIdx < 0) return false;
    const slice = clientSource.slice(propIdx, propIdx + 1500);
    return slice.includes(`Api.run('${apiName}'`) || slice.includes(`Api.run("${apiName}"`);
  }
  const slice = clientSource.slice(methodIdx, methodIdx + 1500);
  return slice.includes(`Api.run('${apiName}'`) || slice.includes(`Api.run("${apiName}"`);
}

function rolePolicyMatches(a, b) {
  return (
    !!a.guestAllowed === !!b.guestAllowed &&
    (a.minRole || null) === (b.minRole || null)
  );
}

function main() {
  const errors = [];
  const metaText = read('ProjectMetadata.gs');
  const clientText = read(contract.clientApiFile);
  const canonical = extractCanonicalApiMap(metaText);
  const metadataPolicy = extractRolePolicyMap(metaText);

  for (const required of contract.requiredGovernanceEndpoints || []) {
    const endpoint = (contract.endpoints || []).find((e) => e.name === required);
    if (!endpoint) {
      errors.push(`requiredGovernanceEndpoints missing contract entry: ${required}`);
    }
  }

  for (const endpoint of contract.endpoints || []) {
    const { name, file, bucket, rolePolicy } = endpoint;
    if (!name || !file || !bucket) {
      errors.push(`endpoint missing name/file/bucket: ${JSON.stringify(endpoint)}`);
      continue;
    }

    if (!functionExistsInFile(file, name)) {
      errors.push(`${name} not found in ${file}`);
    }

    const bucketList = canonical[bucket] || [];
    if (!bucketList.includes(name)) {
      errors.push(`${name} missing from PROJECT_STAGE7_CANONICAL_API_MAP_.${bucket}`);
    }

    if (!rolePolicy) {
      errors.push(`${name} missing rolePolicy in contract`);
      continue;
    }

    const metaRole = metadataPolicy[name];
    if (!metaRole) {
      errors.push(`${name} missing from PROJECT_STAGE7_ACCESS_API_ROLE_POLICY_`);
    } else if (!rolePolicyMatches(metaRole, rolePolicy)) {
      errors.push(
        `${name} rolePolicy mismatch: contract=${JSON.stringify(rolePolicy)} metadata=${JSON.stringify(metaRole)}`,
      );
    }

    if (endpoint.serverGuard) {
      const body = extractFunctionBody(file, name);
      if (!body.includes(endpoint.serverGuard)) {
        errors.push(`${name} missing server guard marker: ${endpoint.serverGuard}`);
      }
    } else if (rolePolicy.guestAllowed === false && rolePolicy.minRole) {
      const body = extractFunctionBody(file, name);
      const hasGuard =
        body.includes('_stage7AssertRole_') ||
        body.includes('_stage7HasRoleAtLeastSilent_') ||
        body.includes('access_denied') ||
        body.includes('roleOrder.admin');
      if (!hasGuard) {
        errors.push(`${name} guestDenied/minRole endpoint lacks visible server guard`);
      }
    }

    for (const clientMethod of endpoint.clientMethods || []) {
      if (!clientMethodUsesApiRun(clientText, clientMethod, name)) {
        errors.push(`${clientMethod} must Api.run('${name}') in ${contract.clientApiFile}`);
      }
    }
  }

  for (const deprecated of contract.deprecatedEndpoints || []) {
    if (canonical.application.includes(deprecated.name) || canonical.maintenance.includes(deprecated.name)) {
      errors.push(`${deprecated.name} is deprecated but still listed in canonical API map`);
    }
    if (clientText.includes(`Api.run('${deprecated.name}'`)) {
      errors.push(`${deprecated.name} is deprecated but still referenced in ${contract.clientApiFile}`);
    }
    if (!functionExistsInFile(deprecated.file, deprecated.name)) {
      errors.push(`${deprecated.name} deprecated stub missing in ${deprecated.file}`);
    }
  }

  const policy = contract.clientSignalPolicy || {};
  if (policy.uiReporterFile && policy.uiReporterFunction) {
    const uiText = read(policy.uiReporterFile);
    const fnBodyStart = uiText.indexOf(`function ${policy.uiReporterFunction}`);
    if (fnBodyStart < 0) {
      errors.push(`${policy.uiReporterFunction} missing in ${policy.uiReporterFile}`);
    } else {
      const fnSlice = uiText.slice(fnBodyStart, fnBodyStart + 800);
      if (!fnSlice.includes('reportClientAccessSignal')) {
        errors.push(
          `${policy.uiReporterFunction} must call MaintenanceApi.reportClientAccessSignal`,
        );
      }
    }
  }

  const contractNames = new Set((contract.endpoints || []).map((e) => e.name));
  for (const bucket of ['application', 'maintenance']) {
    for (const name of canonical[bucket] || []) {
      if (/Access|Bindable|LoginByIdentifier|RegisterAccess|SubmitAccess|NormalizeAccess|ReportClient|ReportAccess|GetAccessDescriptor|BootstrapSidebar|BootstrapAccess/i.test(name)) {
        if (!contractNames.has(name)) {
          errors.push(`access-like endpoint ${name} in canonical map but missing from access-api.contract.json`);
        }
      }
    }
  }

  if (errors.length) {
    console.error('verify-access-api-governance: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('verify-access-api-governance: OK');
  console.log(`  endpoints: ${(contract.endpoints || []).length}`);
  console.log(`  role policies: ${Object.keys(metadataPolicy).length}`);
}

main();
