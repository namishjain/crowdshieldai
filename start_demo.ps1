$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw 'Run .\scripts\setup_demo.ps1 first.' }
if (-not (Test-Path (Join-Path $root 'frontend\dist\index.html'))) { throw 'Dashboard is not built. Run .\scripts\setup_demo.ps1 first.' }

function Open-Dashboard {
    try {
        Start-Process 'http://127.0.0.1:8000/app' -ErrorAction Stop | Out-Null
        Write-Host 'Opening CrowdShield in your browser…' -ForegroundColor Green
    } catch {
        Write-Host 'CrowdShield is ready. Open http://127.0.0.1:8000/app in your browser.' -ForegroundColor Green
    }
}

$port = 8000
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    try {
        $existingApi = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
        $existingPage = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/app' -TimeoutSec 2 -UseBasicParsing
        $existingOpenApi = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/openapi.json' -TimeoutSec 2
        $hasOperatorSwitch = $existingOpenApi.paths.PSObject.Properties.Name -contains '/api/operator'
        if ($existingApi.ok -and $existingPage.StatusCode -eq 200 -and $hasOperatorSwitch) {
            Open-Dashboard
            Write-Host 'CrowdShield is already running.' -ForegroundColor Green
            Write-Host 'Dashboard: http://127.0.0.1:8000/app'
            exit 0
        }
    } catch { }
    throw "Port $port is already in use by PID $($listener.OwningProcess), and it is not a healthy CrowdShield demo. Close that process before starting CrowdShield."
}
$logDir = Join-Path $root 'work\runtime_logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$backendOut = Join-Path $logDir 'backend.log'
$backendProcess = Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError (Join-Path $logDir 'backend-error.log') -PassThru
Set-Content -LiteralPath (Join-Path $logDir 'backend.pid') -Value $backendProcess.Id -Encoding ascii
Write-Host 'Starting CrowdShield API and dashboard…'
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    try {
        $api = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
        $page = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/app' -TimeoutSec 2 -UseBasicParsing
        if ($api.ok -and $page.StatusCode -eq 200) {
            Open-Dashboard
            Write-Host "Dashboard: http://127.0.0.1:8000/app" -ForegroundColor Green
            Write-Host "Camera processing: $($api.cameras_with_measurements)/6 currently reporting."
            Write-Host "Logs: $logDir"
            Write-Host 'Stop CrowdShield later with: .\stop_demo.ps1'
            exit 0
        }
    } catch { }
}
throw "Services did not become ready. Check logs in $logDir."
