#!/usr/bin/env node
/**
 * Stage7TestRunner must keep the discover flag and apply the discovery filter:
 * a safe test runner is included, operational names are not.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.join(repoRoot, 'tests/Stage7TestRunner.gs');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');

assert.match(
  runnerSource,
  /discover:\s*options\.discover === true/,
  'normalizeOptions_ must copy discover',
);
assert.match(
  runnerSource,
  /ctx\.slugify_\(name\)/,
  'discovered task ids must use ctx.slugify_',
);
assert.match(
  runnerSource,
  /if \(raw\.discover !== false\) raw\.discover = true;/,
  'runAllProjectTests must discover unless discover:false',
);
assert.match(
  runnerSource,
  /rawOptions\.includeDiscovery !== false && rawOptions\.discover !== false/,
  'project chunks must discover unless discovery is turned off',
);

const parts = [
  'tests/Stage7TestRunner.Helpers.gs',
  'tests/Stage7TestRunner.Reporting.gs',
  'tests/Stage7TestRunner.Sheet.gs',
  'tests/Stage7TestRunner.SendPanel.gs',
  'tests/Stage7TestRunner.Maintenance.gs',
  'tests/Stage7TestRunner.Access.gs',
  'tests/Stage7TestRunner.Summaries.gs',
  'tests/Stage7TestRunner.Registry.gs',
  'tests/Stage7TestRunner.Ui.gs',
  'tests/Stage7TestRunner.gs',
];

const context = vm.createContext({
  console,
  Logger: { log() {} },
  Session: {
    getScriptTimeZone() {
      return 'Europe/Kyiv';
    },
  },
  Utilities: {
    formatDate() {
      return '20261007_000000';
    },
  },
});

vm.runInContext(
  parts
    .map((rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8'))
    .join('\n;\n'),
  context,
  { filename: 'stage7-test-runner-bundle.gs' },
);

vm.runInContext(
  `
function runSampleDiscoveryProbeTests() {
  return { ok: true };
}
function testClearDiagnostics() {
  return { ok: true };
}
`,
  context,
);

function listed(options) {
  return vm.runInContext(
    `Stage7TestRunner.listTasks(${JSON.stringify(options)})`,
    context,
  );
}

function byName(tasks, name) {
  return tasks.find((task) => task.functionName === name);
}

const discovered = listed({ includeDiscovery: true, discover: true });
const probe = byName(discovered, 'runSampleDiscoveryProbeTests');
assert.ok(probe, 'discover:true must include a safe unregistered test');
assert.equal(probe.discovered, true);
assert.equal(
  probe.id,
  'discovered-' + String(probe.functionName).toLowerCase(),
);
assert.equal(
  byName(discovered, 'testClearDiagnostics'),
  undefined,
  'operational names must stay out of discovery',
);

const registryOnly = listed({ includeDiscovery: true });
assert.equal(
  byName(registryOnly, 'runSampleDiscoveryProbeTests'),
  undefined,
  'omitted discover must not scan for extra tests',
);

const suppressed = listed({ includeDiscovery: false, discover: true });
assert.equal(
  byName(suppressed, 'runSampleDiscoveryProbeTests'),
  undefined,
  'includeDiscovery:false must suppress discovery',
);

console.log(
  `verify-stage7-test-discovery: OK (registry=${registryOnly.length}, discovered=${discovered.length})`,
);
