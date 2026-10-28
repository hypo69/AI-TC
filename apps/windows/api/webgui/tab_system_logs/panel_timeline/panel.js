/**
 * =============================================================================
 * Название: Панель временной шкалы и матрицы активности (GitHub Timeline)
 * =============================================================================
 * Описание:
 *   Визуализация частоты событий Windows во времени: интерактивная гистограмма
 *   Pulse, недельная матрица Heatmap 7x24, статистика пиков и детализация слотов.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_timeline/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml, getSeverityClass } from '../common/ui_utils.js';

let timelineSubView = 'both';
let selectedTimelineBucket = null;
let cachedTimelineData = null;

/**
 * Загружает данные временной шкалы и строит визуализацию.
 * @param {string} currentChannel - Имя текущего канала.
 * @param {string} currentFilePath - Путь к файлу лога.
 * @param {Function} [onSelectEvent] - Коллбек при клике на событие детализации.
 */
export async function loadTimelineView(currentChannel = 'System', currentFilePath = '', onSelectEvent = null) {
  const contentEl = document.getElementById('slc-timeline-content');
  if (!contentEl) return;

  const hoursSelect = document.getElementById('slc-hours-select');
  const limitSelect = document.getElementById('slc-limit-select');
  const levelSelect = document.getElementById('slc-level-select');
  const searchInput = document.getElementById('slc-search-input');
  const eventIdInput = document.getElementById('slc-eventid-input');

  const hours = hoursSelect ? hoursSelect.value : '24';
  const limit = limitSelect ? limitSelect.value : '500';
  const level = levelSelect ? levelSelect.value : '';
  const search = searchInput ? searchInput.value.trim() : '';
  const eventId = eventIdInput && eventIdInput.value.trim() ? eventIdInput.value.trim() : '0';

  contentEl.innerHTML = `
    <div class="text-center py-5 text-muted">
      <div class="spinner-border text-info mb-3" role="status"></div>
      <div class="fw-bold text-light">Построение временного графика активности логов...</div>
      <div class="small text-secondary mt-1">Агрегация по времени • Анализ частоты • Тепловая карта активности</div>
    </div>
  `;

  try {
    const url = `/api/v1/system_logs/timeline?channel=${encodeURIComponent(currentChannel)}&hours=${hours}&limit=${limit}&level=${encodeURIComponent(level)}&search=${encodeURIComponent(search)}&event_id=${eventId}&file_path=${encodeURIComponent(currentFilePath)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedTimelineData = data;
    selectedTimelineBucket = null;

    renderTimelineInterface(data, currentChannel, onSelectEvent);
  } catch (err) {
    contentEl.innerHTML = `<div class="alert alert-danger">Ошибка загрузки таймлайна: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Отрисовывает интерфейс GitHub-style временной шкалы.
 * @param {Object} data - Данные ответа эндпоинта timeline.
 * @param {string} currentChannel - Имя текущего канала.
 * @param {Function} [onSelectEvent] - Коллбек при клике на строку таблицы.
 */
export function renderTimelineInterface(data, currentChannel = 'System', onSelectEvent = null) {
  const contentEl = document.getElementById('slc-timeline-content');
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
  const peakTime = summary.peak_time || 'N/A';
  const peakCount = summary.peak_count || 0;

  const maxBucketTotal = Math.max(...histogram.map((h) => h.total), 1);

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  const providersHtml = topProviders.map((tp) => `
    <span class="badge bg-dark border border-secondary text-info px-2 py-1 font-monospace" style="font-size: 0.72rem;">
      ${escapeHtml(tp.provider)}: <strong class="text-light">${tp.count}</strong>
    </span>
  `).join('') || '<span class="text-muted small">Нет данных</span>';

  const pulseBarsHtml = histogram.map((h, idx) => {
    const heightPct = Math.max(10, (h.total / maxBucketTotal) * 100);
    const isSelected = selectedTimelineBucket && selectedTimelineBucket.time === h.time;

    const critPct = h.total > 0 ? (h.critical / h.total) * 100 : 0;
    const errPct = h.total > 0 ? (h.errors / h.total) * 100 : 0;
    const warnPct = h.total > 0 ? (h.warnings / h.total) * 100 : 0;
    const infoPct = h.total > 0 ? (h.info / h.total) * 100 : 0;

    const timeLabel = h.time.length > 10 ? h.time.slice(11, 16) || h.time.slice(5, 10) : h.time;

    return `
      <div class="gh-pulse-col ${isSelected ? 'active' : ''}" data-index="${idx}" title="${escapeHtml(h.time)} — Всего: ${h.total} (Крит: ${h.critical}, Ошибок: ${h.errors}, Предупр: ${h.warnings}, Инфо: ${h.info})">
        <span class="gh-col-count">${h.total > 0 ? h.total : ''}</span>
        <div class="gh-bar-track" style="height: ${heightPct}%;">
          ${infoPct > 0 ? `<div class="gh-seg-info" style="height: ${infoPct}%;"></div>` : ''}
          ${warnPct > 0 ? `<div class="gh-seg-warn" style="height: ${warnPct}%;"></div>` : ''}
          ${errPct > 0 ? `<div class="gh-seg-err" style="height: ${errPct}%;"></div>` : ''}
          ${critPct > 0 ? `<div class="gh-seg-crit" style="height: ${critPct}%;"></div>` : ''}
        </div>
        <span class="gh-col-label">${escapeHtml(timeLabel)}</span>
      </div>
    `;
  }).join('');

  let heatmapRowsHtml = '';
  if (heatmap && heatmap.length === 7) {
    heatmapRowsHtml = heatmap.map((row, dayIdx) => {
      const cellsHtml = row.map((cell, hourIdx) => {
        const hasErr = (cell.errors || 0) > 0;
        return `
          <div class="gh-heat-cell lvl-${cell.level} ${hasErr ? 'has-err' : ''}" data-day="${dayIdx}" data-hour="${hourIdx}" title="${dayNames[dayIdx]} ${hourLabels[hourIdx]}: ${cell.count} событий (${cell.errors || 0} ошибок, ${cell.warnings || 0} предупр.)"></div>
        `;
      }).join('');

      return `
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="text-secondary small font-monospace text-end" style="width: 24px; font-size: 0.7rem;">${dayNames[dayIdx]}</span>
          <div class="d-flex gap-1 flex-grow-1">
            ${cellsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  let drilldownEvents = [];
  let drilldownTitle = 'Все события в интервале графика';
  if (selectedTimelineBucket) {
    drilldownEvents = selectedTimelineBucket.events || [];
    drilldownTitle = `События интервала: ${escapeHtml(selectedTimelineBucket.time)} (${drilldownEvents.length} записей)`;
  } else {
    histogram.forEach((h) => {
      if (h.events) drilldownEvents.push(...h.events);
    });
    drilldownEvents = drilldownEvents.slice(0, 50);
  }

  const drilldownRowsHtml = drilldownEvents.map((e, idx) => {
    const badgeClass = getSeverityClass(e.level);
    const eidStr = e.event_id > 0 ? String(e.event_id) : '-';
    return `
      <tr data-index="${idx}" class="cursor-pointer">
        <td class="font-monospace text-secondary text-nowrap">${escapeHtml(e.timestamp)}</td>
        <td><span class="badge ${badgeClass} text-uppercase px-2 py-1">${escapeHtml(e.level)}</span></td>
        <td class="text-center font-monospace">${escapeHtml(eidStr)}</td>
        <td class="text-truncate text-info" style="max-width: 150px;" title="${escapeHtml(e.provider)}">${escapeHtml(e.provider)}</td>
        <td class="font-monospace text-light text-truncate" style="max-width: 320px;" title="${escapeHtml(e.message)}">${escapeHtml(e.message)}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" class="text-center text-muted py-3">Нет событий для отображения.</td></tr>`;

  contentEl.innerHTML = `
    <div class="gh-timeline-container shadow-sm">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom border-secondary">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-5">📊</span>
          <div>
            <div class="fw-bold text-light small">Временной график активности: <span class="text-info">${escapeHtml(data.channel || currentChannel)}</span></div>
            <div class="text-muted small" style="font-size: 0.72rem;">Визуализация частоты событий и инцидентов во времени (GitHub Activity Style)</div>
          </div>
        </div>
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-secondary ${timelineSubView === 'pulse' ? 'active' : ''}" id="btn-gh-view-pulse" style="font-size: 0.75rem;">
            <i class="bi bi-bar-chart-fill me-1"></i>Столбцы (Pulse)
          </button>
          <button type="button" class="btn btn-outline-secondary ${timelineSubView === 'heatmap' ? 'active' : ''}" id="btn-gh-view-heatmap" style="font-size: 0.75rem;">
            <i class="bi bi-grid-3x3-gap-fill me-1"></i>Сетка (Heatmap)
          </button>
          <button type="button" class="btn btn-outline-secondary ${timelineSubView === 'both' ? 'active' : ''}" id="btn-gh-view-both" style="font-size: 0.75rem;">
            <i class="bi bi-layout-split me-1"></i>Оба вида
          </button>
        </div>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-sm-2 col-6">
          <div class="gh-stat-card text-center">
            <div class="text-muted small" style="font-size: 0.7rem;">Всего событий</div>
            <div class="fs-5 fw-bold text-light font-monospace">${totalEvents}</div>
          </div>
        </div>
        <div class="col-sm-2 col-6">
          <div class="gh-stat-card text-center">
            <div class="text-muted small" style="font-size: 0.7rem;">Ошибки / Крит</div>
            <div class="fs-5 fw-bold text-danger font-monospace">${critCount + errCount}</div>
          </div>
        </div>
        <div class="col-sm-2 col-6">
          <div class="gh-stat-card text-center">
            <div class="text-muted small" style="font-size: 0.7rem;">Предупреждения</div>
            <div class="fs-5 fw-bold text-warning font-monospace">${warnCount}</div>
          </div>
        </div>
        <div class="col-sm-2 col-6">
          <div class="gh-stat-card text-center">
            <div class="text-muted small" style="font-size: 0.7rem;">Информация</div>
            <div class="fs-5 fw-bold text-success font-monospace">${infoCount}</div>
          </div>
        </div>
        <div class="col-sm-4 col-12">
          <div class="gh-stat-card">
            <div class="text-muted small" style="font-size: 0.7rem;">Пиковая активность</div>
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-info font-monospace small">${escapeHtml(peakTime)}</span>
              <span class="badge bg-danger rounded-pill">${peakCount} соб.</span>
            </div>
          </div>
        </div>
      </div>

      <div id="gh-section-pulse" class="${timelineSubView === 'heatmap' ? 'd-none' : ''} mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="small fw-bold text-light"><i class="bi bi-activity text-info me-1"></i>Гистограмма частоты событий (Pulse Timeline)</div>
          <div class="d-flex align-items-center gap-3 small" style="font-size: 0.72rem;">
            <span><span class="d-inline-block rounded-circle me-1" style="width: 8px; height: 8px; background: #238636;"></span>Инфо</span>
            <span><span class="d-inline-block rounded-circle me-1" style="width: 8px; height: 8px; background: #d29922;"></span>Предупр.</span>
            <span><span class="d-inline-block rounded-circle me-1" style="width: 8px; height: 8px; background: #da3633;"></span>Ошибки</span>
            <span><span class="d-inline-block rounded-circle me-1" style="width: 8px; height: 8px; background: #8e1515;"></span>Крит.</span>
          </div>
        </div>
        <div class="gh-pulse-chart" id="gh-pulse-chart-container">
          ${pulseBarsHtml}
        </div>
        <div class="text-muted small mt-2" style="font-size: 0.7rem;">
          💡 Нажмите на любой столбец гистограммы, чтобы детализировать события выбранного временного слота.
        </div>
      </div>

      <div id="gh-section-heatmap" class="${timelineSubView === 'pulse' ? 'd-none' : ''} mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="small fw-bold text-light"><i class="bi bi-grid-3x3-gap text-info me-1"></i>Недельная матрица активности (GitHub Contribution Heatmap: 24h × 7 дней)</div>
          <div class="d-flex align-items-center gap-1 small" style="font-size: 0.7rem;">
            <span class="text-muted me-1">Меньше</span>
            <span class="gh-heat-cell lvl-0 d-inline-block" style="width: 11px; height: 11px;"></span>
            <span class="gh-heat-cell lvl-1 d-inline-block" style="width: 11px; height: 11px;"></span>
            <span class="gh-heat-cell lvl-2 d-inline-block" style="width: 11px; height: 11px;"></span>
            <span class="gh-heat-cell lvl-3 d-inline-block" style="width: 11px; height: 11px;"></span>
            <span class="gh-heat-cell lvl-4 d-inline-block" style="width: 11px; height: 11px;"></span>
            <span class="text-muted ms-1">Больше</span>
          </div>
        </div>
        <div class="p-2 rounded bg-black border border-secondary overflow-auto">
          <div class="d-flex align-items-center gap-2 mb-1 ps-4 text-muted font-monospace" style="font-size: 0.65rem;">
            <span>00:00</span>
            <span class="ms-auto">06:00</span>
            <span class="ms-auto">12:00</span>
            <span class="ms-auto">18:00</span>
            <span class="ms-auto">23:00</span>
          </div>
          ${heatmapRowsHtml}
        </div>
      </div>

      <div class="mb-3">
        <div class="small fw-bold text-light mb-1"><i class="bi bi-building me-1 text-info"></i>Ключевые поставщики в выборке:</div>
        <div class="d-flex flex-wrap gap-1">
          ${providersHtml}
        </div>
      </div>

      <div class="card bg-black border-secondary">
        <div class="card-header bg-dark border-secondary d-flex justify-content-between align-items-center py-1.5 px-3">
          <span class="text-light small fw-bold"><i class="bi bi-list-nested me-1 text-info"></i>${escapeHtml(drilldownTitle)}</span>
          ${selectedTimelineBucket ? `
            <button class="btn btn-xs btn-outline-info rounded-pill py-0 px-2" id="btn-gh-reset-bucket" style="font-size: 0.72rem;">
              <i class="bi bi-x-circle me-1"></i>Сбросить фильтр
            </button>
          ` : ''}
        </div>
        <div class="table-responsive" style="max-height: 240px; overflow-y: auto;">
          <table class="table slc-table table-sm mb-0">
            <thead>
              <tr>
                <th style="width: 140px;">Время</th>
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
    </div>
  `;

  const btnPulse = document.getElementById('btn-gh-view-pulse');
  const btnHeatmap = document.getElementById('btn-gh-view-heatmap');
  const btnBoth = document.getElementById('btn-gh-view-both');

  if (btnPulse) {
    btnPulse.onclick = () => {
      timelineSubView = 'pulse';
      renderTimelineInterface(data, currentChannel, onSelectEvent);
    };
  }
  if (btnHeatmap) {
    btnHeatmap.onclick = () => {
      timelineSubView = 'heatmap';
      renderTimelineInterface(data, currentChannel, onSelectEvent);
    };
  }
  if (btnBoth) {
    btnBoth.onclick = () => {
      timelineSubView = 'both';
      renderTimelineInterface(data, currentChannel, onSelectEvent);
    };
  }

  const btnResetBucket = document.getElementById('btn-gh-reset-bucket');
  if (btnResetBucket) {
    btnResetBucket.onclick = () => {
      selectedTimelineBucket = null;
      renderTimelineInterface(data, currentChannel, onSelectEvent);
    };
  }

  contentEl.querySelectorAll('.gh-pulse-col').forEach((col) => {
    col.onclick = () => {
      const idx = parseInt(col.getAttribute('data-index') || '0', 10);
      selectedTimelineBucket = histogram[idx];
      renderTimelineInterface(data, currentChannel, onSelectEvent);
    };
  });

  const drilldownBody = document.getElementById('gh-drilldown-table-body');
  if (drilldownBody) {
    drilldownBody.querySelectorAll('tr').forEach((row) => {
      row.onclick = () => {
        const idx = parseInt(row.getAttribute('data-index') || '0', 10);
        const ev = drilldownEvents[idx];
        if (ev && typeof onSelectEvent === 'function') {
          onSelectEvent(ev);
        }
      };
    });
  }
}
