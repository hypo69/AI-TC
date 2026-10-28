/**
 * Модуль сетевых операций загрузки, сохранения и сброса конфигурации телеметрии.
 * Файл: apps/windows/api/webgui/tab_telemetry_config/panel_actions/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { API_BASE, showAlert, showJsonError } from '../common/ui_utils.js';
import { updateMeta } from '../panel_meta/panel.js';
import { renderGuiForm, gatherFormConfig } from '../panel_form/panel.js';
import { renderRawJson } from '../panel_raw_json/panel.js';

let currentConfig = {};
let activeTab = 'gui';

export function getCurrentConfig() {
  return currentConfig;
}

export function setCurrentConfig(cfg) {
  currentConfig = cfg || {};
}

export function getActiveTab() {
  return activeTab;
}

export function setActiveTab(tab) {
  activeTab = tab;
}

/**
 * Загрузка конфигурации с бэкенда.
 */
export async function loadConfig() {
  try {
    const response = await fetch(API_BASE, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      currentConfig = data.config || {};
      updateMeta(data.config_path, data.last_modified, currentConfig.mode, currentConfig.telemetry_mode);
      renderGuiForm(currentConfig);
      renderRawJson(currentConfig);
      showAlert('Конфигурация успешно загружена', 'success', 2500);
    } else {
      showAlert(data.message || 'Ошибка загрузки конфигурации', 'danger');
    }
  } catch (err) {
    console.error('[TelemetryConfigTab] Ошибка загрузки конфигурации телеметрии:', err);
    showAlert(`Не удалось загрузить конфигурацию: ${err.message}`, 'danger');
  }
}

/**
 * Сохранение активной конфигурации (из GUI или JSON).
 */
export async function saveActiveConfig() {
  const btnSave = document.getElementById('tc-cfg-btn-save');
  const originalText = btnSave ? btnSave.innerHTML : '';
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span><span>Сохранение...</span>';
  }

  try {
    if (activeTab === 'json') {
      const editor = document.getElementById('tc-raw-json-editor');
      if (!editor) throw new Error('Редактор JSON не найден');
      const rawJson = editor.value;

      JSON.parse(rawJson);

      const response = await fetch(`${API_BASE}/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_json: rawJson }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.detail || resData.message || `Ошибка сервера ${response.status}`);
      }

      currentConfig = resData.config;
      renderGuiForm(currentConfig);
      updateMeta(resData.config_path, new Date().toISOString(), currentConfig.mode, currentConfig.telemetry_mode);
      showAlert('✅ Конфигурация телеметрии успешно сохранена и применена на лету!', 'success');
    } else {
      const updatedConfig = gatherFormConfig(currentConfig);
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updatedConfig }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.detail || resData.message || `Ошибка сервера ${response.status}`);
      }

      currentConfig = resData.config;
      renderRawJson(currentConfig);
      updateMeta(resData.config_path, new Date().toISOString(), currentConfig.mode, currentConfig.telemetry_mode);
      showAlert('✅ Параметры телеметрии успешно сохранены и применены на лету!', 'success');
    }
  } catch (err) {
    console.error('[TelemetryConfigTab] Ошибка сохранения конфигурации:', err);
    showAlert(`❌ Ошибка сохранения: ${err.message}`, 'danger');
    if (activeTab === 'json') {
      showJsonError(err.message);
    }
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = originalText;
    }
  }
}

/**
 * Сброс конфигурации к значениям по умолчанию.
 */
export async function resetConfigToDefault() {
  try {
    const response = await fetch(`${API_BASE}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data.success) {
      currentConfig = data.config || {};
      updateMeta(data.config_path, new Date().toISOString(), currentConfig.mode, currentConfig.telemetry_mode);
      renderGuiForm(currentConfig);
      renderRawJson(currentConfig);
      showAlert('↺ Конфигурация телеметрии сброшена к значениям по умолчанию!', 'warning');
    } else {
      showAlert(data.message || 'Ошибка сброса конфигурации', 'danger');
    }
  } catch (err) {
    showAlert(`Не удалось сбросить конфигурацию: ${err.message}`, 'danger');
  }
}
