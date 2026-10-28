<#
Updated: 2026-10-15 17:18:00

.SYNOPSIS
    Лончер для запуска портативного Gemini CLI.

.DESCRIPTION
    Считывает GEMINI_API_KEY из файла .env в корне проекта, устанавливает его
    в переменную окружения и передает вызов с аргументами в AI-Portable\Run-Gemini.ps1.

.EXAMPLE
    .\Run-Gemini.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$GeminiArgs = $args

$EnvFile = Join-Path -Path $PSScriptRoot -ChildPath '.env'
if (Test-Path -LiteralPath $EnvFile) {
    $KeyLine = Get-Content -LiteralPath $EnvFile |
        Where-Object { $_ -match '^\s*GEMINI_API_KEY\s*=' } |
        Select-Object -First 1

    if ($KeyLine) {
        $ApiKey = ($KeyLine -replace '^\s*GEMINI_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'")
        if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
            $env:GEMINI_API_KEY = $ApiKey
        }
    }
}

$LauncherPath = Join-Path -Path $PSScriptRoot -ChildPath 'AI-Portable\Run-Gemini.ps1'
if (-not (Test-Path -LiteralPath $LauncherPath)) {
    throw "Лончер не найден: $LauncherPath"
}

& $LauncherPath @GeminiArgs
exit $LASTEXITCODE
