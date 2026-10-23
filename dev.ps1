#requires -Version 5.1
# Native Windows entry point: .\dev.ps1 [-Build] [-Test]
param([switch]$Build, [switch]$Test)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ not found. Install: winget install OpenJS.NodeJS.LTS' }
if ([version](node -p 'process.versions.node') -lt [version]'20.0.0') { throw 'Node.js 20+ required.' }
if (-not (Test-Path node_modules)) { npm install; if ($LASTEXITCODE) { throw 'npm install failed' } }

if ($Test) { npm test; exit $LASTEXITCODE }
if ($Build) { npm run build; exit $LASTEXITCODE }
npm run dev
