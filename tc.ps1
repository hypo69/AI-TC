<#

=============================================================================

Process Name: AI-TC Automation - Tc

=============================================================================

Description:

  Точка входа и лончер внутреннего сервера Windows System API (Terminal Controller / TC)

  с поддержкой BCP 47 локалей/регионов (?region=ru-RU, ?language-region=ru-RU),

  переключения телеметрии реального времени (TC mode) на лету и изоляцией

  браузерного профиля/кеша в локальном каталоге data\ (data\browser_cache, data\browser_profile).



  Зачем нужен этот скрипт:

    1. Запуск низкоуровневого API: поднимает FastAPI сервер модуля apps/windows/api (порт 8001).

    2. Управление конфликтами портов: автоматически выявляет и освобождает занятый порт

       перед запуском сервера.

    3. Управление режимом телеметрии: активирует режим реального времени (TC mode, flush 5s)

       с авто-возвратом в стандартный режим через 5 минут.

    4. Локализация и BCP 47: поддержка передачи региона/языка в параметрах командной строки

       и маршрутизация в веб-интерфейс.

    5. Изоляция кеша браузера: перенос disk-cache и user-data в локальное хранилище data\

       для централизованного хранения RAG-индексов и снимков логов.



File: tc.ps1

Project: ai-tc

Package: root

Author: hypo69

Copyright: © 2026 hypo69

Updated: 2026-10-28 00:20:00

=============================================================================



.SYNOPSIS

    Запуск автономного FastAPI сервера Windows System API (модуль /tc).



.DESCRIPTION

    Проверяет доступность порта 8001 (или переопределенного), завершает старые процессы

    при необходимости, активирует режим реального времени телеметрии, подготавливает

    каталоги кеша в data\ (data\browser_cache, data\browser_profile) и запускает сервер.



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



.PARAMETER EnableTaskSchedulerHistory

    Автоматически включить ведение журнала истории всех задач Windows (Microsoft-Windows-TaskScheduler/Operational).

    Алиасы: -TaskHistory, -EnableTaskHistory, -TaskSchedulerHistory.



.PARAMETER OpenBrowser

    Автоматически открыть веб-интерфейс в браузере с выделенным каталогом кеша в data\browser_cache.



.PARAMETER NoBrowser

    Не открывать браузер автоматически при старте.



.EXAMPLE

    .\tc.ps1

    Запуск Windows API сервера с телеметрией реального времени.



.EXAMPLE

    .\tc.ps1 -OpenBrowser

    Запуск с автоматическим открытием веб-интерфейса и кешем в data\.



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



    [Alias('TaskHistory', 'EnableTaskHistory', 'TaskSchedulerHistory')]

    [switch]$EnableTaskSchedulerHistory,



    [Alias('Browser', 'Web')]

    [switch]$OpenBrowser,



    [switch]$NoBrowser,



    [Alias('Section', 'Page')]

    [string]$Tab,



    [Alias('PanelId', 'SubTab', 'SubPanel')]

    [string]$Panel,



    [Alias('Application', 'Program', 'Module')]

    [string]$App

)



$ErrorActionPreference = 'Continue'

$env:PYTHONUTF8 = '1'

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$OutputEncoding = [System.Text.Encoding]::UTF8



$scriptDir = $PSScriptRoot

if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = (Get-Location).Path }

Set-Location $scriptDir



$rootConfig = Join-Path $scriptDir "config.json"

if (Test-Path $rootConfig) {

    $env:AITC_CONFIG = $rootConfig

    $env:AIWINDOWSADMIN_CONFIG = $rootConfig

    $env:CONFIG_FILE = $rootConfig

    Write-Host "  [⚙️ Config Profile]: config.json" -ForegroundColor DarkCyan

}



$localDataDir = Join-Path $scriptDir "data"
if (-not (Test-Path $localDataDir)) {
    try { New-Item -ItemType Directory -Force -Path $localDataDir | Out-Null } catch {}
}

# Определение имени приложения из config.json (по умолчанию 'ai-tc')
$appName = "ai-tc"
if (Test-Path $rootConfig) {
    try {
        $cfgJson = Get-Content $rootConfig -Raw | ConvertFrom-Json
        if ($cfgJson.app_name) {
            $appName = $cfgJson.app_name
        } elseif ($cfgJson.app -and $cfgJson.app.app_name) {
            $appName = $cfgJson.app.app_name
        }
    } catch {}
}

# Инициализация каталогов телеметрии строго в %PROGRAMDATA%/<appName>/telemetry
$programDataDir = $env:ProgramData
if (-not $programDataDir) { $programDataDir = "C:\ProgramData" }
$telemetryDir = Join-Path $programDataDir "$appName\telemetry"
$telemetryLogsDir = Join-Path $telemetryDir "logs"
$telemetryDbPath = Join-Path $telemetryDir "telemetry.db"

if (-not (Test-Path $telemetryLogsDir)) {
    try {
        New-Item -ItemType Directory -Force -Path $telemetryLogsDir | Out-Null
    } catch {
        Write-Host "  [WARN] Не удалось создать каталог логов телеметрии: $_" -ForegroundColor Yellow
    }
}

$env:AITC_DIR = Join-Path $programDataDir $appName
$env:APP_NAME = $appName
$env:TELEMETRY_DATA_DIR = $telemetryDir
$env:TELEMETRY_DB_PATH = $telemetryDbPath
$env:TELEMETRY_LOGS_DIR = $telemetryLogsDir
$env:AITC_TELEMETRY_LOGS_DIR = $telemetryLogsDir



$browserCacheDir = Join-Path $localDataDir "browser_cache"

$browserProfileDir = Join-Path $localDataDir "browser_profile"



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



Write-Host "  [🗂️ Local Storage (data)]: $localDataDir" -ForegroundColor DarkCyan
Write-Host "  [👤 Browser Profile]:      $browserProfileDir" -ForegroundColor DarkCyan

Write-Host "  [💾 Browser Disk Cache]:  $browserCacheDir" -ForegroundColor DarkCyan
Write-Host "  [📊 Telemetry Base]:      $telemetryDir" -ForegroundColor DarkCyan
Write-Host "  [🗄️ Telemetry DB]:        $telemetryDbPath" -ForegroundColor DarkCyan



# Гарантируем каталоги для двух изолированных баз данных:

# 1. WikiLLM (знания параметров для администратора: knowledge.db)

# 2. AI Instruments (инструменты агента: ai_instruments.db)

$aiInstDir = Join-Path $scriptDir "data\ai_instruments"

$wikiDir = Join-Path $scriptDir "data\windows_wikillm"

if (-not (Test-Path $aiInstDir)) { New-Item -ItemType Directory -Force -Path $aiInstDir | Out-Null }

if (-not (Test-Path $wikiDir)) { New-Item -ItemType Directory -Force -Path $wikiDir | Out-Null }



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



# Освобождаем порт если он занят (только серверные слушающие сокеты LISTENING)

$occupiedPids = @()

try {

    $connections = Get-NetTCPConnection -LocalPort $port_ -State Listen -ErrorAction SilentlyContinue

    if ($connections) {

        $occupiedPids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    }

} catch {}



if (-not $occupiedPids -or $occupiedPids.Count -eq 0) {

    $netstatMatches = netstat -aon 2>$null | Select-String -Pattern "^\s*TCP\s+\S+:${port_}\s+\S+\s+LISTENING\s+(\d+)"

    if ($netstatMatches) {

        $occupiedPids = $netstatMatches | ForEach-Object { $_.Matches[0].Groups[1].Value } | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } | Select-Object -Unique

    }

}



foreach ($pid_ in $occupiedPids) {

    if ($pid_ -and $pid_ -ne $PID) {

        try {

            Stop-Process -Id $pid_ -Force -ErrorAction Stop

            Write-Host "[OK] Освобождён занятый порт $port_ (PID $pid_)" -ForegroundColor Green

        } catch {

            Write-Host "[WARN] Не удалось завершить PID ${pid_}: $_" -ForegroundColor Yellow

        }

    }

}



# Ожидание полного освобождения сокета операционной системой

$waitLoops = 20

while ($waitLoops -gt 0) {

    $stillBusy = $false

    try {

        if (Get-NetTCPConnection -LocalPort $port_ -State Listen -ErrorAction SilentlyContinue) {

            $stillBusy = $true

        }

    } catch {}

    if (-not $stillBusy) {

        $checkNet = netstat -aon 2>$null | Select-String -Pattern "^\s*TCP\s+\S+:${port_}\s+\S+\s+LISTENING"

        if (-not $checkNet) { break }

    }

    Start-Sleep -Milliseconds 250

    $waitLoops--

}



$isAiAssistant = ($App -and $App -match '(?i)^(ai_assistant|ai-assistant|smart-history|history|ai)$') -or ($Tab -and $Tab -match '(?i)^(ai_assistant|ai-assistant|smart-history|tab-ai-assistant)$')



$targetUrl = if ($isAiAssistant) {

    "http://${host_}:${port_}/ai_assistant${regionQuery}"

} elseif ($Tab -or $Panel) {
    $rawTab = if ($Tab) {
        $Tab
    } elseif ($Panel -and ($Panel -match '(?i)^(power|power-lifecycle|sessions|uptime)$')) {
        "system-control"
    } elseif ($Panel -and ($Panel -match '(?i)^(telemetry|models|logs|etw|settings|wikillm|wikillm-db|wikillm_db|instruments|instruments-db|instruments_db|wikillm-params|wikillm_params|wikillm-editor|wikillm_editor)$')) {
        "app-internals"
    } else {
        "processes-load-inspector"
    }
    $t_ = if ($rawTab.StartsWith('tab-')) { $rawTab } else { "tab-$rawTab" }
    if ($t_ -eq "tab-power-lifecycle") {
        $t_ = "tab-system-control"
        if (-not $Panel) { $Panel = "power-lifecycle" }
    }
    if ($t_ -eq "tab-process-manager") {
        $t_ = "tab-processes-load-inspector"
        if (-not $Panel) { $Panel = "manager" }
    }
    if ($t_ -eq "tab-software-scanner" -or $t_ -eq "tab-software-audit") {
        $t_ = "tab-software-monitor"
    }
    if ($t_ -eq "tab-software-manager") {
        $t_ = "tab-software-monitor"
        if (-not $Panel) { $Panel = "winget" }
    }
    if ($t_ -eq "tab-models") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "models" }
    }
    if ($t_ -eq "tab-telemetry-config" -or $t_ -eq "tab-telemetry-control") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "telemetry" }
    }
    if ($t_ -eq "tab-system-logs" -or $t_ -eq "tab-app-logs") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "logs" }
    }
    if ($t_ -eq "tab-performance-tracing") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "etw" }
    }
    if ($t_ -eq "tab-log-settings") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "settings" }
    }
    if ($t_ -eq "tab-wikillm" -or $t_ -eq "tab-wikillm-settings") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "wikillm-db" }
    }
    if ($t_ -eq "tab-instruments" -or $t_ -eq "tab-instruments-db") {
        $t_ = "tab-app-internals"
        if (-not $Panel) { $Panel = "instruments" }
    }
    if ($Panel -and -not $t_.Contains('#')) {
        $cleanPanel = $Panel.Trim().Trim('#')
        if ($cleanPanel -eq "process-manager" -or $cleanPanel -eq "process_manager") {
            $cleanPanel = "manager"
        } elseif ($cleanPanel -eq "power" -or $cleanPanel -eq "sessions" -or $cleanPanel -eq "uptime") {
            $cleanPanel = "power-lifecycle"
        } elseif ($cleanPanel -eq "wikillm" -or $cleanPanel -eq "wikillm_db") {
            $cleanPanel = "wikillm-db"
        } elseif ($cleanPanel -eq "instruments_db" -or $cleanPanel -eq "instruments-db") {
            $cleanPanel = "instruments"
        } elseif ($cleanPanel -eq "wikillm_params") {
            $cleanPanel = "wikillm-params"
        } elseif ($cleanPanel -eq "wikillm_editor" -or $cleanPanel -eq "editor") {
            $cleanPanel = "wikillm-editor"
        }
        $t_ = "${t_}#${cleanPanel}"
    }
    "http://${host_}:${port_}/tc${regionQuery}#${t_}"

} else { 

    "http://${host_}:${port_}/tc${regionQuery}#tab-about-system" 

}



if ($isAiAssistant) {

    Write-Host "  [AI Assistant API] Smart File History UI: $targetUrl" -ForegroundColor Cyan

} else {

    Write-Host "  [Windows Internal API] TC UI: $targetUrl" -ForegroundColor Cyan

}



# Управление режимом телеметрии реального времени (TC mode)

if ($RealtimeTelemetry -and -not $DisableRealtimeTelemetry) {

    try {

        & $pythonExe -c "from apps.windows.telemetry.telemetry_config import TelemetryConfigManager; TelemetryConfigManager().activate_tc_mode(300.0, 5.0)" 2>$null

        Write-Host "  [⚡ Telemetry]: Активирован режим реального времени TC mode (5с flush / 5 мин)" -ForegroundColor Green

    } catch {

        Write-Host "  [WARN] Не удалось активировать TC mode: $_" -ForegroundColor Yellow

    }

}



# Управление журналом истории планировщика заданий Windows

if ($EnableTaskSchedulerHistory) {

    try {

        & wevtutil.exe sl Microsoft-Windows-TaskScheduler/Operational /e:true 2>$null

        Write-Host "  [📅 Task Scheduler History]: Журнал истории задач включён (/Operational enabled)" -ForegroundColor Green

    } catch {

        Write-Host "  [WARN] Не удалось включить журнал истории задач: $_" -ForegroundColor Yellow

    }

}



# Проверка и запуск службы системной телеметрии при необходимости

$tlmProc = Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" | Where-Object { $_.CommandLine -like "*apps.windows.telemetry.main*" }

if (-not $tlmProc) {

    Write-Host "  [⚡ Telemetry]: Фоновая служба не запущена. Запуск через tlm.ps1..." -ForegroundColor Cyan

    $tlmLauncher = Join-Path $scriptDir "tlm.ps1"

    if (Test-Path $tlmLauncher) {

        & $tlmLauncher -Background -Interval 5.0 -TopProcesses 25

    }

}

if (Test-Path $telemetryDbPath) {
    $dbSize = (Get-Item $telemetryDbPath).Length
    $dbSizeKb = [math]::Round($dbSize / 1KB, 1)
    Write-Host "  [⚡ Telemetry DB]:        Подключена ($dbSizeKb KB) -> $telemetryDbPath" -ForegroundColor Green
} else {
    Write-Host "  [⚡ Telemetry DB]:        Ожидание инициализации -> $telemetryDbPath" -ForegroundColor DarkGray
}



$healthUrl = "http://${host_}:${port_}/health"



# Автоматическое открытие браузера при старте (если не указан -NoBrowser)

if (-not $NoBrowser) {

    Start-Job -ScriptBlock {

        param($url, $cacheDir, $profileDir, $healthCheck)

        

        # Активный опрос готовности сервера (healthcheck) перед запуском браузера

        for ($i = 0; $i -lt 40; $i++) {

            Start-Sleep -Milliseconds 350

            try {

                $resp = Invoke-WebRequest -Uri $healthCheck -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop

                if ($resp.StatusCode -eq 200) { break }

            } catch {

                try {

                    $req = [System.Net.WebRequest]::Create($healthCheck)

                    $req.Timeout = 500

                    $resp = $req.GetResponse()

                    if ($resp.StatusCode -eq 200) { $resp.Close(); break }

                    $resp.Close()

                } catch {}

            }

        }

        

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

            $started = $false

            if ($edgeExe) {

                try {

                    $p = Start-Process $edgeExe -ArgumentList "--disk-cache-dir=`"$cacheDir`" --user-data-dir=`"$profileDir`" `"$url`"" -PassThru -ErrorAction Stop

                    Start-Sleep -Milliseconds 300

                    if ($p -and (-not $p.HasExited -or $p.ExitCode -eq 0)) { $started = $true }

                } catch {}

                if (-not $started) {

                    Start-Process $edgeExe -ArgumentList "`"$url`""

                    $started = $true

                }

            } elseif ($chromeExe) {

                try {

                    $p = Start-Process $chromeExe -ArgumentList "--disk-cache-dir=`"$cacheDir`" --user-data-dir=`"$profileDir`" `"$url`"" -PassThru -ErrorAction Stop

                    Start-Sleep -Milliseconds 300

                    if ($p -and (-not $p.HasExited -or $p.ExitCode -eq 0)) { $started = $true }

                } catch {}

                if (-not $started) {

                    Start-Process $chromeExe -ArgumentList "`"$url`""

                    $started = $true

                }

            }

            if (-not $started) {

                Start-Process $url

            }

        } catch {

            Start-Process $url

        }

    } -ArgumentList $targetUrl, $browserCacheDir, $browserProfileDir, $healthUrl | Out-Null

}



& $pythonExe -m apps.windows.api --host $host_ --port $port_