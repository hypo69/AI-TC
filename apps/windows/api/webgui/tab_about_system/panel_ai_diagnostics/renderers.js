/**
 * Модуль отрисовки компонентов AI-диагностики системы.
 * Файл: apps/windows/api/webgui/tab_about_system/panel_ai_diagnostics/renderers.js
 * Updated: 2026-10-20 16:51:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Отрисовывает этапы пошагового аудита в контейнер.
 * @param {Array<Object>} stages - Список объектов этапов.
 * @param {boolean} [isCompleted=true] - Флаг завершения всех этапов.
 */
export function renderAIDiagnosticStages(stages, isCompleted = true) {
  const container = document.getElementById('about-ai-stages-container');
  if (!container) return;
  if (!Array.isArray(stages) || stages.length === 0) {
    container.innerHTML = '<div class="small text-muted text-center py-2">Этапы пошагового аудита не запущены</div>';
    return;
  }

  container.innerHTML = stages.map((st, idx) => {
    const isLatest = idx === stages.length - 1 && !isCompleted;
    const icon = isLatest
      ? '<div class="spinner-grow spinner-grow-sm text-info" style="width: 0.6rem; height: 0.6rem;" role="status"></div>'
      : (st.stage === 'error' || st.stage === 'warning')
      ? '<span class="text-warning small fw-bold" style="font-size: 0.72rem;">⚠️</span>'
      : '<span class="text-success small fw-bold" style="font-size: 0.72rem;">✔</span>';
    const textClass = isLatest ? 'text-light fw-semibold' : 'text-muted';
    return `
      <div class="about-ai-stage-row ${textClass}">
        <div class="d-flex align-items-center gap-2">
          <span>${icon}</span>
          <span>${escapeHtml(st.message || st.title || 'Выполнение этапа...')}</span>
        </div>
        ${st.details ? `<div class="text-secondary ps-3 font-monospace" style="font-size: 0.68rem; word-break: break-all;">↳ ${escapeHtml(st.details)}</div>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Отрисовывает карточки диагностических доменов оборудования.
 * @param {Array<Object>} groupsResults - Результаты анализа групп телеметрии.
 */
export function renderAIDomainCards(groupsResults) {
  const container = document.getElementById('about-ai-groups-container');
  if (!container) return;

  container.innerHTML = groupsResults.map(g => {
    const isPending = g.status === 'pending';
    const isAnalyzing = g.status === 'analyzing';
    const isCrit = g.status === 'critical';
    const isWarn = g.status === 'warning';

    const statusBadge = isPending
      ? '<span class="ui-badge ui-badge-neutral font-monospace"><i class="bi bi-hourglass"></i>Ожидание</span>'
      : isAnalyzing
      ? '<span class="ui-badge ui-badge-info font-monospace"><span class="spinner-border spinner-border-sm me-1" style="width:0.6rem;height:0.6rem;"></span>Анализ LLM...</span>'
      : isCrit
      ? '<span class="ui-badge ui-badge-danger font-monospace"><i class="bi bi-exclamation-octagon-fill"></i>Критично</span>'
      : isWarn
      ? '<span class="ui-badge ui-badge-warning font-monospace"><i class="bi bi-exclamation-triangle-fill"></i>Внимание</span>'
      : '<span class="ui-badge ui-badge-success font-monospace"><i class="bi bi-check-circle-fill"></i>В норме</span>';

    const cardBorder = isCrit
      ? 'border-danger border-opacity-75 shadow-sm'
      : isWarn
      ? 'border-warning border-opacity-50 shadow-sm'
      : isAnalyzing
      ? 'border-info border-opacity-60 shadow-sm'
      : 'border-secondary border-opacity-30';

    const metricsList = g.key_metrics && Object.keys(g.key_metrics).length > 0
      ? `<div class="mt-2 pt-1.5 border-top border-secondary border-opacity-20 d-flex flex-wrap gap-1.5 font-monospace">
          ${Object.entries(g.key_metrics).map(([k, v]) => `<span class="ui-badge ui-badge-neutral font-monospace"><strong class="text-info">${escapeHtml(k)}:</strong> <span class="text-body">${escapeHtml(String(v))}</span></span>`).join('')}
         </div>`
      : '';

    return `
      <div class="col-12 col-md-6">
        <div class="p-2.5 rounded bg-black bg-opacity-40 border ${cardBorder} h-100 d-flex flex-column justify-content-between transition-all" id="domain-card-${g.group_id}">
          <div>
            <div class="d-flex align-items-center justify-content-between mb-1.5">
              <div class="d-flex align-items-center gap-1.5">
                <i class="bi ${escapeHtml(g.icon || 'bi-cpu')} text-info fs-6"></i>
                <strong class="text-light" style="font-size: 0.82rem;">${escapeHtml(g.title)}</strong>
              </div>
              ${statusBadge}
            </div>
            <div class="small text-light mt-1" style="font-size: 0.73rem; line-height: 1.45; white-space: pre-line;">
              ${escapeHtml(g.summary || g.description || 'Ожидание запуска группы...')}
            </div>
          </div>
          ${metricsList}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Отрисовывает аномалии в подсистемах оборудования.
 * @param {Array<Object>} anomalies - Список найденных аномалий.
 */
export function renderAIAnomalies(anomalies) {
  const container = document.getElementById('about-ai-anomalies-container');
  if (!container) return;
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    container.innerHTML = '<span class="badge bg-success-subtle text-success border border-success px-2.5 py-1" style="font-size: 0.72rem;"><i class="bi bi-check-circle me-1"></i> Аномалий в подсистемах оборудования не обнаружено</span>';
    return;
  }

  container.innerHTML = anomalies.map(a => {
    const isCrit = a.severity === 'critical';
    return `<span class="anomaly-pill ${isCrit ? 'critical' : 'warning'}">⚠️ [${escapeHtml(a.subsystem || 'SYS')}] ${escapeHtml(a.title || '')}: ${escapeHtml(a.description || '')}</span>`;
  }).join('');
}
