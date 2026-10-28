/**
 * Модуль панели сводных KPI карточек и списка гипотез исследования.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/panel_kpi_hypotheses/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Отрисовка сводных KPI карточек.
 * @param {Object} report - Отчет исследования.
 */
export function renderKPI(report) {
  const base = report?.base_report || {};
  const valHealth = document.getElementById('tr-val-health');
  const progHealth = document.getElementById('tr-progress-health');
  const valRecords = document.getElementById('tr-val-records');
  const valTimespan = document.getElementById('tr-val-timespan');
  const valHypotheses = document.getElementById('tr-val-hypotheses');
  const valAnomalies = document.getElementById('tr-val-anomalies');
  const valDevices = document.getElementById('tr-val-devices');

  const healthScore = base.health_score ?? 100;
  if (valHealth) valHealth.textContent = `${healthScore}`;
  if (progHealth) {
    progHealth.style.width = `${healthScore}%`;
    progHealth.className = `progress-bar ${
      healthScore >= 80 ? 'bg-success' : healthScore >= 60 ? 'bg-warning' : 'bg-danger'
    }`;
  }

  if (valRecords) valRecords.textContent = `${base.records_analyzed ?? 0}`;
  if (valTimespan && base.time_range) {
    valTimespan.textContent = `${base.time_range.start ? base.time_range.start.slice(11, 19) : ''} - ${
      base.time_range.end ? base.time_range.end.slice(11, 19) : ''
    }`;
  }

  const confirmedCount = (report?.hypotheses || []).filter((h) => h.confirmed).length;
  if (valHypotheses) valHypotheses.textContent = `${confirmedCount} / ${report?.hypotheses ? report.hypotheses.length : 0}`;

  if (valAnomalies) valAnomalies.textContent = `${(base.anomalies || []).length}`;
  if (valDevices) {
    valDevices.textContent = base.device_summary?.error_count > 0
      ? `Ошибок устройств: ${base.device_summary.error_count}`
      : 'Оборудование в норме';
  }

  const banner = document.getElementById('tr-summary-banner');
  const bannerText = document.getElementById('tr-summary-text');
  if (banner && bannerText && report?.investigation_summary) {
    banner.classList.remove('d-none');
    bannerText.textContent = report.investigation_summary;
  }
}

/**
 * Отрисовка карточек гипотез.
 * @param {Array<Object>} hypotheses - Список гипотез.
 */
export function renderHypotheses(hypotheses) {
  const container = document.getElementById('tr-hypotheses-list');
  if (!container) return;

  if (!hypotheses || hypotheses.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted py-4">Гипотезы не проверены</div>';
    return;
  }

  container.innerHTML = '';
  hypotheses.forEach((h) => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6';

    const cardBorder = h.confirmed ? 'border-warning' : 'border-success-subtle';
    const statusBadge = h.confirmed
      ? '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle"></i> Подтверждена</span>'
      : '<span class="badge bg-success"><i class="bi bi-check-circle"></i> В норме</span>';

    const evidenceItems = (h.evidence || []).map((ev) => `<li>${ev}</li>`).join('');

    col.innerHTML = `
      <div class="card bg-dark ${cardBorder} h-100 shadow-sm">
        <div class="card-header bg-transparent border-secondary d-flex justify-content-between align-items-center">
          <span class="fw-bold text-light">${h.title}</span>
          ${statusBadge}
        </div>
        <div class="card-body p-3 small">
          <p class="text-muted mb-2">${h.description}</p>
          <div class="mb-2">
            <strong class="text-secondary">Факты телеметрии:</strong>
            <ul class="text-light text-opacity-75 ps-3 mb-1">${evidenceItems}</ul>
          </div>
          ${
            h.recommendation
              ? `<div class="p-2 rounded bg-body-tertiary bg-opacity-10 text-info mt-2">
                   <strong>👉 Рекомендация:</strong> ${h.recommendation}
                 </div>`
              : ''
          }
        </div>
        <div class="card-footer bg-transparent border-secondary text-muted small d-flex justify-content-between">
          <span>ID: <code>${h.hypothesis_id}</code></span>
          <span>Уверенность: <strong>${Math.round((h.confidence || 0) * 100)}%</strong></span>
        </div>
      </div>
    `;
    container.appendChild(col);
  });
}
