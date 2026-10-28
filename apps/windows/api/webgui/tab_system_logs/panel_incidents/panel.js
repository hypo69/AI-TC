/**
 * =============================================================================
 * Название: Панель корреляции инцидентов и каскадов сбоев
 * =============================================================================
 * Описание:
 *   Анализ цепочек связанных ошибок в заданном временном окне,
 *   выявление первопричин (root cause) и группировка инцидентов.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_incidents/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml, getSeverityClass } from '../common/ui_utils.js';

/**
 * Загружает и отображает список скоррелированных каскадов сбоев.
 */
export async function loadIncidentsView() {
  const listEl = document.getElementById('slc-incidents-list');
  if (!listEl) return;
  listEl.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-info me-2"></div>Корреляция каскадов инцидентов...</div>`;

  try {
    const res = await fetch('/api/v1/system_logs/incidents?window_seconds=25.0');
    if (!res.ok) return;
    const data = await res.json();
    const incidents = data.incidents || [];

    if (incidents.length === 0) {
      listEl.innerHTML = `<div class="card bg-dark border-secondary p-4 text-center text-muted">В выбранном интервале каскадных сбоев не обнаружено.</div>`;
      return;
    }

    listEl.innerHTML = incidents.map((inc) => `
      <div class="card bg-dark border-secondary mb-3 shadow-sm">
        <div class="card-header bg-black d-flex justify-content-between align-items-center">
          <span class="fw-bold text-info"><i class="bi bi-lightning-charge me-1"></i>${escapeHtml(inc.title)}</span>
          <span class="badge ${getSeverityClass(inc.severity)}">${escapeHtml(inc.severity)}</span>
        </div>
        <div class="card-body">
          <div class="row g-2 mb-2 small text-muted font-monospace">
            <div class="col-sm-4">Окно: ${escapeHtml(inc.start_time)} (${inc.duration_seconds}s)</div>
            <div class="col-sm-4">Источник: ${escapeHtml(inc.primary_source)}</div>
            <div class="col-sm-4">Событий: ${inc.events_count}</div>
          </div>
          <p class="small text-light mb-2"><strong class="text-warning">Первопричина:</strong> ${escapeHtml(inc.root_cause_hint)}</p>
          <p class="small text-muted mb-0">${escapeHtml(inc.summary)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<div class="alert alert-danger">Ошибка получения инцидентов: ${escapeHtml(err.message)}</div>`;
  }
}
