<#
=============================================================================
Process Name: AI-Windows-Admin Automation - Replace Imports
=============================================================================
Description:
  PowerShell-сценарий автоматизации и системного обслуживания (replace_imports).

Usage Examples:
  PowerShell Execution:
    .\replace_imports.ps1

File: replace_imports.ps1
Project: ai-windows-admin
Package: apps/windows
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-13 16:29:00
=============================================================================
#>

Get-ChildItem -Path 'C:/Users/onela/AppData/Local/AI-Windows-Admin/apps/windows' -Recurse -Filter *.py |
    ForEach-Object {
        $path = $_.FullName
        $content = Get-Content $path -Raw
        $new = $content -replace 'apps\.windows\.api\.', 'apps.windows.sdk.win32_ffi.'
        if ($new -ne $content) {
            Set-Content -Path $path -Value $new -Encoding utf8
            Write-Host "Updated imports in $path"
        }
    }
