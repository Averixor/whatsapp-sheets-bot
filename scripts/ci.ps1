#!/usr/bin/env pwsh
# Обхід npm run ci, коли cmd.exe вимкнено політикою.
# Запускає повний CI-ланцюг через node (еквівалент package.json "ci").

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Steps = @(
  'scripts/ci-gas-sanity.mjs',
  'scripts/audit-function-graph.mjs',
  'scripts/verify-client-includes.mjs',
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
