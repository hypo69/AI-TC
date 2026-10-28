/**
 * =============================================================================
 * Process Name: Windows User Directories - Users List Panel
 * =============================================================================
 * Description:
 *   Модуль боковой панели списка пользователей: отображение профилей,
 *   ролей (admin/user), использованного дискового пространства, прогресс-баров квот
 *   и выбора активного пользователя для проводника файлов.
 *
 * File: panel.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories/panel_users
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

import { state, escapeHtml } from '../common/ui_utils.js';
import { loadUserFiles } from '../panel_files/panel.js';

/**
 * Загрузка списка пользователей с метриками хранилища.
 * @returns {Promise<void>}
 */
export async function loadUsersList() {
  const usersListEl = document.getElementById('user-dirs-users-list');
  const countBadge = document.getElementById('users-badge-count');
  const statusLabel = document.getElementById('user-dirs-status-label');

  try {
    if (statusLabel) statusLabel.textContent = 'Обновление списка пользователей...';
    const res = await fetch('/api/admin/user-directories/users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.users = data.users || [];
    if (countBadge) countBadge.textContent = state.users.length;
    if (statusLabel) statusLabel.textContent = `Загружено пользователей: ${state.users.length}`;

    renderUsersList();

    // Если уже был выбран пользователь — перезагрузим его файлы, иначе выберем первого
    if (state.selectedUserId && state.users.some(u => u.id === state.selectedUserId)) {
      selectUser(state.selectedUserId);
    } else if (state.users.length > 0) {
      selectUser(state.users[0].id);
    }
  } catch (err) {
    console.error('Ошибка загрузки пользователей:', err);
    if (usersListEl) {
      usersListEl.innerHTML = `
        <div class="text-center py-4 text-danger small">
          <i class="bi bi-exclamation-triangle fs-4 d-block mb-1"></i>
          Не удалось загрузить список пользователей: ${err.message}
        </div>
      `;
    }
  }
}

/**
 * Рендеринг списка пользователей в левой колонке.
 */
export function renderUsersList() {
  const usersListEl = document.getElementById('user-dirs-users-list');
  if (!usersListEl) return;

  const query = state.searchQuery.toLowerCase();
  const filteredUsers = state.users.filter(u => {
    if (!query) return true;
    return (
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      String(u.id).includes(query)
    );
  });

  if (filteredUsers.length === 0) {
    usersListEl.innerHTML = `
      <div class="text-center py-4 text-muted small">
        Пользователи не найдены
      </div>
    `;
    return;
  }

  usersListEl.innerHTML = filteredUsers.map(u => {
    const isSelected = u.id === state.selectedUserId;
    const activeClass = isSelected ? 'active border-primary' : '';
    const roleBadge = u.is_admin
      ? '<span class="badge bg-warning text-dark me-1">admin</span>'
      : '<span class="badge bg-secondary me-1">user</span>';

    const diskWarning = u.quota_percent > 85 ? 'bg-danger' : u.quota_percent > 60 ? 'bg-warning' : 'bg-primary';

    return `
      <a href="javascript:void(0)" 
         class="list-group-item list-group-item-action p-2.5 user-select-item ${activeClass}" 
         data-user-id="${u.id}">
        <div class="d-flex w-100 justify-content-between align-items-center mb-1">
          <div class="d-flex align-items-center gap-1.5 text-truncate">
            <span class="badge bg-dark border text-info" style="font-size: 0.72rem;">#${u.id}</span>
            <strong class="text-truncate small ${isSelected ? 'text-white' : ''}">${escapeHtml(u.name)}</strong>
          </div>
          <div>${roleBadge}</div>
        </div>
        <div class="text-truncate small text-muted mb-1.5" style="font-size: 0.76rem;">
          ${escapeHtml(u.email || '-')}
        </div>
        <div class="d-flex justify-content-between align-items-center small mb-1" style="font-size: 0.74rem;">
          <span class="text-muted"><i class="bi bi-files me-1"></i>${u.files_count} файлов</span>
          <span class="fw-semibold text-info">${u.size_formatted}</span>
        </div>
        <div class="progress" style="height: 4px;" title="Использовано квоты: ${u.quota_percent}%">
          <div class="progress-bar ${diskWarning}" role="progressbar" style="width: ${u.quota_percent}%;"></div>
        </div>
      </a>
    `;
  }).join('');

  // Обработчики клика по элементам пользователей
  usersListEl.querySelectorAll('.user-select-item').forEach(item => {
    item.onclick = () => {
      const uid = parseInt(item.dataset.userId, 10);
      selectUser(uid);
    };
  });
}

/**
 * Выбор пользователя и загрузка его файлового проводника.
 * @param {number} userId - ID пользователя
 */
export function selectUser(userId) {
  state.selectedUserId = userId;
  const user = state.users.find(u => u.id === userId);
  state.selectedUserName = user ? user.name : `Пользователь #${userId}`;

  // Обновление подсветки в списке слева
  const usersListEl = document.getElementById('user-dirs-users-list');
  if (usersListEl) {
    usersListEl.querySelectorAll('.user-select-item').forEach(item => {
      const uid = parseInt(item.dataset.userId, 10);
      item.classList.toggle('active', uid === userId);
      item.classList.toggle('border-primary', uid === userId);
    });
  }

  // Обновление заголовка проводника
  const titleEl = document.getElementById('explorer-user-title');
  const pathBadge = document.getElementById('explorer-user-path-badge');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi bi-folder-fill text-warning me-1"></i> Хранилище: <strong>${escapeHtml(state.selectedUserName)}</strong> (#${userId})`;
  }
  if (pathBadge && user) {
    pathBadge.classList.remove('d-none');
    pathBadge.textContent = `data/users/${userId}/`;
  }

  loadUserFiles(userId);
}
