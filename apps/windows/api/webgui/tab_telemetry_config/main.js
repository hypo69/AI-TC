/**
 * =============================================================================
 * Process Name: Windows Telemetry Config Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский контроллер-оркестратор редактора файла конфигурации телеметрии.
 *   Обеспечивает интерактивное визуальное и raw-JSON редактирование параметров
 *   с мгновенной синхронизацией и применением на лету.
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_telemetry_config
 * Updated: 2026-10-17 01:55:00
 * =============================================================================
 */

import { showAlert, showJsonError, hideJsonError } from './common/ui_utils.js';
import {
  loadConfig,
  saveActiveConfig,
  resetConfigToDefault,
  getActiveTab,
  setActiveTab,
  getCurrentConfig,
  setCurrentConfig
} from './panel_actions/panel.js';
import { syncGuiToJson, syncJsonToGui } from './panel_raw_json/panel.js';

/**
 * Привязка обработчиков событий элементов вкладки.
 */
function bindEvents() {
  document.getElementById('tc-cfg-btn-save')?.addEventListener('click', saveActiveConfig);

  document.getElementById('tc-cfg-btn-reload')?.addEventListener('click', async () => {
    showAlert('Перечитывание конфигурации с диска...', 'info');
    await loadConfig();
  });

  document.getElementById('tc-cfg-btn-reset')?.addEventListener('click', async () => {
    if (confirm('Сбросить конфигурацию телеметрии к исходным настройкам по умолчанию?')) {
      await resetConfigToDefault();
    }
  });

  document.getElementById('tc-cfg-copy-path-btn')?.addEventListener('click', () => {
    const pathEl = document.getElementById('tc-cfg-file-path');
    if (pathEl) {
      navigator.clipboard.writeText(pathEl.innerText.trim()).then(() => {
        showAlert('Путь к файлу скопирован в буфер обмена', 'success', 2500);
      });
    }
  });

  const tabGuiBtn = document.getElementById('tc-tab-gui-btn');
  const tabJsonBtn = document.getElementById('tc-tab-json-btn');
  if (tabGuiBtn && tabJsonBtn) {
    tabGuiBtn.addEventListener('shown.bs.tab', () => {
      setActiveTab('gui');
      const updated = syncJsonToGui();
      if (updated) setCurrentConfig(updated);
    });
    tabJsonBtn.addEventListener('shown.bs.tab', () => {
      setActiveTab('json');
      const updated = syncGuiToJson(getCurrentConfig());
      setCurrentConfig(updated);
    });
  }

  document.getElementById('tc-btn-format-json')?.addEventListener('click', () => {
    const editor = document.getElementById('tc-raw-json-editor');
    if (!editor) return;
    try {
      const parsed = JSON.parse(editor.value);
      editor.value = JSON.stringify(parsed, null, 2);
      hideJsonError();
      showAlert('JSON отформатирован', 'info', 2000);
    } catch (e) {
      showJsonError(e.message);
    }
  });

  document.getElementById('tc-btn-copy-json')?.addEventListener('click', () => {
    const editor = document.getElementById('tc-raw-json-editor');
    if (editor) {
      navigator.clipboard.writeText(editor.value).then(() => {
        showAlert('JSON скопирован в буфер обмена', 'success', 2500);
      });
    }
  });

  const jsonEditor = document.getElementById('tc-raw-json-editor');
  if (jsonEditor) {
    jsonEditor.addEventListener('input', () => {
      try {
        JSON.parse(jsonEditor.value);
        hideJsonError();
      } catch (e) {
        showJsonError(e.message);
      }
    });
  }

  document.getElementById('tc-cfg-alert-close')?.addEventListener('click', () => {
    const alertBox = document.getElementById('tc-cfg-alert');
    if (alertBox) alertBox.classList.add('d-none');
  });
}

/**
 * Инициализация вкладки Telemetry Config.
 */
export async function init() {
  bindEvents();
  await loadConfig();
}

window.initTelemetryConfigTab = init;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
