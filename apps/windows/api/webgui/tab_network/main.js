/**
 * =============================================================================
 * Process Name: Windows Network Terminal Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский скрипт-оркестратор вкладки Windows Network Terminal.
 *   Координирует тестирование скорости (Speedtest), опрос адаптеров,
 *   активных сокетов/портов, перехват трафика DPI (TShark) и анализ PCAP.
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_network
 * Updated: 2026-10-20 18:35:00
 * =============================================================================
 */

import { fetchNetworkStatus } from './panel_kpi_status/panel.js';
import { fetchLatestSpeedtest, runInternetSpeedtest } from './panel_speedtest/panel.js';
import { fetchAdapters, getAllAdapters } from './panel_adapters/panel.js';
import { fetchConnections, renderConnectionsTable, setActiveConnFilter } from './panel_connections/panel.js';
import {
  initDiscoveryPanel,
  fetchDiscoveredDevices,
  startDiscoveryAutoRefresh,
  stopDiscoveryAutoRefresh
} from './panel_discovery/panel.js';
import {
  startLiveCapture,
  stopLiveCapture,
  clearCapturedPackets,
  analyzePcapFile,
  renderPacketsTable,
  getCapturedPacketsCount
} from './panel_capture_pcap/panel.js';

let isNetInitialized = false;

/**
 * Инициализирует вкладку Network Terminal.
 */
export function initNetworkTab() {
  console.log('[NetworkTab] Initializing Windows Network Terminal tab (/apps/windows/network)...');
  fetchNetworkStatus(getCapturedPacketsCount());
  fetchLatestSpeedtest();
  fetchAdapters();
  fetchConnections();
  initDiscoveryPanel();

  if (!isNetInitialized) {
    const refreshAllBtn = document.getElementById('btn-refresh-network-all');
    const runSpeedtestBtn = document.getElementById('btn-run-speedtest');
    const refreshAdaptersBtn = document.getElementById('btn-refresh-adapters');
    const refreshConnsBtn = document.getElementById('btn-refresh-conns');
    const startBtn = document.getElementById('btn-start-live-capture');
    const stopBtn = document.getElementById('btn-stop-live-capture');
    const analyzePcapBtn = document.getElementById('btn-analyze-pcap');
    const clearPacketsBtn = document.getElementById('btn-clear-packets');
    const connsFilterInput = document.getElementById('net-conns-filter');
    const tableFilterInput = document.getElementById('net-table-filter');

    if (refreshAllBtn) {
      refreshAllBtn.onclick = () => {
        fetchNetworkStatus(getCapturedPacketsCount());
        fetchLatestSpeedtest();
        fetchAdapters();
        fetchConnections();
        fetchDiscoveredDevices(false);
      };
    }
    if (runSpeedtestBtn) runSpeedtestBtn.onclick = runInternetSpeedtest;
    if (refreshAdaptersBtn) refreshAdaptersBtn.onclick = fetchAdapters;
    if (refreshConnsBtn) refreshConnsBtn.onclick = fetchConnections;
    if (startBtn) startBtn.onclick = startLiveCapture;
    if (stopBtn) stopBtn.onclick = stopLiveCapture;
    if (analyzePcapBtn) analyzePcapBtn.onclick = analyzePcapFile;
    if (clearPacketsBtn) clearPacketsBtn.onclick = clearCapturedPackets;

    if (connsFilterInput) connsFilterInput.oninput = renderConnectionsTable;
    if (tableFilterInput) tableFilterInput.oninput = renderPacketsTable;

    // Фильтры подключений
    document.querySelectorAll('.btn-filter-conns').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.btn-filter-conns').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setActiveConnFilter(btn.getAttribute('data-filter') || 'all');
        renderConnectionsTable();
      };
    });

    // Навигация по суб-вкладкам
    const subtabsNav = document.getElementById('network-subtabs-nav');
    if (subtabsNav) {
      subtabsNav.querySelectorAll('button[data-bs-toggle="pill"]').forEach((btn) => {
        btn.addEventListener('shown.bs.tab', (e) => {
          const targetId = e.target.getAttribute('data-bs-target') || '';
          if (targetId === '#tab-net-speedtest') {
            fetchLatestSpeedtest();
          } else if (targetId === '#tab-net-discovery') {
            fetchDiscoveredDevices(false);
            startDiscoveryAutoRefresh();
          } else if (targetId === '#tab-net-adapters') {
            fetchAdapters();
          } else if (targetId === '#tab-net-connections') {
            fetchConnections();
          } else if (targetId === '#tab-net-capture') {
            const adapters = getAllAdapters();
            if (!adapters || adapters.length === 0) fetchAdapters();
          }
        });
      });
    }

    isNetInitialized = true;
  }
}

/**
 * Программное переключение между суб-вкладками сетевого терминала.
 * @param {string} subtabId - Идентификатор подвкладки.
 */
export function switchNetworkSubTab(subtabId) {
  let btnId = 'subtab-net-speedtest-btn';
  switch (subtabId) {
    case 'speedtest':
    case 'speed':
      btnId = 'subtab-net-speedtest-btn';
      break;
    case 'discovery':
    case 'devices':
    case 'lan':
    case 'computers':
      btnId = 'subtab-net-discovery-btn';
      break;
    case 'adapters':
    case 'interfaces':
      btnId = 'subtab-net-adapters-btn';
      break;
    case 'connections':
    case 'conns':
    case 'ports':
      btnId = 'subtab-net-connections-btn';
      break;
    case 'capture':
    case 'dpi':
    case 'live':
      btnId = 'subtab-net-capture-btn';
      break;
    case 'pcap':
    case 'ai':
    case 'diagnostics':
      btnId = 'subtab-net-pcap-btn';
      break;
  }
  const btn = document.getElementById(btnId);
  if (btn) {
    if (window.bootstrap && window.bootstrap.Tab) {
      const tabInst = window.bootstrap.Tab.getInstance(btn) || new window.bootstrap.Tab(btn);
      tabInst.show();
    } else {
      btn.click();
    }
  }
}

/**
 * Деактивация вкладки при переходе пользователя на другую вкладку.
 */
export function deactivateNetworkTab() {
  stopDiscoveryAutoRefresh();
}

// Экспорт для глобального доступа и совместимости с хост-контейнером
window.initNetworkTab = initNetworkTab;
window.activateNetworkTab = initNetworkTab;
window.deactivateNetworkTab = deactivateNetworkTab;
window.switchNetworkSubTab = switchNetworkSubTab;

// Автозапуск при обнаружении контейнера в DOM
if (document.getElementById('tab-network') || document.getElementById('net-conns-tbody')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initNetworkTab());
  } else {
    setTimeout(() => initNetworkTab(), 10);
  }
}
