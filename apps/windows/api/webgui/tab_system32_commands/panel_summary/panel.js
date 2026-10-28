/**
 * Модуль панели сводных показателей каталога системных команд System32.
 * Файл: apps/windows/api/webgui/tab_system32_commands/panel_summary/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Обновляет верхние метрики каталога в DOM.
 * @param {Object} sum - Объект сводки от бэкенда.
 * @param {number} fallbackTotal - Запасное значение общего числа инструментов.
 */
export function updateSummaryMetrics(sum, fallbackTotal = 0) {
  const elTotal = document.getElementById('stat-total-tools');
  const elCats = document.getElementById('stat-total-categories');
  const elObs = document.getElementById('stat-observe-tools');
  const elEtw = document.getElementById('stat-etw-tools');
  const elUsn = document.getElementById('stat-usn-tools');
  const elGui = document.getElementById('stat-gui-tools');

  if (elTotal) elTotal.innerText = sum?.total_tools || fallbackTotal;
  if (elCats) elCats.innerText = sum?.categories_count || '66';
  if (elObs) elObs.innerText = sum?.by_telemetry_tier?.OBSERVE || sum?.read_tools_count || '0';
  if (elEtw) elEtw.innerText = sum?.etw_tools_count || '0';
  if (elUsn) elUsn.innerText = sum?.usn_journal_tools_count || '1';
  if (elGui) elGui.innerText = (sum?.gui_tools_count || 0) + (sum?.msc_consoles_count || 0);
}
