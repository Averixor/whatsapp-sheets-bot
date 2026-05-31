#!/usr/bin/env node
/**
 * Access API governance — contract vs canonical map, server entrypoints, client routes.
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
  const slice = text.slice(start, start + 6000);
  const buckets = {};
  for (const bucket of ['application', 'maintenance']) {
    const re = new RegExp(`${bucket}:\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`, 'm');
    const match = slice.match(re);
    if (!match) {
      buckets[bucket] = [];
      continue;
    }
    buckets[bucket] = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }
  return buckets;
}

function functionExistsInFile(fileRel, fnName) {
  const text = read(fileRel);
  const re = new RegExp(`function\\s+${fnName}\\s*\\(`);
  return re.test(text);
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

function main() {
  const errors = [];
  const metaText = read('ProjectMetadata.gs');
  const clientText = read(contract.clientApiFile);
  const canonical = extractCanonicalApiMap(metaText);

  for (const endpoint of contract.endpoints || []) {
    const { name, file, bucket } = endpoint;
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

    for (const clientMethod of endpoint.clientMethods || []) {
      if (!clientMethodUsesApiRun(clientText, clientMethod, name)) {
        errors.push(`${clientMethod} must Api.run('${name}') in ${contract.clientApiFile}`);
      }
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
      if (fnSlice.includes(`Api.run('${policy.forbiddenPublicEndpoint}'`)) {
        errors.push(
          `${policy.uiReporterFunction} must not call ${policy.forbiddenPublicEndpoint} from UI`,
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
}

main();
