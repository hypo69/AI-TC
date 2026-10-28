/**
 * Модуль редактора исходного текста JSON и взаимной синхронизации с формой.
 * Файл: apps/windows/api/webgui/tab_telemetry_config/panel_raw_json/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { hideJsonError, showJsonError } from '../common/ui_utils.js';
import { renderGuiForm, gatherFormConfig } from '../panel_form/panel.js';

/**
 * Отрисовывает JSON в редакторе textarea.
 * @param {Object} cfg - Объект конфигурации.
 */
export function renderRawJson(cfg) {
  const editor = document.getElementById('tc-raw-json-editor');
  if (editor) {
    editor.value = JSON.stringify(cfg, null, 2);
    hideJsonError();
  }
}

/**
 * Синхронизирует данные визуальной формы в текстовый редактор JSON.
 * @param {Object} currentConfig - Текущая конфигурация.
 * @returns {Object} Обновленная конфигурация.
 */
export function syncGuiToJson(currentConfig) {
  try {
    const updated = gatherFormConfig(currentConfig);
    renderRawJson(updated);
    return updated;
  } catch (e) {
    console.warn('[TelemetryConfigTab] Ошибка сбора формы:', e);
    return currentConfig;
  }
}

/**
 * Синхронизирует текст редактора JSON в визуальную форму.
 * @returns {Object|null} Распарсенный объект конфигурации или null при ошибке.
 */
export function syncJsonToGui() {
  const editor = document.getElementById('tc-raw-json-editor');
  if (!editor) return null;
  try {
    const parsed = JSON.parse(editor.value);
    renderGuiForm(parsed);
    hideJsonError();
    return parsed;
  } catch (e) {
    showJsonError(`Невозможно отобразить визуальную форму: ${e.message}`);
    return null;
  }
}
