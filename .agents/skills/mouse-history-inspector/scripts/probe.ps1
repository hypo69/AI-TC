<#
=============================================================================
Process Name: AI-Windows-Admin Automation - Probe
=============================================================================
Description:
  PowerShell-сценарий автоматизации и системного обслуживания (probe).

Usage Examples:
  PowerShell Execution:
    .\probe.ps1

File: probe.ps1
Project: ai-windows-admin
Package: .skills/mouse-history-inspector/scripts
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-10 17:35:00
=============================================================================
#>

Get-PnpDevice -Class 'Mouse' -ErrorAction SilentlyContinue | Select-Object Status, Class, FriendlyName, InstanceId | ConvertTo-Json