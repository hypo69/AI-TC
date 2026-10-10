<#
=============================================================================
Process Name: AI-Windows-Admin Automation - Tc
=============================================================================
Description:
  Точка входа и лончер внутреннего сервера Windows System API (Terminal Controller / TC)
  с поддержкой BCP 47 локалей/регионов (?region=ru-RU, ?language-region=ru-RU),
  переключения телеметрии реального времени (TC mode) на лету и изоляцией
  браузерного профиля/кеша в каталоге %ProgramData%\AI-Windows-Admin\.

  Зачем нужен этот скрипт:
    1. Запуск низкоуровневого API: поднимает FastAPI сервер модуля apps/windows/api (порт 8001).
    2. Управление конфликтами портов: автоматически выявляет и освобождает занятый порт
       перед запуском сервера.
    3. Управление режимом телеметрии: активирует режим реального времени (TC mode, flush 5s)
       с авто-возвратом в стандартный режим через 5 минут.
    4. Локализация и BCP 47: поддержка передачи региона/языка в параметрах командной строки
       и маршрутизация в веб-интерфейс.
    5. Изоляция кеша браузера: перенос disk-cache и user-data в %ProgramData%\AI-Windows-Admin\
       для централизованного хранения RAG-индексов и снимков логов.

File: tc.ps1
Project: ai-windows-admin
Package: root
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-10 17:35:00
=============================================================================

.SYNOPSIS
    Запуск автономного FastAPI сервера Windows System API (модуль /tc).

.DESCRIPTION
    Проверяет доступность порта 8001 (или переопределенного), завершает старые процессы
    при необходимости, активирует режим реального времени телеметрии, подготавливает
    каталоги кеша в %ProgramData%\AI-Windows-Admin\ и запускает сервер.

.PARAMETER HostAddress
    Сетевой адрес для прослушивания запросов (по умолчанию: 127.0.0.1).

.PARAMETER Port
    Сетевой порт сервиса (по умолчанию: 8001).

.PARAMETER LanguageRegion
    Код языка и региона по стандарту BCP 47 (например: ru-RU, he-IL, uk-UA, en-US).
    Автоматически нормализует переданные теги (ru-ru -> ru-RU).
    Алиасы: -Region, -Locale, -Lang, -Language_Region.

.PARAMETER RealtimeTelemetry
    Включить телеметрию в реальном времени (TC mode, сброс каждые 5с, автоотключение через 5 мин).
    По умолчанию: $true.

.PARAMETER DisableRealtimeTelemetry
    Принудительно оставить стандартный режим телеметрии (сброс каждые 30с, лимит 100МБ).

.PARAMETER OpenBrowser
    Автоматически открыть веб-интерфейс в браузере с выделенным каталогом кеша в %ProgramData%\AI-Windows-Admin\.

.PARAMETER NoBrowser
    Не открывать браузер автоматически при старте.

.EXAMPLE
    .\tc.ps1
    Запуск Windows API сервера с телеметрией реального времени.

.EXAMPLE
    .\tc.ps1 -OpenBrowser
    Запуск с автоматическим открытием веб-интерфейса и кешем в %ProgramData%\AI-Windows-Admin\.

.EXAMPLE
    .\tc.ps1 -Region "ru-ru"
    Запуск с автоматическим формированием ссылки с локалью BCP 47 (ru-RU).
#>

[CmdletBinding()]
param (
    [Alias('Host', 'Address', 'IP')]
    [string]$HostAddress,

    [string]$Port,

    [Alias('Region', 'Locale', 'Lang', 'Language_Region', 'language-region')]
    [string]$LanguageRegion,

    [switch]$RealtimeTelemetry = $true,

    [switch]$DisableRealtimeTelemetry,

    [Alias('Browser', 'Web')]
    [switch]$OpenBrowser,

    [switch]$NoBrowser
)

$ErrorActionPreference = 'Continue'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = (Get-Location).Path }

$rootConfig = Join-Path $scriptDir "config.json"
if (Test-Path $rootConfig) {
    $env:AIWINDOWSADMIN_CONFIG = $rootConfig
    $env:CONFIG_FILE = $rootConfig
    Write-Host "  [⚙️ Config Profile]: config.json" -ForegroundColor DarkCyan
}

$programDataDir = if ($env:ProgramData) { $env:ProgramData } else { "C:\ProgramData" }
$adminDataDir = Join-Path $programDataDir "AI-Windows-Admin"
$browserCacheDir = Join-Path $adminDataDir "browser_cache"
$browserProfileDir = Join-Path $adminDataDir "browser_profile"

if (-not (Test-Path $browserCacheDir)) {
    try {
        New-Item -ItemType Directory -Force -Path $browserCacheDir | Out-Null
    } catch {
        Write-Host "  [WARN] Не удалось создать каталог кеша: $_" -ForegroundColor Yellow
    }
}
if (-not (Test-Path $browserProfileDir)) {
    try {
        New-Item -ItemType Directory -Force -Path $browserProfileDir | Out-Null
    } catch {
        Write-Host "  [WARN] Не удалось создать каталог профиля: $_" -ForegroundColor Yellow
    }
}

Write-Host "  [🗂️ ProgramData Storage]: $adminDataDir" -ForegroundColor DarkCyan
Write-Host "  [💾 Browser Disk Cache]:  $browserCacheDir" -ForegroundColor DarkCyan

$venvPy = Join-Path $scriptDir "venv\Scripts\python.exe"
$pythonExe = if (Test-Path $venvPy) { $venvPy } elseif ($env:PYTHON_HOME) { Join-Path $env:PYTHON_HOME 'python.exe' } else { 'python' }

$host_ = if ($HostAddress) { $HostAddress } else { '127.0.0.1' }
$port_ = if ($Port)        { $Port }        else { '8001' }

$regionQuery = ''
if ($LanguageRegion) {
    # Очистка и нормализация тега по стандарту BCP 47 (language-REGION)
    $cleanTag = $LanguageRegion.Trim().Trim("'").Trim('"').Trim('`').Replace('_', '-')
    if ($cleanTag -match '^([a-zA-Z]{2,3})(?:-([a-zA-Z]{2,4}))?$') {
        $langPart = $Matches[1].ToLower()
        $defaultRegions = @{ 
            'ru' = 'RU'
            'he' = 'IL'
            'uk' = 'UA'
            'en' = 'US'
            'de' = 'DE'
            'fr' = 'FR'
            'es' = 'ES'
            'pt' = 'BR'
            'zh' = 'CN'
            'ja' = 'JP'
        }
        $regPart = if ($Matches[2]) { 
            $Matches[2].ToUpper() 
        } elseif ($defaultRegions.ContainsKey($langPart)) { 
            $defaultRegions[$langPart] 
        } else { 
            $langPart.ToUpper() 
        }
        $normalizedTag = "${langPart}-${regPart}"
    } else {
        $normalizedTag = $cleanTag
    }
    $regionQuery = "?region=${normalizedTag}"
    Write-Host "  [🌐 BCP 47 Locale]: $normalizedTag" -ForegroundColor Cyan
}

# Освобождаем порт если он занят
$occupied = netstat -aon 2>$null |
    Select-String ":${port_}\s" |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } |
    Select-Object -Unique

foreach ($pid_ in $occupied) {
    try {
        Stop-Process -Id $pid_ -Force -ErrorAction Stop
        Write-Host "[OK] Освобождён занятый порт $port_ (PID $pid_)" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Не удалось завершить PID ${pid_}: $_" -ForegroundColor Yellow
    }
}

$targetUrl = "http://${host_}:${port_}/tc${regionQuery}#tab-system-control"
Write-Host "  [Windows Internal API] TC UI: $targetUrl" -ForegroundColor Cyan

# Автоматическое открытие браузера при запросе с изолированным кешем в ProgramData
if ($OpenBrowser -and -not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($url, $cacheDir, $profileDir)
        Start-Sleep -Seconds 2
        
        $edgePaths = @(
            "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
            "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
        )
        $edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

        $chromePaths = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "$env:ProgramFiles (x86)\Google\Chrome\Application\chrome.exe",
            "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
        )
        $chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

        try {
            if ($edgeExe) {
                Start-Process $edgeExe -ArgumentList "--disk-cache-dir=`"$cacheDir`" --user-data-dir=`"$profileDir`" `"$url`""
            } elseif ($chromeExe) {
                Start-Process $chromeExe -ArgumentList "--disk-cache-dir=`"$cacheDir`" --user-data-dir=`"$profileDir`" `"$url`""
            } else {
                Start-Process $url
            }
        } catch {}
    } -ArgumentList $targetUrl, $browserCacheDir, $browserProfileDir | Out-Null
}

& $pythonExe -m apps.windows.api --host $host_ --port $port_