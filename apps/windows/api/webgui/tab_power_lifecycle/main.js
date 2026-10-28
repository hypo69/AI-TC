/**
 * =============================================================================
 * Process Name: Windows Power Lifecycle Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский контроллер-оркестратор вкладки жизненного цикла питания (Power Lifecycle).
 *   Координирует загрузку сессий, аптайм, пересканирование Event Log (1074, 41, 6008).
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_power_lifecycle
 * Updated: 2026-10-17 01:55:00
 * =============================================================================
 */

import { renderSummary, startUptimeCounter } from './panel_summary/panel.js';
import {
  setAllSessions,
  filterAndRenderSessions
} from './panel_sessions/panel.js';
import {
  setAllEvents,
  filterAndRenderEvents
} from './panel_events/panel.js';

/**
 * Загружает сводку, сессии и события через API.
 */
export async function loadPowerData() {
  try {
    const sumRes = await fetch('/api/v1/power/summary');
    if (sumRes.ok) {
      const summary = await sumRes.json();
      renderSummary(summary);
    }

    const sessRes = await fetch('/api/v1/power/sessions?limit=100');
    if (sessRes.ok) {
      const sessions = await sessRes.json();
      setAllSessions(sessions);
      filterAndRenderSessions();
    }

    const evRes = await fetch('/api/v1/power/events?limit=200');
    if (evRes.ok) {
      const events = await evRes.json();
      setAllEvents(events);
      filterAndRenderEvents();
    }
  } catch (err) {
    console.error('[PowerLifecycle] Ошибка загрузки данных:', err);
  }
}

/**
 * Устанавливает слушатели событий элементов управления.
 */
function setupEventListeners() {
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
        renderSummary(data);
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

  document.getElementById('pwr-sessions-search')?.addEventListener('input', () => filterAndRenderSessions());
  document.getElementById('pwr-filter-type')?.addEventListener('change', () => filterAndRenderSessions());
  document.getElementById('pwr-filter-unexpected-only')?.addEventListener('change', () => filterAndRenderSessions());

  document.getElementById('pwr-events-search')?.addEventListener('input', () => filterAndRenderEvents());
  document.getElementById('pwr-event-id-filter')?.addEventListener('change', () => filterAndRenderEvents());
}

/**
 * Инициализирует вкладку жизненного цикла питания.
 */
export async function initPowerLifecycleTab() {
  setupEventListeners();
  await loadPowerData();
  startUptimeCounter();
}

window.initPowerLifecycleTab = initPowerLifecycleTab;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPowerLifecycleTab);
} else {
  initPowerLifecycleTab();
}
