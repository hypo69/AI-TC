/**
 * =============================================================================
 * Название: Вспомогательные утилиты интерфейса Windows Sysadmin & Identity
 * =============================================================================
 * Описание:
 *   Экранирование HTML и безопасный сетевой клиент для вызовов API.
 *
 * Файл: apps/windows/api/webgui/tab_windows_admin/common/ui_utils.js
 * Пакет: windows/api/webgui/tab_windows_admin
 * Автор: hypo69
 * Updated: 2026-10-17 01:35:00
 * =============================================================================
 */

/**
 * Экранирует специальные символы HTML для защиты от XSS-инъекций.
 * @param {string} str - Исходный текст.
 * @returns {string} Экранированный текст.
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
 * Безопасный вызов fetch с автоматическим разбором JSON и информативной обработкой ошибок.
 * @param {string} url - URL запроса.
 * @param {Object} [options={}] - Параметры запроса fetch.
 * @returns {Promise<any>} Разобранные данные ответа.
 */
export async function safeApiFetch(url, options = {}) {
  const fetchFn = (window.api && window.api.fetch) || fetch;
  const res = await fetchFn(url, options);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const errData = await res.json();
      if (errData && errData.detail) {
        msg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      } else if (errData && errData.message) {
        msg = errData.message;
      }
    } catch (_) {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return res.json();
}
