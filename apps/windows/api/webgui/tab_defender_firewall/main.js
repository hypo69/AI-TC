/**
 * @file apps/windows/api/webgui/tab_defender_firewall/main.js
 * @description Корневой модуль-оркестратор центра безопасности Microsoft Defender & Firewall
 * @author hypo69
 * @version 2.0.0
 * Updated: 2026-10-17 01:29:00
 */

import { showAlert } from './common/ui_utils.js';
import { loadDefenderStatus } from './panel_overview/panel.js';
import { loadASRRules, loadCFA, bindCfaAddModal, resetAsrCfaCache } from './panel_asr_cfa/panel.js';
import {
  loadExclusions,
  loadThreats,
  loadProcesses,
  loadEvents,
  resetThreatsEventsCache
} from './panel_threats_events/panel.js';
import { loadDiagnostics, setupActions, resetDiagCache } from './panel_diag_tasks/panel.js';
import {
  initFirewallSubtab,
  isFirewallSubtabActive,
  fetchFirewallSummary,
  forceRefreshFirewall,
  renderFirewall
} from './panel_firewall/panel.js';

let isDefenderInitialized = false;
let isRefreshingDefender = false;

/**
 * Комплексное обновление данных активной суб-вкладки Защитника
 * @param {boolean} force Принудительное обновление без кеша
 */
export async function refreshActiveDefenderTab(force = false) {
  if (isRefreshingDefender) return;
  isRefreshingDefender = true;
  try {
    if (force) {
      resetAsrCfaCache();
      resetThreatsEventsCache();
      resetDiagCache();
    }

    // 1. Быстрый статус и сводные карточки (Overview, Score, Exclusions count, Threats count)
    await Promise.all([
      loadDefenderStatus(),
      loadDiagnostics(force),
      loadExclusions(force),
      loadThreats(force),
    ]);

    // 2. Ленивая загрузка детальных данных только для открытой суб-вкладки
    const activeSubpane = document.querySelector('#defTabPanes > .tab-pane.active');
    if (activeSubpane) {
      const activeId = activeSubpane.id;
      if (activeId === 'def-pane-asr') await loadASRRules(force);
      else if (activeId === 'def-pane-cfa') await loadCFA(force);
      else if (activeId === 'def-pane-procs') await loadProcesses(force);
      else if (activeId === 'def-pane-events') await loadEvents(force);
    }
  } finally {
    isRefreshingDefender = false;
  }
}

/**
 * Переключение между верхними субвкладками Защитника и Брандмауэра
 * @param {string} subtabName 'defender' | 'firewall'
 */
export function switchDefenderSubTab(subtabName) {
  if (subtabName === 'firewall') {
    const btn = document.getElementById('subtab-firewall-btn');
    if (btn && window.bootstrap && window.bootstrap.Tab) {
      new window.bootstrap.Tab(btn).show();
    }
    initFirewallSubtab();
  } else {
    const btn = document.getElementById('subtab-defender-btn');
    if (btn && window.bootstrap && window.bootstrap.Tab) {
      new window.bootstrap.Tab(btn).show();
    }
  }
}

/**
 * Привязка слушателей ленивой подгрузки субвкладок
 */
function bindSubtabListeners() {
  const defSubTabs = document.getElementById('defSubTabs');
  if (defSubTabs && !defSubTabs._lazyBound) {
    defSubTabs._lazyBound = true;
    defSubTabs.addEventListener('shown.bs.tab', (e) => {
      const targetId = e.target?.getAttribute('data-bs-target') || '';
      if (targetId === '#def-pane-asr') loadASRRules(false);
      else if (targetId === '#def-pane-cfa') loadCFA(false);
      else if (targetId === '#def-pane-exclusions') loadExclusions(false);
      else if (targetId === '#def-pane-threats') loadThreats(false);
      else if (targetId === '#def-pane-procs') loadProcesses(false);
      else if (targetId === '#def-pane-events') loadEvents(false);
      else if (targetId === '#def-pane-diag') loadDiagnostics(false);
    });
  }

  const fwSubtabBtn = document.getElementById('subtab-firewall-btn');
  if (fwSubtabBtn && !fwSubtabBtn._lazyBound) {
    fwSubtabBtn._lazyBound = true;
    fwSubtabBtn.addEventListener('shown.bs.tab', () => {
      initFirewallSubtab();
    });
  }

  const btnRefresh = document.getElementById('btn-def-refresh');
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      showAlert('Обновление данных Defender...');
      await refreshActiveDefenderTab(true);
    };
  }
}

/**
 * Инициализация вкладки Defender & Firewall
 */
export async function initDefenderFirewallTab() {
  if (isDefenderInitialized) return;
  isDefenderInitialized = true;
  console.log('[DefenderFirewallTab] Initializing Defender & Firewall Security Center Tab...');

  setupActions(() => refreshActiveDefenderTab(true));
  bindCfaAddModal();
  bindSubtabListeners();

  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    window.AISmartTooltip.initAll(document.getElementById('tab-defender-firewall') || document);
  }

  const isActive = window.isTabActive ? (window.isTabActive('tab-defender-firewall') || window.isTabActive('tab-defender')) : true;
  if (isActive) {
    if (isFirewallSubtabActive()) {
      await fetchFirewallSummary();
    } else {
      await refreshActiveDefenderTab();
    }
  }
}

/**
 * Активация вкладки
 */
export async function activateDefenderFirewallTab() {
  console.log('[DefenderFirewallTab] Activating Defender & Firewall Security Center Tab...');
  if (isFirewallSubtabActive()) {
    await fetchFirewallSummary();
  } else {
    await refreshActiveDefenderTab();
  }
}

// Экспорт глобальных функций в window
window.initDefenderFirewallTab = initDefenderFirewallTab;
window.activateDefenderFirewallTab = activateDefenderFirewallTab;
window.initDefenderTab = initDefenderFirewallTab;
window.activateDefenderTab = activateDefenderFirewallTab;
window.initFirewallManagerTab = initFirewallSubtab;
window.fetchFirewallSummary = fetchFirewallSummary;
window.forceRefreshFirewall = forceRefreshFirewall;
window.renderFirewall = renderFirewall;
window.refreshAll = refreshActiveDefenderTab;
window.switchDefenderSubTab = switchDefenderSubTab;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('def-shields-tbody')) {
      window.initDefenderFirewallTab();
    }
  });
} else {
  if (document.getElementById('def-shields-tbody')) {
    window.initDefenderFirewallTab();
  }
}
