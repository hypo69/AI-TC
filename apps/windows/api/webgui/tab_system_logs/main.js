/**
 * =============================================================================
 * Название: Центр системных журналов Windows - Главный оркестратор
 * =============================================================================
 * Описание:
 *   Точка входа и диспетчер режимов вкладки tab_system_logs.
 *   Координирует сканирование каналов, фильтрацию потока событий,
 *   аудит аномалий, RAG-поиск, временную шкалу и экспорт журналов.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/main.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml } from './common/ui_utils.js';
import {
  getCurrentChannel,
  getCurrentFilePath,
  setCurrentChannel,
  performSystemScan,
  renderChannelsTree
} from './panel_channels/panel.js';
import {
  loadEvents,
  renderTableEvents,
  getCachedEvents
} from './panel_events_stream/panel.js';
import {
  showEventModal,
  getSelectedEvent,
  setSelectedEvent
} from './panel_details_modal/panel.js';
import { loadAuditView } from './panel_audit_digest/panel.js';
import { loadTimelineView } from './panel_timeline/panel.js';
import { loadIncidentsView } from './panel_incidents/panel.js';
import { performRAGSearch, rebuildRAGIndex } from './panel_rag/panel.js';

let isInitialized = false;
let currentMode = 'live';
let liveIntervalTimer = null;

// Экспорт глобальных функций для вызова из хост-контейнера
window.initSystemLogsTab = initSystemLogsTab;
window.activateSystemLogsTab = () => {
  performSystemScan().then(() => loadEvents(false, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView));
};

/**
 * Переключает отображение контейнеров в соответствии с выбранным режимом.
 */
export function renderCurrentModeView() {
  const tableContainer = document.getElementById('slc-table-container');
  const incidentsContainer = document.getElementById('slc-incidents-container');
  const timelineContainer = document.getElementById('slc-timeline-container');
  const rawContainer = document.getElementById('slc-raw-container');
  const auditContainer = document.getElementById('slc-audit-container');
  const ragContainer = document.getElementById('slc-rag-container');
  const viewTitle = document.getElementById('slc-main-view-title');

  const channel = getCurrentChannel();
  const filePath = getCurrentFilePath();
  const cachedEvents = getCachedEvents();
  const selectedEvent = getSelectedEvent();

  // Сброс видимости всех контейнеров
  if (tableContainer) tableContainer.classList.add('d-none');
  if (incidentsContainer) incidentsContainer.classList.add('d-none');
  if (timelineContainer) timelineContainer.classList.add('d-none');
  if (rawContainer) rawContainer.classList.add('d-none');
  if (auditContainer) auditContainer.classList.add('d-none');
  if (ragContainer) ragContainer.classList.add('d-none');

  if (currentMode === 'audit') {
    if (viewTitle) viewTitle.innerHTML = `<i class="bi bi-shield-check text-info me-2"></i>Интеллектуальный Аудит Логирования (Zero-LLM Overhead)`;
    if (auditContainer) {
      auditContainer.classList.remove('d-none');
      loadAuditView(channel, filePath);
    }
  } else if (currentMode === 'rag') {
    if (viewTitle) viewTitle.innerHTML = `<i class="bi bi-brain text-info me-2"></i>Динамический RAG-поиск по логам`;
    if (ragContainer) ragContainer.classList.remove('d-none');
  } else if (currentMode === 'incidents') {
    if (viewTitle) viewTitle.innerHTML = `<i class="bi bi-diagram-3 me-2"></i>Каскады связанных инцидентов`;
    if (incidentsContainer) {
      incidentsContainer.classList.remove('d-none');
      loadIncidentsView();
    }
  } else if (currentMode === 'timeline') {
    if (viewTitle) viewTitle.innerHTML = `<i class="bi bi-bar-chart me-2"></i>Временной график активности логов`;
    if (timelineContainer) {
      timelineContainer.classList.remove('d-none');
      loadTimelineView(channel, filePath, (ev) => {
        setSelectedEvent(ev);
        showEventModal(ev, channel);
      });
    }
  } else if (currentMode === 'raw') {
    if (viewTitle) viewTitle.innerHTML = `<i class="bi bi-code-square me-2"></i>Сырые данные структуры событий`;
    if (rawContainer) {
      rawContainer.classList.remove('d-none');
      const rawText = document.getElementById('slc-raw-text');
      if (rawText) {
        rawText.textContent = selectedEvent
          ? (selectedEvent.raw_data || JSON.stringify(selectedEvent, null, 2))
          : JSON.stringify(cachedEvents.slice(0, 10), null, 2);
      }
    }
  } else {
    // Режимы таблицы Live Events или Errors Only
    if (tableContainer) tableContainer.classList.remove('d-none');
    if (viewTitle) {
      viewTitle.innerHTML = currentMode === 'errors'
        ? `<i class="bi bi-exclamation-octagon text-danger me-2"></i>Критические ошибки (${escapeHtml(channel)})`
        : `<i class="bi bi-list-columns-reverse me-2"></i>Поток событий в реальном времени (${escapeHtml(channel)})`;
    }

    let entriesToRender = cachedEvents;
    if (currentMode === 'errors') {
      entriesToRender = cachedEvents.filter((e) => {
        const l = (e.level || '').toLowerCase();
        return l.includes('err') || l.includes('crit') || l.includes('warn');
      });
    }

    renderTableEvents(entriesToRender, selectedEvent, (ev) => {
      setSelectedEvent(ev);
      showEventModal(ev, channel);
    });
  }
}

/**
 * Экспортирует события текущего журнала в файл JSON или CSV.
 * @param {string} format - Формат экспорта ('json' или 'csv').
 */
export function exportLogs(format) {
  const level = (document.getElementById('slc-level-select') || {}).value || '';
  const search = (document.getElementById('slc-search-input') || {}).value || '';
  const limit = (document.getElementById('slc-limit-select') || {}).value || '200';
  const hours = (document.getElementById('slc-hours-select') || {}).value || '24';
  const channel = getCurrentChannel();

  const url = `/api/v1/system_logs/export?format=${format}&channel=${encodeURIComponent(channel)}&level=${encodeURIComponent(level)}&search=${encodeURIComponent(search)}&hours=${hours}&limit=${limit}`;
  window.open(url, '_blank');
}

/**
 * Инициализирует вкладку системных журналов.
 */
export function initSystemLogsTab() {
  if (isInitialized) return;
  isInitialized = true;

  renderChannelsTree((channel, filePath) => {
    loadEvents(false, channel, filePath, renderCurrentModeView);
  });

  performSystemScan().then(() => {
    loadEvents(false, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  });

  const scanBtn = document.getElementById('btn-slc-scan');
  if (scanBtn) {
    scanBtn.onclick = () => performSystemScan(true);
  }

  const refreshBtn = document.getElementById('btn-slc-refresh');
  if (refreshBtn) {
    refreshBtn.onclick = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  const panelRefreshBtn = document.getElementById('btn-slc-panel-refresh');
  if (panelRefreshBtn) {
    panelRefreshBtn.onclick = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  const jsonExportBtn = document.getElementById('btn-slc-export-json');
  if (jsonExportBtn) {
    jsonExportBtn.onclick = (e) => {
      e.preventDefault();
      exportLogs('json');
    };
  }

  const csvExportBtn = document.getElementById('btn-slc-export-csv');
  if (csvExportBtn) {
    csvExportBtn.onclick = (e) => {
      e.preventDefault();
      exportLogs('csv');
    };
  }

  const modeTabs = document.querySelectorAll('#slc-mode-tabs .nav-link');
  modeTabs.forEach((tab) => {
    tab.onclick = () => {
      modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode') || 'live';
      renderCurrentModeView();
    };
  });

  const auditBtn = document.getElementById('btn-slc-audit');
  if (auditBtn) {
    auditBtn.onclick = () => {
      modeTabs.forEach(t => {
        if (t.getAttribute('data-mode') === 'audit') {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      currentMode = 'audit';
      renderCurrentModeView();
    };
  }

  const ragSearchBtn = document.getElementById('btn-slc-rag-search');
  if (ragSearchBtn) {
    ragSearchBtn.onclick = () => performRAGSearch(getCurrentChannel());
  }

  const ragRebuildBtn = document.getElementById('btn-slc-rag-rebuild');
  if (ragRebuildBtn) {
    ragRebuildBtn.onclick = () => rebuildRAGIndex(getCurrentChannel(), getCurrentFilePath());
  }

  const ragInput = document.getElementById('slc-rag-input');
  if (ragInput) {
    ragInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performRAGSearch(getCurrentChannel());
      }
    };
  }

  const askAiBtn = document.getElementById('btn-slc-ask-ai');
  if (askAiBtn) {
    askAiBtn.onclick = () => {
      const selected = getSelectedEvent();
      const events = getCachedEvents();
      if (selected) {
        showEventModal(selected, getCurrentChannel());
      } else if (events.length > 0) {
        showEventModal(events[0], getCurrentChannel());
      }
    };
  }

  const levelSelect = document.getElementById('slc-level-select');
  if (levelSelect) {
    levelSelect.onchange = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  const hoursSelect = document.getElementById('slc-hours-select');
  if (hoursSelect) {
    hoursSelect.onchange = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  const limitSelect = document.getElementById('slc-limit-select');
  if (limitSelect) {
    limitSelect.onchange = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  const eventIdInput = document.getElementById('slc-eventid-input');
  if (eventIdInput) {
    eventIdInput.onchange = () => loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
  }

  let searchTimer = null;
  const searchInput = document.getElementById('slc-search-input');
  if (searchInput) {
    searchInput.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadEvents(true, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
      }, 350);
    };
  }

  const channelFilterInput = document.getElementById('slc-channel-filter-input');
  if (channelFilterInput) {
    channelFilterInput.oninput = () => {
      renderChannelsTree((channel, filePath) => {
        loadEvents(false, channel, filePath, renderCurrentModeView);
      });
    };
  }

  const liveSwitch = document.getElementById('slc-live-switch');
  if (liveSwitch) {
    liveSwitch.onchange = () => {
      const pollFn = () => loadEvents(false, getCurrentChannel(), getCurrentFilePath(), renderCurrentModeView);
      if (window.registerTabPoller && window.unregisterTabPoller) {
        if (liveSwitch.checked) {
          window.registerTabPoller('tab-system-logs', pollFn, 4000, { pollerId: 'tab-system-logs_live', immediate: true });
        } else {
          window.unregisterTabPoller('tab-system-logs_live');
        }
      } else {
        if (liveSwitch.checked) {
          liveIntervalTimer = setInterval(pollFn, 4000);
        } else {
          clearInterval(liveIntervalTimer);
          liveIntervalTimer = null;
        }
      }
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystemLogsTab);
} else {
  initSystemLogsTab();
}
