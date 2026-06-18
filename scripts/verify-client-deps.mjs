#!/usr/bin/env node
/**
 * Client layer dependency audit — acyclic layer graph + forbidden cross-layer refs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findFileByBasename } from './lib/gas-files.mjs';
import { loadContract, repoRoot } from './lib/load-contract.mjs';

const layersContract = loadContract('client-layers.contract.json');
const BUILTINS = new Set(layersContract.builtins || []);
const SHARED = new Set(layersContract.sharedUtilities || []);

function stripScript(html) {
  const match = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  return match ? match[1] : html;
}

function readClientSource(fileStem) {
  const htmlRel =
    findFileByBasename(repoRoot, `${fileStem}.html`, ['.html']) || `${fileStem}.html`;
  const filePath = path.join(repoRoot, htmlRel);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${fileStem}.html`);
  }
  return stripScript(fs.readFileSync(filePath, 'utf8'));
}

function buildLayerMaps() {
  const fileToLayer = new Map();
  const layerMeta = new Map();

  for (const layer of layersContract.layers || []) {
    layerMeta.set(layer.id, layer);
    for (const file of layer.files || []) {
      fileToLayer.set(file, layer.id);
    }
  }

  return { fileToLayer, layerMeta };
}

function extractTopLevelExports(source) {
  const symbols = new Set();
  let depth = 0;

  for (const line of source.split('\n')) {
    const fnMatch = line.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (fnMatch && depth === 0) {
      symbols.add(fnMatch[1]);
    }

    const varMatch = line.match(/^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (varMatch && depth === 0) {
      symbols.add(varMatch[1]);
    }

    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (depth < 0) depth = 0;
  }

  return symbols;
}

function stripCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i += 1;
      out += ' ';
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }

    if (ch === '`') {
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === '`') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += ' ';
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      out += ' ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function layerCanDependOn(sourceLayerId, targetLayerId, layerMeta) {
  if (sourceLayerId === targetLayerId) return true;
  const allowed = layerMeta.get(sourceLayerId)?.allowedDependsOn || [];
  return allowed.includes(targetLayerId);
}

function matchesAnyPattern(text, patterns) {
  if (!patterns?.length) return false;
  return patterns.some((source) => new RegExp(source).test(text));
}

function bridgeAllows(sourceLayerId, targetLayerId, line, bridges) {
  for (const bridge of bridges || []) {
    if (bridge.definedLayer !== targetLayerId) continue;
    if (!bridge.consumerLayers?.includes(sourceLayerId)) continue;
    if (matchesAnyPattern(line, bridge.matchPatterns)) return true;
  }
  return false;
}

function forbiddenRuleAllows(sourceLayerId, targetLayerId, line, forbiddenRefs) {
  for (const rule of forbiddenRefs || []) {
    if (rule.sourceLayer !== sourceLayerId) continue;
    if (!rule.forbiddenTargetLayers?.includes(targetLayerId)) continue;
    if (matchesAnyPattern(line, rule.allowedPatterns)) return true;
    return false;
  }
  return null;
}

function findCallSites(source, symbolName) {
  const refs = [];
  const re = new RegExp(
    `\\b${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`,
    'g',
  );
  let match;
  while ((match = re.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
    refs.push({
      lineNumber: source.slice(0, match.index).split('\n').length,
      line: line.trim(),
    });
  }
  return refs;
}

function isTrackedSymbol(symbol) {
  if (BUILTINS.has(symbol) || SHARED.has(symbol)) return false;
  if (symbol.startsWith('_') && symbol.endsWith('_')) return true;
  if (/^[A-Z]/.test(symbol)) return true;
  if (symbol.endsWith('Api')) return true;
  if (symbol.length >= 10) return true;
  return false;
}

function buildSymbolRegistry() {
  const symbolToDef = new Map();

  for (const layer of layersContract.layers || []) {
    for (const file of layer.files || []) {
      const source = readClientSource(file);
      for (const symbol of extractTopLevelExports(source)) {
        if (!isTrackedSymbol(symbol)) continue;
        if (symbolToDef.has(symbol)) continue;
        symbolToDef.set(symbol, { file, layer: layer.id, symbol });
      }
    }
  }

  return symbolToDef;
}

function verifyAcyclicLayerOrder(layerMeta) {
  const errors = [];
  const order = (layersContract.layers || []).map((l) => l.id);

  for (const layer of layersContract.layers || []) {
    for (const dep of layer.allowedDependsOn || []) {
      const depIndex = order.indexOf(dep);
      const layerIndex = order.indexOf(layer.id);
      if (depIndex === -1) {
        errors.push(`layer "${layer.id}": unknown allowedDependsOn "${dep}"`);
        continue;
      }
      if (depIndex >= layerIndex) {
        errors.push(
          `layer "${layer.id}": allowedDependsOn "${dep}" must refer to a lower layer (acyclic order)`,
        );
      }
    }
  }

  return errors;
}

function auditCrossLayerRefs(fileToLayer, layerMeta, symbolToDef) {
  const violations = [];
  const bridges = layersContract.runtimeBridges || [];
  const forbiddenRefs = layersContract.forbiddenRefs || [];

  for (const layer of layersContract.layers || []) {
    for (const file of layer.files || []) {
      const sourceLayer = fileToLayer.get(file);
      const rawSource = readClientSource(file);
      const scanSource = stripCommentsAndStrings(rawSource);
      const localSymbols = extractTopLevelExports(rawSource);

      for (const [symbol, def] of symbolToDef.entries()) {
        if (def.file === file) continue;
        if (localSymbols.has(symbol)) continue;
        if (SHARED.has(symbol)) continue;
        if (BUILTINS.has(symbol)) continue;

        const targetLayer = def.layer;
        if (layerCanDependOn(sourceLayer, targetLayer, layerMeta)) continue;

        const refs = findCallSites(scanSource, symbol);
        for (const ref of refs) {
          if (bridgeAllows(sourceLayer, targetLayer, ref.line, bridges)) continue;

          const ruleDecision = forbiddenRuleAllows(sourceLayer, targetLayer, ref.line, forbiddenRefs);
          if (ruleDecision === true) continue;
          if (ruleDecision === false) {
            violations.push(
              `${file}.html:${ref.lineNumber}: call ${symbol}() from ${def.file} (${targetLayer}) — forbidden by rule`,
            );
            continue;
          }

          violations.push(
            `${file}.html:${ref.lineNumber}: call ${symbol}() from ${def.file} (${targetLayer}) — ${sourceLayer} may depend on [${(layerMeta.get(sourceLayer)?.allowedDependsOn || []).join(', ') || 'none'}] only`,
          );
        }
      }
    }
  }

  return violations;
}

function main() {
  const errors = [];
  const { fileToLayer, layerMeta } = buildLayerMaps();

  errors.push(...verifyAcyclicLayerOrder(layerMeta));

  const includesContract = loadContract('client-includes.contract.json');
  const expectedFiles = includesContract.expected || [];
  for (const layer of layersContract.layers || []) {
    for (const file of layer.files || []) {
      if (!expectedFiles.includes(file)) {
        errors.push(`layer file "${file}" missing from client-includes.contract.json expected[]`);
      }
    }
  }

  let symbolToDef;
  try {
    symbolToDef = buildSymbolRegistry();
  } catch (err) {
    console.error('verify-client-deps: FAIL');
    console.error(`  - ${err.message}`);
    process.exit(1);
  }

  errors.push(...auditCrossLayerRefs(fileToLayer, layerMeta, symbolToDef));

  if (errors.length) {
    console.error('verify-client-deps: FAIL');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const layerSummary = (layersContract.layers || [])
    .map((l) => `${l.id}(${l.files.length})→[${(l.allowedDependsOn || []).join(',') || '∅'}]`)
    .join(' ');
  console.log('verify-client-deps: OK');
  console.log(`  layers: ${layerSummary}`);
  console.log(`  symbols tracked: ${symbolToDef.size}`);
}

main();
