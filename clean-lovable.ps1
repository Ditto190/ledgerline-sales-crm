#requires -Version 5.1
# Compatibility entry point; legacy project files are archived, never deleted.
& (Join-Path $PSScriptRoot 'archive-lovable.ps1') @args
