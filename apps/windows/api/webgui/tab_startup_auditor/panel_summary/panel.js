/**
 * Модуль панели сводки и показателей здоровья автозагрузки (KPI / Health Score).
 * Файл: apps/windows/api/webgui/tab_startup_auditor/panel_summary/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Отрисовывает KPI-карточки здоровья автозагрузки и рекомендации.
 * @param {Object} report - Отчет аудита от бэкенда.
 */
export function renderSummaryCards(report) {
  const summary = report?.summary || {};

  // Оценка индекса здоровья автозапуска (Health Score)
  const scoreEl = document.getElementById('sa-health-score');
  if (scoreEl) {
    scoreEl.textContent = summary.health_score ?? '--';
    scoreEl.className = 'sa-card-value ' + (
      summary.health_score >= 80 ? 'text-success' : (summary.health_score >= 60 ? 'text-warning' : 'text-danger')
    );
  }

  // Счетчики категорий и состояний
  const activeEl = document.getElementById('sa-active-count');
  if (activeEl) activeEl.textContent = summary.active_entries ?? '--';

  const totalEl = document.getElementById('sa-total-count');
  if (totalEl) totalEl.textContent = summary.total_entries ?? '--';

  const disabledEl = document.getElementById('sa-disabled-count');
  if (disabledEl) disabledEl.textContent = summary.disabled_entries ?? '0';

  const brokenEl = document.getElementById('sa-broken-count');
  if (brokenEl) brokenEl.textContent = summary.broken_entries ?? '0';

  const threatsEl = document.getElementById('sa-threats-count');
  if (threatsEl) threatsEl.textContent = (summary.critical_count || 0) + (summary.suspicious_count || 0);

  // Блок системных рекомендаций
  const recDesc = document.getElementById('sa-rec-desc');
  if (recDesc) {
    if (report?.recommendations && report.recommendations.length > 0) {
      recDesc.innerHTML = report.recommendations.map(r => `<div>${r}</div>`).join('');
    } else {
      recDesc.textContent = 'Конфигурация автозапуска оптимальна, критических замечаний нет.';
    }
  }
}
