/**
 * Вспомогательные утилиты интерфейса вкладки аудита автозапуска Windows.
 * Файл: apps/windows/api/webgui/tab_startup_auditor/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Выполняет сетевой запрос через window.api или fetch.
 * @param {string} url - URL запроса.
 * @param {Object} [options={}] - Параметры fetch.
 * @returns {Promise<any>}
 */
export async function apiFetch(url, options = {}) {
  if (window.api && typeof window.api.fetch === 'function') {
    return await window.api.fetch(url, options);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Экранирует HTML-спецсимволы.
 * @param {string} str - Исходная строка.
 * @returns {string} Экранированная строка.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Возвращает HTML-бейдж уровня риска.
 * @param {string} level - Уровень риска.
 * @returns {string} HTML-бейдж.
 */
export function getRiskBadge(level) {
  switch ((level || '').toLowerCase()) {
    case 'critical':
      return '<span class="sa-badge sa-risk-critical"><i class="bi bi-shield-x"></i> CRITICAL</span>';
    case 'suspicious':
      return '<span class="sa-badge sa-risk-suspicious"><i class="bi bi-exclamation-octagon"></i> SUSPICIOUS</span>';
    case 'warning':
      return '<span class="sa-badge sa-risk-warning"><i class="bi bi-exclamation-triangle"></i> WARNING</span>';
    case 'notice':
      return '<span class="sa-badge sa-risk-notice"><i class="bi bi-info-circle"></i> NOTICE</span>';
    default:
      return '<span class="sa-badge sa-risk-clean"><i class="bi bi-shield-check"></i> CLEAN</span>';
  }
}

/**
 * Возвращает HTML-бейдж типа дифференциального изменения.
 * @param {string} changeType - Тип изменения.
 * @returns {string} HTML-бейдж.
 */
export function getChangeTypeBadge(changeType) {
  switch (changeType) {
    case 'added':
      return '<span class="sa-badge sa-badge-enabled"><i class="bi bi-plus-circle"></i> Добавлен</span>';
    case 'removed':
      return '<span class="sa-badge sa-badge-disabled"><i class="bi bi-dash-circle"></i> Удален</span>';
    case 'state_changed':
      return '<span class="sa-badge sa-risk-warning"><i class="bi bi-toggle2-on"></i> Статус</span>';
    case 'path_changed':
      return '<span class="sa-badge sa-risk-suspicious"><i class="bi bi-pencil"></i> Путь</span>';
    case 'risk_changed':
      return '<span class="sa-badge sa-risk-critical"><i class="bi bi-shield-exclamation"></i> Риск</span>';
    default:
      return `<span class="sa-badge sa-badge-cat">${escapeHtml(changeType)}</span>`;
  }
}
