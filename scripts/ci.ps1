#!/usr/bin/env pwsh
# Обхід npm run ci, коли cmd.exe вимкнено політикою.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

node .\scripts\ci-gas-sanity.mjs
exit $LASTEXITCODE
