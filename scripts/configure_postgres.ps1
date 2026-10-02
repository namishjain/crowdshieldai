$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$service = Get-Service -Name 'postgresql-x64-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1

if (-not $service) {
    throw 'PostgreSQL Windows service was not found. Install PostgreSQL first, then rerun this script.'
}
if ($service.Status -ne 'Running') {
    Write-Host 'Starting the PostgreSQL service…'
    Start-Service -Name $service.Name
    $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(20))
}

$psql = $null
$createdb = $null
$programFilesPostgres = Join-Path $env:ProgramFiles 'PostgreSQL'
if (Test-Path $programFilesPostgres) {
    $installations = Get-ChildItem -LiteralPath $programFilesPostgres -Directory | Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } -Descending
    foreach ($installation in $installations) {
        $candidate = Join-Path $installation.FullName 'bin\psql.exe'
        if (Test-Path $candidate) {
            $psql = $candidate
            $createdb = Join-Path $installation.FullName 'bin\createdb.exe'
            break
        }
    }
}
if (-not $psql) {
    $command = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($command) { $psql = $command.Source }
}
if (-not $psql) {
    throw 'Could not find psql.exe. Confirm PostgreSQL command-line tools are installed.'
}
if (-not $createdb) { $createdb = Join-Path (Split-Path -Parent $psql) 'createdb.exe' }

$securePassword = Read-Host 'Enter the password for your PostgreSQL user "postgres" (input stays hidden)' -AsSecureString
if ($securePassword.Length -eq 0) { throw 'A PostgreSQL password is required.' }
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = $null
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:PGPASSWORD = $plainPassword

    Write-Host 'Checking the local PostgreSQL login…'
    $loginCheck = & $psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc 'SELECT 1' 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Could not log in to PostgreSQL. Check the password you entered. Details: $($loginCheck -join ' ')"
    }

    $databaseExists = & $psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'crowdshield'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Could not check for the crowdshield database. Details: $($databaseExists -join ' ')"
    }
    if (-not ($databaseExists -join '').Trim()) {
        if (-not (Test-Path $createdb)) { throw 'PostgreSQL login succeeded, but createdb.exe could not be found.' }
        Write-Host 'Creating the crowdshield database…'
        $createResult = & $createdb -w -h 127.0.0.1 -p 5432 -U postgres crowdshield 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Could not create the crowdshield database. Details: $($createResult -join ' ')" }
    } else {
        Write-Host 'The crowdshield database already exists.'
    }

    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $databaseUrl = "postgresql://postgres:$encodedPassword@127.0.0.1:5432/crowdshield"
    $envPath = Join-Path $root '.env'
    $lines = if (Test-Path $envPath) { [System.Collections.Generic.List[string]]::new([string[]](Get-Content -LiteralPath $envPath)) } else { [System.Collections.Generic.List[string]]::new() }
    $urlLine = "CROWDSHIELD_DATABASE_URL=$databaseUrl"
    $found = $false
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match '^\s*CROWDSHIELD_DATABASE_URL\s*=') {
            $lines[$index] = $urlLine
            $found = $true
        }
    }
    if (-not $found) { $lines.Add($urlLine) }
    [System.IO.File]::WriteAllText($envPath, (($lines -join [Environment]::NewLine) + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))

    Write-Host 'CrowdShield database settings saved to the private project .env file.' -ForegroundColor Green
    Write-Host 'Restart the demo with .\stop_demo.ps1 and .\start_demo.ps1 to connect and create its tables.'
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    $plainPassword = $null
    $encodedPassword = $null
    $databaseUrl = $null
}
