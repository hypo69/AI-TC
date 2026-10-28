/**
 * Вспомогательные утилиты интерфейса вкладки жизненного цикла питания.
 * Файл: apps/windows/api/webgui/tab_power_lifecycle/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Экранирует HTML-спецсимволы в строке.
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
