#!/usr/bin/env node
/**
 * Load and resolve contract JSON from contracts/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../..');
export const contractsDir = path.join(repoRoot, 'contracts');

/**
 * @param {string} name - e.g. "envelope.contract.json"
 * @returns {object}
 */
export function loadContract(name) {
  const filePath = path.isAbsolute(name) ? name : path.join(contractsDir, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`load-contract: missing ${path.relative(repoRoot, filePath)}`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`load-contract: invalid JSON in ${name}: ${err.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error(`load-contract: ${name} must be a JSON object`);
  }
  return data;
}

/**
 * Resolve envelopeRef / *Ref fields within contracts/.
 * @param {object} contract
 * @param {string} refKey - property name ending in Ref or envelopeRef
 */
export function resolveRef(contract, refKey = 'envelopeRef') {
  const ref = contract[refKey];
  if (!ref) return null;
  return loadContract(ref);
}

/**
 * Build RegExp list from xss-policy patterns (string sources).
 * @param {string[]} patterns
 */
export function patternsToRegExp(patterns) {
  return patterns.map((source) => new RegExp(source));
}

/**
 * Default envelope fieldTypes from envelope.contract.json.
 */
export function loadEnvelopeFieldTypes() {
  const envelope = loadContract('envelope.contract.json');
  return { ...(envelope.fieldTypes || {}) };
}
