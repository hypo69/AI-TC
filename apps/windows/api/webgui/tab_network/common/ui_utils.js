/**
 * Вспомогательные утилиты для вкладки сетевого терминала.
 * Файл: apps/windows/api/webgui/tab_network/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Форматирует байты в человекочитаемый вид (B, KB, MB, GB, TB).
 * @param {number} bytes - Количество байт.
 * @param {number} [decimals=1] - Знаков после запятой.
 * @returns {string} Строка с размерностью.
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
