/**
 * =============================================================================
 * Process Name: Windows System Logs & Activity - Main Script
 * =============================================================================
 * Description:
 *   Клиентский веб-скрипт модуля журналов событий и активности системы Windows.
 *   Полная поддержка интернационализации (i18n), светлой и тёмной темы.
 *
 * Usage Examples:
 *   HTML Integration:
 *     <script src="/html/system_control_tab/main.js?v=20261006_v14" type="module"></script>
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/system_control_tab
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-12 07:12:00
 * =============================================================================
 */

(function () {
  'use strict';

  let isSCCInitialized = false;

  // Состояния центра журналов событий
  let currentChannel = 'System';
  let currentFilePath = '';
  let currentMode = 'live';
  let cachedEvents = [];
  let cachedChannels = [];
  let selectedEvent = null;
  let liveIntervalTimer = null;
  let isLogRequestInProgress = false;
  let globalTooltipEl = null;

  // =========================================================================
  // БРАУЗЕРНЫЙ КЕШ И ХРАНИЛИЩЕ RAG/AUDIT (LOCALSTORAGE / INDEXEDDB)
  // =========================================================================
  const BrowserRagCache = {
    prefix: 'ai_windows_admin_rag_',

    get(key) {
      try {
        const item = localStorage.getItem(this.prefix + key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (parsed.expires && Date.now() > parsed.expires) {
          localStorage.removeItem(this.prefix + key);
          return null;
        }
        return parsed.data;
      } catch (e) {
        console.debug('[BrowserRagCache] Ошибка чтения кеша:', e);
        return null;
      }
    },

    set(key, data, ttlMs = 24 * 3600 * 1000) {
      try {
        const payload = {
          data: data,
          timestamp: Date.now(),
          expires: ttlMs ? Date.now() + ttlMs : null,
        };
        localStorage.setItem(this.prefix + key, JSON.stringify(payload));
        this.updateCacheIndicator(true);
      } catch (e) {
        console.debug('[BrowserRagCache] Ошибка записи в кеш:', e);
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(this.prefix + key);
      } catch (e) {}
    },

    clearAll() {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(this.prefix))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    },

    updateCacheIndicator(active = true) {
      const ind = document.getElementById('slc-rag-cache-indicator');
      if (ind) {
        ind.className = active ? 'badge bg-success-subtle text-success border border-success-subtle font-monospace' : 'badge bg-secondary-subtle text-secondary font-monospace';
        ind.innerHTML = `<i class="bi bi-hdd-fill me-1"></i>${active ? t('systemControl.ragCacheSynced', 'Кеш браузера: Синхронизирован') : t('systemControl.ragCacheActive', 'Кеш браузера: Активен')}`;
      }
    }
  };

  function getSelectedRagPeriod() {
    const periodSelect = document.getElementById('slc-rag-period-select');
    return periodSelect ? parseInt(periodSelect.value, 10) : 24;
  }

  function getPeriodLabel(hours) {
    const h = parseInt(hours, 10);
    if (h === 24) return t('systemControl.periodBadge24', 'Сутки (24 часа)');
    if (h === 168) return t('systemControl.periodBadge168', 'Неделя (7 дней)');
    if (h === 720) return t('systemControl.periodBadge720', 'Месяц (30 дней)');
    if (h === 0) return t('systemControl.periodBadgeAll', 'Все время');
    return `${hours} ч`;
  }

  function updateRagPeriodDisplay(hours) {
    const h = parseInt(hours, 10);
    const badgeEl = document.getElementById('slc-rag-period-badge');
    if (badgeEl) {
      badgeEl.textContent = getPeriodLabel(h);
    }
    const periodSelect = document.getElementById('slc-rag-period-select');
    if (periodSelect && String(periodSelect.value) !== String(h)) {
      const opt = periodSelect.querySelector(`option[value="${h}"]`);
      if (opt) periodSelect.value = String(h);
    }
    const hoursSelect = document.getElementById('slc-hours-select');
    if (hoursSelect && String(hoursSelect.value) !== String(h)) {
      const opt = hoursSelect.querySelector(`option[value="${h}"]`);
      if (opt) hoursSelect.value = String(h);
    }
    BrowserRagCache.set('selected_period', h);
  }

  /**
   * Локализация строки через i18next с fallback.
   *
   * @param {string} key - Ключ локализации.
   * @param {string} fallback - Значение по умолчанию.
   * @returns {string} Локализованная строка.
   */
  function t(key, fallback) {
    if (window.i18next && typeof window.i18next.t === 'function' && window.i18next.isInitialized) {
      const res = window.i18next.t(key);
      if (res && res !== key) return res;
    }
    return fallback !== undefined ? fallback : key;
  }

  /**
   * Экранирование HTML-символов для защиты от XSS.
   *
   * @param {string} str - Исходная строка.
   * @returns {string} Экранированная строка.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Форматирование ISO-времени.
   *
   * @param {string} isoStr - Строка ISO Timestamp.
   * @returns {string} Отформатированное время.
   */
  function formatTime(isoStr) {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleTimeString();
    } catch {
      return isoStr.slice(11, 19);
    }
  }

  /**
   * Определение CSS-класса для уровня важности события.
   *
   * @param {string} level - Уровень важности.
   * @returns {string} Имя CSS-класса.
   */
  function getSeverityClass(level) {
    const lvl = (level || '').toLowerCase();
    if (lvl.includes('crit')) return 'badge-crit';
    if (lvl.includes('err')) return 'badge-err';
    if (lvl.includes('warn')) return 'badge-warn';
    if (lvl.includes('verb')) return 'badge-verb';
    return 'badge-inf';
  }

  /**
   * Проверка прав администратора и обновление бейджа.
   */
  async function fetchStatus() {
    try {
      const res = await fetch('/api/system-control/status');
      if (!res.ok) return;
      const data = await res.json();

      const elevBadge = document.getElementById('scc-elevation-badge');
      if (elevBadge) {
        if (data.is_elevated) {
          elevBadge.className = 'badge rounded-pill bg-success-subtle text-success border border-success px-3 py-2';
          elevBadge.innerHTML = t('systemControl.elevAdmin', '🛡️ Режим: Администратор (Полный доступ)');
        } else {
          elevBadge.className = 'badge rounded-pill bg-warning-subtle text-warning border border-warning px-3 py-2';
          elevBadge.innerHTML = t('systemControl.elevUser', '👁️ Режим: Обычный пользователь (Ограничено)');
        }
      }
    } catch (e) {
      console.warn('[SystemLogs] Ошибка проверки прав:', e);
    }
  }

  // =========================================================================
  // ЖУРНАЛ АКТИВНОСТИ И ОПЕРАЦИЙ
  // =========================================================================

  async function loadSccActivityLogs() {
    const tbody = document.getElementById('scc-logs-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/system-control/logs');
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-3">${t('systemControl.emptyActivity', 'Журнал операций пуст.')}</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(l.timestamp)}</td>
          <td><span class="badge bg-secondary font-monospace">${escapeHtml(l.action)}</span></td>
          <td style="color: var(--text-color);">${escapeHtml(l.target)}</td>
          <td><span class="badge ${l.status === 'SUCCESS' || l.status === 'OK' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(l.status)}</span></td>
          <td class="small text-truncate" style="max-width: 280px; color: var(--text-muted);" title="${escapeHtml(l.details)}">${escapeHtml(l.details)}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('[SystemLogs] Ошибка загрузки логов активности:', e);
    }
  }

  // =========================================================================
  // WINDOWS OS SYSTEM LOG CENTER (ПОТОК, КАНАЛЫ, АУДИТ, RAG, ИНЦИДЕНТЫ)
  // =========================================================================

  function createGlobalChannelTooltip() {
    if (globalTooltipEl) return;
    globalTooltipEl = document.createElement('div');
    globalTooltipEl.className = 'slc-tooltip-popup';
    globalTooltipEl.id = 'slc-global-tooltip';
    document.body.appendChild(globalTooltipEl);
  }

  function showChannelTooltip(channelData, mouseEvent) {
    if (!globalTooltipEl) createGlobalChannelTooltip();
    const isFile = !!(channelData.file_path || channelData.location || (channelData.source_type && channelData.source_type !== 'channel'));
    const icon = isFile ? '📄' : '📁';
    const rawTitle = channelData.display_name || channelData.channel_name || channelData.name || 'Channel';
    const chanTitle = rawTitle.replace(/^evt:/, '');
    const typeLabel = (channelData.source_type === 'channel' || !isFile) ? t('systemControl.tooltipTypeLive', 'Live Windows Channel') : t('systemControl.tooltipTypeArchive', 'EVTX File Archive');
    const countVal = channelData.record_count !== undefined ? channelData.record_count : (channelData.records || 'N/A');
    const recCount = typeof countVal === 'number' ? countVal.toLocaleString() : String(countVal);
    const sizeStr = channelData.file_size_mb ? `${channelData.file_size_mb} MB` : (channelData.size_bytes ? `${(channelData.size_bytes / 1024 / 1024).toFixed(1)} MB` : 'N/A');

    globalTooltipEl.innerHTML = `
      <div class="fw-bold mb-1 d-flex align-items-center gap-1.5" style="color: var(--text-color);">
        <span>${icon}</span>
        <span class="text-truncate">${escapeHtml(chanTitle)}</span>
      </div>
      <div class="mb-2" style="font-size: 0.76rem; color: var(--text-muted) !important;">
        ${escapeHtml(channelData.description || t('systemControl.tooltipDefaultDesc', 'Стандартный системный канал событий Windows.'))}
      </div>
      <div class="d-flex justify-content-between align-items-center pt-1 border-top" style="border-color: var(--border-color) !important; font-size: 0.74rem;">
        <span class="text-muted">${t('systemControl.tooltipType', 'Тип:')} <strong style="color: var(--text-color);">${typeLabel}</strong></span>
        <span class="text-muted">${t('systemControl.tooltipRecords', 'Записей:')} <strong class="text-info">${recCount}</strong></span>
      </div>
      <div class="d-flex justify-content-between align-items-center pt-1" style="font-size: 0.74rem;">
        <span class="text-muted">${t('systemControl.tooltipSize', 'Размер:')} <strong style="color: var(--text-color);">${sizeStr}</strong></span>
        <span class="text-success fw-bold">${t('systemControl.tooltipAvailable', 'Доступен')}</span>
      </div>
    `;

    const pad = 15;
    let left = mouseEvent.clientX + pad;
    let top = mouseEvent.clientY + pad;
    if (left + 330 > window.innerWidth) left = mouseEvent.clientX - 335;
    if (top + 140 > window.innerHeight) top = mouseEvent.clientY - 145;

    globalTooltipEl.style.left = `${Math.max(10, left)}px`;
    globalTooltipEl.style.top = `${Math.max(10, top)}px`;
    globalTooltipEl.classList.add('show');
  }

  function hideChannelTooltip() {
    if (globalTooltipEl) {
      globalTooltipEl.classList.remove('show');
    }
  }

  async function scanChannels(force = false) {
    const treeEl = document.getElementById('slc-channel-tree-container');
    const countBadge = document.getElementById('slc-channel-count-badge');
    const sourcesStat = document.getElementById('slc-stat-sources');

    if (treeEl && (!cachedChannels || cachedChannels.length === 0)) {
      treeEl.innerHTML = `<div class="text-muted p-2 small"><div class="spinner-border spinner-border-sm text-info me-1"></div>${t('systemControl.searchingChannels', 'Поиск каналов...')}</div>`;
    }

    try {
      const response = await fetch(`/api/v1/system_logs/scan?force=${force}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rawChannels = data.channels || [];
      // Оставляем только непустые каналы и файлы журналов
      cachedChannels = rawChannels.filter(c => {
        const records = Number(c.record_count) || 0;
        const sizeBytes = Number(c.size_bytes) || 0;
        const sizeMb = Number(c.file_size_mb) || 0;
        return records > 0 || sizeBytes > 0 || sizeMb > 0;
      });

      if (countBadge) countBadge.textContent = cachedChannels.length;
      if (sourcesStat) sourcesStat.textContent = cachedChannels.length.toLocaleString();

      renderChannelTree(cachedChannels);
    } catch (err) {
      if (treeEl) treeEl.innerHTML = `<div class="text-danger p-2 small">${t('systemControl.errorScanning', 'Ошибка сканирования каналов:')} ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderChannelTree(channels) {
    const treeEl = document.getElementById('slc-channel-tree-container');
    const countBadge = document.getElementById('slc-channel-count-badge');
    if (!treeEl) return;

    if (countBadge && channels) {
      countBadge.textContent = channels.length;
    }

    if (!channels || channels.length === 0) {
      treeEl.innerHTML = `<div class="text-muted p-2 small">${t('systemControl.noChannels', 'Каналы не найдены.')}</div>`;
      return;
    }

    createGlobalChannelTooltip();

    treeEl.innerHTML = channels.map(ch => {
      const isFile = !!(ch.file_path || (ch.source_type && ch.source_type !== 'channel'));
      const sysName = (ch.channel_name || ch.name || ch.source_id || 'System').replace(/^evt:/, '');
      const dispName = (ch.display_name || ch.channel_name || ch.name || 'Channel').replace(/^evt:/, '');
      const chPath = ch.location || ch.file_path || '';
      const isActive = isFile ? (currentFilePath === chPath) : (currentChannel === sysName && !currentFilePath);
      const icon = isFile ? 'bi-file-earmark-text text-secondary' : 'bi-folder-fill text-warning';
      
      let sizeBadge = '';
      if (ch.record_count !== undefined && ch.record_count > 0) {
        const countText = ch.record_count >= 1000 ? `${(ch.record_count / 1000).toFixed(1)}k` : String(ch.record_count);
        sizeBadge = `<span class="badge bg-secondary font-monospace" style="font-size: 0.68rem;">${countText}</span>`;
      } else if (ch.file_size_mb) {
        sizeBadge = `<span class="badge bg-secondary font-monospace" style="font-size: 0.68rem;">${ch.file_size_mb} MB</span>`;
      }

      return `
        <div class="slc-tree-item ${isActive ? 'active' : ''}" data-channel="${escapeHtml(sysName)}" data-display-name="${escapeHtml(dispName)}" data-path="${escapeHtml(chPath)}">
          <div class="d-flex align-items-center gap-2 text-truncate me-2" style="min-width: 0; flex: 1 1 auto;">
            <i class="bi ${icon} flex-shrink-0"></i>
            <span class="text-truncate fw-medium" title="${escapeHtml(dispName)}">${escapeHtml(dispName)}</span>
          </div>
          <div class="d-flex align-items-center flex-shrink-0">
            ${sizeBadge}
          </div>
        </div>
      `;
    }).join('');

    treeEl.querySelectorAll('.slc-tree-item').forEach((el, index) => {
      const chData = channels[index];
      el.addEventListener('mouseenter', (e) => {
        if (chData) showChannelTooltip(chData, e);
      });
      el.addEventListener('mousemove', (e) => {
        if (chData) showChannelTooltip(chData, e);
      });
      el.addEventListener('mouseleave', () => {
        hideChannelTooltip();
      });

      el.addEventListener('click', () => {
        hideChannelTooltip();
        treeEl.querySelectorAll('.slc-tree-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');

        currentChannel = (el.getAttribute('data-channel') || el.getAttribute('data-name') || 'System').replace(/^evt:/, '').split(' (')[0].trim();
        currentFilePath = el.getAttribute('data-path') || '';
        const dispName = el.getAttribute('data-display-name') || currentChannel;

        const statChan = document.getElementById('slc-stat-channel');
        if (statChan) statChan.textContent = dispName;

        const mainTitle = document.getElementById('slc-main-view-title');
        if (mainTitle) mainTitle.innerHTML = `<i class="bi bi-list-columns-reverse me-2 text-primary"></i>${t('systemControl.channelEventsTitle', 'События канала:')} <span class="text-info">${escapeHtml(dispName)}</span>`;

        if (currentMode === 'event-logs') {
          const elSelect = document.getElementById('el-channel-select');
          if (elSelect) {
            let found = false;
            for (let opt of elSelect.options) {
              if (opt.value.toLowerCase() === currentChannel.toLowerCase()) {
                elSelect.value = opt.value;
                found = true;
                break;
              }
            }
            if (!found && !currentFilePath) {
              const opt = document.createElement('option');
              opt.value = currentChannel;
              opt.textContent = `Журнал ${dispName}`;
              elSelect.appendChild(opt);
              elSelect.value = currentChannel;
            }
          }
          fetchEventLogsSummary();
        } else {
          loadEvents();
        }
      });
    });
  }

  async function loadEvents() {
    if (isLogRequestInProgress) return;
    isLogRequestInProgress = true;

    const tbody = document.getElementById('slc-table-body');
    const statEvents = document.getElementById('slc-stat-events');
    const statIncidents = document.getElementById('slc-stat-incidents');
    const streamBadge = document.getElementById('slc-stream-count-badge');

    const searchInput = document.getElementById('slc-search-input');
    const levelSelect = document.getElementById('slc-level-select');
    const hoursSelect = document.getElementById('slc-hours-select');
    const limitSelect = document.getElementById('slc-limit-select');
    const eventIdInput = document.getElementById('slc-eventid-input');

    const query = searchInput ? searchInput.value.trim() : '';
    const level = levelSelect ? levelSelect.value : '';
    const hours = hoursSelect ? hoursSelect.value : '24';
    const limit = limitSelect ? limitSelect.value : '100';
    const eventId = eventIdInput ? eventIdInput.value.trim() : '';

    const cleanChan = currentChannel.replace(/^evt:/, '').split(' (')[0].trim();
    const params = new URLSearchParams({
      channel: cleanChan,
      limit: limit,
      hours: hours,
    });

    if (query) {
      params.append('search', query);
      params.append('query', query);
    }
    if (level) params.append('level', level);
    if (eventId) params.append('event_id', eventId);
    if (currentFilePath) params.append('file_path', currentFilePath);

    let url = `/api/v1/system_logs/events?${params.toString()}`;
    if (currentMode === 'errors') {
      params.set('level', 'Error');
      url = `/api/v1/system_logs/events?${params.toString()}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cachedEvents = data.events || data.entries || [];

      if (statEvents) statEvents.textContent = cachedEvents.length.toLocaleString();
      if (streamBadge) streamBadge.textContent = `${cachedEvents.length} ${t('systemControl.records', 'записей')}`;

      const faults = cachedEvents.filter(e => {
        const l = (e.level || '').toLowerCase();
        return l.includes('err') || l.includes('crit');
      }).length;
      if (statIncidents) statIncidents.textContent = faults;

      renderEventsTable(cachedEvents);
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${t('systemControl.errorLoadingEvents', 'Ошибка загрузки событий:')} ${escapeHtml(err.message)}</td></tr>`;
    } finally {
      isLogRequestInProgress = false;
    }
  }

  function renderEventsTable(events) {
    const tbody = document.getElementById('slc-table-body');
    if (!tbody) return;

    if (!events || events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">${t('systemControl.noEvents', 'Нет записей, удовлетворяющих заданным фильтрам.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = events.map((e, idx) => {
      const timeFormatted = formatTime(e.timestamp);
      const isErr = (e.level || '').toLowerCase().includes('err') || (e.level || '').toLowerCase().includes('crit');
      const provName = e.provider || e.source || '-';
      const msgText = e.message || e.raw_data || '-';

      return `
        <tr data-index="${idx}" class="${isErr ? 'table-danger-subtle' : ''}">
          <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(timeFormatted)}</td>
          <td><span class="badge ${getSeverityClass(e.level)} text-uppercase" style="font-size: 0.68rem;">${escapeHtml(e.level || 'Info')}</span></td>
          <td class="font-monospace small fw-bold" style="color: #0284c7;">${e.event_id > 0 ? e.event_id : '-'}</td>
          <td class="text-truncate small" style="max-width: 160px; color: var(--text-color);" title="${escapeHtml(provName)}">${escapeHtml(provName)}</td>
          <td class="font-monospace small" style="color: var(--text-muted);">${e.process_id || '-'}</td>
          <td class="text-truncate" style="max-width: 420px; color: var(--text-color);" title="${escapeHtml(msgText)}">${escapeHtml(msgText)}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.onclick = () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('table-active'));
        row.classList.add('table-active');
        const idx = parseInt(row.getAttribute('data-index'), 10);
        selectedEvent = events[idx];

        if (currentMode === 'raw') {
          const rawEl = document.getElementById('slc-raw-text');
          if (rawEl && selectedEvent) rawEl.textContent = JSON.stringify(selectedEvent, null, 2);
        } else {
          showEventDetails(selectedEvent);
        }
      };
    });
  }

  function renderAuditDigest(data, fromCache = false) {
    const contentEl = document.getElementById('slc-audit-content');
    if (!contentEl) return;

    const totalEvents = data.total_events || data.total_analyzed || 0;
    const critSum = data.severity_summary?.Critical || data.critical_count || 0;
    const errSum = data.severity_summary?.Error || data.error_count || 0;
    const warnSum = data.severity_summary?.Warning || data.warning_count || 0;

    let anomaliesHtml = `<div class="text-muted small">${escapeHtml(t('systemControl.noAnomalies', 'Аномалий и резких всплесков частоты ошибок не обнаружено.'))}</div>`;
    if (data.anomalies && data.anomalies.length > 0) {
      anomaliesHtml = data.anomalies.map(a => `
        <div class="alert alert-warning py-1 px-2 mb-1.5 small d-flex justify-content-between align-items-center">
          <div><strong class="text-danger">[${escapeHtml(t('systemControl.anomaliesTitle', 'Аномалия'))}]</strong> ${escapeHtml(a.description || a.sample || a.message)}</div>
          <span class="badge bg-danger font-monospace">${a.count || ''} ${escapeHtml(t('systemControl.eventsCountBadge', 'событий').replace('{{count}}', '').trim())}</span>
        </div>
      `).join('');
    }

    const clustersList = data.clusters || data.top_clusters || [];
    let clustersHtml = '';
    if (clustersList && clustersList.length > 0) {
      clustersHtml = clustersList.slice(0, 15).map((c, i) => `
        <tr class="slc-cluster-row" data-idx="${i}" style="cursor: pointer;" title="Нажмите для AI-диагностики кластера">
          <td class="font-monospace" style="color: var(--text-muted);">${i + 1}</td>
          <td><span class="badge ${getSeverityClass(c.level)}">${escapeHtml(c.level || 'Info')}</span></td>
          <td class="text-truncate" style="max-width: 140px; color: var(--text-color);" title="${escapeHtml(c.provider)}">${escapeHtml(c.provider)}</td>
          <td class="font-monospace fw-bold" style="color: #0284c7;">${c.event_id || '-'}</td>
          <td class="small text-truncate" style="max-width: 340px; color: var(--text-color);" title="${escapeHtml(c.pattern || c.template)}">${escapeHtml(c.pattern || c.template)}</td>
          <td class="font-monospace text-center fw-bold" style="color: var(--text-color);">${c.count}</td>
          <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(formatTime(c.first_seen || data.generated_at))}</td>
        </tr>
      `).join('');
    } else {
      clustersHtml = `<tr><td colspan="7" class="text-center text-muted py-3">${escapeHtml(t('systemControl.noClusters', 'Кластеры не сформированы.'))}</td></tr>`;
    }

    contentEl.innerHTML = `
      ${fromCache ? `<div class="d-flex justify-content-between align-items-center mb-2 px-1"><span class="badge bg-info-subtle text-info border border-info-subtle font-monospace"><i class="bi bi-hdd me-1"></i>Загружено из кеша браузера</span><span class="small text-muted">${escapeHtml(data.generated_at || '')}</span></div>` : ''}
      <div class="row g-2 mb-3">
        <div class="col-sm-3 col-6">
          <div class="p-2 rounded border" style="background: var(--surface-1); border-color: var(--border-color) !important;">
            <div class="small text-muted" style="font-size: 0.72rem;">${escapeHtml(t('systemControl.totalAnalyzed', 'Всего проанализировано'))}</div>
            <div class="fs-5 fw-bold text-info font-monospace">${totalEvents.toLocaleString()}</div>
          </div>
        </div>
        <div class="col-sm-3 col-6">
          <div class="p-2 rounded border" style="background: var(--surface-1); border-color: var(--border-color) !important;">
            <div class="small text-muted" style="font-size: 0.72rem;">${escapeHtml(t('systemControl.critFaults', 'Критических сбоев'))}</div>
            <div class="fs-5 fw-bold text-danger font-monospace">${critSum}</div>
          </div>
        </div>
        <div class="col-sm-3 col-6">
          <div class="p-2 rounded border" style="background: var(--surface-1); border-color: var(--border-color) !important;">
            <div class="small text-muted" style="font-size: 0.72rem;">${escapeHtml(t('systemControl.errorsCount', 'Ошибок'))}</div>
            <div class="fs-5 fw-bold text-danger font-monospace">${errSum}</div>
          </div>
        </div>
        <div class="col-sm-3 col-6">
          <div class="p-2 rounded border" style="background: var(--surface-1); border-color: var(--border-color) !important;">
            <div class="small text-muted" style="font-size: 0.72rem;">${escapeHtml(t('systemControl.warningsCount', 'Предупреждений'))}</div>
            <div class="fs-5 fw-bold text-warning font-monospace">${warnSum}</div>
          </div>
        </div>
      </div>

      <div class="slc-card mb-2 shadow-sm">
        <div class="slc-card-header text-warning fw-bold py-1.5 px-3 small">
          <i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(t('systemControl.anomaliesTitle', 'Обнаруженные аномалии и всплески'))}
        </div>
        <div class="p-2">
          ${anomaliesHtml}
        </div>
      </div>

      <div class="slc-card shadow-sm">
        <div class="slc-card-header fw-bold d-flex justify-content-between align-items-center py-1.5 px-3">
          <span><i class="bi bi-collection me-2 text-primary"></i>${escapeHtml(t('systemControl.patternsTitle', 'Топ шаблонов событий (Дедупликация)'))}</span>
          <span class="small text-muted">${escapeHtml(t('systemControl.top15', 'Топ 15 кластеров'))}</span>
        </div>
        <div class="table-responsive">
          <table class="slc-table mb-0">
            <thead>
              <tr>
                <th style="width: 40px;">${escapeHtml(t('systemControl.colNum', '#'))}</th>
                <th style="width: 80px;">${escapeHtml(t('systemControl.colLevel', 'Уровень'))}</th>
                <th style="width: 140px;">${escapeHtml(t('systemControl.colProvider', 'Поставщик'))}</th>
                <th style="width: 60px;">${escapeHtml(t('systemControl.colId', 'ID'))}</th>
                <th>${escapeHtml(t('systemControl.colPattern', 'Шаблон сообщения (Masked)'))}</th>
                <th style="width: 70px;" class="text-center">${escapeHtml(t('systemControl.colCount', 'Кол-во'))}</th>
                <th style="width: 140px;">${escapeHtml(t('systemControl.colFirstSeen', 'Впервые'))}</th>
              </tr>
            </thead>
            <tbody>
              ${clustersHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Интерактивный клик по строке кластера дедупликации
    contentEl.querySelectorAll('.slc-cluster-row').forEach(row => {
      row.onclick = () => {
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        const c = clustersList[idx];
        if (!c) return;

        const modal = window.AIModalDialog || window.AITableModal;
        if (modal) {
          modal.show({
            icon: '📊',
            title: `Кластер #${c.event_id || 'GRP'} (${c.provider || 'Windows'})`,
            subtitle: `Повторений: ${c.count} | Уровень: ${c.level || 'Info'}`,
            panelId: 'panel-system-control-2',
            tableType: 'security_event',
            badges: [
              { text: `${c.count} повторений`, class: 'badge bg-warning text-dark font-monospace' },
              { text: c.level || 'Info', class: `badge ${getSeverityClass(c.level)}` }
            ],
            metadata: [
              { label: 'Event ID', value: String(c.event_id || '-') },
              { label: 'Поставщик', value: c.provider || '-' },
              { label: 'Уровень', value: c.level || 'Info' },
              { label: 'Всего повторений', value: String(c.count) },
              { label: 'Первое появление', value: c.first_seen || '-' }
            ],
            rawTitle: 'Шаблон сообщения (Masked Pattern)',
            rawContent: c.pattern || c.template || '',
            requestData: {
              event_id: c.event_id,
              provider: c.provider,
              count: c.count,
              pattern: c.pattern || c.template
            }
          });
        }
      };
    });
  }

  async function loadAuditDigest() {
    const contentEl = document.getElementById('slc-audit-content');
    if (!contentEl) return;

    const hoursSelect = document.getElementById('slc-hours-select');
    const hours = hoursSelect ? hoursSelect.value : '24';
    const cleanChan = currentChannel.replace(/^evt:/i, '');
    const cacheKey = `audit_${cleanChan}_${hours}_${currentFilePath}`;

    const cached = BrowserRagCache.get(cacheKey);
    if (cached) {
      renderAuditDigest(cached, true);
    } else {
      contentEl.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.auditSummaryGenerating', 'Формирование сводки аудита и дедупликации...'))}</div>`;
    }

    try {
      const res = await fetch(`/api/v1/system_logs/audit?channel=${encodeURIComponent(cleanChan)}&hours=${hours}&limit=300&file_path=${encodeURIComponent(currentFilePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      BrowserRagCache.set(cacheKey, data);
      renderAuditDigest(data, false);
    } catch (err) {
      if (!cached) {
        contentEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(t('systemControl.errorAudit', 'Ошибка проведения аудита:'))} ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  async function fetchRagStatus() {
    const hours = getSelectedRagPeriod();
    const cachedStatus = BrowserRagCache.get(`status_${hours}`);

    if (cachedStatus) {
      applyRagStatusToUi(cachedStatus);
      BrowserRagCache.updateCacheIndicator(true);
    }

    try {
      const res = await fetch('/api/v1/system_logs/rag/status');
      if (!res.ok) return;
      const data = await res.json();

      BrowserRagCache.set(`status_${hours}`, data);
      applyRagStatusToUi(data);
      BrowserRagCache.updateCacheIndicator(true);
    } catch (e) {
      console.debug('[SystemLogs] Ошибка получения статуса RAG:', e);
    }
  }

  function applyRagStatusToUi(data) {
    const badgeEl = document.getElementById('slc-rag-status-badge');
    const countEl = document.getElementById('slc-rag-indexed-count');
    const chansEl = document.getElementById('slc-rag-channels-count');
    const lastBuiltEl = document.getElementById('slc-rag-last-built');
    const hours = getSelectedRagPeriod();

    if (countEl) countEl.textContent = (data.total_events || data.indexed_events || 0).toLocaleString();
    if (chansEl) chansEl.textContent = (data.channels_count || data.scanned_channels || 0).toLocaleString();
    if (lastBuiltEl) {
      lastBuiltEl.textContent = data.last_built_at || data.generated_at ? `Обновлено: ${data.last_built_at || data.generated_at}` : 'Индекс еще не создан';
    }
    updateRagPeriodDisplay(data.hours !== undefined ? data.hours : hours);

    if (badgeEl) {
      const totalEv = data.total_events || data.indexed_events || 0;
      if ((data.is_indexed || totalEv > 0) && totalEv > 0) {
        badgeEl.textContent = 'Готов к поиску (RAM)';
        badgeEl.className = 'text-success fw-bold';
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

  async function runRagSearch() {
    const inputEl = document.getElementById('slc-rag-input');
    const resultsEl = document.getElementById('slc-rag-results');
    const chanSelect = document.getElementById('slc-rag-channel-select');
    const aggSwitch = document.getElementById('slc-rag-aggregate-switch');
    if (!inputEl || !resultsEl) return;
    const query = inputEl.value.trim();
    if (!query) return;

    const selectedChan = chanSelect ? chanSelect.value : 'all';
    const channelParam = selectedChan === 'all' ? '' : selectedChan;
    const aggregate = aggSwitch ? aggSwitch.checked : true;
    const hours = getSelectedRagPeriod();
    const periodLabel = getPeriodLabel(hours);
    const cacheKey = `query_${hours}_${selectedChan}_${query}_agg_${aggregate}`;

    const cachedResults = BrowserRagCache.get(cacheKey);
    if (cachedResults) {
      renderRagResults(cachedResults, query, periodLabel, true);
    } else {
      resultsEl.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.ragSearching', 'Семантический поиск по RAM RAG-индексу...'))} (${escapeHtml(periodLabel)})</div>`;
    }

    try {
      const res = await fetch('/api/v1/system_logs/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, channel: channelParam, top_k: 20, aggregate: aggregate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const chunks = data.results || [];

      BrowserRagCache.set(cacheKey, chunks);
      renderRagResults(chunks, query, periodLabel, false);
    } catch (err) {
      if (!cachedResults) {
        resultsEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(t('systemControl.errorRagSearch', 'Ошибка поиска RAG:'))} ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function renderRagResults(chunks, query, periodLabel, fromCache = false) {
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
          <div class="slc-card mb-2 p-3 shadow-sm ${isErr ? 'border-danger-subtle' : ''}" style="transition: transform 0.15s ease;">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1.5 pb-1 border-bottom" style="border-color: var(--border-color) !important;">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style="font-size: 0.72rem;">📁 ${escapeHtml(chan)}</span>
                <span class="badge ${lvlClass} text-uppercase" style="font-size: 0.68rem;">${escapeHtml(c.level || 'Info')}</span>
                <span class="fw-bold font-monospace" style="color: #0284c7; font-size: 0.8rem;">ID ${eid > 0 ? eid : '-'}</span>
                <span class="small fw-semibold" style="color: var(--text-color);">${escapeHtml(prov)}</span>
                ${isAgg ? `<span class="badge bg-warning text-dark font-monospace fw-bold" style="font-size: 0.72rem;" title="Событие повторялось несколько раз"><i class="bi bi-stack me-1"></i>${escapeHtml(t('systemControl.ragRepetitions', 'Повторений: {{count}}x').replace('{{count}}', count))}</span>` : ''}
              </div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge bg-info-subtle text-info border border-info-subtle font-monospace" style="font-size: 0.72rem;">Релевантность: ${relPct}%</span>
                ${isAgg && c.first_seen && c.last_seen && c.first_seen !== c.last_seen ? `
                  <span class="badge bg-secondary-subtle text-secondary font-monospace" style="font-size: 0.7rem;" title="Период первого и последнего события">
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
            ${isAgg && c.occurrences && c.occurrences.length > 1 ? `
              <div class="mt-2 pt-1 border-top" style="border-color: var(--border-color) !important;">
                <button class="btn btn-xs btn-outline-secondary rounded-pill py-0.5 px-2.5 btn-toggle-occurrences" data-target="occ-${idx}" style="font-size: 0.72rem;">
                  <i class="bi bi-list-nested me-1"></i><span class="btn-occ-text">${escapeHtml(t('systemControl.ragShowOccurrences', 'Показать все {{count}} повторения по времени').replace('{{count}}', count))}</span>
                </button>
                <div class="d-none mt-2 p-2 rounded border" id="occ-${idx}" style="background: var(--surface-2); border-color: var(--border-color) !important; max-height: 180px; overflow-y: auto;">
                  <table class="slc-table mb-0" style="font-size: 0.74rem;">
                    <thead>
                      <tr>
                        <th style="width: 145px;">Время события</th>
                        <th style="width: 70px;">PID</th>
                        <th style="width: 80px;">Record ID</th>
                        <th>Сообщение</th>
                        <th style="width: 55px;"></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${c.occurrences.map((occ, oIdx) => `
                        <tr>
                          <td class="font-monospace" style="color: var(--text-color);">${escapeHtml(occ.timestamp || '-')}</td>
                          <td class="font-monospace text-muted">${occ.process_id || '-'}</td>
                          <td class="font-monospace text-muted">${occ.record_id || '-'}</td>
                          <td class="text-truncate small" style="max-width: 280px; color: var(--text-muted);" title="${escapeHtml(occ.message)}">${escapeHtml(occ.message)}</td>
                          <td class="text-end">
                            <button class="btn btn-xs btn-outline-info py-0 px-1.5 btn-occ-detail" data-chunk-idx="${idx}" data-occ-idx="${oIdx}" title="Открыть детали">
                              <i class="bi bi-info-circle"></i>
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    `;

    resultsEl.querySelectorAll('.btn-rag-detail').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const chunk = chunks[idx];
        if (chunk) {
          showEventDetails({
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

    resultsEl.querySelectorAll('.btn-toggle-occurrences').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.getAttribute('data-target');
        const container = document.getElementById(targetId);
        const textSpan = btn.querySelector('.btn-occ-text');
        if (container) {
          const isHidden = container.classList.contains('d-none');
          if (isHidden) {
            container.classList.remove('d-none');
            if (textSpan) textSpan.textContent = t('systemControl.ragHideOccurrences', 'Скрыть повторения');
          } else {
            container.classList.add('d-none');
            const count = btn.closest('.slc-card').querySelector('.badge.bg-warning')?.textContent || '';
            if (textSpan) textSpan.textContent = t('systemControl.ragShowOccurrences', 'Показать все повторения');
          }
        }
      };
    });

    resultsEl.querySelectorAll('.btn-occ-detail').forEach(btn => {
      btn.onclick = () => {
        const cIdx = parseInt(btn.getAttribute('data-chunk-idx'), 10);
        const oIdx = parseInt(btn.getAttribute('data-occ-idx'), 10);
        const chunk = chunks[cIdx];
        const occ = chunk?.occurrences?.[oIdx];
        if (occ) {
          showEventDetails({
            timestamp: occ.timestamp,
            level: occ.level,
            event_id: occ.event_id,
            provider: occ.provider,
            channel: occ.channel,
            computer: occ.computer || '',
            process_id: occ.process_id || 0,
            message: occ.message,
          });
        }
      };
    });
  }

  async function rebuildRagIndex() {
    const resultsEl = document.getElementById('slc-rag-results');
    const rebuildBtn = document.getElementById('btn-slc-rag-rebuild');
    const hours = getSelectedRagPeriod();
    const periodLabel = getPeriodLabel(hours);
    if (!resultsEl) return;

    if (rebuildBtn) rebuildBtn.disabled = true;
    resultsEl.innerHTML = `
      <div class="text-center text-info py-4">
        <div class="spinner-border spinner-border-sm text-info me-2"></div>
        <strong>${escapeHtml(t('systemControl.ragRebuilding', 'Сбор событий со всех системных каналов и построение RAM-индекса...'))} (${escapeHtml(periodLabel)})</strong>
        <div class="small text-muted mt-1">Опрос WevtAPI, сбор журналов в оперативную память и синхронизация браузерного кеша.</div>
      </div>
    `;

    try {
      const res = await fetch(`/api/v1/system_logs/rag/build?all_channels=true&hours=${hours}&limit=150`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      BrowserRagCache.set(`status_${hours}`, data);
      await fetchRagStatus();

      resultsEl.innerHTML = `
        <div class="alert alert-success d-flex align-items-start gap-2 shadow-sm">
          <i class="bi bi-check-circle-fill fs-4 text-success flex-shrink-0 mt-0.5"></i>
          <div>
            <div class="fw-bold fs-6">In-Memory RAG-индекс успешно построен (${escapeHtml(periodLabel)})!</div>
            <div class="small mt-1">
              Просканировано каналов: <strong>${data.scanned_channels || 0}</strong> (с событиями: <strong>${data.channels_with_events || 0}</strong>).
              Всего событий (${escapeHtml(periodLabel)}): <strong>${(data.indexed_events || 0).toLocaleString()}</strong>
              (🚨 Критических: <strong>${data.critical_count || 0}</strong>, ⚠️ Ошибок: <strong>${data.error_count || 0}</strong>).
              Время генерации: <strong>${data.build_duration_ms || 0} мс</strong> в RAM.
            </div>
            <div class="small text-muted mt-2">Данные зафиксированы в RAM и кеше браузера. Вы можете вводить любые запросы для семантического поиска.</div>
          </div>
        </div>
      `;
    } catch (err) {
      resultsEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(t('systemControl.errorRagRebuild', 'Ошибка обновления RAG:'))} ${escapeHtml(err.message)}</div>`;
    } finally {
      if (rebuildBtn) rebuildBtn.disabled = false;
    }
  }

  function showEventDetails(entry, panelId = 'panel-system-control-3') {
    if (!entry) return;

    const modal = window.AIModalDialog || window.AITableModal;
    if (modal) {
      const lvl = entry.level || 'Info';
      const isErr = String(lvl).toLowerCase().includes('err') || String(lvl).toLowerCase().includes('crit');
      const isWarn = String(lvl).toLowerCase().includes('warn');
      const badgeCls = isErr ? 'badge bg-danger' : (isWarn ? 'badge bg-warning text-dark' : 'badge bg-info text-dark');
      const chan = (entry.channel || currentChannel || 'System').replace(/^evt:/i, '');

      modal.show({
        icon: isErr ? '🚨' : (isWarn ? '⚠️' : '📋'),
        title: `Событие #${entry.event_id > 0 ? entry.event_id : 'LOG'} (${entry.provider || entry.source || 'Windows'})`,
        subtitle: `Уровень: ${lvl} | ${entry.timestamp || ''}`,
        panelId: panelId,
        tableType: 'security_event',
        badges: [
          { text: lvl, class: badgeCls },
          { text: chan, class: 'badge border text-secondary' }
        ],
        metadata: [
          { label: 'Event ID', value: entry.event_id > 0 ? String(entry.event_id) : '-' },
          { label: 'Поставщик / Источник', value: entry.provider || entry.source || '-' },
          { label: 'Уровень важности', value: lvl },
          { label: 'Время регистрации', value: entry.timestamp || '-' },
          { label: 'Канал логов', value: chan },
          { label: 'Компьютер / Хост', value: entry.computer || 'LOCAL' },
          { label: 'PID процесса', value: entry.process_id > 0 ? String(entry.process_id) : '-' }
        ],
        rawTitle: 'Текст сообщения журнала событий',
        rawContent: entry.message || entry.raw_data || '',
        requestData: {
          event_id: entry.event_id,
          provider: entry.provider || entry.source,
          level: lvl,
          channel: chan,
          computer: entry.computer
        }
      });
      return;
    }

    const modalEl = document.getElementById('slc-event-detail-modal');
    if (!modalEl) return;

    const setElTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '';
    };

    setElTxt('slc-modal-time', entry.timestamp);
    const lvlEl = document.getElementById('slc-modal-level');
    if (lvlEl) lvlEl.innerHTML = `<span class="badge ${getSeverityClass(entry.level)}">${escapeHtml(entry.level)}</span>`;
    setElTxt('slc-modal-id', entry.event_id > 0 ? String(entry.event_id) : '-');
    setElTxt('slc-modal-provider', entry.provider || entry.source || '-');
    setElTxt('slc-modal-computer', entry.computer || '-');
    setElTxt('slc-modal-pid', entry.process_id > 0 ? String(entry.process_id) : '-');
    setElTxt('slc-modal-channel', (entry.channel || currentChannel).replace(/^evt:/i, ''));
    setElTxt('slc-modal-message', entry.message);

    const aiExplanation = document.getElementById('slc-modal-ai-explanation');
    if (aiExplanation) {
      aiExplanation.innerHTML = escapeHtml(t('systemControl.modalAiPrompt', 'Нажмите «Анализ контекста», чтобы провести диагностику выбранной записи.'));
    }

    const diagnoseBtn = document.getElementById('btn-slc-modal-diagnose');
    if (diagnoseBtn) {
      diagnoseBtn.onclick = async () => {
        aiExplanation.innerHTML = `<div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.modalAiAnalyzing', 'Анализ выбранной записи...'))}`;
        try {
          const cleanChan = (entry.channel || currentChannel).replace(/^evt:/i, '');
          const res = await fetch('/api/v1/system_logs/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: cleanChan,
              timestamp: entry.timestamp,
              event_id: entry.event_id || 0,
              provider: entry.provider || entry.source || '',
              level: entry.level || '',
              message: entry.message || '',
              target_entry: entry,
              query_text: `Event diagnostic ${entry.provider || entry.source} (ID ${entry.event_id || 0}): ${entry.message || ''}`,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const report = await res.json();
          aiExplanation.innerHTML = `
            <div class="mb-2"><strong class="text-info">${escapeHtml(t('systemControl.modalAiSummary', 'Сводка:'))}</strong> ${escapeHtml(report.summary)}</div>
            <div class="mb-2"><strong class="text-warning">${escapeHtml(t('systemControl.modalAiRootCause', 'Причина / Анализ:'))}</strong> ${escapeHtml(report.root_cause)}</div>
            <h6 class="small text-uppercase text-muted fw-bold mb-1">${escapeHtml(t('systemControl.modalAiRecs', 'Рекомендации:'))}</h6>
            <ul class="mb-0 ps-3">
              ${(report.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          `;
        } catch (e) {
          aiExplanation.innerHTML = `<div class="text-danger">${escapeHtml(t('systemControl.errorDiagnose', 'Ошибка диагностики:'))} ${escapeHtml(e.message)}</div>`;
        }
      };
    }

    if (window.bootstrap?.Modal) {
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();
    }
  }

  async function loadIncidents() {
    const listEl = document.getElementById('slc-incidents-list');
    if (!listEl) return;
    listEl.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.groupingIncidents', 'Группировка инцидентов...'))}</div>`;

    try {
      const res = await fetch('/api/v1/system_logs/incidents?window_seconds=25.0');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const incidents = data.incidents || [];

      if (incidents.length === 0) {
        listEl.innerHTML = `<div class="slc-card p-3 text-center text-muted">${escapeHtml(t('systemControl.noIncidents', 'Связанных цепочек инцидентов и каскадных сбоев не обнаружено.'))}</div>`;
        return;
      }

      listEl.innerHTML = incidents.map(inc => `
        <div class="slc-card mb-2 shadow-sm border-danger">
          <div class="slc-card-header text-danger d-flex justify-content-between align-items-center py-1.5 px-3">
            <strong>${escapeHtml(inc.incident_title || t('systemControl.cascadeFailure', 'Каскадный сбой'))}</strong>
            <span class="badge bg-danger">${inc.events_count} ${escapeHtml(t('systemControl.eventsCountBadge', 'событий').replace('{{count}}', '').trim())}</span>
          </div>
          <div class="p-2.5">
            <p class="small mb-1">${escapeHtml(inc.summary || '')}</p>
            <div class="small font-monospace text-muted">${escapeHtml(t('systemControl.timeWindow', 'Временное окно:'))} ${escapeHtml(inc.time_window || '')}</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      listEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(t('systemControl.errorIncidents', 'Ошибка загрузки инцидентов:'))} ${escapeHtml(e.message)}</div>`;
    }
  }

  async function loadTimeline() {
    const listEl = document.getElementById('slc-timeline-list');
    if (!listEl) return;
    listEl.innerHTML = `<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.formingTimeline', 'Формирование временной шкалы...'))}</div>`;

    try {
      const res = await fetch('/api/v1/system_logs/timeline');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const points = data.timeline || [];

      if (points.length === 0) {
        listEl.innerHTML = `<div class="slc-card p-3 text-center text-muted">${escapeHtml(t('systemControl.noTimeline', 'Данные временной шкалы отсутствуют.'))}</div>`;
        return;
      }

      listEl.innerHTML = points.map(p => `
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="font-monospace small" style="width: 120px; color: var(--text-muted);">${escapeHtml(p.time_slot)}</span>
          <div class="progress flex-grow-1" style="height: 12px; background: var(--surface-2);">
            <div class="progress-bar bg-info" style="width: ${Math.min(100, p.count * 4)}%;"></div>
          </div>
          <span class="font-monospace small fw-bold" style="width: 40px; color: #0284c7;">${p.count}</span>
        </div>
      `).join('');
    } catch (e) {
      listEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(t('systemControl.errorTimeline', 'Ошибка таймлайна:'))} ${escapeHtml(e.message)}</div>`;
    }
  }

  // =========================================================================
  // ПАНЕЛЬ ЖУРНАЛОВ СОБЫТИЙ WINDOWS (WEVTAPI & LOG INTELLIGENCE)
  // =========================================================================

  let elEventsList = [];
  let isElInitialized = false;

  async function fetchEventLogsSummary() {
    const channelSelect = document.getElementById('el-channel-select');
    const channel = channelSelect ? channelSelect.value : 'System';

    try {
      const res = await fetch(`/api/event-logs/events?channel=${encodeURIComponent(channel)}&limit=100&hours=24`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = await res.json();
      renderElEvents(entries);
      fetchIntelligenceProfile(channel, false);
    } catch (err) {
      console.warn('[EventLogs] Ошибка получения событий:', err);
    }
  }

  async function fetchIntelligenceProfile(channel, showBanner = true) {
    try {
      const res = await fetch(`/api/event-logs/intelligence/profile?channel=${encodeURIComponent(channel)}&hours=24&limit=100`);
      if (!res.ok) return;
      const data = await res.json();

      const healthEl = document.getElementById('el-health-score');
      const redEl = document.getElementById('el-redundancy-pct');

      if (data.profile) {
        if (healthEl) {
          const score = Math.round(data.profile.health_score ?? 100);
          healthEl.textContent = `${score}/100`;
          healthEl.className = `fs-4 fw-bold mt-1 font-monospace ${score >= 80 ? 'text-success' : (score >= 50 ? 'text-warning' : 'text-danger')}`;
        }
        if (redEl) {
          const rPct = (data.profile.redundancy_ratio_pct ?? 0).toFixed(1);
          redEl.textContent = `${rPct}%`;
        }
      }

      if (showBanner && data.decision) {
        renderIntelligenceBanner(data);
      }
    } catch (err) {
      console.debug('[EventLogs] Фоновый сбор аналитики:', err);
    }
  }

  function renderIntelligenceBanner(data) {
    const banner = document.getElementById('el-intel-banner');
    const title = document.getElementById('el-intel-title');
    const strat = document.getElementById('el-strategy-badge');
    const rationale = document.getElementById('el-intel-rationale');
    const rec = document.getElementById('el-intel-recommendation');
    const chunks = document.getElementById('el-chunks-badge');

    if (!banner) return;

    if (title) title.textContent = `Log Intelligence: Канал ${data.channel || 'System'}`;
    if (strat) strat.textContent = (data.decision.strategy || 'SNAPSHOT').toUpperCase();
    if (rationale) rationale.textContent = data.decision.rationale || '';
    if (rec) rec.innerHTML = `<i class="bi bi-lightbulb me-1"></i><strong>Рекомендация:</strong> ${escapeHtml(data.decision.recommended_llm_action || 'Система в штатном режиме.')}`;
    if (chunks) chunks.textContent = `${data.decision.chunks_generated || 0} RAG chunks`;

    banner.classList.remove('d-none');
  }

  async function runElFullAudit() {
    const channelSelect = document.getElementById('el-channel-select');
    const channel = channelSelect ? channelSelect.value : 'System';

    try {
      const res = await fetch(`/api/event-logs/intelligence/audit?channel=${encodeURIComponent(channel)}&hours=24&limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderIntelligenceBanner({
        channel: data.channel,
        decision: {
          strategy: data.strategy,
          rationale: data.strategy_rationale,
          recommended_llm_action: data.recommended_llm_action,
          chunks_generated: data.top_clusters ? data.top_clusters.length : 0,
        }
      });
    } catch (err) {
      console.warn('[EventLogs] Ошибка аудита:', err);
    }
  }

  async function runElRAGSearch() {
    const input = document.getElementById('el-rag-query-input');
    const channelSelect = document.getElementById('el-channel-select');
    const resultsCard = document.getElementById('el-rag-results-card');
    const resultsBody = document.getElementById('el-rag-results-body');

    if (!input || !resultsCard || !resultsBody) return;
    const query = input.value.trim();
    if (!query) return;

    resultsBody.innerHTML = `<div class="text-center py-3 text-muted"><div class="spinner-border spinner-border-sm text-info me-2"></div>Поиск в Adaptive Log RAG...</div>`;
    resultsCard.classList.remove('d-none');

    try {
      const channel = channelSelect ? channelSelect.value : '';
      const res = await fetch(`/api/event-logs/intelligence/search?query=${encodeURIComponent(query)}&top_k=5&channel=${encodeURIComponent(channel)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const results = await res.json();

      if (!results || results.length === 0) {
        resultsBody.innerHTML = `<div class="text-center py-3 text-muted">По запросу "<em>${escapeHtml(query)}</em>" совпадений не найдено.</div>`;
        return;
      }

      resultsBody.innerHTML = results.map(r => `
        <div class="p-2 mb-2 rounded bg-black border border-secondary">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="text-info">${escapeHtml(r.title || 'Документ RAG')}</strong>
            <span class="badge bg-secondary font-monospace">Relevance: ${Math.round((r.relevance_score || 0) * 100)}%</span>
          </div>
          <div class="small text-light font-monospace" style="word-break: break-word;">${escapeHtml(r.content || '')}</div>
          <div class="small text-muted mt-1 font-monospace"><i class="bi bi-tag me-1"></i>Стратегия: ${escapeHtml(r.strategy || 'Adaptive')} • ${escapeHtml(r.created_at || '')}</div>
        </div>
      `).join('');
    } catch (err) {
      resultsBody.innerHTML = `<div class="text-danger small p-2">Ошибка поиска: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderElEvents(entries) {
    elEventsList = entries || [];

    const critEl = document.getElementById('el-critical-count');
    const errEl = document.getElementById('el-error-count');

    let crits = 0;
    let errs = 0;

    elEventsList.forEach(e => {
      const l = (e.level || '').toLowerCase();
      if (l.includes('crit')) crits++;
      else if (l.includes('err')) errs++;
    });

    if (critEl) critEl.textContent = crits;
    if (errEl) errEl.textContent = errs;

    applyElFilters();
  }

  function applyElFilters() {
    const tbody = document.getElementById('el-tbody');
    const searchInput = document.getElementById('el-search-input');
    const badge = document.getElementById('el-table-badge');

    if (!tbody) return;

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = elEventsList.filter(e => {
      if (!query) return true;
      const msgMatch = (e.message || '').toLowerCase().includes(query);
      const provMatch = (e.provider_name || e.provider || '').toLowerCase().includes(query);
      const idMatch = String(e.event_id || e.id || '').includes(query);
      return msgMatch || provMatch || idMatch;
    });

    if (badge) badge.textContent = `${filtered.length} из ${elEventsList.length} событий`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${escapeHtml(t('systemControl.noEvents', 'События не найдены'))}</td></tr>`;
      return;
    }

    const itemsToRender = filtered.slice(0, 150);
    tbody.innerHTML = itemsToRender.map((e, idx) => {
      const level = (e.level || 'Information').toLowerCase();
      let badgeClass = 'bg-secondary';
      if (level.includes('crit') || level.includes('err')) badgeClass = 'bg-danger text-white';
      else if (level.includes('warn')) badgeClass = 'bg-warning text-dark';
      else if (level.includes('info')) badgeClass = 'bg-info text-dark';

      return `
        <tr class="slc-el-table-row" data-idx="${idx}" style="cursor: pointer;" title="Нажмите для просмотра подробностей события">
          <td><span class="badge ${badgeClass}">${escapeHtml(e.level || 'Info')}</span></td>
          <td class="text-muted small font-monospace">${escapeHtml(e.time_created || e.timestamp || '-')}</td>
          <td class="fw-semibold small" style="color: var(--text-color);">${escapeHtml(e.provider_name || e.provider || 'Windows')}</td>
          <td class="font-monospace text-warning small">${escapeHtml(String(e.event_id || e.id || '-'))}</td>
          <td class="small text-truncate" style="max-width: 500px; color: var(--text-color);">${escapeHtml(e.message || '-')}</td>
        </tr>
      `;
    }).join('');

    // Привязываем клики по строкам для просмотра деталей и ИИ-диагностики
    tbody.querySelectorAll('.slc-el-table-row').forEach(row => {
      row.onclick = () => {
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        const item = itemsToRender[idx];
        if (item) {
          showEventDetails({
            timestamp: item.time_created || item.timestamp,
            level: item.level,
            event_id: item.event_id || item.id,
            provider: item.provider_name || item.provider,
            computer: item.computer || item.machine_name || '',
            process_id: item.process_id || item.pid,
            channel: item.channel || (document.getElementById('el-channel-select')?.value || 'System'),
            message: item.message,
          });
        }
      };
    });
  }

  function initEventLogsPanel() {
    if (isElInitialized) return;
    isElInitialized = true;

    const refreshBtn = document.getElementById('el-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchEventLogsSummary);

    const channelSelect = document.getElementById('el-channel-select');
    if (channelSelect) channelSelect.addEventListener('change', fetchEventLogsSummary);

    const searchInput = document.getElementById('el-search-input');
    if (searchInput) searchInput.addEventListener('input', applyElFilters);

    const analyzeBtn = document.getElementById('el-intel-analyze-btn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', () => {
      const chan = channelSelect ? channelSelect.value : 'System';
      fetchIntelligenceProfile(chan, true);
    });

    const auditBtn = document.getElementById('el-intel-audit-btn');
    if (auditBtn) auditBtn.addEventListener('click', runElFullAudit);

    const ragBtn = document.getElementById('el-rag-search-btn');
    if (ragBtn) ragBtn.addEventListener('click', runElRAGSearch);

    const ragInput = document.getElementById('el-rag-query-input');
    if (ragInput) ragInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runElRAGSearch();
    });

    const bannerCloseBtn = document.getElementById('el-intel-close-btn');
    if (bannerCloseBtn) bannerCloseBtn.addEventListener('click', () => {
      const banner = document.getElementById('el-intel-banner');
      if (banner) banner.classList.add('d-none');
    });

    const ragCloseBtn = document.getElementById('el-rag-close-btn');
    if (ragCloseBtn) ragCloseBtn.addEventListener('click', () => {
      const card = document.getElementById('el-rag-results-card');
      if (card) card.classList.add('d-none');
    });

    initTableResizers();
  }

  // =========================================================================
  // ПАНЕЛЬ ЖИЗНЕННОГО ЦИКЛА ПИТАНИЯ (POWER LIFECYCLE & BOOT HISTORY)
  // =========================================================================

  let allPowerSessions = [];
  let allPowerEvents = [];
  let powerUptimeSeconds = 0;
  let powerUptimeInterval = null;
  let isPowerInitialized = false;

  function initPowerLifecyclePanel() {
    if (isPowerInitialized) return;
    isPowerInitialized = true;

    const refreshBtn = document.getElementById('pwr-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Обновление...';
        try {
          await loadPowerData();
          if (window.toast) window.toast.success('Обновлено', 'Данные сессий питания успешно обновлены');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i><span>Обновить данные</span>';
        }
      });
    }

    const rebuildBtn = document.getElementById('pwr-rebuild-btn');
    if (rebuildBtn) {
      rebuildBtn.addEventListener('click', async () => {
        rebuildBtn.disabled = true;
        rebuildBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Сканирование...';
        try {
          const res = await fetch('/api/v1/power/rebuild', { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          renderPowerSummary(data);
          await loadPowerData();
          if (window.toast) window.toast.success('Event Log пересканирован', `Реконструировано сессий: ${data.total_sessions_count}`);
        } catch (err) {
          console.error('[PowerLifecycle] Ошибка пересканирования:', err);
          if (window.toast) window.toast.error('Ошибка', 'Не удалось пересканировать журналы: ' + err.message);
        } finally {
          rebuildBtn.disabled = false;
          rebuildBtn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i><span>Пересканировать Event Log</span>';
        }
      });
    }

    // Фильтры сессий
    const sessionsSearch = document.getElementById('pwr-sessions-search');
    if (sessionsSearch) {
      sessionsSearch.addEventListener('input', () => filterAndRenderPowerSessions());
    }

    const filterType = document.getElementById('pwr-filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => filterAndRenderPowerSessions());
    }

    const filterUnexpected = document.getElementById('pwr-filter-unexpected-only');
    if (filterUnexpected) {
      filterUnexpected.addEventListener('change', () => filterAndRenderPowerSessions());
    }

    // Фильтры событий
    const eventsSearch = document.getElementById('pwr-events-search');
    if (eventsSearch) {
      eventsSearch.addEventListener('input', () => filterAndRenderPowerEvents());
    }

    const filterEid = document.getElementById('pwr-event-id-filter');
    if (filterEid) {
      filterEid.addEventListener('change', () => filterAndRenderPowerEvents());
    }

    startPowerUptimeCounter();
    initTableResizers();
  }

  async function loadPowerData() {
    try {
      // 1. Сводка
      const sumRes = await fetch('/api/v1/power/summary');
      if (sumRes.ok) {
        const summary = await sumRes.json();
        renderPowerSummary(summary);
      }

      // 2. Сессии
      const sessRes = await fetch('/api/v1/power/sessions?limit=100');
      if (sessRes.ok) {
        allPowerSessions = await sessRes.json();
        filterAndRenderPowerSessions();
      }

      // 3. События
      const evRes = await fetch('/api/v1/power/events?limit=200');
      if (evRes.ok) {
        allPowerEvents = await evRes.json();
        filterAndRenderPowerEvents();
      }
    } catch (err) {
      console.error('[PowerLifecycle] Ошибка загрузки данных:', err);
    }
  }

  function renderPowerSummary(summary) {
    if (!summary) return;

    const curBootEl = document.getElementById('pwr-current-boot');
    if (curBootEl) curBootEl.textContent = `Загрузка: ${summary.current_boot_time || '--'}`;

    const curUptimeEl = document.getElementById('pwr-current-uptime');
    if (curUptimeEl) {
      curUptimeEl.textContent = summary.current_uptime_human || '--';
      powerUptimeSeconds = summary.current_uptime_seconds || 0;
    }

    const totalSessionsEl = document.getElementById('pwr-total-sessions');
    if (totalSessionsEl) totalSessionsEl.textContent = summary.total_sessions_count;

    const totalBadge = document.getElementById('pwr-total-sessions-badge');
    if (totalBadge) totalBadge.textContent = `${summary.total_sessions_count} Сессий`;

    const cleanCountEl = document.getElementById('pwr-clean-count');
    if (cleanCountEl) cleanCountEl.textContent = summary.clean_shutdowns_count;

    const cleanRatioEl = document.getElementById('pwr-clean-ratio');
    if (cleanRatioEl) {
      const total = summary.total_sessions_count || 1;
      const ratio = Math.round((summary.clean_shutdowns_count / total) * 100);
      cleanRatioEl.textContent = `${ratio} %`;
    }

    const lastInitEl = document.getElementById('pwr-last-initiator');
    if (lastInitEl) {
      lastInitEl.textContent = `Инициатор: ${summary.last_initiator || 'Штатный'}`;
    }

    const unexpCountEl = document.getElementById('pwr-unexpected-count');
    if (unexpCountEl) unexpCountEl.textContent = summary.unexpected_shutdowns_count;

    const unexpBadge = document.getElementById('pwr-unexpected-badge');
    if (unexpBadge) {
      unexpBadge.textContent = `${summary.unexpected_shutdowns_count} Сбоев`;
      if (summary.unexpected_shutdowns_count > 0) {
        unexpBadge.className = 'badge bg-danger font-monospace';
      } else {
        unexpBadge.className = 'badge bg-success font-monospace';
      }
    }

    const bsodEl = document.getElementById('pwr-bsod-count');
    if (bsodEl) bsodEl.textContent = `BSOD (1001): ${summary.bsod_count || 0}`;
  }

  function filterAndRenderPowerSessions() {
    const tbody = document.getElementById('pwr-sessions-tbody');
    const counter = document.getElementById('pwr-sessions-counter');
    if (!tbody) return;

    const searchVal = (document.getElementById('pwr-sessions-search')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('pwr-filter-type')?.value || '';
    const unexpOnly = document.getElementById('pwr-filter-unexpected-only')?.checked || false;

    const filtered = allPowerSessions.filter(s => {
      if (unexpOnly && !s.unexpected_shutdown) return false;
      if (typeFilter) {
        if (typeFilter === 'Active' && s.shutdown_type !== 'Active') return false;
        if (typeFilter === 'Restart' && s.shutdown_type !== 'Restart') return false;
        if (typeFilter === 'Shutdown' && s.shutdown_type !== 'Shutdown' && s.shutdown_type !== 'PowerOff') return false;
        if (typeFilter === 'Unexpected' && !s.unexpected_shutdown) return false;
        if (typeFilter === 'BSOD' && s.shutdown_type !== 'BSOD' && !s.bugcheck) return false;
      }

      if (searchVal) {
        const init = (s.initiator || '').toLowerCase();
        const proc = (s.process || '').toLowerCase();
        const reason = (s.reason || '').toLowerCase();
        const code = (s.reason_code || '').toLowerCase();
        const sId = (s.session_id || '').toLowerCase();
        if (!init.includes(searchVal) && !proc.includes(searchVal) && !reason.includes(searchVal) && !code.includes(searchVal) && !sId.includes(searchVal)) {
          return false;
        }
      }
      return true;
    });

    if (counter) counter.textContent = `Найдено: ${filtered.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            Сессии питания, удовлетворяющие критериям фильтрации, не найдены.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      let statusBadge = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Неизвестно</span>';
      if (s.shutdown_type === 'Active') {
        statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle">🟢 Активная</span>';
      } else if (s.shutdown_type === 'Restart') {
        statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">↻ Перезагрузка</span>';
      } else if (s.shutdown_type === 'Shutdown' || s.shutdown_type === 'PowerOff') {
        statusBadge = '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">⏻ Выключение</span>';
      } else if (s.shutdown_type === 'BSOD' || s.bugcheck) {
        statusBadge = `<span class="badge bg-danger text-white">🚨 BSOD ${escapeHtml(s.bugcheck || '')}</span>`;
      } else if (s.unexpected_shutdown) {
        statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">⚠️ Сбой / 41</span>';
      }

      let initiatorHtml = '<span class="text-muted">--</span>';
      if (s.initiator || s.process) {
        const initName = s.initiator ? `<span class="fw-semibold text-primary">${escapeHtml(s.initiator)}</span>` : '';
        const procName = s.process ? `<span class="badge pwr-proc-badge font-monospace ms-1">${escapeHtml(s.process)}</span>` : '';
        initiatorHtml = `<div class="d-flex align-items-center flex-wrap">${initName} ${procName}</div>`;
        if (s.initiator_chain && s.initiator_chain.length > 1) {
          initiatorHtml += `<div class="small text-muted font-monospace mt-0.5" style="font-size: 0.72rem;">🔗 ${escapeHtml(s.initiator_chain.join(' → '))}</div>`;
        }
      }

      let reasonHtml = '<span class="text-muted">--</span>';
      if (s.reason || s.reason_code) {
        const codeBadge = s.reason_code ? `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle font-monospace me-1">${escapeHtml(s.reason_code)}</span>` : '';
        reasonHtml = `<div>${codeBadge}<span>${escapeHtml(s.reason || '')}</span></div>`;
        if (s.comment) {
          reasonHtml += `<div class="small text-muted font-italic mt-0.5">💬 ${escapeHtml(s.comment)}</div>`;
        }
      }

      return `
        <tr class="pwr-session-row" data-session-id="${escapeHtml(s.session_id)}" style="cursor: pointer;" title="Нажмите для AI-анализа сессии питания">
          <td class="font-monospace text-primary small fw-bold">${escapeHtml(s.session_id)}</td>
          <td class="font-monospace small">${escapeHtml(s.boot_time)}</td>
          <td class="font-monospace small text-muted">${s.shutdown_time ? escapeHtml(s.shutdown_time) : '<span class="text-success fw-bold">Сейчас</span>'}</td>
          <td class="font-monospace fw-semibold">${escapeHtml(s.uptime_human || '--')}</td>
          <td>${statusBadge}</td>
          <td>${initiatorHtml}</td>
          <td>${reasonHtml}</td>
          <td class="text-center">
            <button class="btn btn-xs btn-outline-info p-1 px-2 pwr-detail-btn" data-session-id="${escapeHtml(s.session_id)}" title="Посмотреть подробную хронологию">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.pwr-session-row').forEach(row => {
      row.addEventListener('click', (evt) => {
        const sId = row.dataset.sessionId;
        showPowerSessionDetailModal(sId);
      });
    });
  }

  function showPowerEventDetail(e) {
    if (!e) return;
    const modal = window.AIModalDialog || window.AITableModal;
    if (modal) {
      const isErr = e.event_id === 41 || e.event_id === 6008 || e.event_id === 1001;
      modal.show({
        icon: isErr ? '🚨' : '⚡',
        title: `Событие питания #${e.event_id} (${e.provider || 'Kernel-Power'})`,
        subtitle: `Тип: ${e.event_type || 'Lifecycle'} | ${e.timestamp || ''}`,
        panelId: 'panel-system-control-5',
        tableType: 'security_event',
        badges: [
          { text: `Event ${e.event_id}`, class: isErr ? 'badge bg-danger' : 'badge bg-info text-dark' },
          { text: e.event_type || 'Power', class: 'badge border text-secondary' }
        ],
        metadata: [
          { label: 'Event ID', value: String(e.event_id) },
          { label: 'Поставщик', value: e.provider || 'Kernel-Power' },
          { label: 'Пользователь', value: e.user || 'SYSTEM' },
          { label: 'Процесс', value: e.process || '-' },
          { label: 'Время события', value: e.timestamp || '-' },
          { label: 'Причина / Сообщение', value: e.reason || e.details?.message || '-', fullWidth: true }
        ],
        rawTitle: 'Сырые XML данные события',
        rawContent: e.raw_xml || JSON.stringify(e, null, 2),
        requestData: {
          event_id: e.event_id,
          provider: e.provider,
          user: e.user,
          process: e.process,
          reason: e.reason
        }
      });
      return;
    }
  }

  function filterAndRenderPowerEvents() {
    const tbody = document.getElementById('pwr-events-tbody');
    const counter = document.getElementById('pwr-events-counter');
    if (!tbody) return;

    const searchVal = (document.getElementById('pwr-events-search')?.value || '').toLowerCase().trim();
    const eidFilter = document.getElementById('pwr-event-id-filter')?.value || '';

    const filtered = allPowerEvents.filter(e => {
      if (eidFilter && String(e.event_id) !== String(eidFilter)) return false;
      if (searchVal) {
        const prov = (e.provider || '').toLowerCase();
        const user = (e.user || '').toLowerCase();
        const proc = (e.process || '').toLowerCase();
        const reason = (e.reason || '').toLowerCase();
        const msg = (e.details?.message || '').toLowerCase();
        if (!prov.includes(searchVal) && !user.includes(searchVal) && !proc.includes(searchVal) && !reason.includes(searchVal) && !msg.includes(searchVal)) {
          return false;
        }
      }
      return true;
    });

    if (counter) counter.textContent = `Событий: ${filtered.length}`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">
            События журнала, удовлетворяющие критериям поиска, не найдены.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((e, idx) => {
      let eidBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle font-monospace">${e.event_id}</span>`;
      if (e.event_id === 1074) {
        eidBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning font-monospace fw-bold">1074 User32</span>';
      } else if (e.event_id === 41) {
        eidBadge = '<span class="badge bg-danger-subtle text-danger border border-danger font-monospace fw-bold">41 Kernel-Power</span>';
      } else if (e.event_id === 6008) {
        eidBadge = '<span class="badge bg-danger-subtle text-danger border border-danger font-monospace fw-bold">6008 EventLog</span>';
      } else if (e.event_id === 12 || e.event_id === 6005 || e.event_id === 6009) {
        eidBadge = `<span class="badge bg-success-subtle text-success border border-success font-monospace">${e.event_id} Boot</span>`;
      } else if (e.event_id === 13 || e.event_id === 6006) {
        eidBadge = `<span class="badge bg-info-subtle text-info border border-info font-monospace">${e.event_id} Clean</span>`;
      } else if (e.event_id === 1001) {
        eidBadge = '<span class="badge bg-danger text-white font-monospace fw-bold">1001 BSOD</span>';
      }

      let userProc = '<span class="text-muted">--</span>';
      if (e.user || e.process) {
        userProc = `<div class="fw-semibold text-primary">${escapeHtml(e.user || '')}</div>`;
        if (e.process) userProc += `<div class="font-monospace small text-muted">${escapeHtml(e.process)}</div>`;
      }

      const desc = e.reason || e.details?.message || '--';

      return `
        <tr class="pwr-event-row" data-idx="${idx}" style="cursor: pointer;" title="Нажмите для AI-диагностики инцидента питания">
          <td class="font-monospace small">${escapeHtml(e.timestamp)}</td>
          <td>${eidBadge}</td>
          <td class="small text-muted font-monospace">${escapeHtml(e.provider)}</td>
          <td><span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">${escapeHtml(e.event_type)}</span></td>
          <td>${userProc}</td>
          <td class="small">${escapeHtml(desc)}</td>
          <td class="text-center">
            ${e.raw_xml ? `
              <button class="btn btn-xs btn-outline-secondary p-1 px-2 pwr-xml-btn" data-xml="${escapeHtml(e.raw_xml)}" title="Просмотреть XML">
                <i class="bi bi-code-square"></i>
              </button>
            ` : '<span class="text-muted">-</span>'}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.pwr-event-row').forEach(row => {
      row.addEventListener('click', (evt) => {
        if (evt.target.closest('.pwr-xml-btn')) return;
        const idx = parseInt(row.dataset.idx, 10);
        const e = filtered[idx];
        if (e) showPowerEventDetail(e);
      });
    });

    tbody.querySelectorAll('.pwr-xml-btn').forEach(btn => {
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const xml = btn.dataset.xml;
        showPowerXmlModal(xml);
      });
    });
  }

  function showPowerSessionDetailModal(sessionId) {
    const session = allPowerSessions.find(s => s.session_id === sessionId);
    if (!session) return;

    const modal = window.AIModalDialog || window.AITableModal;
    if (modal) {
      const isUnexp = Boolean(session.unexpected_shutdown || session.bugcheck);
      modal.show({
        icon: isUnexp ? '⚡' : '⏻',
        title: `Сессия питания: ${session.session_id}`,
        subtitle: `Статус: ${session.shutdown_type || 'Active'} | Аптайм: ${session.uptime_human || '--'}`,
        panelId: 'panel-system-control-4',
        tableType: 'user_account',
        badges: [
          { text: session.shutdown_type || 'Active', class: isUnexp ? 'badge bg-danger' : 'badge bg-success' },
          { text: session.uptime_human || 'Active', class: 'badge border text-secondary' }
        ],
        metadata: [
          { label: 'ID сессии', value: session.session_id },
          { label: 'Время старта (Boot)', value: session.boot_time || '-' },
          { label: 'Время завершения', value: session.shutdown_time || 'Активна' },
          { label: 'Инициатор', value: session.initiator || 'Система' },
          { label: 'Процесс', value: session.process || 'N/A' },
          { label: 'Причина выключения', value: session.reason || 'N/A', fullWidth: true }
        ],
        rawTitle: 'Контекст и хронология событий сессии',
        rawContent: JSON.stringify(session, null, 2),
        requestData: {
          session_id: session.session_id,
          initiator: session.initiator,
          process: session.process,
          reason: session.reason,
          shutdown_type: session.shutdown_type,
          unexpected: session.unexpected_shutdown
        }
      });
      return;
    }

    const modalTitle = document.getElementById('pwr-modal-title');
    const modalBody = document.getElementById('pwr-modal-body');
    if (modalTitle) modalTitle.textContent = `Сессия питания: ${session.session_id}`;

    if (modalBody) {
      let eventsListHtml = '<div class="text-muted small">Нет связанных событий</div>';
      if (session.events && session.events.length > 0) {
        eventsListHtml = session.events.map(ev => `
          <div class="pwr-detail-card p-2 mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">Event ${ev.event_id}</span>
              <span class="font-monospace small text-muted">${escapeHtml(ev.timestamp)}</span>
            </div>
            <div class="small fw-semibold text-primary">${escapeHtml(ev.provider || '')}</div>
            <div class="small mt-1">${escapeHtml(ev.reason || ev.details?.message || '')}</div>
            ${ev.process ? `<div class="small text-muted font-monospace mt-1">Процесс: ${escapeHtml(ev.process)} | Пользователь: ${escapeHtml(ev.user || '--')}</div>` : ''}
          </div>
        `).join('');
      }

      modalBody.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-6">
            <div class="pwr-detail-card p-2.5">
              <div class="text-muted small">🚀 Время старта (Boot):</div>
              <div class="font-monospace fw-bold text-info mt-1">${escapeHtml(session.boot_time)}</div>
            </div>
          </div>
          <div class="col-6">
            <div class="pwr-detail-card p-2.5">
              <div class="text-muted small">⏹️ Завершение работы:</div>
              <div class="font-monospace fw-bold ${session.shutdown_time ? '' : 'text-success'} mt-1">
                ${session.shutdown_time ? escapeHtml(session.shutdown_time) : 'Сессия активна'}
              </div>
            </div>
          </div>
        </div>

        <div class="pwr-detail-card p-3 mb-3">
          <h6 class="fw-bold text-warning mb-2"><i class="bi bi-sliders me-1.5"></i>Параметры завершения</h6>
          <div class="row g-2 small">
            <div class="col-4 text-muted">Тип завершения:</div>
            <div class="col-8 fw-semibold">${escapeHtml(session.shutdown_type)}</div>
            
            <div class="col-4 text-muted">Аптайм сессии:</div>
            <div class="col-8 font-monospace fw-bold">${escapeHtml(session.uptime_human || '--')}</div>

            <div class="col-4 text-muted">Инициатор:</div>
            <div class="col-8">${escapeHtml(session.initiator || 'SYSTEM / Hardware')}</div>

            <div class="col-4 text-muted">Процесс:</div>
            <div class="col-8 font-monospace text-info">${escapeHtml(session.process || '--')}</div>

            <div class="col-4 text-muted">Код причины:</div>
            <div class="col-8 font-monospace text-secondary">${escapeHtml(session.reason_code || '--')}</div>

            <div class="col-4 text-muted">Текст причины:</div>
            <div class="col-8">${escapeHtml(session.reason || '--')}</div>

            ${session.comment ? `
              <div class="col-4 text-muted">Комментарий:</div>
              <div class="col-8 font-italic">${escapeHtml(session.comment)}</div>
            ` : ''}

            ${session.bugcheck ? `
              <div class="col-4 text-danger fw-bold">BSOD BugCheck:</div>
              <div class="col-8 text-danger font-monospace fw-bold">${escapeHtml(session.bugcheck)}</div>
            ` : ''}
          </div>
        </div>

        ${session.initiator_chain && session.initiator_chain.length > 0 ? `
          <div class="pwr-detail-card p-3 mb-3">
            <h6 class="fw-bold text-info mb-2"><i class="bi bi-diagram-3 me-1.5"></i>Корреляция цепочки вызова</h6>
            <div class="d-flex align-items-center flex-wrap gap-1 font-monospace small">
              ${session.initiator_chain.map((step, idx) => `
                <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle p-2">${escapeHtml(step)}</span>
                ${idx < session.initiator_chain.length - 1 ? '<i class="bi bi-arrow-right text-muted"></i>' : ''}
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pwr-detail-card p-3">
          <h6 class="fw-bold mb-2"><i class="bi bi-list-nested me-1.5"></i>Хронология событий в рамках сессии</h6>
          <div style="max-height: 250px; overflow-y: auto;">
            ${eventsListHtml}
          </div>
        </div>
      `;

      const modalEl = document.getElementById('pwrSessionDetailModal');
      if (modalEl && window.bootstrap) {
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
      }
    }
  }

  function showPowerXmlModal(xmlString) {
    const pre = document.getElementById('pwr-xml-content');
    if (pre) pre.textContent = xmlString;

    const modalEl = document.getElementById('pwrXmlDetailModal');
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  function startPowerUptimeCounter() {
    if (powerUptimeInterval) clearInterval(powerUptimeInterval);
    powerUptimeInterval = setInterval(() => {
      powerUptimeSeconds += 1;
      const curUptimeEl = document.getElementById('pwr-current-uptime');
      if (curUptimeEl && powerUptimeSeconds > 0) {
        const days = Math.floor(powerUptimeSeconds / 86400);
        const hours = Math.floor((powerUptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((powerUptimeSeconds % 3600) / 60);
        const sec = Math.floor(powerUptimeSeconds % 60);
        const parts = [];
        if (days > 0) parts.push(`${days}д`);
        if (hours > 0 || days > 0) parts.push(`${hours}ч`);
        if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}м`);
        parts.push(`${sec}с`);
        curUptimeEl.textContent = parts.join(' ');
      }
    }, 1000);
  }

  // =========================================================================
  // ПАНЕЛЬ ЖУРНАЛОВ И БЕЗОПАСНОСТИ DEFENDER (WINDOWS DEFENDER SECURITY EVENTS)
  // =========================================================================

  let allDefenderEvents = [];
  let allDefenderThreats = [];
  let defenderStatusData = null;
  let isDefenderInitialized = false;

  const DEFENDER_CATEGORIES = {
    1000: { name: 'Сканирование начато', en: 'Scan Started', cat: 'scans', icon: 'bi-search', badge: 'bg-info' },
    1001: { name: 'Сканирование завершено', en: 'Scan Completed', cat: 'scans', icon: 'bi-check-circle', badge: 'bg-success' },
    1002: { name: 'Сканирование отменено', en: 'Scan Cancelled', cat: 'scans', icon: 'bi-slash-circle', badge: 'bg-warning text-dark' },
    1005: { name: 'Сбой сканирования', en: 'Scan Failed', cat: 'scans', icon: 'bi-x-circle', badge: 'bg-danger' },
    1006: { name: 'Обнаружена угроза (Вредонос)', en: 'Malware Detected', cat: 'threats', icon: 'bi-bug-fill', badge: 'bg-danger' },
    1007: { name: 'Угроза нейтрализована', en: 'Malware Remediated', cat: 'threats', icon: 'bi-shield-check', badge: 'bg-success' },
    1008: { name: 'Сбой нейтрализации угрозы', en: 'Remediation Failed', cat: 'threats', icon: 'bi-exclamation-octagon-fill', badge: 'bg-danger' },
    1015: { name: 'Подозрительное поведение', en: 'Suspicious Behavior', cat: 'threats', icon: 'bi-eye-fill', badge: 'bg-warning text-dark' },
    1116: { name: 'Обнаружен вирус / вредонос', en: 'Malware Detected', cat: 'threats', icon: 'bi-radioactive', badge: 'bg-danger' },
    1117: { name: 'Действие выполнено', en: 'Action Taken', cat: 'threats', icon: 'bi-shield-shaded', badge: 'bg-info' },
    1121: { name: 'Блокировка Network Protection', en: 'Network Protection Block', cat: 'network', icon: 'bi-globe-americas', badge: 'bg-warning text-dark' },
    1122: { name: 'Аудит Network Protection', en: 'Network Protection Audit', cat: 'network', icon: 'bi-globe', badge: 'bg-secondary' },
    1123: { name: 'Блокировка CFA (Ransomware)', en: 'Controlled Folder Access Block', cat: 'cfa', icon: 'bi-lock-fill', badge: 'bg-warning text-dark' },
    1124: { name: 'Аудит CFA', en: 'Controlled Folder Access Audit', cat: 'cfa', icon: 'bi-folder-check', badge: 'bg-secondary' },
    1125: { name: 'Блокировка ASR (Exploit Guard)', en: 'Attack Surface Reduction Block', cat: 'asr', icon: 'bi-lightning-fill', badge: 'bg-warning text-dark' },
    1126: { name: 'Аудит ASR', en: 'Attack Surface Reduction Audit', cat: 'asr', icon: 'bi-lightning', badge: 'bg-secondary' },
    2000: { name: 'Сигнатуры обновлены', en: 'Signature Updated', cat: 'signatures', icon: 'bi-cloud-check', badge: 'bg-success' },
    2001: { name: 'Сбой обновления сигнатур', en: 'Signature Update Failed', cat: 'signatures', icon: 'bi-cloud-slash', badge: 'bg-danger' },
    2002: { name: 'Обновление сигнатур отменено', en: 'Signature Update Cancelled', cat: 'signatures', icon: 'bi-cloud-minus', badge: 'bg-secondary' },
    2003: { name: 'Движок Defender обновлен', en: 'Engine Updated', cat: 'signatures', icon: 'bi-cpu-fill', badge: 'bg-info text-dark' },
    5000: { name: 'Защита в реальном времени ВКЛ', en: 'Real-time Protection Enabled', cat: 'protection', icon: 'bi-shield-fill-check', badge: 'bg-success' },
    5001: { name: 'Защита в реальном времени ВЫКЛ', en: 'Real-time Protection Disabled', cat: 'protection', icon: 'bi-shield-fill-x', badge: 'bg-danger' },
    5007: { name: 'Конфигурация Defender изменена', en: 'Configuration Changed', cat: 'protection', icon: 'bi-sliders', badge: 'bg-warning text-dark' },
  };

  function initDefenderLogsPanel() {
    if (isDefenderInitialized) return;
    isDefenderInitialized = true;

    const refreshBtn = document.getElementById('def-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
        try {
          await loadDefenderData();
          if (window.toast) window.toast.success(t('systemControl.btnRefresh', 'Обновлено'), 'События Defender успешно обновлены');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = `<i class="bi bi-arrow-clockwise me-1"></i><span>${t('systemControl.btnRefresh', 'Обновить')}</span>`;
        }
      });
    }

    const auditBtn = document.getElementById('def-audit-btn');
    if (auditBtn) {
      auditBtn.addEventListener('click', async () => {
        auditBtn.disabled = true;
        auditBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Аудит...';
        try {
          const res = await fetch('/api/v1/defender/refresh', { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await loadDefenderData();
          if (window.toast) window.toast.success('Аудит Defender', 'Снимок безопасности Defender успешно обновлен в БД');
        } catch (e) {
          console.warn('[Defender] Ошибка аудита:', e);
          if (window.toast) window.toast.error('Ошибка', 'Не удалось провести аудит Defender: ' + e.message);
        } finally {
          auditBtn.disabled = false;
          auditBtn.innerHTML = `<i class="bi bi-shield-check me-1"></i><span>${t('systemControl.defBtnAudit', 'Аудит статуса')}</span>`;
        }
      });
    }

    const scanBtn = document.getElementById('def-quick-scan-btn');
    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Старт...';
        try {
          const res = await fetch('/api/v1/defender/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scan_type: 'quick' }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const task = await res.json();
          if (window.toast) window.toast.info('Сканирование Defender', `Запущено быстрое сканирование (Task ID: ${task.task_id || 'active'})`);
          setTimeout(loadDefenderData, 3000);
        } catch (e) {
          console.warn('[Defender] Ошибка сканирования:', e);
          if (window.toast) window.toast.error('Ошибка', 'Не удалось запустить сканирование: ' + e.message);
        } finally {
          scanBtn.disabled = false;
          scanBtn.innerHTML = `<i class="bi bi-play-circle me-1"></i><span>${t('systemControl.defBtnScan', 'Быстрое скан')}</span>`;
        }
      });
    }

    const updateSigBtn = document.getElementById('def-update-sig-btn');
    if (updateSigBtn) {
      updateSigBtn.addEventListener('click', async () => {
        updateSigBtn.disabled = true;
        updateSigBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Обновление...';
        try {
          const res = await fetch('/api/v1/defender/update-signatures', { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const task = await res.json();
          if (window.toast) window.toast.info('Обновление сигнатур', `Запущено фоновое обновление баз (Task ID: ${task.task_id || 'active'})`);
          setTimeout(loadDefenderData, 3000);
        } catch (e) {
          console.warn('[Defender] Ошибка обновления баз:', e);
          if (window.toast) window.toast.error('Ошибка', 'Не удалось обновить базы: ' + e.message);
        } finally {
          updateSigBtn.disabled = false;
          updateSigBtn.innerHTML = `<i class="bi bi-cloud-arrow-down me-1"></i><span>${t('systemControl.defBtnUpdateSig', 'Обновить базы')}</span>`;
        }
      });
    }

    const searchInput = document.getElementById('def-events-search');
    if (searchInput) searchInput.addEventListener('input', () => filterAndRenderDefenderEvents());

    const catSelect = document.getElementById('def-category-select');
    if (catSelect) catSelect.addEventListener('change', () => filterAndRenderDefenderEvents());

    const lvlSelect = document.getElementById('def-level-select');
    if (lvlSelect) lvlSelect.addEventListener('change', () => filterAndRenderDefenderEvents());

    initTableResizers();
  }

  async function loadDefenderData() {
    try {
      // 1. Статус Defender
      const statusPromise = fetch('/api/v1/defender/status')
        .then(r => r.ok ? r.json() : null)
        .catch(e => { console.debug('[Defender] Ошибка статуса:', e); return null; });

      // 2. Угрозы
      const threatsPromise = fetch('/api/v1/defender/threats?limit=50')
        .then(r => r.ok ? r.json() : [])
        .catch(e => { console.debug('[Defender] Ошибка истории угроз:', e); return []; });

      // 3. Журнал событий Defender
      const eventsPromise = fetch('/api/v1/defender/events?limit=150')
        .then(async r => {
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) return data;
          }
          // Fallback на WevtAPI через system_logs
          const fallbackRes = await fetch('/api/v1/system_logs/events?channel=Microsoft-Windows-Windows%20Defender/Operational&hours=720&limit=150');
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            return fbData.events || fbData.entries || [];
          }
          return [];
        })
        .catch(e => { console.debug('[Defender] Ошибка событий:', e); return []; });

      const [status, threats, events] = await Promise.all([statusPromise, threatsPromise, eventsPromise]);
      defenderStatusData = status;
      allDefenderThreats = Array.isArray(threats) ? threats : [];
      allDefenderEvents = (Array.isArray(events) ? events : []).map(normalizeDefenderEvent);

      renderDefenderSummary(defenderStatusData, allDefenderThreats, allDefenderEvents);
      filterAndRenderDefenderEvents();
    } catch (err) {
      console.warn('[Defender] Ошибка загрузки данных Defender:', err);
    }
  }

  function normalizeDefenderEvent(e) {
    const eid = Number(e.event_id || e.Id || 0);
    const info = DEFENDER_CATEGORIES[eid] || {
      name: 'Событие безопасности',
      en: 'Security Event',
      cat: 'general',
      icon: 'bi-shield',
      badge: 'bg-secondary'
    };
    return {
      event_id: eid,
      timestamp: e.timestamp || e.TimeCreated || new Date().toISOString(),
      level: e.level || e.LevelDisplayName || (info.cat === 'threats' ? 'Warning' : 'Information'),
      category: e.category || (window.currentLang === 'en' ? info.en : info.name),
      category_key: info.cat,
      icon: info.icon,
      badge: info.badge,
      message: e.message || e.Message || e.raw_data || '',
      details: e.details || {}
    };
  }

  function renderDefenderSummary(status, threats, events) {
    const statusBadge = document.getElementById('def-status-badge');
    const statusText = document.getElementById('def-status-text');
    const cloudStatus = document.getElementById('def-cloud-status');
    const threatsBadge = document.getElementById('def-threats-badge');
    const threatsCount = document.getElementById('def-threats-count');
    const threatsDesc = document.getElementById('def-threats-desc');
    const blocksCount = document.getElementById('def-blocks-count');
    const sigBadge = document.getElementById('def-sig-badge');
    const sigVersion = document.getElementById('def-sig-version');
    const engineVersion = document.getElementById('def-engine-version');

    if (status) {
      const isEnabled = status.is_enabled !== false && status.real_time_protection !== false && status.antivirus_enabled !== false;
      if (statusBadge) {
        statusBadge.className = isEnabled ? 'badge bg-success font-monospace' : 'badge bg-danger font-monospace';
        statusBadge.textContent = isEnabled ? 'ACTIVE' : 'DISABLED';
      }
      if (statusText) {
        statusText.textContent = isEnabled ? 'Включена (Real-Time)' : 'Отключена / Неактивна';
      }
      if (cloudStatus) {
        const cloudActive = status.cloud_protection !== false && status.behavior_monitor_enabled !== false;
        cloudStatus.textContent = `Cloud: ${cloudActive ? 'Включена' : 'Отключена'}`;
      }
      if (sigVersion) {
        sigVersion.textContent = status.signatures_version || status.antivirus_signature_version || 'vLatest';
      }
      if (sigBadge && status.signatures_version) {
        sigBadge.textContent = status.signatures_version.split('.').slice(0, 2).join('.') || 'vLatest';
      }
      if (engineVersion) {
        engineVersion.textContent = `Engine: ${status.engine_version || 'Defender Engine'}`;
      }
    }

    const threatCountVal = (threats && threats.length) || (events ? events.filter(e => e.category_key === 'threats').length : 0);
    if (threatsCount) threatsCount.textContent = threatCountVal;
    if (threatsBadge) {
      if (threatCountVal > 0) {
        threatsBadge.className = 'badge bg-danger font-monospace';
        threatsBadge.textContent = `${threatCountVal} Угроз`;
      } else {
        threatsBadge.className = 'badge bg-success font-monospace';
        threatsBadge.textContent = '0 Угроз';
      }
    }
    if (threatsDesc && threats && threats.length > 0) {
      threatsDesc.textContent = `Посл: ${threats[0].threat_name || threats[0].name || 'Detected'}`;
    }

    const blocksTotal = events ? events.filter(e => e.category_key === 'cfa' || e.category_key === 'asr' || e.category_key === 'network').length : 0;
    if (blocksCount) blocksCount.textContent = blocksTotal;
  }

  function filterAndRenderDefenderEvents() {
    const tbody = document.getElementById('def-events-tbody');
    const counter = document.getElementById('def-events-counter');
    const tableBadge = document.getElementById('def-table-badge');
    if (!tbody) return;

    const searchVal = (document.getElementById('def-events-search')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('def-category-select')?.value || '';
    const lvlFilter = (document.getElementById('def-level-select')?.value || '').toLowerCase().trim();

    const filtered = allDefenderEvents.filter(e => {
      if (catFilter && e.category_key !== catFilter) return false;
      if (lvlFilter) {
        const lvl = (e.level || '').toLowerCase();
        if (!lvl.includes(lvlFilter)) return false;
      }
      if (searchVal) {
        const matchMsg = (e.message || '').toLowerCase().includes(searchVal);
        const matchId = String(e.event_id || '').includes(searchVal);
        const matchCat = (e.category || '').toLowerCase().includes(searchVal);
        if (!matchMsg && !matchId && !matchCat) return false;
      }
      return true;
    });

    if (counter) counter.textContent = `${filtered.length} событий`;
    if (tableBadge) tableBadge.textContent = `${filtered.length} событий`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">${t('systemControl.defNoEvents', 'Событий Windows Defender не найдено.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((e, idx) => {
      const timeStr = formatTime(e.timestamp);
      const isWarnOrErr = (e.level || '').toLowerCase().includes('warn') || (e.level || '').toLowerCase().includes('err') || (e.level || '').toLowerCase().includes('crit') || e.category_key === 'threats';
      return `
        <tr data-index="${idx}" class="${isWarnOrErr ? 'table-danger-subtle' : ''}">
          <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(timeStr)}</td>
          <td><span class="badge ${getSeverityClass(e.level)} text-uppercase" style="font-size: 0.68rem;">${escapeHtml(e.level || 'Info')}</span></td>
          <td class="font-monospace small fw-bold" style="color: #0284c7;">${e.event_id || '-'}</td>
          <td>
            <span class="badge ${e.badge || 'bg-secondary'} d-inline-flex align-items-center gap-1 font-monospace" style="font-size: 0.72rem;">
              <i class="bi ${e.icon || 'bi-shield'}"></i>
              <span>${escapeHtml(e.category)}</span>
            </span>
          </td>
          <td class="text-truncate" style="max-width: 480px; color: var(--text-color);" title="${escapeHtml(e.message)}">
            ${escapeHtml(e.message)}
          </td>
          <td class="text-center">
            <button class="btn btn-xs btn-outline-info rounded-pill px-2 py-0.5 def-detail-btn" data-index="${idx}" title="Посмотреть детали события">
              <i class="bi bi-info-circle"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.onclick = () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('table-active'));
        row.classList.add('table-active');
        const idx = parseInt(row.getAttribute('data-index'), 10);
        const ev = filtered[idx];
        if (ev) showDefenderEventDetail(ev);
      };
    });
  }

  function showDefenderEventDetail(ev) {
    const modal = window.AIModalDialog || window.AITableModal;
    if (modal && ev) {
      const isThreat = ev.category_key === 'threats' || (ev.level || '').toLowerCase().includes('crit') || (ev.level || '').toLowerCase().includes('err');
      modal.show({
        icon: isThreat ? '🚨' : '🛡️',
        title: `Defender ID ${ev.event_id}: ${ev.category || 'Безопасность'}`,
        subtitle: `Уровень: ${ev.level || 'Info'} | ${ev.timestamp || ''}`,
        panelId: 'panel-system-control-defender-filter',
        tableType: 'security_event',
        badges: [
          { text: ev.level || 'Info', class: `badge ${getSeverityClass(ev.level)}` },
          { text: ev.category || 'Defender', class: 'badge bg-secondary' }
        ],
        metadata: [
          { label: 'Event ID', value: String(ev.event_id) },
          { label: 'Категория', value: ev.category || 'Защита' },
          { label: 'Уровень', value: ev.level || 'Info' },
          { label: 'Время регистрации', value: ev.timestamp || '-' },
          { label: 'Журнал', value: 'Microsoft-Windows-Windows Defender/Operational', isCode: true, fullWidth: true }
        ],
        rawTitle: 'Подробности и параметры события Defender',
        rawContent: ev.message || '',
        requestData: {
          event_id: ev.event_id,
          category: ev.category,
          category_key: ev.category_key,
          level: ev.level,
          description: ev.message
        }
      });
      return;
    }

    const modalEl = document.getElementById('defEventDetailModal');
    const bodyEl = document.getElementById('def-modal-body');
    const titleEl = document.getElementById('def-modal-title');
    if (!modalEl || !bodyEl || !ev) return;

    if (titleEl) {
      titleEl.innerHTML = `<i class="bi ${ev.icon || 'bi-shield-check'} text-info me-2"></i><span>Событие Defender ID ${ev.event_id}: ${escapeHtml(ev.category)}</span>`;
    }

    bodyEl.innerHTML = `
      <div class="row g-2 mb-3 small font-monospace">
        <div class="col-sm-6"><strong class="text-muted">Время:</strong> <span style="color: var(--text-color);">${escapeHtml(ev.timestamp)}</span></div>
        <div class="col-sm-6"><strong class="text-muted">Уровень:</strong> <span class="badge ${getSeverityClass(ev.level)}">${escapeHtml(ev.level || 'Info')}</span></div>
        <div class="col-sm-6"><strong class="text-muted">Event ID:</strong> <span class="fw-bold text-info">${ev.event_id}</span></div>
        <div class="col-sm-6"><strong class="text-muted">Категория:</strong> <span class="badge ${ev.badge || 'bg-secondary'}">${escapeHtml(ev.category)}</span></div>
        <div class="col-sm-12"><strong class="text-muted">Канал:</strong> <span class="text-warning">Microsoft-Windows-Windows Defender/Operational</span></div>
      </div>
      <div class="p-3 mb-3 rounded border" style="background: var(--surface-2); border-color: var(--border-color) !important;">
        <h6 class="small text-uppercase text-muted fw-bold mb-2">Описание события</h6>
        <div class="small font-monospace" style="white-space: pre-wrap; word-break: break-word; color: var(--text-color);">${escapeHtml(ev.message || 'Нет описания')}</div>
      </div>
      <div class="p-3 rounded border" style="background: var(--surface-2); border-color: var(--border-color) !important;">
        <h6 class="fw-bold text-primary mb-1"><i class="bi bi-shield-lock me-1"></i> Рекомендация безопасности</h6>
        <div class="small text-muted">
          ${ev.category_key === 'threats' ? '⚠️ Обнаружена угроза! Рекомендуется выполнить проверку карантина или запустить полное сканирование.' : (ev.category_key === 'cfa' ? '🔒 Блокировка доступа к защищенным папкам. Проверьте доверенные приложения в Controlled Folder Access.' : (ev.category_key === 'signatures' ? '📦 Статус баз антивирусных сигнатур Defender. Обновления применяются автоматически.' : '🛡️ Стандартное событие мониторинга и безопасности Microsoft Defender.'))}
        </div>
      </div>
    `;

    if (window.bootstrap && window.bootstrap.Modal) {
      const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  /**
   * Инициализация ползунков изменения высоты таблиц журнала и событий.
   */
  function initTableResizers() {
    function setupResizer(resizerId, containerId, defaultMaxHeight = 520, minH = 140, maxH = 1500) {
      const resizer = document.getElementById(resizerId);
      const container = document.getElementById(containerId);
      if (!resizer || !container || resizer._resizerBound) return;
      resizer._resizerBound = true;

      let startY = 0, startHeight = 0;
      const onMouseMove = (e) => {
        const delta = e.clientY - startY;
        const newH = Math.max(minH, Math.min(maxH, startHeight + delta));
        container.style.maxHeight = 'none';
        container.style.height = `${newH}px`;
      };
      const onMouseUp = () => {
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      resizer.onmousedown = (e) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = container.getBoundingClientRect().height || parseInt(window.getComputedStyle(container).height, 10) || defaultMaxHeight;
        resizer.classList.add('resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };
      resizer.ondblclick = () => {
        container.style.height = '';
        container.style.maxHeight = `${defaultMaxHeight}px`;
      };
    }

    setupResizer('el-table-resizer', 'el-table-container', 520, 140, 1500);
    setupResizer('slc-table-resizer', 'slc-table-container', 560, 140, 1500);
    setupResizer('scc-activity-table-resizer', 'scc-activity-table-container', 480, 140, 1500);
    setupResizer('pwr-sessions-table-resizer', 'pwr-sessions-table-container', 520, 140, 1500);
    setupResizer('pwr-events-table-resizer', 'pwr-events-table-container', 520, 140, 1500);
    setupResizer('def-events-table-resizer', 'def-events-table-container', 520, 140, 1500);
  }

  function setMode(mode) {
    currentMode = mode;
    const tableContainer = document.getElementById('slc-table-container');
    const auditContainer = document.getElementById('slc-audit-container');
    const ragContainer = document.getElementById('slc-rag-container');
    const incidentsContainer = document.getElementById('slc-incidents-container');
    const timelineContainer = document.getElementById('slc-timeline-container');
    const rawContainer = document.getElementById('slc-raw-container');
    const activityContainer = document.getElementById('slc-activity-container');
    const eventLogsContainer = document.getElementById('slc-event-logs-container');
    const powerLifecycleContainer = document.getElementById('slc-power-lifecycle-container');
    const defenderLogsContainer = document.getElementById('slc-defender-logs-container');
    const filterRow = document.getElementById('slc-filter-row');
    const sidebar = document.getElementById('slc-channel-tree-sidebar');
    const mainStreamCol = document.getElementById('slc-main-stream-column');
    const mainStreamHeader = document.querySelector('#slc-main-stream-column .slc-panel-header');

    if (tableContainer) tableContainer.classList.add('d-none');
    if (auditContainer) auditContainer.classList.add('d-none');
    if (ragContainer) ragContainer.classList.add('d-none');
    if (incidentsContainer) incidentsContainer.classList.add('d-none');
    if (timelineContainer) timelineContainer.classList.add('d-none');
    if (rawContainer) rawContainer.classList.add('d-none');
    if (activityContainer) activityContainer.classList.add('d-none');
    if (eventLogsContainer) eventLogsContainer.classList.add('d-none');
    if (powerLifecycleContainer) powerLifecycleContainer.classList.add('d-none');
    if (defenderLogsContainer) defenderLogsContainer.classList.add('d-none');
    if (filterRow) filterRow.classList.remove('d-none');

    // Управление шириной колонок и сайдбаром каналов
    if (mode === 'event-logs' || mode === 'power-lifecycle' || mode === 'defender-logs') {
      if (sidebar) sidebar.classList.add('d-none');
      if (mainStreamCol) {
        mainStreamCol.classList.remove('col-lg-9');
        mainStreamCol.classList.add('col-12');
      }
      if (mainStreamHeader) mainStreamHeader.classList.add('d-none');
    } else {
      if (sidebar) sidebar.classList.remove('d-none');
      if (mainStreamCol) {
        mainStreamCol.classList.remove('col-12');
        mainStreamCol.classList.add('col-lg-9');
      }
      if (mainStreamHeader) mainStreamHeader.classList.remove('d-none');
    }

    document.querySelectorAll('#slc-mode-tabs button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    if (mode === 'live' || mode === 'errors') {
      if (tableContainer) tableContainer.classList.remove('d-none');
      loadEvents();
    } else if (mode === 'audit') {
      if (auditContainer) auditContainer.classList.remove('d-none');
      loadAuditDigest();
    } else if (mode === 'rag') {
      if (ragContainer) ragContainer.classList.remove('d-none');
      if (filterRow) filterRow.classList.add('d-none');
      fetchRagStatus();
    } else if (mode === 'incidents') {
      if (incidentsContainer) incidentsContainer.classList.remove('d-none');
      loadIncidents();
    } else if (mode === 'timeline') {
      if (timelineContainer) timelineContainer.classList.remove('d-none');
      loadTimeline();
    } else if (mode === 'raw') {
      if (rawContainer) rawContainer.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.remove('d-none');
    } else if (mode === 'activity') {
      if (activityContainer) activityContainer.classList.remove('d-none');
      if (filterRow) filterRow.classList.add('d-none');
      loadSccActivityLogs();
    } else if (mode === 'event-logs') {
      if (eventLogsContainer) eventLogsContainer.classList.remove('d-none');
      if (filterRow) filterRow.classList.add('d-none');
      initEventLogsPanel();
      fetchEventLogsSummary();
    } else if (mode === 'power-lifecycle') {
      if (powerLifecycleContainer) powerLifecycleContainer.classList.remove('d-none');
      if (filterRow) filterRow.classList.add('d-none');
      initPowerLifecyclePanel();
      loadPowerData();
    } else if (mode === 'defender-logs') {
      if (defenderLogsContainer) defenderLogsContainer.classList.remove('d-none');
      if (filterRow) filterRow.classList.add('d-none');
      initDefenderLogsPanel();
      loadDefenderData();
    }
  }

  /**
   * Экспорт текущих событий.
   */
  function exportEvents(format = 'json') {
    if (!cachedEvents || cachedEvents.length === 0) {
      if (window.toast) {
        window.toast.warning(
          t('systemControl.btnExport', 'Экспорт'),
          t('systemControl.exportNoEvents', 'Нет загруженных событий для экспорта.')
        );
      }
      return;
    }
    let content = '';
    let mime = 'application/json';
    let ext = 'json';

    if (format === 'json') {
      content = JSON.stringify(cachedEvents, null, 2);
    } else {
      mime = 'text/csv';
      ext = 'csv';
      const headers = ['timestamp', 'level', 'event_id', 'provider', 'process_id', 'message'];
      const rows = cachedEvents.map(e => headers.map(h => `"${String(e[h] || '').replace(/"/g, '""')}"`).join(','));
      content = [headers.join(','), ...rows].join('\n');
    }

    const cleanChan = currentChannel.replace(/^evt:/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_logs_${cleanChan}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Инициализация вкладки System Logs & Activity Center.
   */
  function initSystemControlTab() {
    window.applyTranslations?.();
    if (window.isTabActive ? window.isTabActive('tab-system-control') : true) {
      fetchStatus();
      scanChannels();
      loadEvents();
    }

    if (window.registerTabPoller) {
      window.registerTabPoller('tab-system-control', loadEvents, 4000, { pollerId: 'tab-system-control_logs', immediate: true });
    }

    // Слушатель глобального изменения языка в приложении
    window.addEventListener('languageChanged', () => {
      window.applyTranslations?.();
      fetchStatus();
      if (cachedChannels.length > 0) {
        renderChannelTree(cachedChannels);
      }
      if (cachedEvents.length > 0) {
        renderEventsTable(cachedEvents);
      }
      if (currentMode === 'audit') loadAuditDigest();
      else if (currentMode === 'incidents') loadIncidents();
      else if (currentMode === 'timeline') loadTimeline();
      else if (currentMode === 'activity') loadSccActivityLogs();
      else if (currentMode === 'event-logs') fetchEventLogsSummary();
      else if (currentMode === 'power-lifecycle') loadPowerData();
      else if (currentMode === 'defender-logs') loadDefenderData();
    });

    initEventLogsPanel();
    initTableResizers();

    if (isSCCInitialized) return;
    isSCCInitialized = true;

    // Главная кнопка обновления шапки
    const refreshBtn = document.getElementById('btn-scc-refresh');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        fetchStatus();
        if (currentMode === 'event-logs') {
          fetchEventLogsSummary();
        } else if (currentMode === 'power-lifecycle') {
          loadPowerData();
        } else if (currentMode === 'defender-logs') {
          loadDefenderData();
        } else {
          loadEvents();
        }
      };
    }

    // Кнопка обновления потока логов
    const slcRefreshBtn = document.getElementById('btn-slc-refresh');
    if (slcRefreshBtn) {
      slcRefreshBtn.onclick = () => {
        if (currentMode === 'event-logs') {
          fetchEventLogsSummary();
        } else if (currentMode === 'power-lifecycle') {
          loadPowerData();
        } else if (currentMode === 'defender-logs') {
          loadDefenderData();
        } else {
          loadEvents();
        }
      };
    }

    // Кнопка сканирования источников
    const slcScanBtn = document.getElementById('btn-slc-scan');
    if (slcScanBtn) {
      slcScanBtn.onclick = () => {
        scanChannels(true);
      };
    }

    // Кнопка быстрого открытия встроенной панели журналов событий
    const openEventLogsBtn = document.getElementById('btn-scc-open-event-logs');
    if (openEventLogsBtn) {
      openEventLogsBtn.onclick = () => {
        setMode('event-logs');
      };
    }

    // Кнопка быстрого открытия встроенной панели жизненного цикла питания
    const openPowerLifecycleBtn = document.getElementById('btn-scc-open-power-lifecycle');
    if (openPowerLifecycleBtn) {
      openPowerLifecycleBtn.onclick = () => {
        setMode('power-lifecycle');
      };
    }

    // Кнопка быстрого открытия встроенной панели журналов Defender
    const openDefenderLogsBtn = document.getElementById('btn-scc-open-defender-logs');
    if (openDefenderLogsBtn) {
      openDefenderLogsBtn.onclick = () => {
        setMode('defender-logs');
      };
    }

    // Кнопка аудита
    const auditBtn = document.getElementById('btn-slc-audit');
    if (auditBtn) {
      auditBtn.onclick = () => {
        setMode('audit');
      };
    }

    // Авто-активация режима по хэшу/параметру
    if (location.hash.includes('power-lifecycle') || location.search.includes('power-lifecycle') || location.search.includes('panel=power-lifecycle')) {
      setMode('power-lifecycle');
    } else if (location.hash.includes('defender-logs') || location.search.includes('defender-logs') || location.search.includes('panel=defender-logs')) {
      setMode('defender-logs');
    } else if (location.hash.includes('event-logs') || location.search.includes('event-logs') || location.search.includes('panel=event-logs')) {
      setMode('event-logs');
    }

    // Фильтр каналов в дереве
    const channelFilterInput = document.getElementById('slc-channel-filter-input');
    if (channelFilterInput) {
      channelFilterInput.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = cachedChannels.filter(c => {
          const name = (c.channel_name || c.display_name || c.name || '').toLowerCase();
          const desc = (c.description || '').toLowerCase();
          return name.includes(query) || desc.includes(query);
        });
        renderChannelTree(filtered);
      };
    }

    // Переключение режимов работы (Live, Audit, RAG, Incidents, Timeline, Raw, Activity, Event Logs, Power Lifecycle)
    document.querySelectorAll('#slc-mode-tabs button').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode') || 'live';
        setMode(mode);
      };
    });

    // Фильтры потока
    const searchInput = document.getElementById('slc-search-input');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(loadEvents, 300);
      };
    }

    const hoursSelect = document.getElementById('slc-hours-select');
    if (hoursSelect) {
      hoursSelect.onchange = () => {
        const ragPeriodSelect = document.getElementById('slc-rag-period-select');
        if (ragPeriodSelect) {
          const opt = ragPeriodSelect.querySelector(`option[value="${hoursSelect.value}"]`);
          if (opt) {
            ragPeriodSelect.value = hoursSelect.value;
            updateRagPeriodDisplay(hoursSelect.value);
          }
        }
        loadEvents();
      };
    }

    // Селектор периода RAG (сутки / неделя / месяц / все время)
    const ragPeriodSelect = document.getElementById('slc-rag-period-select');
    if (ragPeriodSelect) {
      const savedPeriod = BrowserRagCache.get('selected_period');
      if (savedPeriod !== null && savedPeriod !== undefined) {
        ragPeriodSelect.value = String(savedPeriod);
      }
      updateRagPeriodDisplay(ragPeriodSelect.value);
      ragPeriodSelect.onchange = () => {
        updateRagPeriodDisplay(ragPeriodSelect.value);
        fetchRagStatus();
      };
    }

    const limitSelect = document.getElementById('slc-limit-select');
    if (limitSelect) limitSelect.onchange = loadEvents;

    const eventIdInput = document.getElementById('slc-eventid-input');
    if (eventIdInput) {
      let debounceTimer = null;
      eventIdInput.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(loadEvents, 300);
      };
    }

    // Live Auto-refresh switch
    const liveSwitch = document.getElementById('slc-live-switch');
    if (liveSwitch) {
      liveSwitch.onchange = (e) => {
        if (e.target.checked) {
          if (window.registerTabPoller) {
            window.registerTabPoller('tab-system-control', loadEvents, 3000, { pollerId: 'tab-system-control_live', immediate: true });
          } else {
            if (liveIntervalTimer) clearInterval(liveIntervalTimer);
            liveIntervalTimer = setInterval(loadEvents, 3000);
          }
        } else {
          if (window.unregisterTabPoller) {
            window.unregisterTabPoller('tab-system-control_live');
          }
          if (liveIntervalTimer) {
            clearInterval(liveIntervalTimer);
            liveIntervalTimer = null;
          }
        }
      };
    }

    // Экспорт событий
    const exportJson = document.getElementById('btn-slc-export-json');
    if (exportJson) {
      exportJson.onclick = (e) => {
        e.preventDefault();
        exportEvents('json');
      };
    }

    const exportCsv = document.getElementById('btn-slc-export-csv');
    if (exportCsv) {
      exportCsv.onclick = (e) => {
        e.preventDefault();
        exportEvents('csv');
      };
    }

    // RAG Search actions
    const ragSearchBtn = document.getElementById('btn-slc-rag-search');
    if (ragSearchBtn) ragSearchBtn.onclick = runRagSearch;

    const ragInput = document.getElementById('slc-rag-input');
    if (ragInput) {
      ragInput.onkeydown = (e) => {
        if (e.key === 'Enter') runRagSearch();
      };
    }

    const ragRebuildBtn = document.getElementById('btn-slc-rag-rebuild');
    if (ragRebuildBtn) ragRebuildBtn.onclick = rebuildRagIndex;

    const ragAggregateSwitch = document.getElementById('slc-rag-aggregate-switch');
    if (ragAggregateSwitch) {
      ragAggregateSwitch.onchange = () => {
        const rInput = document.getElementById('slc-rag-input');
        if (rInput && rInput.value.trim()) {
          runRagSearch();
        }
      };
    }

    // Быстрые подсказки запросов RAG
    document.querySelectorAll('.slc-rag-tag').forEach(tagBtn => {
      tagBtn.onclick = () => {
        const q = tagBtn.getAttribute('data-query');
        const rInput = document.getElementById('slc-rag-input');
        if (rInput && q) {
          rInput.value = q;
          runRagSearch();
        }
      };
    });

    // AI Ask Action
    const askAiBtn = document.getElementById('btn-slc-ask-ai');
    if (askAiBtn) {
      askAiBtn.onclick = () => {
        const topEvents = cachedEvents.slice(0, 10).map(e => `[${e.level}] ${e.provider}: ${e.message}`).join('\n');
        const cleanChan = currentChannel.replace(/^evt:/i, '');
        const prompt = `${t('systemControl.headerTitle', 'Windows System Logs')} (${cleanChan}):\n${topEvents}`;
        if (window.sendChatMessage) {
          window.sendChatMessage(prompt);
        } else if (window.toast) {
          window.toast.info(
            t('systemControl.aiToastTitle', 'ИИ Анализ'),
            t('systemControl.aiToastBody', 'Запрос направлен в чат-ассистент.')
          );
        }
      };
    }

    // Application activity refresh
    const refreshActivityBtn = document.getElementById('btn-scc-refresh-logs');
    if (refreshActivityBtn) refreshActivityBtn.onclick = loadSccActivityLogs;
  }

  // Экспорт для динамического загрузчика
  window.initSystemControlTab = initSystemControlTab;

  // Автостарт при готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemControlTab);
  } else {
    initSystemControlTab();
  }
})();
