$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$pidFile = Join-Path $root 'work\runtime_logs\backend.pid'
$python = [System.IO.Path]::GetFullPath((Join-Path $root '.venv\Scripts\python.exe'))

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host 'No CrowdShield PID file found. The demo may already be stopped.'
    exit 0
}

$serverPid = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$serverPid)) {
    throw "Invalid PID file: $pidFile"
}

$process = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
if (-not $process) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Host 'CrowdShield is already stopped.'
    exit 0
}

$processPath = [System.IO.Path]::GetFullPath([string]$process.ExecutablePath)
$isCrowdShield = $processPath -ieq $python -and $process.CommandLine -like '*backend.app.main:app*' -and $process.CommandLine -like '*--port 8000*'
if (-not $isCrowdShield) {
    throw "PID $serverPid no longer matches this CrowdShield server. It was left running. Remove the stale PID file manually if needed: $pidFile"
}

Stop-Process -Id $serverPid -Force
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'CrowdShield stopped.' -ForegroundColor Green
