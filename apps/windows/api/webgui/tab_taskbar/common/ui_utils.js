/**
 * Вспомогательные утилиты интерфейса вкладки управления панелью задач.
 * Файл: apps/windows/api/webgui/tab_taskbar/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

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
    .replace(/"/g, '&quot;');
}
