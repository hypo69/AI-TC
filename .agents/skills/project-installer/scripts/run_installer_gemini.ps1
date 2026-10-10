<#
=============================================================================
Process Name: AI-Windows-Admin Automation - Run Installer Gemini
=============================================================================
Description:
  Launch interactive AI Windows Admin Project Installer using Gemini CLI with gemini-3

Usage Examples:
  PowerShell Execution:
    .\run_installer_gemini.ps1

File: run_installer_gemini.ps1
Project: ai-windows-admin
Package: .skills/project-installer/scripts
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-10 17:35:00
=============================================================================
.SYNOPSIS
    Launch interactive AI Windows Admin Project Installer using Gemini CLI with gemini-3
.DESCRIPTION
    Runs the official Gemini CLI with model "gemini-3
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent (Split-Path -Parent $skillDir)

$instructionFile = Join-Path $skillDir "INSTALL-INSTRUCTION.md"
if (-not (Test-Path $instructionFile)) {
    $instructionFile = Join-Path $projectRoot "INSTALL-INSTRUCTION.md"
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "🤖 Launching Gemini CLI Installer (gemini-3.1-flash-lite)" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot" -ForegroundColor Gray
Write-Host "Instruction:  $instructionFile" -ForegroundColor Gray
Write-Host ""

$prompt = "You are the AI Windows Admin Interactive Installer. Read and follow all instructions from '$instructionFile'. Guide me step by step through installing AI Windows Admin, perform pre-flight checks, handle errors, and verify directories and components at the end."

# Execute Gemini CLI with gemini-3.1-flash-lite model
gemini --model "gemini-3.1-flash-lite" --prompt "$prompt"
