/**
 * @file apps/windows/api/webgui/tab_defender_firewall/main.js
 * @description Корневой модуль-оркестратор центра безопасности Microsoft Defender & Firewall
 * @author hypo69
 * @version 2.1.0
 * Updated: 2026-10-28 14:53:00
 */

import { showAlert } from './common/ui_utils.js?v=20261028_v5';
import { loadDefenderStatus } from './panel_overview/panel.js?v=20261028_v5';
import { loadASRRules, loadCFA, bindCfaAddModal, resetAsrCfaCache } from './panel_asr_cfa/panel.js?v=20261028_v5';
import {
  loadExclusions,
  loadThreats,
  loadProcesses,
  loadEvents,
  resetThreatsEventsCache
} from './panel_threats_events/panel.js?v=20261028_v5';
import { loadDiagnostics, setupActions, resetDiagCache } from './panel_diag_tasks/panel.js?v=20261028_v5';
import {
  bindFirewallControls,
  initFirewallSubtab,
  isFirewallSubtabActive,
  fetchFirewallSummary,
  forceRefreshFirewall,
  renderFirewall
} from './panel_firewall/panel.js?v=20261028_v5';

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
 * Извлекает целевую субвкладку из URL hash (#tab-defender-firewall#firewall)
 * @returns {string|null} 'firewall' | 'defender' | null
 */
export function getDefenderSubTabFromHash() {
  if (typeof location === 'undefined' || !location.hash) return null;
  const parts = location.hash.replace(/^#/, '').split('#');
  if (parts[0] === 'tab-firewall-manager' || parts[0] === 'firewall-manager') {
    return 'firewall';
  }
  if (parts.length < 2) return null;
  const sub = parts[1].toLowerCase().trim();
  if (sub === 'firewall' || sub === 'subpane-firewall' || sub === 'fw') {
    return 'firewall';
  }
  if (sub === 'defender' || sub === 'subpane-defender') {
    return 'defender';
  }
  return null;
}

/**
 * Переключение между верхними субвкладками Защитника и Брандмауэра
 * @param {string} subtabName 'defender' | 'firewall'
 * @param {boolean} [updateUrl=true] Обновлять ли URL hash
 */
export function switchDefenderSubTab(subtabName, updateUrl = true) {
  const norm = String(subtabName || '').toLowerCase().trim();
  const isFirewall = norm === 'firewall' || norm === 'subpane-firewall' || norm === 'fw' || norm === '#subpane-firewall';
  const targetSub = isFirewall ? 'firewall' : 'defender';

  const fwBtn = document.getElementById('subtab-firewall-btn');
  const defBtn = document.getElementById('subtab-defender-btn');
  const fwPane = document.getElementById('subpane-firewall');
  const defPane = document.getElementById('subpane-defender');

  if (isFirewall) {
    if (fwBtn && window.bootstrap && window.bootstrap.Tab) {
      const tabInst = window.bootstrap.Tab.getInstance(fwBtn) || new window.bootstrap.Tab(fwBtn);
      tabInst.show();
    }
    if (defBtn) defBtn.classList.remove('active');
    if (fwBtn) fwBtn.classList.add('active');
    if (defPane) defPane.classList.remove('show', 'active');
    if (fwPane) fwPane.classList.add('show', 'active');
    initFirewallSubtab();
  } else {
    if (defBtn && window.bootstrap && window.bootstrap.Tab) {
      const tabInst = window.bootstrap.Tab.getInstance(defBtn) || new window.bootstrap.Tab(defBtn);
      tabInst.show();
    }
    if (fwBtn) fwBtn.classList.remove('active');
    if (defBtn) defBtn.classList.add('active');
    if (fwPane) fwPane.classList.remove('show', 'active');
    if (defPane) defPane.classList.add('show', 'active');
    refreshActiveDefenderTab(false);
  }

  if (updateUrl && typeof window.setPanelHash === 'function') {
    window.setPanelHash('tab-defender-firewall', targetSub);
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
      if (typeof window.setPanelHash === 'function') {
        window.setPanelHash('tab-defender-firewall', 'firewall');
      }
    });
    fwSubtabBtn.addEventListener('click', () => {
      switchDefenderSubTab('firewall');
    });
  }

  const defSubtabBtn = document.getElementById('subtab-defender-btn');
  if (defSubtabBtn && !defSubtabBtn._lazyBound) {
    defSubtabBtn._lazyBound = true;
    defSubtabBtn.addEventListener('shown.bs.tab', () => {
      refreshActiveDefenderTab(false);
      if (typeof window.setPanelHash === 'function') {
        window.setPanelHash('tab-defender-firewall', 'defender');
      }
    });
    defSubtabBtn.addEventListener('click', () => {
      switchDefenderSubTab('defender');
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
  bindFirewallControls();

  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    window.AISmartTooltip.initAll(document.getElementById('tab-defender-firewall') || document);
  }

  const hashSub = getDefenderSubTabFromHash();
  if (hashSub) {
    switchDefenderSubTab(hashSub, false);
  }

  const isActive = window.isTabActive ? (window.isTabActive('tab-defender-firewall') || window.isTabActive('tab-defender')) : true;
  if (isActive) {
    // Загружаем данные как для Defender, так и для Firewall, чтобы переключение было мгновенным
    fetchFirewallSummary();
    await refreshActiveDefenderTab();
  }
}

/**
 * Активация вкладки
 */
export async function activateDefenderFirewallTab() {
  console.log('[DefenderFirewallTab] Activating Defender & Firewall Security Center Tab...');
  bindSubtabListeners();
  bindFirewallControls();

  const hashSub = getDefenderSubTabFromHash();
  if (hashSub) {
    switchDefenderSubTab(hashSub, false);
  }

  if (isFirewallSubtabActive()) {
    await fetchFirewallSummary();
  } else {
    fetchFirewallSummary();
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
