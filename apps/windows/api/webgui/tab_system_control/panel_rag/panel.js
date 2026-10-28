/**
 * Модуль панели семантического RAG-поиска по системным журналам Windows.
 * 
 * Отвечает за:
 * - Полнотекстовый и семантический поиск по журналам без расхода токенов LLM
 * - Кластеризацию и ранжирование релевантности событий
 * - Синхронизацию и кэширование в IndexedDB
 * - Построение и перестроение локального поискового индекса
 * 
 * Updated: 2026-10-17 00:30:00
 */

import { escapeHtml, getSeverityClass, t } from '../common/ui_utils.js';
import { BrowserRagCache, RagIndexDB } from './rag_db.js';

let isAutoBuildingRag = false;
let onShowEventDetails = () => {};

/**
 * Установка колбэка для открытия деталей события из RAG-выдачи.
 * @param {Function} cb
 */
export function setRagEventDetailsCallback(cb) {
  if (typeof cb === 'function') {
    onShowEventDetails = cb;
  }
}

/**
 * Получение выбранного периода выборки в часах.
 * @returns {number}
 */
export function getSelectedRagPeriod() {
  const periodSelect = document.getElementById('slc-rag-period-select');
  return periodSelect ? parseInt(periodSelect.value, 10) : 24;
}

/**
 * Человекопонятная метка периода выборки.
 * @param {number} hours
 * @returns {string}
 */
export function getPeriodLabel(hours) {
  const h = parseInt(hours, 10);
  if (h === 1) return t('systemControl.ragPeriod1h', 'Последний 1 час');
  if (h === 6) return t('systemControl.ragPeriod6h', 'Последние 6 часов');
  if (h === 24) return t('systemControl.ragPeriod24h', 'Последние 24 часа');
  if (h === 72) return t('systemControl.ragPeriod3d', 'Последние 3 дня');
  if (h === 168) return t('systemControl.ragPeriod7d', 'Последние 7 дней');
  if (h === 720) return t('systemControl.ragPeriod30d', 'Последние 30 дней');
  return `${h} ${t('systemControl.ragHours', 'ч')}`;
}

/**
 * Синхронизация отображения выбранного периода в бейджах и селекторах.
 * @param {number} hours
 */
export function updateRagPeriodDisplay(hours) {
  const h = parseInt(hours, 10);
  const badgeEl = document.getElementById('slc-rag-period-badge');
  if (badgeEl) {
    badgeEl.textContent = getPeriodLabel(h);
  }
  const periodSelect = document.getElementById('slc-rag-period-select');
  if (periodSelect && periodSelect.value !== String(h)) {
    const opt = periodSelect.querySelector(`option[value="${h}"]`);
    if (opt) periodSelect.value = String(h);
  }
  const hoursSelect = document.getElementById('slc-hours-select');
  if (hoursSelect && hoursSelect.value !== String(h)) {
    const opt = hoursSelect.querySelector(`option[value="${h}"]`);
    if (opt) hoursSelect.value = String(h);
  }
}

/**
 * Отображение статуса RAG индекса в интерфейсе.
 * @param {Object} data
 */
export function applyRagStatusToUi(data) {
  const badgeEl = document.getElementById('slc-rag-status-badge');
  const countEl = document.getElementById('slc-rag-indexed-count');
  const chansEl = document.getElementById('slc-rag-channels-count');
  const lastBuiltEl = document.getElementById('slc-rag-last-built');
  const hours = getSelectedRagPeriod();

  const totalEv = data.total_events || data.indexed_events || 0;
  const channelsCount = data.channels_count || data.scanned_channels || (data.channels_list ? data.channels_list.length : 0);

  if (countEl) countEl.textContent = totalEv.toLocaleString();
  if (chansEl) chansEl.textContent = channelsCount.toLocaleString();
  if (lastBuiltEl) {
    lastBuiltEl.textContent = data.last_built_at || data.generated_at ? `Обновлено: ${data.last_built_at || data.generated_at}` : 'Индекс еще не создан';
  }
  updateRagPeriodDisplay(data.hours !== undefined ? data.hours : hours);

  if (badgeEl) {
    if ((data.is_indexed || totalEv > 0) && totalEv > 0) {
      badgeEl.textContent = 'Готов к поиску (БД Кеш)';
      badgeEl.className = 'text-success fw-bold';
    } else if (isAutoBuildingRag) {
      badgeEl.innerHTML = '<span class="spinner-border spinner-border-sm text-warning me-1"></span>Сбор данных...';
      badgeEl.className = 'text-warning fw-bold';
    } else {
      badgeEl.textContent = 'Требуется сбор данных';
      badgeEl.className = 'text-warning fw-bold';
    }
  }

  const chanSelect = document.getElementById('slc-rag-channel-select');
  if (chanSelect && data.channels_list && data.channels_list.length > 0) {
    const currentVal = chanSelect.value;
    const opts = ['<option value="all">🌐 Все журналы системы (По всей ОС)</option>'];
    data.channels_list.forEach(ch => {
      opts.push(`<option value="${escapeHtml(ch)}">${escapeHtml(ch)}</option>`);
    });
    chanSelect.innerHTML = opts.join('');
    if (currentVal && data.channels_list.includes(currentVal)) {
      chanSelect.value = currentVal;
    }
  }
}

/**
 * Фоновая синхронизация чанков с бэкенда в IndexedDB.
 * @param {Object} meta
 * @param {number} hours
 */
async function syncServerChunksToIndexedDb(meta, hours) {
  try {
    const res = await fetch('/api/v1/system_logs/rag/chunks?limit=3000');
    if (res.ok) {
      const data = await res.json();
      const chunks = data.chunks || [];
      await RagIndexDB.saveIndex(meta, chunks);
      RagIndexDB.updateDbIndicator(true, meta.indexed_events || chunks.length);
    }
  } catch (e) {
    console.debug('[RagIndexDB] Ошибка фоновой синхронизации чанков:', e);
  }
}

/**
 * Получение статуса RAG индекса.
 * @param {boolean} autoTrigger
 */
export async function fetchRagStatus(autoTrigger = true) {
  const hours = getSelectedRagPeriod();

  // 1. Проверяем наличие актуального индекса в IndexedDB браузера
  try {
    const cachedStatus = await RagIndexDB.loadIndexMeta(hours);
    if (cachedStatus && (cachedStatus.indexed_events > 0 || cachedStatus.total_events > 0)) {
      applyRagStatusToUi(cachedStatus);
      RagIndexDB.updateDbIndicator(true, cachedStatus.indexed_events || cachedStatus.total_events);
      return;
    }
  } catch (dbErr) {
    console.debug('[RagIndexDB] Ошибка предварительного чтения метаданных:', dbErr);
  }

  // 2. Опрос бэкенда
  try {
    const res = await fetch('/api/v1/system_logs/rag/status');
    if (!res.ok) return;
    const data = await res.json();
    const totalEv = data.total_events || data.indexed_events || 0;

    if (totalEv > 0) {
      BrowserRagCache.set(`status_${hours}`, data);
      applyRagStatusToUi(data);
      syncServerChunksToIndexedDb(data, hours);
    } else if (autoTrigger && !isAutoBuildingRag) {
      console.info('[RagIndexDB] Индекс пуст. Автоматический запуск сбора и индексации...');
      rebuildRagIndex(true);
    } else {
      applyRagStatusToUi(data);
    }
  } catch (e) {
    console.debug('[SystemLogs] Ошибка получения статуса RAG:', e);
  }
}

/**
 * Рендеринг результатов RAG-поиска.
 */
export function renderRagResults(chunks, query, periodLabel, fromCache = false) {
  const resultsEl = document.getElementById('slc-rag-results');
  if (!resultsEl) return;

  if (!chunks || chunks.length === 0) {
    resultsEl.innerHTML = `
      <div class="slc-card p-4 text-center text-muted shadow-sm">
        <i class="bi bi-search text-warning fs-3 mb-2 d-block"></i>
        <div>По запросу «<strong>${escapeHtml(query)}</strong>» совпадений в журналах за период «<strong>${escapeHtml(periodLabel)}</strong>» не найдено.</div>
        <div class="small text-muted mt-1">Попробуйте изменить формулировку или нажмите «Перестроить RAG-индекс».</div>
      </div>
    `;
    return;
  }

  const totalOccurrences = chunks.reduce((acc, c) => acc + (c.count || 1), 0);

  resultsEl.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2 px-1 flex-wrap gap-2">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="small text-muted">Найдено кластеров: <strong class="text-info font-monospace">${chunks.length}</strong> (Всего событий: <strong class="text-warning font-monospace">${totalOccurrences.toLocaleString()}</strong>, Период: <strong>${escapeHtml(periodLabel)}</strong>)</span>
      </div>
      <div class="d-flex align-items-center gap-2">
        ${fromCache ? '<span class="badge bg-info-subtle text-info border border-info-subtle font-monospace" style="font-size: 0.72rem;"><i class="bi bi-hdd me-1"></i>Кеш браузера</span>' : ''}
        <span class="badge bg-secondary font-monospace" style="font-size: 0.72rem;">In-Memory Score Rank</span>
      </div>
    </div>
    ${chunks.map((c, idx) => {
      const relPct = Math.round((c.score || c.relevance_score || 0) * 100);
      const lvlClass = getSeverityClass(c.level);
      const isErr = (c.level || '').toLowerCase().includes('err') || (c.level || '').toLowerCase().includes('crit');
      const prov = c.provider || c.metadata?.provider || 'Windows';
      const eid = c.event_id || c.metadata?.event_id || 0;
      const chan = c.channel || c.metadata?.channel || 'System';
      const time = c.timestamp || c.metadata?.timestamp || '-';
      const msg = c.message || c.text || c.content || '';
      const count = c.count || 1;
      const isAgg = count > 1;

      return `
        <div class="slc-card mb-2 p-3 shadow-sm ${isErr ? 'border-danger-subtle' : ''}">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1.5 pb-1 border-bottom" style="border-color: var(--border-color) !important;">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style="font-size: 0.72rem;">📁 ${escapeHtml(chan)}</span>
              <span class="badge ${lvlClass} text-uppercase" style="font-size: 0.68rem;">${escapeHtml(c.level || 'Info')}</span>
              <span class="fw-bold font-monospace" style="color: #0284c7; font-size: 0.8rem;">ID ${eid > 0 ? eid : '-'}</span>
              <span class="small fw-semibold" style="color: var(--text-color);">${escapeHtml(prov)}</span>
              ${isAgg ? `<span class="badge bg-warning text-dark font-monospace fw-bold" style="font-size: 0.72rem;" title="Повторений: ${count}"><i class="bi bi-stack me-1"></i>Повторений: ${count}x</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge bg-info-subtle text-info border border-info-subtle font-monospace" style="font-size: 0.72rem;">Релевантность: ${relPct}%</span>
              ${isAgg && c.first_seen && c.last_seen && c.first_seen !== c.last_seen ? `
                <span class="badge bg-secondary-subtle text-secondary font-monospace" style="font-size: 0.7rem;">
                  <i class="bi bi-clock-history me-1"></i>${escapeHtml(c.first_seen)} → ${escapeHtml(c.last_seen)}
                </span>
              ` : `
                <span class="font-monospace small text-muted">${escapeHtml(time)}</span>
              `}
              <button class="btn btn-xs btn-outline-info rounded-pill px-2 py-0.5 btn-rag-detail" data-idx="${idx}" style="font-size: 0.72rem;">
                <i class="bi bi-info-circle me-1"></i>Детали
              </button>
            </div>
          </div>
          <div class="small font-monospace text-break mt-1" style="color: var(--text-color); line-height: 1.45; max-height: 100px; overflow-y: auto;">
            ${escapeHtml(msg)}
          </div>
        </div>
      `;
    }).join('')}
  `;

  resultsEl.querySelectorAll('.btn-rag-detail').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const chunk = chunks[idx];
      if (chunk) {
        onShowEventDetails({
          timestamp: chunk.timestamp,
          level: chunk.level,
          event_id: chunk.event_id,
          provider: chunk.provider,
          channel: chunk.channel,
          computer: chunk.computer || '',
          process_id: chunk.process_id || 0,
          message: chunk.message || chunk.text,
        });
      }
    };
  });
}

/**
 * Выполнение RAG поиска по введенному запросу.
 */
export async function runRagSearch() {
  const inputEl = document.getElementById('slc-rag-input');
  const resultsEl = document.getElementById('slc-rag-results');
  const chanSelect = document.getElementById('slc-rag-channel-select');
  const aggSwitch = document.getElementById('slc-rag-aggregate-switch');
  if (!inputEl || !resultsEl) return;
  const query = inputEl.value.trim();
  if (!query) return;

  const hours = getSelectedRagPeriod();
  const periodLabel = getPeriodLabel(hours);
  const selectedChannel = chanSelect ? chanSelect.value : 'all';
  const aggregate = aggSwitch ? aggSwitch.checked : true;

  resultsEl.innerHTML = `
    <div class="text-center text-muted py-4">
      <div class="spinner-border spinner-border-sm text-info me-2"></div>
      ${escapeHtml(t('systemControl.ragSearching', 'Семантический поиск по кластерам...'))} (${escapeHtml(periodLabel)})
    </div>
  `;

  try {
    const payload = {
      query: query,
      hours: hours,
      channel: selectedChannel === 'all' ? null : selectedChannel,
      top_k: 30,
      min_score: 0.25,
      aggregate: aggregate,
    };

    const res = await fetch('/api/v1/system_logs/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      renderRagResults(data.chunks || [], query, periodLabel, false);
      return;
    }

    // Fallback на локальный поиск по IndexedDB
    const localChunks = await RagIndexDB.searchLocalChunks(query, selectedChannel);
    renderRagResults(localChunks, query, periodLabel, true);
  } catch (err) {
    const localChunks = await RagIndexDB.searchLocalChunks(query, selectedChannel);
    renderRagResults(localChunks, query, periodLabel, true);
  }
}

/**
 * Перестроение RAG-индекса.
 * @param {boolean} isAuto
 */
export async function rebuildRagIndex(isAuto = false) {
  if (isAutoBuildingRag) return;
  isAutoBuildingRag = true;

  const resultsEl = document.getElementById('slc-rag-results');
  const rebuildBtn = document.getElementById('btn-slc-rag-rebuild');
  const badgeEl = document.getElementById('slc-rag-status-badge');
  const hours = getSelectedRagPeriod();
  const periodLabel = getPeriodLabel(hours);

  if (rebuildBtn) rebuildBtn.disabled = true;
  if (badgeEl) {
    badgeEl.innerHTML = '<span class="spinner-border spinner-border-sm text-warning me-1"></span>Сбор данных...';
    badgeEl.className = 'text-warning fw-bold';
  }

  if (resultsEl) {
    resultsEl.innerHTML = `
      <div class="text-center text-info py-4">
        <div class="spinner-border spinner-border-sm text-info me-2"></div>
        <strong>${isAuto ? 'Автоматический сбор данных и создание RAG-индекса...' : 'Сбор событий со всех системных каналов и построение RAM-индекса...'} (${escapeHtml(periodLabel)})</strong>
        <div class="small text-muted mt-1">Опрос WevtAPI, сбор журналов активности, сессий электропитания и сохранение в IndexedDB.</div>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/v1/system_logs/rag/build?all_channels=true&hours=${hours}&limit=200`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let chunks = [];
    try {
      const chunksRes = await fetch('/api/v1/system_logs/rag/chunks?limit=3000');
      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        chunks = chunksData.chunks || [];
      }
    } catch (_) {}

    await RagIndexDB.saveIndex(data, chunks);
    BrowserRagCache.set(`status_${hours}`, data);
    applyRagStatusToUi(data);
    RagIndexDB.updateDbIndicator(true, data.indexed_events || chunks.length);

    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="alert alert-success d-flex align-items-start gap-2 shadow-sm" style="background: var(--surface-2); border: 1px solid var(--border-color); color: var(--text-color);">
          <i class="bi bi-check-circle-fill fs-4 text-success flex-shrink-0 mt-0.5"></i>
          <div>
            <div class="fw-bold fs-6 text-success">RAG-индекс успешно создан и сохранен в базе данных браузера (${escapeHtml(periodLabel)})!</div>
            <div class="small mt-1" style="color: var(--text-color);">
              Просканировано каналов: <strong class="text-info">${data.scanned_channels || 0}</strong>.
              Всего событий: <strong class="text-warning font-monospace">${(data.indexed_events || chunks.length || 0).toLocaleString()}</strong>.
              Синхронизировано чанков: <strong class="text-success font-monospace">${chunks.length}</strong>.
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (resultsEl) {
      resultsEl.innerHTML = `<div class="alert alert-danger">Ошибка обновления RAG: ${escapeHtml(err.message)}</div>`;
    }
  } finally {
    isAutoBuildingRag = false;
    if (rebuildBtn) rebuildBtn.disabled = false;
  }
}

/**
 * Инициализация обработчиков элементов RAG панели.
 */
export function initRagPanel() {
  const searchBtn = document.getElementById('btn-slc-rag-search');
  if (searchBtn && !searchBtn._bound) {
    searchBtn._bound = true;
    searchBtn.onclick = runRagSearch;
  }

  const ragInput = document.getElementById('slc-rag-input');
  if (ragInput && !ragInput._bound) {
    ragInput._bound = true;
    ragInput.onkeydown = (e) => {
      if (e.key === 'Enter') runRagSearch();
    };
  }

  const rebuildBtn = document.getElementById('btn-slc-rag-rebuild');
  if (rebuildBtn && !rebuildBtn._bound) {
    rebuildBtn._bound = true;
    rebuildBtn.onclick = () => rebuildRagIndex(false);
  }

  const periodSelect = document.getElementById('slc-rag-period-select');
  if (periodSelect && !periodSelect._bound) {
    periodSelect._bound = true;
    periodSelect.onchange = () => {
      const h = parseInt(periodSelect.value, 10);
      updateRagPeriodDisplay(h);
      fetchRagStatus(false);
    };
  }
}
