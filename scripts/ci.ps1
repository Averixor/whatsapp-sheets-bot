#!/usr/bin/env pwsh
# Legacy Windows subset when npm run ci fails under restricted cmd.exe policy.
# Full CI parity: npm run ci (see package.json "ci" and ci:* scripts).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

node scripts/verify-node-version.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Steps = @(
  'scripts/ci-gas-sanity.mjs',
  'scripts/verify-clasp-push-patterns.mjs',
  'scripts/audit-function-graph.mjs',
  'scripts/verify-client-includes.mjs',
  'scripts/verify-html-label-for.mjs',
  'scripts/verify-client-js.mjs',
  'scripts/verify-client-deps.mjs',
  'scripts/audit-client-xss.mjs',
  'scripts/audit-envelope-compat.mjs',
  'scripts/verify-usecase-facade.mjs',
  'scripts/verify-snapshot-governance.mjs',
  'scripts/verify-bridge-flags.mjs',
  'scripts/verify-jsconfig.mjs'
)

foreach ($step in $Steps) {
  node (Join-Path $Root $step)
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

exit 0
