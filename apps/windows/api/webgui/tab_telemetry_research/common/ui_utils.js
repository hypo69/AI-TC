/**
 * Вспомогательные утилиты интерфейса исследования телеметрии.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Открытие автономного HTML дашборда в новой вкладке браузера.
 */
export function openHtmlDashboard() {
  const selectSource = document.getElementById('tr-select-source');
  const sourcePath = selectSource ? selectSource.value : '';
  const url = sourcePath
    ? `/apps/telemetry_research/dashboard?source_path=${encodeURIComponent(sourcePath)}`
    : '/apps/telemetry_research/dashboard';
  window.open(url, '_blank');
}

/**
 * Скачивание текущего отчета исследования в формате JSON.
 * @param {Object} report - Объект отчета.
 */
export function downloadJsonReport(report) {
  if (!report) {
    if (window.toast) window.toast.warning('Нет данных', 'Сначала выполните исследование.');
    return;
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `telemetry_research_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
