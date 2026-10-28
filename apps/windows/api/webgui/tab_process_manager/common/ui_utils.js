/**
 * @file apps/windows/api/webgui/tab_process_manager/common/ui_utils.js
 * @description Вспомогательные утилиты интерфейса диспетчера процессов (форматирование, экранирование)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:07:00
 */

/**
 * Экранирование спецсимволов HTML для безопасного вывода
 * @param {string|number} str Исходная строка
 * @returns {string} Безопасная экранированная строка
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Форматирование байт в человекочитаемый вид
 * @param {number} bytes Количество байт
 * @returns {string} Форматированное значение (Б, КБ, МБ, ГБ)
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let val = Number(bytes);
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

/**
 * Форматирование процентной нагрузки CPU
 * @param {number} percent Процент нагрузки
 * @returns {string} Строка с процентом
 */
export function formatCpu(percent) {
  const p = Number(percent || 0);
  return `${p.toFixed(1)}%`;
}
