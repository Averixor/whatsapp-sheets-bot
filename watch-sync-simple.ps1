param(
    [ValidateRange(1, 3600)]
    [int]$IntervalSeconds = 3,
    [string]$NodeRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot
$ManifestPath = Join-Path $ProjectRoot 'appsscript.json'
$ClaspConfigPath = Join-Path $ProjectRoot '.clasp.json'

function Assert-FileExists {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path)) { throw "$Label not found: $Path" }
}

function Resolve-NodeExe {
    if ($NodeRoot) {
        $candidate = Join-Path $NodeRoot 'node.exe'
        if (Test-Path -LiteralPath $candidate) { return (Get-Item -LiteralPath $candidate).FullName }
    }
    foreach ($candidate in @((Join-Path $ProjectRoot 'tnt/node-v20.20.1-win-x64/node.exe'), (Join-Path $ProjectRoot 'node.exe'))) {
        if (Test-Path -LiteralPath $candidate) { return (Get-Item -LiteralPath $candidate).FullName }
    }
    try { return (Get-Command node.exe -ErrorAction Stop).Source } catch {}
    throw 'node.exe not found. Pass -NodeRoot or install Node.'
}

function Resolve-ClaspEntry {
    $candidate = Join-Path $ProjectRoot 'node_modules/@google/clasp/build/src/index.js'
    if (Test-Path -LiteralPath $candidate) { return (Get-Item -LiteralPath $candidate).FullName }
    throw 'Local clasp entry not found. Run npm install first.'
}

function Get-NowStamp { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }
function Write-Info([string]$Message) { Write-Host "[$(Get-NowStamp)] $Message" }
function Write-ErrorLine([string]$Message) { Write-Host "[$(Get-NowStamp)] ERROR: $Message" }

function Invoke-ClaspPushWithRetry {
    param([int]$MaxAttempts = 3)
    $node = Resolve-NodeExe
    $clasp = Resolve-ClaspEntry
    $attempt = 0
    while ($attempt -lt $MaxAttempts) {
        $attempt++
        & $node $clasp push
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 0) { return 0 }
        if ($attempt -ge $MaxAttempts) { throw "clasp push failed with exit code $exitCode" }
        Write-ErrorLine "clasp push failed (attempt $attempt/$MaxAttempts). Retrying..."
        Start-Sleep -Seconds ([Math]::Min(5 * $attempt, 15))
    }
}

function Get-TrackedFiles {
    $patterns = @('*.gs', '*.html', 'appsscript.json', '.clasp.json')
    $all = foreach ($pattern in $patterns) { Get-ChildItem -LiteralPath $ProjectRoot -File -Filter $pattern -ErrorAction SilentlyContinue }
    return $all | Sort-Object FullName -Unique
}

function Get-RelativeHash {
    $files = Get-TrackedFiles
    $parts = foreach ($file in $files) {
        $relative = Resolve-Path -LiteralPath $file.FullName -Relative
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        "$relative::$hash"
    }
    $joined = [string]::Join("`n", $parts)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($joined)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') }
    finally { $sha.Dispose() }
}

Assert-FileExists -Path $ManifestPath -Label 'appsscript.json'
Assert-FileExists -Path $ClaspConfigPath -Label '.clasp.json'

Write-Info 'WAPB watch-sync started.'
$lastHash = ''
while ($true) {
    try {
        $currentHash = Get-RelativeHash
        if ($currentHash -ne $lastHash) {
            $lastHash = $currentHash
            Write-Info 'Changes detected. Running clasp push...'
            Invoke-ClaspPushWithRetry | Out-Null
            Write-Info 'clasp push completed successfully.'
        }
    } catch {
        Write-ErrorLine $_.Exception.Message
    }
    Start-Sleep -Seconds $IntervalSeconds
}
