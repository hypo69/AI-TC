/**
 * @file apps/windows/api/webgui/tab_defender_firewall/common/ui_utils.js
 * @description Вспомогательные утилиты для интерфейса Защитника и Брандмауэра Windows (экранирование, запросы, алерты)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:23:00
 */

/**
 * Экранирование спецсимволов HTML
 * @param {string|number} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Выполнение безопасных JSON-запросов
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, options = {}) {
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
 * Отображение информационного или предупреждающего сообщения на панели
 * @param {string} msg Текст сообщения
 * @param {boolean} isError Флаг ошибки
 */
export function showAlert(msg, isError = false) {
  const box = document.getElementById('def-alert-box');
  if (!box) return;
  box.className = `alert py-2 px-3 mb-2 small ${isError ? 'alert-danger' : 'alert-info'}`;
  box.textContent = msg;
  box.classList.remove('d-none');
  setTimeout(() => {
    box.classList.add('d-none');
  }, 8000);
}
