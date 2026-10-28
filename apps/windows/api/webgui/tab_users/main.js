/**
 * @file apps/windows/api/webgui/tab_users/main.js
 * @description Корневой модуль-оркестратор вкладки управления пользователями (Users Tab Orchestrator)
 * @author hypo69
 * @version 2.0.0
 * Updated: 2026-10-17 01:36:00
 */

import { apiFetch, showStatusAlert, escapeHtml } from './common/ui_utils.js';
import { renderStats, initFilterListeners } from './panel_stats_filter/panel.js';
import { renderTable } from './panel_table/panel.js';
import {
  initModalListeners,
  openEditModal,
  openPasswordModal,
  openDetailsModal,
  openDeleteModal
} from './panel_modals/panel.js';
import { initOrphanedDirsListeners } from './panel_orphaned_dirs/panel.js';

const state = {
  users: [],
  stats: {
    total: 0,
    active: 0,
    admins: 0,
    telegram: 0
  },
  filterRole: '',
  filterStatus: '',
  searchQuery: '',
  editingUserId: null,
  savingUserId: null,
  isLoading: false,
  initialized: false
};

/**
 * Загрузка списка пользователей с бэкенда
 */
export async function loadUsers() {
  state.isLoading = true;
  const tableBody = document.getElementById('users-table-body');

  if (tableBody && (!state.users || state.users.length === 0)) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          Загрузка списка пользователей...
        </td>
      </tr>`;
  }

  try {
    const params = new URLSearchParams();
    if (state.searchQuery) params.append('q', state.searchQuery);
    if (state.filterRole) params.append('role', state.filterRole);
    if (state.filterStatus) params.append('status', state.filterStatus);

    const url = `/api/admin/users?${params.toString()}`;
    const data = await apiFetch(url);

    state.users = data.users || [];
    if (data.stats) {
      state.stats = data.stats;
    }

    renderStats(state.stats);
    renderCurrentTable();
  } catch (err) {
    console.error('[UsersTab] Error loading users:', err);
    showStatusAlert(`Ошибка загрузки пользователей: ${err.message}`, 'danger');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-octagon fs-4 d-block mb-1"></i>
            Не удалось загрузить пользователей: ${escapeHtml(err.message)}
          </td>
        </tr>`;
    }
  } finally {
    state.isLoading = false;
  }
}

/**
 * Отрисовка таблицы с текущим состоянием
 */
function renderCurrentTable() {
  renderTable(state.users, state.stats, state.editingUserId, state.savingUserId, {
    onUpdateField: handleUpdateField,
    onStartEdit: (userId) => {
      state.editingUserId = userId;
      renderCurrentTable();
    },
    onCancelEdit: () => {
      state.editingUserId = null;
      renderCurrentTable();
    },
    onSaveInline: saveInlineRow,
    onOpenEditModal: (userId) => {
      const user = state.users.find(u => u.id === userId);
      if (user) openEditModal(user);
    },
    onOpenPasswordModal: openPasswordModal,
    onOpenDetailsModal: openDetailsModal,
    onOpenDeleteModal: openDeleteModal
  });
}

/**
 * Быстрое обновление отдельного поля (роль, статус)
 */
async function handleUpdateField(userId, payload, successMsg = 'Данные сохранены') {
  try {
    const res = await apiFetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const user = state.users.find(u => u.id === userId);
    if (user && res.user) {
      Object.assign(user, res.user);
    }
    showStatusAlert(`Пользователь #${userId}: ${successMsg}`, 'success');
    loadUsers();
  } catch (err) {
    showStatusAlert(`Ошибка обновления: ${err.message}`, 'danger');
    loadUsers();
  }
}

/**
 * Сохранение изменений строки в инлайн-режиме
 */
async function saveInlineRow(userId) {
  const row = document.querySelector(`tr[data-user-id="${userId}"]`);
  if (!row) return;

  const nameInput = row.querySelector('.inline-edit-name');
  const emailInput = row.querySelector('.inline-edit-email');
  const roleSelect = row.querySelector('.inline-edit-role');
  const statusSelect = row.querySelector('.inline-edit-status');
  const tgInput = row.querySelector('.inline-edit-tg');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'user';
  const isActive = statusSelect ? parseInt(statusSelect.value, 10) : 1;
  const tg = tgInput ? tgInput.value.trim().replace(/^@/, '') : '';

  if (!email) {
    showStatusAlert('Email не может быть пустым', 'warning');
    return;
  }
  if (!name) {
    showStatusAlert('Имя пользователя не может быть пустым', 'warning');
    return;
  }

  const payload = {
    name,
    email,
    role,
    is_admin: (role === 'admin') ? 1 : 0,
    is_active: isActive,
    telegram_username: tg
  };

  state.savingUserId = userId;
  const saveBtn = row.querySelector('.btn-save-inline');
  if (saveBtn) saveBtn.disabled = true;

  try {
    await apiFetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    state.editingUserId = null;
    showStatusAlert(`Пользователь #${userId} (<strong>${escapeHtml(name)}</strong>) успешно сохранён!`, 'success');
    loadUsers();
  } catch (err) {
    showStatusAlert(`Ошибка сохранения: ${err.message}`, 'danger');
  } finally {
    state.savingUserId = null;
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * Инициализация вкладки пользователей
 */
export function initUsersTab() {
  console.log('[UsersTab] Initializing user management tab with modular architecture...');
  if (!state.initialized) {
    state.initialized = true;

    initFilterListeners(
      (search) => {
        state.searchQuery = search;
        loadUsers();
      },
      (role) => {
        state.filterRole = role;
        loadUsers();
      },
      (status) => {
        state.filterStatus = status;
        loadUsers();
      }
    );

    const btnRefresh = document.getElementById('btn-refresh-users');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => loadUsers());
    }

    initModalListeners(() => loadUsers());
    initOrphanedDirsListeners();
  }
  loadUsers();
}

// Регистрация в глобальном объекте window
window.initUsersTab = initUsersTab;
window.loadUsers = loadUsers;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('users-tab-root')) {
      initUsersTab();
    }
  });
} else {
  if (document.getElementById('users-tab-root')) {
    initUsersTab();
  }
}
