/**
 * =============================================================================
 * Process Name: Windows Storage Management Tab - Main Script
 * =============================================================================
 * Description:
 *   Клиентский контроллер консолидированной панели накопителей.
 *   Управляет суб-вкладками «Диски и тома» и «Ресурс и SMART».
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_storage_management
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-13 14:05:00
 * =============================================================================
 */

(function () {
  'use strict';

  function loadScript(src) {
    return new Promise((resolve) => {
      const cleanSrc = src.split('?')[0];
      const existing = document.querySelector(`script[src^="${cleanSrc}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (err) => {
        console.warn(`[StorageManagement] Не удалось загрузить скрипт ${src}:`, err);
        resolve();
      };
      document.body.appendChild(s);
    });
  }

  async function loadSubPane(containerId, htmlUrl, jsUrl, initFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!container.hasChildNodes()) {
      try {
        const res = await fetch(`${htmlUrl}?v=${Date.now()}`);
        if (!res.ok) return;
        container.innerHTML = await res.text();
      } catch (err) {
        console.warn(`[StorageManagement] Ошибка загрузки HTML для ${containerId}:`, err);
        return;
      }
    }

    if (jsUrl) {
      try {
        await loadScript(`${jsUrl}?v=${Date.now()}`);
        if (initFnName && typeof window[initFnName] === 'function') {
          try { window[initFnName](); } catch (err) { console.debug(`[StorageManagement] ${initFnName} error:`, err); }
        }
      } catch (err) {
        console.warn(`[StorageManagement] Ошибка скрипта для ${containerId}:`, err);
      }
    }
  }

  async function loadSubPanes() {
    // 1. Диски и тома
    await loadSubPane(
      'storage-manager-embed-container',
      '/html/tab_storage_manager/index.html',
      '/html/tab_storage_manager/main.js',
      'initStorageManagerTab'
    );

    // 2. Ресурс и SMART
    await loadSubPane(
      'storage-wear-embed-container',
      '/html/tab_storage_wear/index.html',
      '/html/tab_storage_wear/main.js',
      'initStorageWearTab'
    );
  }

  async function triggerSubTabInit(subtabName) {
    if (subtabName === 'wear') {
      await loadSubPane('storage-wear-embed-container', '/html/tab_storage_wear/index.html', '/html/tab_storage_wear/main.js', 'initStorageWearTab');
      if (typeof window.initStorageWearTab === 'function') window.initStorageWearTab();
    } else {
      await loadSubPane('storage-manager-embed-container', '/html/tab_storage_manager/index.html', '/html/tab_storage_manager/main.js', 'initStorageManagerTab');
      if (typeof window.initStorageManagerTab === 'function') window.initStorageManagerTab();
    }
  }

  window.switchStorageSubTab = function(subtabName) {
    const btnId = subtabName === 'wear' ? 'subtab-storage-wear-btn' : 'subtab-storage-volumes-btn';
    const btn = document.getElementById(btnId);
    if (btn) {
      if (window.bootstrap && window.bootstrap.Tab) {
        new window.bootstrap.Tab(btn).show();
      } else {
        btn.click();
      }
      triggerSubTabInit(subtabName);
    }
  };

  async function initStorageManagementTab() {
    await loadSubPanes();
  }

  window.initStorageManagementTab = initStorageManagementTab;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStorageManagementTab);
  } else {
    initStorageManagementTab();
  }
})();

