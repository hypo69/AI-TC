/**
 * =============================================================================
 * Process Name: Windows Startup Auditor Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский скрипт-оркестратор вкладки Startup Auditor.
 *   Координирует работу панелей сводки (KPI), таблицы автозапуска,
 *   модального окна истории дифференциальных изменений и AI-диагностики.
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_startup_auditor
 * Updated: 2026-10-17 01:55:00
 * =============================================================================
 */

import { loadAuditData, refreshStartupTelemetry, renderFilteredTable } from './panel_table/panel.js';
import { checkRecentChangesBadge, showChangesModal, loadChangesData } from './panel_changes_modal/panel.js';

/**
 * Привязывает обработчики к элементам управления верхней панели фильтров и действий.
 */
function bindEvents() {
  const btnRefreshTelemetry = document.getElementById('sa-btn-refresh-telemetry');
  if (btnRefreshTelemetry) {
    btnRefreshTelemetry.onclick = () => refreshStartupTelemetry();
  }

  const btnRefreshLegacy = document.getElementById('sa-btn-refresh');
  if (btnRefreshLegacy) {
    btnRefreshLegacy.onclick = () => refreshStartupTelemetry();
  }

  const btnViewChanges = document.getElementById('sa-btn-view-changes');
  if (btnViewChanges) {
    btnViewChanges.onclick = () => showChangesModal();
  }

  const btnRefreshChangesModal = document.getElementById('sa-btn-refresh-changes-modal');
  if (btnRefreshChangesModal) {
    btnRefreshChangesModal.onclick = () => loadChangesData();
  }

  const searchInput = document.getElementById('sa-search-input');
  if (searchInput) {
    searchInput.oninput = () => renderFilteredTable();
  }

  const filterRisk = document.getElementById('sa-filter-risk');
  if (filterRisk) {
    filterRisk.onchange = () => renderFilteredTable();
  }

  const filterLocation = document.getElementById('sa-filter-location');
  if (filterLocation) {
    filterLocation.onchange = () => renderFilteredTable();
  }

  const filterState = document.getElementById('sa-filter-state');
  if (filterState) {
    filterState.onchange = () => renderFilteredTable();
  }

  const btnExportJson = document.getElementById('sa-btn-export-json');
  if (btnExportJson) {
    btnExportJson.onclick = () => {
      window.open('/api/v1/startup-auditor/export?format=json', '_blank');
    };
  }

  const btnExportCsv = document.getElementById('sa-btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.onclick = () => {
      window.open('/api/v1/startup-auditor/export?format=csv', '_blank');
    };
  }
}

/**
 * Инициализирует вкладку Startup Auditor.
 */
export async function initStartupAuditorTab() {
  console.log('[StartupAuditor] Initializing tab...');
  bindEvents();
  await loadAuditData();
  checkRecentChangesBadge().catch(() => {});
}

// Экспорт для глобального доступа и совместимости с хостом
window.initStartupAuditorTab = initStartupAuditorTab;

// Автозапуск при обнаружении контейнера в DOM
if (document.getElementById('tab-startup-auditor') || document.getElementById('sa-table-body')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initStartupAuditorTab());
  } else {
    setTimeout(() => initStartupAuditorTab(), 10);
  }
}
