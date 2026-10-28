/**
 * =============================================================================
 * Process Name: Windows Telemetry Control Tab - Main Script
 * =============================================================================
 * Description:
 *   Клиентский скрипт управления панелью конфигурации и контроля телеметрии.
 *   Осуществляет загрузку, редактирование и Hot Reload параметров сбора.
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_telemetry_control
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-13 17:48:00
 * =============================================================================
 */

(function () {
  'use strict';

  let currentConfig = {};

  async function loadConfig() {
    try {
      const res = await fetch('/api/windows/telemetry/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      currentConfig = data.config || {};

      const pathEl = document.getElementById('tc-ctrl-config-path');
      if (pathEl) pathEl.textContent = data.config_path || 'config.json';

      const mtimeEl = document.getElementById('tc-ctrl-mtime');
      if (mtimeEl) mtimeEl.textContent = data.last_modified ? new Date(data.last_modified).toLocaleString() : 'Только что';

      // Заполнение полей
      const fastInput = document.getElementById('tc-ctrl-fast-interval');
      if (fastInput) fastInput.value = currentConfig.interval_seconds || 5.0;

      const heavyInput = document.getElementById('tc-ctrl-heavy-interval');
      if (heavyInput) heavyInput.value = currentConfig.heavy_interval_seconds || 60.0;

      const triggerModeSelect = document.getElementById('tc-ctrl-trigger-mode');
      if (triggerModeSelect) triggerModeSelect.value = currentConfig.trigger_mode || 'INTERVAL_BASED';

      const seqHeavySw = document.getElementById('tc-ctrl-sequential-heavy');
      if (seqHeavySw) seqHeavySw.checked = currentConfig.sequential_heavy_execution !== false;

      const flushInput = document.getElementById('tc-ctrl-flush-interval');
      if (flushInput) flushInput.value = currentConfig.flush_interval_seconds || 5.0;

      const topProcInput = document.getElementById('tc-ctrl-top-processes');
      if (topProcInput) topProcInput.value = currentConfig.top_processes || 10;

      const procModeSelect = document.getElementById('tc-ctrl-process-mode');
      if (procModeSelect) procModeSelect.value = currentConfig.process_mode || 'top_n';

      const whitelistArea = document.getElementById('tc-ctrl-whitelist');
      if (whitelistArea) {
        const wl = currentConfig.process_whitelist || [];
        whitelistArea.value = Array.isArray(wl) ? wl.join(', ') : '';
      }

      const heavyCollectors = currentConfig.heavy_collectors || {};
      const hwSw = document.getElementById('tc-ctrl-hw-sensors');
      if (hwSw) hwSw.checked = heavyCollectors.hardware_sensors !== false;

      const smartSw = document.getElementById('tc-ctrl-smart');
      if (smartSw) smartSw.checked = heavyCollectors.deep_disk_smart !== false;

      const portsSw = document.getElementById('tc-ctrl-ports');
      if (portsSw) portsSw.checked = heavyCollectors.system_snapshot !== false;

      // Тумблер политики Foreground Window
      const fgSw = document.getElementById('tc-ctrl-fg-window');
      if (fgSw) fgSw.checked = currentConfig.enable_foreground_window !== false;

    } catch (err) {
      console.warn('[TelemetryControl] Ошибка загрузки конфигурации:', err);
    }
  }

  async function saveConfig() {
    try {
      const fastVal = parseFloat(document.getElementById('tc-ctrl-fast-interval')?.value || '5.0');
      const heavyVal = parseFloat(document.getElementById('tc-ctrl-heavy-interval')?.value || '60.0');
      const triggerModeVal = document.getElementById('tc-ctrl-trigger-mode')?.value || 'INTERVAL_BASED';
      const seqHeavyVal = document.getElementById('tc-ctrl-sequential-heavy')?.checked ?? true;
      const flushVal = parseFloat(document.getElementById('tc-ctrl-flush-interval')?.value || '5.0');
      const topProcVal = parseInt(document.getElementById('tc-ctrl-top-processes')?.value || '10', 10);
      const procModeVal = document.getElementById('tc-ctrl-process-mode')?.value || 'top_n';

      const whitelistRaw = document.getElementById('tc-ctrl-whitelist')?.value || '';
      const whitelist = whitelistRaw.split(',').map(s => s.trim()).filter(Boolean);

      const hwSensors = document.getElementById('tc-ctrl-hw-sensors')?.checked ?? true;
      const smart = document.getElementById('tc-ctrl-smart')?.checked ?? true;
      const ports = document.getElementById('tc-ctrl-ports')?.checked ?? true;
      const enableFg = document.getElementById('tc-ctrl-fg-window')?.checked ?? true;

      const updated = {
        ...currentConfig,
        interval_seconds: fastVal,
        heavy_interval_seconds: heavyVal,
        trigger_mode: triggerModeVal,
        sequential_heavy_execution: seqHeavyVal,
        flush_interval_seconds: flushVal,
        top_processes: topProcVal,
        process_mode: procModeVal,
        process_whitelist: whitelist,
        enable_foreground_window: enableFg,
        heavy_collectors: {
          ...(currentConfig.heavy_collectors || {}),
          hardware_sensors: hwSensors,
          deep_disk_smart: smart,
          system_snapshot: ports
        }
      };

      const res = await fetch('/api/windows/telemetry/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updated })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      currentConfig = updated;

      if (window.showToast) {
        window.showToast('Конфигурация телеметрии успешно обновлена на лету (Hot Reload)', 'success');
      } else {
        alert('Конфигурация успешно обновлена (Hot Reload)');
      }

      await loadConfig();
    } catch (err) {
      console.error('[TelemetryControl] Ошибка сохранения:', err);
      if (window.showToast) {
        window.showToast('Ошибка сохранения конфигурации: ' + err.message, 'danger');
      } else {
        alert('Ошибка сохранения: ' + err.message);
      }
    }
  }

  async function runHeavySequentially() {
    try {
      const res = await fetch('/api/windows/telemetry/collect-heavy-sequentially', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectors: ['wmi', 'smart', 'ports', 'handles'] })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = data.results?.length || 0;
      if (window.showToast) {
        window.showToast(`Последовательный сбор тяжелой телеметрии завершен (${count} коллекторов)`, 'success');
      } else {
        alert(`Последовательный сбор завершен (${count} коллекторов)`);
      }
    } catch (err) {
      console.error('[TelemetryControl] Ошибка последовательного сбора:', err);
      if (window.showToast) {
        window.showToast('Ошибка сбора: ' + err.message, 'danger');
      } else {
        alert('Ошибка: ' + err.message);
      }
    }
  }

  function initTelemetryControlTab() {
    loadConfig();

    const refreshBtn = document.getElementById('tc-ctrl-btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', loadConfig);

    const saveBtn = document.getElementById('tc-ctrl-btn-save');
    if (saveBtn) saveBtn.addEventListener('click', saveConfig);

    const runSeqBtn = document.getElementById('tc-ctrl-btn-run-heavy-seq');
    if (runSeqBtn) runSeqBtn.addEventListener('click', runHeavySequentially);
  }

  window.initTelemetryControlTab = initTelemetryControlTab;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTelemetryControlTab);
  } else {
    initTelemetryControlTab();
  }
})();

