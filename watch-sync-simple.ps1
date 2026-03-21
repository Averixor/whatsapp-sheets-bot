$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$ClaspEntry = Join-Path $ProjectRoot "node_modules\@google\clasp\build\src\index.js"
$NodeExe = (Get-Command node.exe).Source

Set-Location $ProjectRoot

function Invoke-Clasp {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    & $NodeExe $ClaspEntry @Args
}

Write-Host "Auto sync started. Press Ctrl+C to stop."

while ($true) {
    Start-Sleep -Seconds 5
    Invoke-Clasp push
}