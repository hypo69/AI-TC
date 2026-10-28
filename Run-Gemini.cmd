:: Updated: 2026-10-15 17:18:00
@echo off
REM Запуск портативного Gemini CLI через PowerShell с обходом ExecutionPolicy
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-Gemini.ps1" %*
