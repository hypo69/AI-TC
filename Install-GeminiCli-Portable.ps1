<#
Updated: 2026-10-15 17:18:00

.SYNOPSIS
    Устанавливает портативные Node.js и Gemini CLI в выбранный каталог.

.DESCRIPTION
    Загружает LTS-версию Node.js для Windows x64, проверяет SHA-256 архива,
    распаковывает Node.js и устанавливает Gemini CLI в локальный npm-prefix.

.EXAMPLE
    .\Install-GeminiCli.ps1

.EXAMPLE
    .\Install-GeminiCli.ps1 -Destination 'U:\AI-Portable'
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$Destination = (Join-Path $PSScriptRoot 'AI-Portable'),

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    <#
    .SYNOPSIS
        Выводит заголовок этапа установки.
    .PARAMETER Message
        Текст этапа.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-CheckedNativeCommand {
    <#
    .SYNOPSIS
        Запускает внешнюю команду и проверяет код завершения.
    .PARAMETER FilePath
        Путь к исполняемому файлу.
    .PARAMETER ArgumentList
        Аргументы команды.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter()]
        [string[]]$ArgumentList = @()
    )

    & $FilePath @ArgumentList

    if ($LASTEXITCODE -ne 0) {
        throw "Команда завершилась с кодом $LASTEXITCODE`: $FilePath"
    }
}

$Destination = [IO.Path]::GetFullPath($Destination)

$NodeDir = Join-Path $Destination 'node'
$CliDir = Join-Path $Destination 'gemini-cli'
$CacheDir = Join-Path $Destination 'cache\npm'
$DownloadDir = Join-Path $Destination 'downloads'
$ConfigDir = Join-Path $Destination 'config'
$WorkspaceDir = Join-Path $Destination 'workspace'
$TempDir = Join-Path $Destination 'temp'

if (Test-Path $Destination) {
    $ExistingItems = Get-ChildItem -LiteralPath $Destination -Force

    if ($ExistingItems -and -not $Force) {
        throw "Каталог не пуст: $Destination. Укажи другой путь или используй -Force."
    }
}

foreach ($Directory in @(
    $Destination,
    $NodeDir,
    $CliDir,
    $CacheDir,
    $DownloadDir,
    $ConfigDir,
    $WorkspaceDir,
    $TempDir
)) {
    New-Item -ItemType Directory -Path $Directory -Force |
        Out-Null
}

$OriginalPath = $env:Path
$OriginalPrefix = $env:npm_config_prefix
$OriginalCache = $env:npm_config_cache
$OriginalTmp = $env:TEMP
$OriginalTemp = $env:TMP

try {
    Write-Step 'Определение актуальной LTS-версии Node.js'

    $IndexUrl = 'https://nodejs.org/dist/index.json'
    $ReleaseIndex = Invoke-RestMethod -Uri $IndexUrl -TimeoutSec 60

    $Release = $ReleaseIndex |
        Where-Object {
            $_.lts -and $_.files -contains 'win-x64-zip'
        } |
        Select-Object -First 1

    if (-not $Release) {
        throw 'Не удалось определить LTS-версию Node.js для Windows x64.'
    }

    $NodeVersion = [string]$Release.version
    $ArchiveName = "node-$NodeVersion-win-x64.zip"
    $ArchiveUrl = "https://nodejs.org/dist/$NodeVersion/$ArchiveName"
    $ChecksumsUrl = "https://nodejs.org/dist/$NodeVersion/SHASUMS256.txt"

    $ArchivePath = Join-Path $DownloadDir $ArchiveName
    $ChecksumsPath = Join-Path $DownloadDir 'SHASUMS256.txt'

    Write-Host "Версия Node.js: $NodeVersion"

    Write-Step 'Загрузка Node.js и контрольных сумм'

    Invoke-WebRequest -Uri $ArchiveUrl `
        -OutFile $ArchivePath `
        -TimeoutSec 300

    Invoke-WebRequest -Uri $ChecksumsUrl `
        -OutFile $ChecksumsPath `
        -TimeoutSec 60

    $ChecksumLine = Get-Content -LiteralPath $ChecksumsPath |
        Where-Object {
            $_ -match ("\s+" + [regex]::Escape($ArchiveName) + '$')
        } |
        Select-Object -First 1

    if (-not $ChecksumLine) {
        throw 'SHA-256 для архива Node.js не найдена.'
    }

    $ExpectedHash = (($ChecksumLine -split '\s+')[0]).ToLowerInvariant()

    $ActualHash = (
        Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($ActualHash -ne $ExpectedHash) {
        throw 'SHA-256 не совпадает. Распаковка отменена.'
    }

    Write-Host 'Проверка SHA-256 пройдена.' -ForegroundColor Green

    Write-Step 'Распаковка Node.js'

    $ExtractDir = Join-Path $TempDir 'node-extract'

    if (Test-Path $ExtractDir) {
        Remove-Item -LiteralPath $ExtractDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $ExtractDir -Force |
        Out-Null

    Expand-Archive -LiteralPath $ArchivePath `
        -DestinationPath $ExtractDir `
        -Force

    $ExtractedNodeRoot = Join-Path $ExtractDir "node-$NodeVersion-win-x64"

    if (-not (Test-Path (Join-Path $ExtractedNodeRoot 'node.exe'))) {
        throw 'В архиве не найден node.exe.'
    }

    Get-ChildItem -LiteralPath $NodeDir -Force |
        Remove-Item -Recurse -Force

    Copy-Item -Path (Join-Path $ExtractedNodeRoot '*') `
        -Destination $NodeDir `
        -Recurse `
        -Force

    $NodeExe = Join-Path $NodeDir 'node.exe'
    $NpmCmd = Join-Path $NodeDir 'npm.cmd'

    if (-not (Test-Path $NodeExe) -or -not (Test-Path $NpmCmd)) {
        throw 'Не найдены node.exe или npm.cmd.'
    }

    $env:Path = "$NodeDir;$CliDir;$env:Path"
    $env:npm_config_prefix = $CliDir
    $env:npm_config_cache = $CacheDir
    $env:TEMP = $TempDir
    $env:TMP = $TempDir

    Write-Step 'Проверка Node.js и npm'

    Invoke-CheckedNativeCommand -FilePath $NodeExe `
        -ArgumentList @('--version')

    Invoke-CheckedNativeCommand -FilePath $NpmCmd `
        -ArgumentList @('--version')

    Write-Step 'Установка Gemini CLI'

    Invoke-CheckedNativeCommand -FilePath $NpmCmd `
        -ArgumentList @(
            'install',
            '--global',
            '--no-audit',
            '--no-fund',
            '@google/gemini-cli'
        )

    $GeminiCmd = Join-Path $CliDir 'gemini.cmd'

    if (-not (Test-Path $GeminiCmd)) {
        throw "Gemini CLI не найден после установки: $GeminiCmd"
    }

    Write-Step 'Создание запускателя'

    $LauncherPath = Join-Path $Destination 'Run-Gemini.ps1'

    $Launcher = @'
<#
Updated: 2026-10-15 17:18:00
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$GeminiArgs = $args

$Root = $PSScriptRoot
$NodeDir = Join-Path $Root 'node'
$CliDir = Join-Path $Root 'gemini-cli'
$CacheDir = Join-Path $Root 'cache\npm'
$ConfigDir = Join-Path $Root 'config'
$WorkspaceDir = Join-Path $Root 'workspace'
$TempDir = Join-Path $Root 'temp'

$GeminiCmd = Join-Path $CliDir 'gemini.cmd'
$EnvFile = Join-Path $ConfigDir '.env'

foreach ($Directory in @($CacheDir, $WorkspaceDir, $TempDir)) {
    New-Item -ItemType Directory -Path $Directory -Force |
        Out-Null
}

if (-not (Test-Path (Join-Path $NodeDir 'node.exe'))) {
    throw "Node.js не найден: $NodeDir"
}

if (-not (Test-Path $GeminiCmd)) {
    throw "Gemini CLI не найден: $GeminiCmd"
}

$env:Path = "$NodeDir;$CliDir;$env:Path"
$env:npm_config_prefix = $CliDir
$env:npm_config_cache = $CacheDir
$env:TEMP = $TempDir
$env:TMP = $TempDir

# Загружается GEMINI_API_KEY из локального или корневого .env.
$TargetEnv = $EnvFile
if (-not (Test-Path $TargetEnv)) {
    $RootEnv = Join-Path (Split-Path $Root -Parent) '.env'
    if (Test-Path $RootEnv) {
        $TargetEnv = $RootEnv
    }
}

if (Test-Path $TargetEnv) {
    $KeyLine = Get-Content -LiteralPath $TargetEnv |
        Where-Object {
            $_ -match '^\s*GEMINI_API_KEY\s*='
        } |
        Select-Object -First 1

    if ($KeyLine) {
        $ApiKey = (
            $KeyLine -replace '^\s*GEMINI_API_KEY\s*=\s*', ''
        ).Trim()

        $ApiKey = $ApiKey.Trim('"').Trim("'")

        if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
            $env:GEMINI_API_KEY = $ApiKey
        }
    }
}

Set-Location $WorkspaceDir

& $GeminiCmd @GeminiArgs
exit $LASTEXITCODE
'@

    Set-Content -LiteralPath $LauncherPath `
        -Value $Launcher `
        -Encoding utf8

    $EnvExamplePath = Join-Path $ConfigDir '.env.example'

    if (-not (Test-Path $EnvExamplePath)) {
        Set-Content -LiteralPath $EnvExamplePath `
            -Value 'GEMINI_API_KEY=put_your_key_here' `
            -Encoding utf8
    }

    @'
config/.env
cache/
downloads/
temp/
'@ | Set-Content -LiteralPath (Join-Path $Destination '.gitignore') `
        -Encoding utf8

    Write-Step 'Проверка Gemini CLI'

    Invoke-CheckedNativeCommand -FilePath $GeminiCmd `
        -ArgumentList @('--version')

    Write-Step 'Установка завершена'

    Write-Host "Каталог: $Destination" -ForegroundColor Green
    Write-Host "Запускатель: $LauncherPath"
    Write-Host "Конфигурация: $ConfigDir\.env"
    Write-Host ''
    Write-Host 'Создай config\.env и добавь GEMINI_API_KEY=...'
    Write-Host 'Запуск: .\Run-Gemini.ps1'
}
finally {
    $env:Path = $OriginalPath

    if ($null -eq $OriginalPrefix) {
        Remove-Item Env:\npm_config_prefix -ErrorAction SilentlyContinue
    } else {
        $env:npm_config_prefix = $OriginalPrefix
    }

    if ($null -eq $OriginalCache) {
        Remove-Item Env:\npm_config_cache -ErrorAction SilentlyContinue
    } else {
        $env:npm_config_cache = $OriginalCache
    }

    if ($null -eq $OriginalTmp) {
        Remove-Item Env:\TEMP -ErrorAction SilentlyContinue
    } else {
        $env:TEMP = $OriginalTmp
    }

    if ($null -eq $OriginalTemp) {
        Remove-Item Env:\TMP -ErrorAction SilentlyContinue
    } else {
        $env:TMP = $OriginalTemp
    }
}
