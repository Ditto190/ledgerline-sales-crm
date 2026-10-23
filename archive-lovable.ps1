#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$archiveRoot = Join-Path $PSScriptRoot '.archive\lovable-legacy'
$legacyPaths = @(
    '.lovable',
    'src\server.ts',
    'src\start.ts',
    'src\lib\error-capture.ts',
    'src\lib\error-page.ts',
    'src\lib\lovable-error-reporting.ts',
    'bun.lock',
    'bunfig.toml',
    'README2.tmp'
)

if (Test-Path $archiveRoot) {
    throw "Archive target already exists: $archiveRoot. Move or inspect it before archiving again."
}

$existing = @($legacyPaths | Where-Object { Test-Path (Join-Path $PSScriptRoot $_) })
if ($existing.Count -eq 0) {
    Write-Output 'No legacy Lovable files found.'
    exit 0
}

if ($PSCmdlet.ShouldProcess($archiveRoot, "Move $($existing.Count) legacy items into archive")) {
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
    foreach ($relativePath in $existing) {
        $source = Join-Path $PSScriptRoot $relativePath
        $destination = Join-Path $archiveRoot $relativePath
        $destinationDirectory = Split-Path $destination -Parent
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Move-Item -LiteralPath $source -Destination $destination
        Write-Output "Archived $relativePath"
    }
}
