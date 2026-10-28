/**
 * Модуль инцидентов, каскадных сбоев и временной шкалы активности (Incidents & Timeline).
 * 
 * Отвечает за:
 * - Выявление цепочек связанных инцидентов и каскадных сбоев Windows
 * - Построение почасовой гистограммы интенсивности событий
 * - Визуализацию тепловой карты активности (Activity Heatmap)
 * - Интерактивную фильтрацию и детализацию событий временного интервала
 * 
 * Updated: 2026-10-17 00:30:00
 */

import { escapeHtml, formatTime, getSeverityClass, t } from '../common/ui_utils.js';
import { showEventDetails } from '../panel_event_logs/modal.js';

let cachedTimelineData = null;
let selectedTimelineBucket = null;
let timelineSubView = 'both';

/**
 * Загрузка каскадных сбоев и цепочек инцидентов для активного канала логов.
 * @param {string} channel
 * @param {string} currentFilePath
 */
export async function loadIncidents(channel = 'System', currentFilePath = '') {
  const listEl = document.getElementById('slc-incidents-list');
  if (!listEl) return;

  listEl.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-info me-2"></div>Поиск каскадных цепочек сбоев...</div>`;

  const cleanChan = channel.replace(/^evt:/i, '');
  const hoursSelect = document.getElementById('slc-hours-select');
  const hours = hoursSelect ? hoursSelect.value : '24';

  try {
    const res = await fetch(`/api/v1/system_logs/incidents?channel=${encodeURIComponent(cleanChan)}&hours=${hours}&file_path=${encodeURIComponent(currentFilePath || '')}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const incidents = data.incidents || [];

    if (incidents.length === 0) {
      listEl.innerHTML = `
        <div class="slc-card p-4 text-center text-muted shadow-sm">
          <i class="bi bi-shield-check text-success fs-3 mb-2 d-block"></i>
          <div>В выбранном журнале каскадных сбоев не зафиксировано.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = incidents.map(inc => {
      const title = inc.title || inc.incident_title || 'Каскадный сбой';
      const count = inc.events_count || inc.count || 1;
      const timeWindow = inc.start_time || inc.time_window || '';
      const summary = inc.summary || inc.root_cause_hint || '';
      return `
        <div class="slc-card mb-2 shadow-sm border-danger">
          <div class="slc-card-header text-danger d-flex justify-content-between align-items-center py-1.5 px-3">
            <strong>${escapeHtml(title)}</strong>
            <span class="badge bg-danger">${count} событий</span>
          </div>
          <div class="p-2.5">
            <p class="small mb-1">${escapeHtml(summary)}</p>
            ${timeWindow ? `<div class="small font-monospace text-muted">Временное окно: ${escapeHtml(timeWindow)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    listEl.innerHTML = `<div class="alert alert-danger">Ошибка загрузки инцидентов: ${escapeHtml(e.message)}</div>`;
  }
}

/**
 * Загрузка таймлайна активности логов.
 * @param {string} channel
 * @param {string} currentFilePath
 */
export async function loadTimeline(channel = 'System', currentFilePath = '') {
  const contentEl = document.getElementById('slc-timeline-content') || document.getElementById('slc-timeline-list');
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="text-center py-5 text-muted">
      <div class="spinner-border text-info mb-3" role="status"></div>
      <div class="fw-bold" style="color: var(--text-color);">Построение временного графика активности логов...</div>
      <div class="small text-muted mt-1">Агрегация по времени • Анализ частоты • Activity Heatmap</div>
    </div>
  `;

  const hoursSelect = document.getElementById('slc-hours-select');
  const hours = hoursSelect ? hoursSelect.value : '24';
  const levelSelect = document.getElementById('slc-level-select');
  const level = levelSelect ? levelSelect.value : '';
  const searchInput = document.getElementById('slc-search-input');
  const search = searchInput ? searchInput.value.trim() : '';

  try {
    const url = `/api/v1/system_logs/timeline?channel=${encodeURIComponent(channel)}&hours=${hours}&limit=1000&level=${encodeURIComponent(level)}&search=${encodeURIComponent(search)}&file_path=${encodeURIComponent(currentFilePath || '')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedTimelineData = data;
    selectedTimelineBucket = null;
    renderTimelineInterface(data);
  } catch (err) {
    contentEl.innerHTML = `<div class="alert alert-danger">Ошибка таймлайна: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Рендеринг интерфейса Activity Timeline & Heatmap.
 * @param {Object} data
 */
export function renderTimelineInterface(data) {
  const contentEl = document.getElementById('slc-timeline-content') || document.getElementById('slc-timeline-list');
  if (!contentEl || !data) return;

  const summary = data.summary || {};
  const histogram = data.histogram || [];
  const heatmap = data.heatmap || [];
  const topProviders = data.top_providers || [];

  const totalEvents = summary.total_events || 0;
  const critCount = summary.critical_count || 0;
  const errCount = summary.error_count || 0;
  const warnCount = summary.warning_count || 0;
  const infoCount = summary.info_count || 0;

  const maxBucketTotal = Math.max(...histogram.map((h) => h.total), 1);
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const providersHtml = topProviders.map((tp) => `
    <span class="badge bg-dark border border-secondary text-info px-2 py-1 font-monospace" style="font-size: 0.72rem;">
      ${escapeHtml(tp.provider)}: <strong class="text-light">${tp.count}</strong>
    </span>
  `).join('');

  const pulseColsHtml = histogram.map((h, i) => {
    const isSelected = selectedTimelineBucket && selectedTimelineBucket.time === h.time;
    const heightPct = Math.max(6, Math.min(100, Math.round((h.total / maxBucketTotal) * 100)));
    let barColor = 'var(--accent-primary, #0284c7)';
    if (h.critical > 0) barColor = '#ef4444';
    else if (h.errors > 0) barColor = '#f97316';
    else if (h.warnings > 0) barColor = '#eab308';

    return `
      <div class="gh-pulse-col ${isSelected ? 'selected' : ''}" data-index="${i}" title="${escapeHtml(h.time)}: Всего ${h.total} событий" style="flex: 1; min-width: 12px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; cursor: pointer;">
        <div style="width: 100%; height: ${heightPct}%; background: ${barColor}; border-radius: 2px;"></div>
      </div>
    `;
  }).join('');

  const drilldownEvents = selectedTimelineBucket ? (selectedTimelineBucket.events || []) : (histogram[histogram.length - 1]?.events || []);
  const drilldownTitle = selectedTimelineBucket ? `События интервала: ${selectedTimelineBucket.time}` : 'Последние зафиксированные события';

  const drilldownRowsHtml = drilldownEvents.length === 0 ? `<tr><td colspan="5" class="text-center text-muted py-3">Нет событий в выбранном интервале</td></tr>` : drilldownEvents.slice(0, 25).map((ev, idx) => `
    <tr class="interactive-table-row" data-index="${idx}" style="cursor: pointer;">
      <td class="font-monospace small text-muted">${escapeHtml(formatTime(ev.timestamp))}</td>
      <td><span class="badge ${getSeverityClass(ev.level)}">${escapeHtml(ev.level || 'Info')}</span></td>
      <td class="font-monospace small text-info">${ev.event_id || '-'}</td>
      <td class="small fw-semibold text-truncate" style="max-width: 150px;">${escapeHtml(ev.provider || '-')}</td>
      <td class="small text-truncate" style="max-width: 380px;">${escapeHtml(ev.message || '-')}</td>
    </tr>
  `).join('');

  contentEl.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2 px-1 flex-wrap gap-2">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="small text-muted">Всего: <strong class="text-info font-monospace">${totalEvents.toLocaleString()}</strong></span>
        <span class="badge bg-danger-subtle text-danger font-monospace">Сбои: ${critCount + errCount}</span>
        <span class="badge bg-warning-subtle text-warning font-monospace">Предупреждения: ${warnCount}</span>
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary ${timelineSubView === 'both' ? 'active' : ''}" id="btn-gh-view-both">Все</button>
        <button class="btn btn-outline-secondary ${timelineSubView === 'pulse' ? 'active' : ''}" id="btn-gh-view-pulse">Интенсивность</button>
      </div>
    </div>

    <div class="slc-card p-3 mb-3 shadow-sm">
      <div class="small fw-bold mb-2 text-muted">Гистограмма интенсивности событий:</div>
      <div style="height: 120px; display: flex; align-items: flex-end; gap: 3px; background: var(--surface-1); padding: 8px; border-radius: 6px;">
        ${pulseColsHtml}
      </div>
    </div>

    <div class="slc-card shadow-sm p-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold small text-info"><i class="bi bi-list-nested me-1"></i>${escapeHtml(drilldownTitle)}</span>
      </div>
      <div class="table-responsive" style="max-height: 240px; overflow-y: auto;">
        <table class="slc-table mb-0">
          <thead>
            <tr>
              <th style="width: 120px;">Время</th>
              <th style="width: 80px;">Уровень</th>
              <th style="width: 60px;">ID</th>
              <th style="width: 150px;">Поставщик</th>
              <th>Сообщение</th>
            </tr>
          </thead>
          <tbody id="gh-drilldown-table-body">
            ${drilldownRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  contentEl.querySelectorAll('.gh-pulse-col').forEach(col => {
    col.onclick = () => {
      const idx = parseInt(col.getAttribute('data-index') || '0', 10);
      selectedTimelineBucket = histogram[idx];
      renderTimelineInterface(data);
    };
  });

  const drilldownBody = document.getElementById('gh-drilldown-table-body');
  if (drilldownBody) {
    drilldownBody.querySelectorAll('tr').forEach(row => {
      row.onclick = () => {
        const idx = parseInt(row.getAttribute('data-index') || '0', 10);
        const ev = drilldownEvents[idx];
        if (ev) showEventDetails(ev);
      };
    });
  }
}
