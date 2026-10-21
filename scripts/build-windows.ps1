$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS first: https://nodejs.org/' }
$major = [int]((node -p 'process.versions.node').Split('.')[0])
if ($major -lt 24) { throw 'Node.js 24 or newer is required.' }
& npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '5'
& npm.cmd run build:win
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }
& npm.cmd run release:prepare
if ($LASTEXITCODE -ne 0) { throw 'Source/hash preparation failed.' }
& npm.cmd run release:verify
if ($LASTEXITCODE -ne 0) { throw 'Release verification failed.' }
Write-Host 'Ready! Open the release folder for the portable EXE and installer.' -ForegroundColor Green
Invoke-Item (Join-Path (Get-Location) 'release')
