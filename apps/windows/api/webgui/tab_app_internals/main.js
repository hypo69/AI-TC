/**
 * =============================================================================
 * Process Name: Windows App Internals Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Модульный клиентский оркестратор консолидированной панели «Внутренняя кухня».
 *   Координирует суб-панели телеметрии, моделей, логов, ETW-трассировки,
 *   системных настроек, сервера БД WikiLLM, базы инструментов агента,
 *   параметров модели и редактора статей базы знаний с синхронизацией URL hash
 *   (http://localhost:8001/tc#tab-app-internals#<panel_id>).
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_app_internals
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 15:25:00
 * =============================================================================
 */

import {
  initSubtabsPanel,
  switchAppInternalsSubTab,
  triggerSubTabInit,
} from './panel_subtabs/panel.js';
import {
  TAB_ID,
  isAppInternalsTabActive,
  normalizeSubTabId,
  getActiveSubTabId,
  getPanelFromHash,
  updateUrlWithPanel,
} from './common/ui_utils.js';
import {
  initWikiLLMSettingsPanel,
  bindWikiLLMButtons,
  loadWikiLLMSettings,
  initWikiLLMEditor,
} from './panel_wikillm_settings/panel.js';
import {
  initWikiLLMDbPanel,
  bindWikiLLMDbButtons,
  loadWikiLLMDbConfig,
} from './panel_wikillm_db/panel.js';
import {
  initInstrumentsDbPanel,
  bindInstrumentsDbButtons,
  loadInstrumentsDbConfig,
} from './panel_instruments_db/panel.js';

let isAppInternalsInitialized = false;

/**
 * Обновление данных и компонентов суб-вкладок баз данных и WikiLLM.
 * @returns {Promise<void>}
 */
export async function refreshWikiLLMSubtab() {
  bindWikiLLMDbButtons();
  await loadWikiLLMDbConfig();
  bindInstrumentsDbButtons();
  await loadInstrumentsDbConfig();
  bindWikiLLMButtons();
  await loadWikiLLMSettings();
  await initWikiLLMEditor();
}

/**
 * Главная инициализация вкладки «Внутренняя кухня».
 * @returns {Promise<void>}
 */
export async function initAppInternalsTab() {
  if (isAppInternalsInitialized) return;
  isAppInternalsInitialized = true;

  await Promise.allSettled([
    initSubtabsPanel(),
    initWikiLLMDbPanel(),
    initInstrumentsDbPanel(),
    initWikiLLMSettingsPanel(),
  ]);

  // Синхронизация суб-панели с URL hash (#tab-app-internals#<panel_id>)
  const panelFromHash = getPanelFromHash();
  if (panelFromHash) {
    switchAppInternalsSubTab(panelFromHash, false);
  } else {
    updateUrlWithPanel(getActiveSubTabId());
  }

  // Реакция на изменение hash в URL при активной вкладке
  window.addEventListener('hashchange', () => {
    if (!isAppInternalsTabActive()) return;
    const target = getPanelFromHash();
    if (target && target !== getActiveSubTabId()) {
      switchAppInternalsSubTab(target, false);
    }
  });

  // Событие активации вкладки в общем интерфейсе
  document.addEventListener('tab:activated', (e) => {
    if (e.detail?.tabId === TAB_ID || e.detail?.tabId === 'app-internals') {
      const target = getPanelFromHash();
      if (target) {
        switchAppInternalsSubTab(target, false);
      } else {
        updateUrlWithPanel(getActiveSubTabId());
      }
    }
  });
}

// Экспорт глобальных методов для внешней навигации и суб-вкладок
window.initAppInternalsTab = initAppInternalsTab;
window.switchAppInternalsSubTab = switchAppInternalsSubTab;
window.getActiveAppInternalsSubTabId = getActiveSubTabId;
window.getAppInternalsPanelFromHash = getPanelFromHash;
window.updateAppInternalsUrlWithPanel = updateUrlWithPanel;
window.normalizeAppInternalsSubTabId = normalizeSubTabId;
window.refreshWikiLLMSubtab = refreshWikiLLMSubtab;
window.bindWikiLLMDbButtons = bindWikiLLMDbButtons;
window.loadWikiLLMDbConfig = loadWikiLLMDbConfig;
window.bindInstrumentsDbButtons = bindInstrumentsDbButtons;
window.loadInstrumentsDbConfig = loadInstrumentsDbConfig;
window.bindWikiLLMButtons = bindWikiLLMButtons;
window.loadWikiLLMSettings = loadWikiLLMSettings;
window.initWikiLLMEditor = initWikiLLMEditor;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppInternalsTab);
} else {
  initAppInternalsTab();
}
