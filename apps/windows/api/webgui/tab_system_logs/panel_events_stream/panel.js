/**
 * =============================================================================
 * Название: Панель потока событий Windows (Live & Errors Stream)
 * =============================================================================
 * Описание:
 *   Запрос событий журнала из API или кеша браузера, фильтрация по уровню
 *   и времени, отрисовка табличного списка записей и выбор строк.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_events_stream/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import {
  escapeHtml,
  getSeverityClass,
  saveLogToBrowserCache,
  loadLogFromBrowserCache,
  updateCacheDateBadge
} from '../common/ui_utils.js';

let cachedEvents = [];
let isRequestInProgress = false;

export function getCachedEvents() {
  return cachedEvents;
}

export function setCachedEvents(events) {
  cachedEvents = events || [];
}

/**
 * Загружает события журнала из API или локального кеша браузера.
 * @param {boolean} [forceRefresh=false] - Принудительный запрос к серверу без кеша.
 * @param {string} currentChannel - Имя текущего канала.
 * @param {string} currentFilePath - Путь к файлу лога (если выбран файл).
 * @param {Function} [onComplete] - Коллбек после загрузки событий.
 */
export async function loadEvents(forceRefresh = false, currentChannel = 'System', currentFilePath = '', onComplete = null) {
  if (isRequestInProgress) return;

  const levelSelect = document.getElementById('slc-level-select');
  const hoursSelect = document.getElementById('slc-hours-select');
  const searchInput = document.getElementById('slc-search-input');
  const eventIdInput = document.getElementById('slc-eventid-input');
  const limitSelect = document.getElementById('slc-limit-select');
  const tableBody = document.getElementById('slc-table-body');
  const eventsBadge = document.getElementById('slc-stat-events');
  const faultsBadge = document.getElementById('slc-stat-incidents');
  const streamBadge = document.getElementById('slc-stream-count-badge');

  const level = levelSelect ? levelSelect.value : '';
  const hours = hoursSelect ? hoursSelect.value : '24';
  const search = searchInput ? searchInput.value.trim() : '';
  const eventId = eventIdInput && eventIdInput.value.trim() ? eventIdInput.value.trim() : '0';
  const limit = limitSelect ? limitSelect.value : '100';

  const isDefaultFilter = !level && hours === '24' && !search && eventId === '0';

  // 1. Попытка загрузить журнал из кеша браузера
  if (!forceRefresh && isDefaultFilter && !currentFilePath) {
    const cachedData = loadLogFromBrowserCache(currentChannel);
    if (cachedData && Array.isArray(cachedData.events) && cachedData.events.length > 0) {
      cachedEvents = cachedData.events;
      if (eventsBadge) eventsBadge.textContent = String(cachedEvents.length);
      if (streamBadge) streamBadge.textContent = `${cachedEvents.length} records`;

      let errCount = 0;
      let critCount = 0;
      cachedEvents.forEach((e) => {
        const lvl = (e.level || '').toLowerCase();
        if (lvl.includes('crit')) critCount++;
        if (lvl.includes('err')) errCount++;
      });
      if (faultsBadge) faultsBadge.textContent = `${errCount + critCount} faults`;

      updateCacheDateBadge(cachedData.cachedAtFormatted);
      if (typeof onComplete === 'function') onComplete(cachedEvents);
      return;
    }
  }

  // 2. Если кеша нет — индикатор загрузки
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          <div class="spinner-border spinner-border-sm text-info me-2" role="status"></div>
          <span>Загрузка журнала ${escapeHtml(currentChannel)} от операционной системы...</span>
        </td>
      </tr>
    `;
  }

  isRequestInProgress = true;

  try {
    const url = `/api/v1/system_logs/events?channel=${encodeURIComponent(currentChannel)}&limit=${limit}&level=${encodeURIComponent(level)}&search=${encodeURIComponent(search)}&hours=${hours}&event_id=${eventId}&file_path=${encodeURIComponent(currentFilePath)}`;

    const res = await fetch(url);
    if (!res.ok) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Ошибка чтения журнала (HTTP ${res.status})</td></tr>`;
      return;
    }

    const data = await res.json();
    cachedEvents = data.entries || [];

    if (eventsBadge) eventsBadge.textContent = String(cachedEvents.length);
    if (streamBadge) streamBadge.textContent = `${cachedEvents.length} records`;

    let errCount = 0;
    let critCount = 0;
    cachedEvents.forEach((e) => {
      const lvl = (e.level || '').toLowerCase();
      if (lvl.includes('crit')) critCount++;
      if (lvl.includes('err')) errCount++;
    });

    if (faultsBadge) {
      faultsBadge.textContent = `${errCount + critCount} faults`;
    }

    if (isDefaultFilter && !currentFilePath) {
      saveLogToBrowserCache(currentChannel, cachedEvents);
    }

    if (typeof onComplete === 'function') onComplete(cachedEvents);
  } catch (err) {
    console.warn('[SystemLogs] Ошибка загрузки событий:', err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Сетевая ошибка при загрузке логов.</td></tr>`;
  } finally {
    isRequestInProgress = false;
  }
}

/**
 * Отрисовывает таблицу событий в режимах Live Events и Errors Only.
 * @param {Array} entriesToRender - Список записей для рендеринга.
 * @param {Object|null} selectedEvent - Текущее выбранное событие.
 * @param {Function} onSelectEvent - Обработчик клика по строке.
 */
export function renderTableEvents(entriesToRender, selectedEvent, onSelectEvent) {
  const tableBody = document.getElementById('slc-table-body');
  if (!tableBody) return;

  if (entriesToRender.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">События не найдены по активному фильтру.</td></tr>`;
    return;
  }

  tableBody.innerHTML = entriesToRender.map((e, idx) => {
    const badgeClass = getSeverityClass(e.level);
    const eidStr = e.event_id > 0 ? String(e.event_id) : '-';
    const pidStr = e.process_id > 0 ? String(e.process_id) : '-';
    const isSelected = selectedEvent && (
      selectedEvent.timestamp === e.timestamp &&
      selectedEvent.event_id === e.event_id &&
      (selectedEvent.provider || selectedEvent.source) === (e.provider || e.source)
    );

    return `
      <tr data-index="${idx}" class="${isSelected ? 'selected table-active' : ''}">
        <td class="font-monospace text-secondary text-nowrap">${escapeHtml(e.timestamp)}</td>
        <td><span class="badge ${badgeClass} text-uppercase px-2 py-1">${escapeHtml(e.level)}</span></td>
        <td class="text-center font-monospace">${escapeHtml(eidStr)}</td>
        <td class="text-truncate text-info" style="max-width: 160px;" title="${escapeHtml(e.provider || e.source)}">${escapeHtml(e.provider || e.source)}</td>
        <td class="text-center font-monospace text-muted">${escapeHtml(pidStr)}</td>
        <td class="font-monospace text-light" style="word-break: break-word;">${escapeHtml(e.message)}</td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('tr').forEach((row) => {
    row.onclick = () => {
      const idx = parseInt(row.getAttribute('data-index') || '0', 10);
      const ev = entriesToRender[idx];
      tableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected', 'table-active'));
      row.classList.add('selected', 'table-active');
      if (typeof onSelectEvent === 'function') {
        onSelectEvent(ev);
      }
    };
  });
}
