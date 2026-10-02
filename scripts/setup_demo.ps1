$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$nodeVersion = (& node --version).Trim()
$npmVersion = (& npm --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 and npm are required for the frontend and safe video byte-range proxy.' }
Write-Host "Node.js $nodeVersion · npm $npmVersion"

$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.14 -m venv (Join-Path $root '.venv')
    } else {
        & python -m venv (Join-Path $root '.venv')
    }
}
if (-not (Test-Path $python)) { throw 'Could not create .venv. Install Python 3.14 x64 and retry.' }
& $python -c "import sys; print('Python:', sys.version)"
if ($LASTEXITCODE -ne 0) { throw 'Python environment check failed.' }
& $python -m ensurepip --upgrade
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize pip inside .venv.' }

& $python -m pip install --upgrade pip==26.2.1
if ($LASTEXITCODE -ne 0) { throw 'pip bootstrap failed.' }
& $python -m pip install -r (Join-Path $root 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Python dependency setup failed.' }

Push-Location (Join-Path $root 'frontend')
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency setup failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend production build failed.' }
} finally { Pop-Location }

& $python (Join-Path $root 'scripts\setup_model.py')
if ($LASTEXITCODE -ne 0) { throw 'YOLOv8n weight setup failed.' }
& $python (Join-Path $root 'scripts\fetch_wildtrack_samples.py') --duration 15 --max-total-mb 2000 --proxy-transfer-mb 1850
if ($LASTEXITCODE -ne 0) { throw 'Short WILDTRACK camera clip setup failed.' }
Write-Host "`nOne-time setup complete. Start with: .\start_demo.ps1" -ForegroundColor Green
