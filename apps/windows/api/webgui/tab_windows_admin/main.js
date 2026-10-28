/**
 * =============================================================================
 * Название: Панель Windows Sysadmin & Identity - Главный оркестратор
 * =============================================================================
 * Описание:
 *   Главная точка входа и оркестратор модулей вкладки tab_windows_admin.
 *   Объединяет управление учетными записями, группами, журналами безопасности,
 *   аудитом прав, политиками SAM, инспектором процессов и ACL.
 *
 * Файл: apps/windows/api/webgui/tab_windows_admin/main.js
 * Пакет: windows/api/webgui/tab_windows_admin
 * Автор: hypo69
 * Updated: 2026-10-20 19:00:00
 * =============================================================================
 */

import {
  fetchStatus,
  loadCurrentToken,
  updatePrivacyRadar,
  updateWindowsBackupStatus,
  triggerWindowsBackup
} from './panel_overview/panel.js';
import {
  fetchAccounts,
  filterUsersTable,
  openUserAiModal,
  handleCreateUserSubmit,
  deleteUserAction,
  setCurrentUserFilter,
  getCurrentUserFilter
} from './panel_users/panel.js';
import {
  loadGroups,
  filterGroupsTable,
  handleGroupRollover,
  viewGroupMembers
} from './panel_groups/panel.js';
import {
  loadSecurityEvents,
  applyEventsFilter,
  filterEventsTable,
  showEventDetail,
  setCurrentEventFilter
} from './panel_security_events/panel.js';
import {
  loadPasswordPolicy,
  runWhoIsAdminCheck,
  runServiceLogonCheck,
  runRdpCheck,
  runOrphanedCheck
} from './panel_audit_sam/panel.js';
import { handleExplainPid } from './panel_pid_inspector/panel.js';
import { loadCatalog, filterCatalogTable } from './panel_catalog/panel.js';
import {
  inspectAcl,
  executeAclAction,
  resetAclDefault,
  applyAclTemplate,
  restoreAclRollback,
  bindAclEvents
} from './panel_acl/panel.js';

let isWinAdminInitialized = false;

// Экспорт глобальных функций для вызова из внешних контейнеров и HTML
window.initWindowsAdminTab = initWindowsAdminTab;
window.initAccountsIdentityTab = initWindowsAdminTab;
window.activateWindowsAdminTab = function() {
  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    window.AISmartTooltip.initAll(document.getElementById('windows-admin-root') || document);
  }
};
window.triggerWindowsBackup = triggerWindowsBackup;
window.updateWindowsBackupStatus = updateWindowsBackupStatus;
window._explainUserDossier = openUserAiModal;
window._deleteUserAction = deleteUserAction;
window._handleGroupRollover = handleGroupRollover;
window._viewGroupMembers = viewGroupMembers;
window._showEventDetail = showEventDetail;
window.applyAclTemplate = applyAclTemplate;
window.inspectAcl = inspectAcl;
window.executeAclAction = executeAclAction;
window.resetAclDefault = resetAclDefault;
window.switchWindowsAdminSubTab = switchWindowsAdminSubTab;

/**
 * Переключение субвкладки панели Windows Sysadmin.
 * @param {string} subtabName - Имя субвкладки ('acl', etc.).
 */
export function switchWindowsAdminSubTab(subtabName) {
  const norm = (subtabName || '').toLowerCase().replace(/^subtab-winadmin-/, '').replace(/-btn$/, '');
  const btnId = `subtab-winadmin-${norm}-btn`;
  const btn = document.getElementById(btnId);
  if (btn && window.bootstrap) {
    new window.bootstrap.Tab(btn).show();
  }
  if (norm === 'acl') {
    inspectAcl();
  }
  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    setTimeout(() => {
      window.AISmartTooltip.initAll(document.getElementById('windows-admin-root') || document);
    }, 100);
  }
}

/**
 * Обновление всех данных вкладки параллельно.
 */
export async function refreshAllData() {
  await Promise.allSettled([
    fetchStatus(),
    loadCurrentToken(),
    fetchAccounts(getCurrentUserFilter()),
    loadGroups(),
    loadSecurityEvents(),
    loadPasswordPolicy(),
    loadCatalog(),
    updatePrivacyRadar(),
    updateWindowsBackupStatus(),
    inspectAcl(),
  ]);
}

/**
 * Привязка обработчиков событий элементов интерфейса.
 */
function bindEvents() {
  const refreshBtn = document.getElementById('btn-winadmin-refresh');
  if (refreshBtn) {
    refreshBtn.onclick = () => refreshAllData();
  }

  const openCreateUserBtn = document.getElementById('btn-open-create-user-modal');
  if (openCreateUserBtn) {
    openCreateUserBtn.onclick = () => {
      const modalEl = document.getElementById('createUserModal');
      if (modalEl && window.bootstrap) {
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
      }
    };
  }

  const submitCreateUserBtn = document.getElementById('btn-submit-create-user');
  if (submitCreateUserBtn) {
    submitCreateUserBtn.onclick = handleCreateUserSubmit;
  }

  const filterGroup = document.getElementById('winadmin-user-filters');
  if (filterGroup) {
    filterGroup.querySelectorAll('.winadmin-filter-btn').forEach(btn => {
      btn.onclick = () => {
        filterGroup.querySelectorAll('.winadmin-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter') || 'all';
        setCurrentUserFilter(filter);
        fetchAccounts(filter);
      };
    });
  }

  const filterUsersInput = document.getElementById('filter-users-input');
  if (filterUsersInput) {
    filterUsersInput.oninput = (e) => filterUsersTable(e.target.value);
  }

  const filterGroupsInput = document.getElementById('filter-groups-input');
  if (filterGroupsInput) {
    filterGroupsInput.oninput = (e) => filterGroupsTable(e.target.value);
  }

  const eventsFilterToolbar = document.getElementById('events-quick-filters');
  if (eventsFilterToolbar) {
    eventsFilterToolbar.querySelectorAll('.event-filter-btn').forEach(btn => {
      btn.onclick = () => {
        eventsFilterToolbar.querySelectorAll('.event-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter') || 'all';
        setCurrentEventFilter(filter);
        applyEventsFilter();
      };
    });
  }

  const filterEventsInput = document.getElementById('filter-events-input');
  if (filterEventsInput) {
    filterEventsInput.oninput = () => filterEventsTable();
  }

  const refreshEventsBtn = document.getElementById('btn-refresh-events');
  if (refreshEventsBtn) {
    refreshEventsBtn.onclick = () => loadSecurityEvents();
  }

  const filterCatalogInput = document.getElementById('filter-catalog-input');
  if (filterCatalogInput) {
    filterCatalogInput.oninput = (e) => filterCatalogTable(e.target.value);
  }

  const btnWhoIsAdmin = document.getElementById('btn-check-who-is-admin');
  if (btnWhoIsAdmin) btnWhoIsAdmin.onclick = runWhoIsAdminCheck;

  const btnServiceLogon = document.getElementById('btn-check-service-logon');
  if (btnServiceLogon) btnServiceLogon.onclick = runServiceLogonCheck;

  const btnRdp = document.getElementById('btn-check-rdp');
  if (btnRdp) btnRdp.onclick = runRdpCheck;

  const btnOrphaned = document.getElementById('btn-check-orphaned');
  if (btnOrphaned) btnOrphaned.onclick = runOrphanedCheck;

  const btnExplainPid = document.getElementById('btn-explain-pid');
  if (btnExplainPid) btnExplainPid.onclick = handleExplainPid;

  if (window.registerTabPoller) {
    window.registerTabPoller('tab-windows-admin', async () => {
      if (window.isPanelActive && window.isPanelActive('tab-windows-admin', 'panel-overview', 'panel-overview')) {
        await updatePrivacyRadar();
        await updateWindowsBackupStatus();
      }
    }, 15000, { pollerId: 'winadmin_overview_poller', immediate: false });
  }
}

/**
 * Инициализация панели Windows Sysadmin & Identity.
 */
export async function initWindowsAdminTab() {
  console.log('[WinAdminTab] Инициализация панели Sysadmin & Identity...');

  if (!isWinAdminInitialized) {
    bindEvents();
    bindAclEvents();
    isWinAdminInitialized = true;
  }

  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    window.AISmartTooltip.initAll(document.getElementById('windows-admin-root') || document);
  }

  await refreshAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWindowsAdminTab);
} else {
  initWindowsAdminTab();
}
