param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

function Resolve-OptionalPath {
    param([string[]]$Candidates)
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return (Get-Item -LiteralPath $candidate).FullName
        }
    }
    return $null
}

function Refresh-WapbEnvState {
    $script:WapbEnv = [ordered]@{
        ProjectRoot = $ProjectRoot
        ManifestPath = Resolve-OptionalPath @((Join-Path $ProjectRoot 'appsscript.json'))
        ClaspConfigPath = Resolve-OptionalPath @((Join-Path $ProjectRoot '.clasp.json'))
        LocalClaspEntry = Resolve-OptionalPath @((Join-Path $ProjectRoot 'node_modules/@google/clasp/build/src/index.js'))
        NodePath = Resolve-OptionalPath @(
            (Join-Path $ProjectRoot 'tnt/node-v20.20.1-win-x64/node.exe'),
            (Join-Path $ProjectRoot 'node.exe')
        )
        GitPath = $null
    }

    try { $script:WapbEnv.GitPath = (Get-Command git -ErrorAction Stop).Source } catch {}
    if (-not $script:WapbEnv.NodePath) {
        try { $script:WapbEnv.NodePath = (Get-Command node.exe -ErrorAction Stop).Source } catch {}
    }
}

function Get-WapbNodePath {
    Refresh-WapbEnvState
    if (-not $script:WapbEnv.NodePath) { throw 'node.exe не знайдено. Вкажи локальний Node у tnt/ або встанови Node у PATH.' }
    return $script:WapbEnv.NodePath
}

function npmx {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $node = Get-WapbNodePath
    $npmCli = Join-Path (Split-Path $node -Parent) 'node_modules/npm/bin/npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmCli)) { throw "npm-cli.js не знайдено: $npmCli" }
    & $node $npmCli @Args
}

function npxx {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $node = Get-WapbNodePath
    $npxCli = Join-Path (Split-Path $node -Parent) 'node_modules/npm/bin/npx-cli.js'
    if (-not (Test-Path -LiteralPath $npxCli)) { throw "npx-cli.js не знайдено: $npxCli" }
    & $node $npxCli @Args
}

function gitx {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    Refresh-WapbEnvState
    if (-not $script:WapbEnv.GitPath) { throw 'git не знайдено в PATH.' }
    & $script:WapbEnv.GitPath @Args
}

function Test-ClaspProjectLinked { Refresh-WapbEnvState; return [bool]$script:WapbEnv.ClaspConfigPath }
function Assert-ClaspProjectLinked { if (-not (Test-ClaspProjectLinked)) { throw '.clasp.json не знайдено. У репозиторії зберігай тільки .clasp.json.example.' } }

function Invoke-ClaspCommand {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    Refresh-WapbEnvState
    if ($script:WapbEnv.LocalClaspEntry) {
        $node = Get-WapbNodePath
        & $node $script:WapbEnv.LocalClaspEntry @Args
        return
    }
    Write-Warning 'Локальний clasp не знайдено. Спроба через npx.'
    & npxx @('clasp') @Args
}

function Get-GasStatus { Assert-ClaspProjectLinked; Invoke-ClaspCommand status }
function Invoke-GasPull { Assert-ClaspProjectLinked; Invoke-ClaspCommand pull }
function Invoke-GasPush { Assert-ClaspProjectLinked; Invoke-ClaspCommand push }
function Invoke-GasPushIfChanged { Assert-ClaspProjectLinked; & (Join-Path $ProjectRoot 'watch-sync-simple.ps1') }
function Open-GasProject { Assert-ClaspProjectLinked; Invoke-ClaspCommand open }
function Start-GasWatch { Assert-ClaspProjectLinked; & (Join-Path $ProjectRoot 'watch-sync-simple.ps1') }
function Get-GitStatusShort { gitx status --short }
function Save-GitChanges([string]$Message) { gitx add -A; gitx commit -m ($(if ($Message) { $Message } else { 'update' })) }
function Sync-GitBranch([string]$Message) { if ($Message) { Save-GitChanges $Message }; gitx pull --rebase; gitx push }
function Invoke-DeployAll([string]$Message) { if ($Message) { Save-GitChanges $Message }; Invoke-GasPush; gitx push }
function Test-ProjectHealth {
    Refresh-WapbEnvState
    [pscustomobject]@{
        ProjectRoot = $script:WapbEnv.ProjectRoot
        ManifestFound = [bool]$script:WapbEnv.ManifestPath
        ClaspLinked = [bool]$script:WapbEnv.ClaspConfigPath
        LocalClaspFound = [bool]$script:WapbEnv.LocalClaspEntry
        NodeFound = [bool]$script:WapbEnv.NodePath
        GitFound = [bool]$script:WapbEnv.GitPath
    }
}
function Show-WapbCommands {
@'
Canonical commands:
  Get-GasStatus
  Invoke-GasPull
  Invoke-GasPush
  Invoke-GasPushIfChanged
  Open-GasProject
  Start-GasWatch
  Get-GitStatusShort
  Save-GitChanges "msg"
  Sync-GitBranch "msg"
  Invoke-DeployAll "msg"
  Test-ProjectHealth
  Show-WapbCommands

Short aliases:
  gas-status
  gas-pull
  gas-push
  gas-push-smart
  gas-open
  gas-watch
  git-status-short
  git-save "msg"
  git-sync "msg"
  deploy-all "msg"
  project-health
  wapb-help
  npmx ...
  npxx ...
  gitx ...
'@ | Write-Host
}

Set-Alias gas-status Get-GasStatus
Set-Alias gas-pull Invoke-GasPull
Set-Alias gas-push Invoke-GasPush
Set-Alias gas-push-smart Invoke-GasPushIfChanged
Set-Alias gas-open Open-GasProject
Set-Alias gas-watch Start-GasWatch
Set-Alias git-status-short Get-GitStatusShort
Set-Alias git-save Save-GitChanges
Set-Alias git-sync Sync-GitBranch
Set-Alias deploy-all Invoke-DeployAll
Set-Alias project-health Test-ProjectHealth
Set-Alias wapb-help Show-WapbCommands

Refresh-WapbEnvState
Write-Host ''
Write-Host '======================================'
Write-Host ' WAPB DEV ENV LOADED'
Write-Host '======================================'
Write-Host "Project: $ProjectRoot"
if (-not $script:WapbEnv.LocalClaspEntry) { Write-Warning 'Локальний clasp не знайдено. Shell завантажено без падіння; GAS-команди працюватимуть через npx або після npm install.' }
Show-WapbCommands
