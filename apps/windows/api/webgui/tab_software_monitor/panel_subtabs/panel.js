/**
 * =============================================================================
 * Process Name: Windows Software Monitor - Subtabs Navigation Panel
 * =============================================================================
 * Description:
 *   Модуль координации и ленивой подгрузки разделов хаба ПО:
 *   инвентарь, пакеты WinGet, пакеты MSI, Microsoft Store, Ninite, спящие программы,
 *   автозапуск, ИИ-аудит, ресурсоемкие процессы и сетевые сокеты.
 *
 * File: panel_subtabs/panel.js
 * Project: ai-windows-admin
 * Package: apps/windows/api/webgui/tab_software_monitor/panel_subtabs
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 15:50:00
 * =============================================================================
 */

import { loadSubPane } from '../common/ui_utils.js';
import { initDormantScanner } from '../panel_dormant/panel.js';
import { initHeavyResourcesPanel } from '../panel_heavy/panel.js';
import { initSocketsConfigPanel } from '../panel_sockets/panel.js';
import { initStorePackagesPanel } from '../panel_store/panel.js';
import { initWingetPackagesPanel } from '../panel_winget/panel.js';
import { initMsiPackagesPanel } from '../panel_msi/panel.js';

let _lastTriggerTab = '';
let _lastTriggerTime = 0;

/**
 * Инициализирует конкретную субпанель по ее названию.
 * @param {string} subtabName - Название субпанели.
 */
export async function triggerSubTabInit(subtabName) {
  const now = Date.now();
  if (_lastTriggerTab === subtabName && (now - _lastTriggerTime) < 300) {
    return;
  }
  _lastTriggerTab = subtabName;
  _lastTriggerTime = now;
  if (subtabName === 'inventory' || subtabName === 'audit') {
    await loadSubPane(
      'sw-inventory-embed-container',
      '/html/tab_software_audit/index.html',
      '/html/tab_software_audit/main.js',
      'initSoftwareAuditTab'
    );
  } else if (subtabName === 'packages' || subtabName === 'winget' || subtabName === 'manager') {
    await initWingetPackagesPanel();
  } else if (subtabName === 'msi') {
    await initMsiPackagesPanel();
  } else if (subtabName === 'store' || subtabName === 'msstore' || subtabName === 'microsoft-store') {
    await initStorePackagesPanel();
  } else if (subtabName === 'ninite') {
    await loadSubPane(
      'sw-ninite-embed-container',
      '/html/tab_ninite_updater/index.html',
      '/html/tab_ninite_updater/main.js',
      'initNiniteUpdaterTab'
    );
  } else if (subtabName === 'dormant' || subtabName === 'orphans') {
    initDormantScanner();
  } else if (subtabName === 'startup' || subtabName === 'startup-auditor' || subtabName === 'startup_auditor') {
    await loadSubPane(
      'sw-startup-embed-container',
      '/html/tab_startup_auditor/index.html',
      '/html/tab_startup_auditor/main.js',
      'initStartupAuditorTab'
    );
  } else if (subtabName === 'transparency') {
    await loadSubPane(
      'sw-transparency-embed-container',
      '/html/tab_software_transparency/index.html',
      '/html/tab_software_transparency/main.js',
      'initSoftwareTransparencyTab'
    );
  } else if (subtabName === 'heavy' || subtabName === 'resources') {
    initHeavyResourcesPanel();
  } else if (subtabName === 'sockets' || subtabName === 'ports') {
    initSocketsConfigPanel();
  }

  // Реинициализация тултипов при подгрузке содержимого субвкладок
  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    setTimeout(() => {
      const rootEl = document.getElementById('software-monitor-container') ||
                     document.getElementById('software-scanner-container') ||
                     document;
      window.AISmartTooltip.initAll(rootEl);
    }, 120);
  }
}

/**
 * Программное переключение между субвкладками хаба.
 * @param {string} subtabName - Имя целевой субпанели.
 */
export function switchSoftwareSubTab(subtabName) {
  let btnId = 'subtab-sw-inventory-btn';
  if (subtabName === 'packages' || subtabName === 'winget' || subtabName === 'manager' || subtabName === 'msi' || subtabName === 'store' || subtabName === 'msstore' || subtabName === 'ninite') {
    btnId = 'subtab-sw-packages-btn';
  } else if (subtabName === 'dormant' || subtabName === 'orphans') {
    btnId = 'subtab-sw-dormant-btn';
  } else if (subtabName === 'startup' || subtabName === 'startup-auditor' || subtabName === 'startup_auditor') {
    btnId = 'subtab-sw-startup-btn';
  } else if (subtabName === 'transparency') {
    btnId = 'subtab-sw-transparency-btn';
  } else if (subtabName === 'heavy' || subtabName === 'resources') {
    btnId = 'subtab-sw-heavy-btn';
  } else if (subtabName === 'sockets' || subtabName === 'ports') {
    btnId = 'subtab-sw-sockets-btn';
  }

  const btn = document.getElementById(btnId);
  if (btn) {
    if (window.bootstrap && window.bootstrap.Tab) {
      new window.bootstrap.Tab(btn).show();
    } else {
      btn.click();
    }
  }

  // Обработка внутренних вкладок Ninite / WinGet / MSI / Store
  if (subtabName === 'msi') {
    setTimeout(() => {
      const msiBtn = document.getElementById('sw-subtab-msi-btn');
      if (msiBtn) {
        if (window.bootstrap && window.bootstrap.Tab) {
          new window.bootstrap.Tab(msiBtn).show();
        } else {
          msiBtn.click();
        }
      }
      initMsiPackagesPanel();
    }, 50);
  } else if (subtabName === 'store' || subtabName === 'msstore') {
    setTimeout(() => {
      const storeBtn = document.getElementById('sw-subtab-store-btn');
      if (storeBtn) {
        if (window.bootstrap && window.bootstrap.Tab) {
          new window.bootstrap.Tab(storeBtn).show();
        } else {
          storeBtn.click();
        }
      }
      initStorePackagesPanel();
    }, 50);
  } else if (subtabName === 'ninite') {
    setTimeout(() => {
      const niniteBtn = document.getElementById('sw-subtab-ninite-btn');
      if (niniteBtn) {
        if (window.bootstrap && window.bootstrap.Tab) {
          new window.bootstrap.Tab(niniteBtn).show();
        } else {
          niniteBtn.click();
        }
      }
      triggerSubTabInit('ninite');
    }, 50);
  } else if (subtabName === 'packages' || subtabName === 'winget') {
    setTimeout(() => {
      const wingetBtn = document.getElementById('sw-subtab-winget-btn');
      if (wingetBtn) {
        if (window.bootstrap && window.bootstrap.Tab) {
          new window.bootstrap.Tab(wingetBtn).show();
        } else {
          wingetBtn.click();
        }
      }
      initWingetPackagesPanel();
    }, 50);
  }

  triggerSubTabInit(subtabName);
}

/**
 * Настройка обработчиков переключения субвкладок.
 */
export function setupSubTabNavigation() {
  const bindTabBtn = (btnId, name) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('shown.bs.tab', () => triggerSubTabInit(name));
    btn.addEventListener('click', () => {
      if (!window.bootstrap || !window.bootstrap.Tab) {
        triggerSubTabInit(name);
      }
    });
  };

  bindTabBtn('subtab-sw-inventory-btn', 'inventory');
  bindTabBtn('subtab-sw-packages-btn', 'winget');
  bindTabBtn('subtab-sw-dormant-btn', 'dormant');
  bindTabBtn('subtab-sw-startup-btn', 'startup');
  bindTabBtn('subtab-sw-transparency-btn', 'transparency');
  bindTabBtn('subtab-sw-heavy-btn', 'heavy');
  bindTabBtn('subtab-sw-sockets-btn', 'sockets');

  bindTabBtn('sw-subtab-winget-btn', 'winget');
  bindTabBtn('sw-subtab-msi-btn', 'msi');
  bindTabBtn('sw-subtab-store-btn', 'store');
  bindTabBtn('sw-subtab-ninite-btn', 'ninite');
}
