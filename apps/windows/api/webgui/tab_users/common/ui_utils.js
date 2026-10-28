/**
 * @file apps/windows/api/webgui/tab_users/common/ui_utils.js
 * @description Вспомогательные функции для модуля управления пользователями (экранирование, даты, форматирование байт, генератор паролей, алерты)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:31:00
 */

/**
 * Выполнение безопасных HTTP-запросов к API пользователей
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function apiFetch(url, options = {}) {
  if (window.api && typeof window.api.fetch === 'function') {
    return window.api.fetch(url, options);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData && errData.detail) {
        errMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch (_) {}
    throw new Error(errMsg);
  }
  return res.json();
}

/**
 * Вывод всплывающего алерта в шапке панели
 * @param {string} msg Текст сообщения
 * @param {string} type 'info' | 'success' | 'warning' | 'danger'
 */
export function showStatusAlert(msg, type = 'info') {
  const alertBox = document.getElementById('users-alert-box');
  const alertMsg = document.getElementById('users-alert-message');
  if (!alertBox || !alertMsg) return;

  alertBox.className = `alert alert-${type} alert-dismissible fade show mb-3`;
  alertMsg.innerHTML = msg;
  alertBox.classList.remove('d-none');

  setTimeout(() => {
    alertBox.classList.add('d-none');
  }, 5000);
}

/**
 * Генерация безопасного случайного пароля
 * @param {number} length Длина пароля
 * @returns {string} Пароль
 */
export function generatePassword(length = 12) {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let pwd = '';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    pwd += charset[randomValues[i] % charset.length];
  }
  return pwd;
}

/**
 * Безопасное экранирование HTML
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
    .replace(/'/g, '&#039;');
}

/**
 * Форматирование ISO даты
 * @param {string} isoStr
 * @returns {string}
 */
export function formatDate(isoStr) {
  if (!isoStr) return '<span class="text-muted">—</span>';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    return `<span title="${escapeHtml(isoStr)}">${d.toLocaleDateString('ru-RU')} <small class="text-muted">${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small></span>`;
  } catch (_) {
    return escapeHtml(isoStr);
  }
}

/**
 * Форматирование байт в читаемый вид
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
