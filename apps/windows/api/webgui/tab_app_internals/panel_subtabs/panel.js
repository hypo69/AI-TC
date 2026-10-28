/**
 * =============================================================================
 * Process Name: Windows App Internals - Subtabs Navigation Panel
 * =============================================================================
 * Description:
 *   Модуль динамической загрузки, ленивой подгрузки и переключения
 *   встраиваемых суб-панелей вкладки «Внутренняя кухня» с синхронизацией URL hash
 *   (http://localhost:8001/tc#tab-app-internals#<panel_id>):
 *   1. Телеметрия (Telemetry Control)
 *   2. Модели и API (Models & Providers)
 *   3. Центр логов (Logs Center)
 *   4. Трассировка ETW (Performance Tracing)
 *   5. Параметры (Log Settings)
 *   6. БД WikiLLM (MariaDB / SQLite)
 *   7. База инструментов (AI Instruments)
 *   8. Параметры WikiLLM (Model & RAG Settings)
 *   9. Статьи WikiLLM (Knowledge Base Editor)
 *
 * File: panel.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_app_internals/panel_subtabs
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 15:25:00
 * =============================================================================
 */

import {
  loadScript,
  normalizeSubTabId,
  updateUrlWithPanel,
  getActiveSubTabId,
} from '../common/ui_utils.js';

/**
 * Загрузка разметки и скрипта конкретной суб-панели с вызовом хуков инициализации.
 * @param {string} containerId - ID DOM-контейнера суб-панели
 * @param {string} htmlUrl - URL разметки HTML
 * @param {string} jsUrl - URL управляющего JS скрипта
 * @param {string} [initFnName] - Глобальное имя функции инициализации
 * @param {string} [activateFnName] - Глобальное имя функции активации/обновления
 * @returns {Promise<void>}
 */
export async function loadSubPane(containerId, htmlUrl, jsUrl, initFnName, activateFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!container.hasChildNodes()) {
    try {
      const res = await fetch(`${htmlUrl}?v=${Date.now()}`);
      if (!res.ok) {
        container.innerHTML = `
          <div class="alert alert-warning m-3">
            <i class="bi bi-exclamation-triangle me-2"></i>Не удалось загрузить компонент (${res.status}).
          </div>`;
        return;
      }
      container.innerHTML = await res.text();
    } catch (err) {
      console.warn(`[AppInternals] Ошибка загрузки HTML для ${containerId}:`, err);
      container.innerHTML = `
        <div class="alert alert-danger m-3">
          <i class="bi bi-x-circle me-2"></i>Ошибка загрузки разметки: ${err.message}
        </div>`;
      return;
    }
  }

  if (jsUrl) {
    try {
      await loadScript(`${jsUrl}?v=${Date.now()}`);
      if (initFnName && typeof window[initFnName] === 'function') {
        try {
          const maybePromise = window[initFnName]();
          if (maybePromise && typeof maybePromise.catch === 'function') {
            await maybePromise;
          }
        } catch (err) {
          console.debug(`[AppInternals] ${initFnName} error:`, err);
        }
      }
      if (activateFnName && typeof window[activateFnName] === 'function') {
        try {
          const maybePromise = window[activateFnName]();
          if (maybePromise && typeof maybePromise.catch === 'function') {
            await maybePromise;
          }
        } catch (err) {
          console.debug(`[AppInternals] ${activateFnName} error:`, err);
        }
      }
    } catch (err) {
      console.warn(`[AppInternals] Ошибка инициализации скрипта для ${containerId}:`, err);
    }
  }
}

/**
 * Конвейерная загрузка всех 5 внешних суб-панелей:
 * Первая (активная) загружается немедленно, остальные подгружаются параллельно.
 * @returns {Promise<void>}
 */
export async function loadSubPanes() {
  // 1. Немедленная загрузка активной суб-панели (Телеметрия)
  await loadSubPane(
    'internals-telemetry-embed-container',
    '/html/tab_telemetry_control/index.html',
    '/html/tab_telemetry_control/main.js',
    'initTelemetryControlTab'
  );

  // 2. Параллельная подгрузка остальных суб-панелей
  await Promise.allSettled([
    loadSubPane(
      'internals-models-embed-container',
      '/html/tab_models/index.html',
      '/html/tab_models/main.js',
      'initModelsTab'
    ),
    loadSubPane(
      'internals-logs-embed-container',
      '/html/tab_app_logs/index.html',
      '/html/tab_app_logs/main.js',
      'initAppLogsTab',
      'activateAppLogsTab'
    ),
    loadSubPane(
      'internals-etw-embed-container',
      '/html/tab_performance_tracing/index.html',
      '/html/tab_performance_tracing/main.js',
      'initPerformanceTracingTab',
      'fetchPerformanceSummary'
    ),
    loadSubPane(
      'internals-settings-embed-container',
      '/html/tab_log_settings/index.html',
      '/html/tab_log_settings/main.js',
      'initLogSettingsTab',
      'fetchDomainsSummary'
    ),
  ]);
}

/**
 * Вызов обновления данных и хуков для конкретной суб-панели.
 * @param {string} subtabName - Имя субпанели ('telemetry', 'models', 'logs', 'etw', 'settings', 'wikillm-db', 'instruments', 'wikillm-params', 'wikillm-editor')
 * @returns {Promise<void>}
 */
export async function triggerSubTabInit(subtabName) {
  const canonical = normalizeSubTabId(subtabName);
  if (canonical === 'telemetry') {
    await loadSubPane(
      'internals-telemetry-embed-container',
      '/html/tab_telemetry_control/index.html',
      '/html/tab_telemetry_control/main.js',
      'initTelemetryControlTab'
    );
    if (typeof window.initTelemetryControlTab === 'function') window.initTelemetryControlTab();
  } else if (canonical === 'models') {
    await loadSubPane(
      'internals-models-embed-container',
      '/html/tab_models/index.html',
      '/html/tab_models/main.js',
      'initModelsTab'
    );
    if (typeof window.initModelsTab === 'function') window.initModelsTab();
  } else if (canonical === 'logs') {
    await loadSubPane(
      'internals-logs-embed-container',
      '/html/tab_app_logs/index.html',
      '/html/tab_app_logs/main.js',
      'initAppLogsTab',
      'activateAppLogsTab'
    );
    if (typeof window.initAppLogsTab === 'function') window.initAppLogsTab();
    if (typeof window.activateAppLogsTab === 'function') window.activateAppLogsTab();
    window.APP_LOG_URL = '/api/v1/internals/logs/app.log';
  } else if (canonical === 'etw') {
    await loadSubPane(
      'internals-etw-embed-container',
      '/html/tab_performance_tracing/index.html',
      '/html/tab_performance_tracing/main.js',
      'initPerformanceTracingTab',
      'fetchPerformanceSummary'
    );
    if (typeof window.initPerformanceTracingTab === 'function') window.initPerformanceTracingTab();
    if (typeof window.fetchPerformanceSummary === 'function') window.fetchPerformanceSummary();
  } else if (canonical === 'settings') {
    await loadSubPane(
      'internals-settings-embed-container',
      '/html/tab_log_settings/index.html',
      '/html/tab_log_settings/main.js',
      'initLogSettingsTab',
      'fetchDomainsSummary'
    );
    if (typeof window.initLogSettingsTab === 'function') window.initLogSettingsTab();
    if (typeof window.fetchDomainsSummary === 'function') window.fetchDomainsSummary();
  } else if (canonical === 'wikillm-db') {
    if (typeof window.bindWikiLLMDbButtons === 'function') window.bindWikiLLMDbButtons();
    if (typeof window.loadWikiLLMDbConfig === 'function') window.loadWikiLLMDbConfig();
  } else if (canonical === 'instruments') {
    if (typeof window.bindInstrumentsDbButtons === 'function') window.bindInstrumentsDbButtons();
    if (typeof window.loadInstrumentsDbConfig === 'function') window.loadInstrumentsDbConfig();
  } else if (canonical === 'wikillm-params') {
    if (typeof window.bindWikiLLMButtons === 'function') window.bindWikiLLMButtons();
    if (typeof window.loadWikiLLMSettings === 'function') window.loadWikiLLMSettings();
  } else if (canonical === 'wikillm-editor') {
    if (typeof window.initWikiLLMEditor === 'function') window.initWikiLLMEditor();
  }
}

/**
 * Программное переключение на нужную суб-панель с обновлением URL hash (#tab-app-internals#<panel_id>).
 * @param {string} subtabName - Имя субпанели
 * @param {boolean} [updateUrl=true] - Обновлять ли URL hash
 */
export function switchAppInternalsSubTab(subtabName, updateUrl = true) {
  const canonical = normalizeSubTabId(subtabName);
  let btnId = 'subtab-internals-telemetry-btn';
  if (canonical === 'models') btnId = 'subtab-internals-models-btn';
  else if (canonical === 'logs') btnId = 'subtab-internals-logs-btn';
  else if (canonical === 'etw') btnId = 'subtab-internals-etw-btn';
  else if (canonical === 'settings') btnId = 'subtab-internals-settings-btn';
  else if (canonical === 'wikillm-db') btnId = 'subtab-internals-wikillm-db-btn';
  else if (canonical === 'instruments') btnId = 'subtab-internals-instruments-btn';
  else if (canonical === 'wikillm-params') btnId = 'subtab-internals-wikillm-params-btn';
  else if (canonical === 'wikillm-editor') btnId = 'subtab-internals-wikillm-editor-btn';

  const btn = document.getElementById(btnId);
  if (btn) {
    if (window.bootstrap && window.bootstrap.Tab) {
      const tabInst = window.bootstrap.Tab.getInstance(btn) || new window.bootstrap.Tab(btn);
      tabInst.show();
    } else {
      btn.click();
    }
  }

  triggerSubTabInit(canonical);

  if (updateUrl) {
    updateUrlWithPanel(canonical);
  }
}

/**
 * Подключение слушателей навигации по кнопкам суб-вкладок.
 */
export function setupSubTabNavigation() {
  const navContainer = document.getElementById('app-internals-subtabs-nav');
  if (navContainer && !navContainer.dataset.subnavBound) {
    navContainer.dataset.subnavBound = 'true';
    navContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-bs-toggle="pill"]');
      if (!btn) return;
      const pId = btn.getAttribute('data-panel-id');
      const target = btn.getAttribute('data-bs-target') || '';
      const canonical = normalizeSubTabId(pId || target);
      switchAppInternalsSubTab(canonical, true);
    });
  }
}

/**
 * Инициализация модуля навигации по суб-вкладкам.
 * @returns {Promise<void>}
 */
export async function initSubtabsPanel() {
  setupSubTabNavigation();
  window.switchAppInternalsSubTab = switchAppInternalsSubTab;
  await loadSubPanes();
}
