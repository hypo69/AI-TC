/**
 * @file apps/windows/api/webgui/tab_users/panel_table/panel.js
 * @description Панель таблицы пользователей с поддержкой прямого инлайн-редактирования строк и селекторов
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:33:00
 */

import { escapeHtml, formatDate } from '../common/ui_utils.js';

/**
 * Отрисовка таблицы пользователей
 * @param {Array<Object>} users Список пользователей
 * @param {Object} stats Статистика
 * @param {number|null} editingUserId ID редактируемого пользователя в инлайн-режиме
 * @param {number|null} savingUserId ID пользователя, который сейчас сохраняется
 * @param {Object} callbacks Набор callback-функций действий таблицы
 */
export function renderTable(users, stats, editingUserId, savingUserId, callbacks) {
  const tableBody = document.getElementById('users-table-body');
  const countBadge = document.getElementById('users-count-badge');
  if (!tableBody) return;

  const userList = users || [];
  if (countBadge) {
    countBadge.textContent = `Показано: ${userList.length} из ${stats?.total || userList.length}`;
  }

  if (userList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="bi bi-person-x fs-2 d-block mb-2 text-secondary"></i>
          Пользователи не найдены.
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = userList.map((user) => {
    const isRoot = user.id === 1;
    const isAdmin = Boolean(user.is_admin || user.role === 'admin');
    const isActive = Boolean(user.is_active);
    const isEmailVerified = Boolean(user.is_email_verified);
    const hasPassword = Boolean(user.has_password);
    const isRowEditing = (editingUserId === user.id);
    const isSaving = (savingUserId === user.id);

    let avatarHtml = '';
    if (user.picture) {
      avatarHtml = `<img src="${escapeHtml(user.picture)}" class="rounded-circle me-2 flex-shrink-0" style="width:36px;height:36px;object-fit:cover;" alt="avatar">`;
    } else {
      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      const bgClass = isAdmin ? 'bg-warning text-dark' : 'bg-primary text-white';
      avatarHtml = `<div class="rounded-circle ${bgClass} d-flex align-items-center justify-content-center me-2 flex-shrink-0 fw-bold" style="width:36px;height:36px;font-size:14px;">${escapeHtml(initial)}</div>`;
    }

    const pwdHtml = hasPassword
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle" title="Пароль установлен"><i class="bi bi-key-fill"></i> Задан</span>`
      : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle" title="Пароль не установлен (OAuth/TG)"><i class="bi bi-dash-circle"></i> Нет</span>`;

    const emailVerifiedBadge = isEmailVerified
      ? `<i class="bi bi-patch-check-fill text-success ms-1" title="Email подтвержден"></i>`
      : `<i class="bi bi-question-circle text-muted ms-1" title="Email не подтвержден"></i>`;

    if (isRowEditing) {
      return `
        <tr data-user-id="${user.id}" class="table-active border-primary">
          <td class="text-center text-muted fw-bold align-middle">${user.id}</td>
          <td class="align-middle">
            <div class="d-flex align-items-center">
              ${avatarHtml}
              <div class="w-100">
                <div class="input-group input-group-sm mb-1">
                  <span class="input-group-text text-muted"><i class="bi bi-person"></i></span>
                  <input type="text" class="form-control inline-edit-name" value="${escapeHtml(user.name || '')}" placeholder="Имя пользователя">
                </div>
                <div class="input-group input-group-sm">
                  <span class="input-group-text text-muted"><i class="bi bi-envelope"></i></span>
                  <input type="email" class="form-control inline-edit-email" value="${escapeHtml(user.email || '')}" placeholder="Email">
                </div>
              </div>
            </div>
          </td>
          <td class="text-center align-middle">
            <select class="form-select form-select-sm inline-edit-role" ${isRoot ? 'disabled' : ''}>
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>👤 User</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>🛡️ Admin</option>
              <option value="guest" ${user.role === 'guest' ? 'selected' : ''}>👀 Guest</option>
            </select>
          </td>
          <td class="text-center align-middle">
            <select class="form-select form-select-sm inline-edit-status" ${isRoot ? 'disabled' : ''}>
              <option value="1" ${isActive ? 'selected' : ''}>🟢 Активен</option>
              <option value="0" ${!isActive ? 'selected' : ''}>🔴 Блок</option>
            </select>
          </td>
          <td class="align-middle">
            <div class="input-group input-group-sm">
              <span class="input-group-text text-info"><i class="bi bi-telegram"></i></span>
              <input type="text" class="form-control inline-edit-tg" value="${escapeHtml(user.telegram_username || '')}" placeholder="Username">
            </div>
          </td>
          <td class="text-center align-middle">${pwdHtml}</td>
          <td class="small align-middle">
            <div><span class="text-muted">Создан:</span> ${formatDate(user.created_at)}</div>
          </td>
          <td class="text-center align-middle">
            <div class="d-flex justify-content-center gap-1">
              <button class="btn btn-success btn-sm btn-save-inline" data-id="${user.id}" title="Сохранить изменения (Enter)" ${isSaving ? 'disabled' : ''}>
                ${isSaving ? '<span class="spinner-border spinner-border-sm"></span>' : '<i class="bi bi-check-lg"></i>'}
              </button>
              <button class="btn btn-outline-secondary btn-sm btn-cancel-inline" data-id="${user.id}" title="Отмена (Esc)" ${isSaving ? 'disabled' : ''}>
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    const roleSelectHtml = `
      <select class="form-select form-select-sm bg-dark border-secondary user-table-role-select text-center ${isAdmin ? 'text-warning fw-bold' : 'text-info'}"
        data-user-id="${user.id}"
        ${isRoot ? 'disabled title="Нельзя изменить роль Root"' : 'title="Изменить роль прямо в таблице"'}>
        <option value="user" ${user.role === 'user' ? 'selected' : ''} class="text-info">👤 User</option>
        <option value="admin" ${isAdmin ? 'selected' : ''} class="text-warning">🛡️ Admin</option>
        <option value="guest" ${user.role === 'guest' ? 'selected' : ''} class="text-secondary">👀 Guest</option>
      </select>
    `;

    const statusSelectHtml = `
      <select class="form-select form-select-sm bg-dark border-secondary user-table-status-select text-center ${isActive ? 'text-success' : 'text-danger'}"
        data-user-id="${user.id}"
        ${isRoot ? 'disabled title="Нельзя деактивировать Root"' : 'title="Изменить статус прямо в таблице"'}>
        <option value="1" ${isActive ? 'selected' : ''} class="text-success">🟢 Активен</option>
        <option value="0" ${!isActive ? 'selected' : ''} class="text-danger">🔴 Блок</option>
      </select>
    `;

    let tgHtml = '<span class="text-muted small">—</span>';
    if (user.telegram_username) {
      tgHtml = `<a href="https://t.me/${escapeHtml(user.telegram_username)}" target="_blank" class="text-info text-decoration-none small d-flex align-items-center gap-1" title="Открыть профиль Telegram">
        <i class="bi bi-telegram"></i> @${escapeHtml(user.telegram_username)}
      </a>`;
    } else if (user.telegram_id) {
      tgHtml = `<span class="text-muted small" title="Telegram ID"><i class="bi bi-telegram text-info"></i> ID: ${escapeHtml(user.telegram_id)}</span>`;
    }

    return `
      <tr data-user-id="${user.id}">
        <td class="text-center text-muted fw-bold align-middle">${user.id}</td>
        <td class="align-middle">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
              ${avatarHtml}
              <div>
                <div class="fw-bold text-white user-cell-name" title="Дважды кликните для быстрого редактирования" style="cursor: pointer;">
                  ${escapeHtml(user.name || 'Без имени')}
                  <i class="bi bi-pencil-fill text-muted ms-1 opacity-25 hover-opacity-100" style="font-size:10px;"></i>
                </div>
                <div class="small text-muted d-flex align-items-center user-cell-email" title="Дважды кликните для быстрого редактирования" style="cursor: pointer;">
                  ${escapeHtml(user.email)} ${emailVerifiedBadge}
                </div>
              </div>
            </div>
          </div>
        </td>
        <td class="text-center align-middle" style="min-width: 130px;">${roleSelectHtml}</td>
        <td class="text-center align-middle" style="min-width: 125px;">${statusSelectHtml}</td>
        <td class="align-middle" style="min-width: 140px;">
          <div class="d-flex align-items-center justify-content-between">
            <div class="user-cell-tg" title="Дважды кликните для быстрого редактирования" style="cursor: pointer;">${tgHtml}</div>
          </div>
        </td>
        <td class="text-center align-middle">${pwdHtml}</td>
        <td class="small align-middle">
          <div><span class="text-muted">Создан:</span> ${formatDate(user.created_at)}</div>
          ${user.last_login ? `<div><span class="text-muted">Вход:</span> ${formatDate(user.last_login)}</div>` : ''}
        </td>
        <td class="text-center align-middle">
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-warning btn-inline-edit" data-id="${user.id}" title="Редактировать поля строки прямо в таблице">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-outline-info btn-pwd-user" data-id="${user.id}" data-name="${escapeHtml(user.name || user.email)}" title="Сменить пароль">
              <i class="bi bi-key-fill"></i>
            </button>
            <button class="btn btn-outline-light btn-details-user" data-id="${user.id}" title="Профиль и настройки">
              <i class="bi bi-info-circle-fill"></i>
            </button>
            <button class="btn btn-outline-secondary btn-edit-user-modal" data-id="${user.id}" title="Редактировать в модальном окне">
              <i class="bi bi-sliders"></i>
            </button>
            <button class="btn btn-outline-danger btn-delete-user" data-id="${user.id}" data-name="${escapeHtml(user.name || user.email)}" ${isRoot ? 'disabled title="Нельзя удалить Root"' : 'title="Удалить"'}>
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  attachTableEvents(callbacks);
}

/**
 * Привязка слушателей к элементам таблицы
 * @param {Object} callbacks
 */
function attachTableEvents(callbacks) {
  document.querySelectorAll('.user-table-role-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const userId = parseInt(e.target.getAttribute('data-user-id'), 10);
      const newRole = e.target.value;
      const isAdmin = (newRole === 'admin') ? 1 : 0;
      if (callbacks.onUpdateField) callbacks.onUpdateField(userId, { role: newRole, is_admin: isAdmin }, `Роль изменена на "${newRole}"`);
    });
  });

  document.querySelectorAll('.user-table-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const userId = parseInt(e.target.getAttribute('data-user-id'), 10);
      const newStatus = parseInt(e.target.value, 10);
      if (callbacks.onUpdateField) callbacks.onUpdateField(userId, { is_active: newStatus }, `Статус изменен на "${newStatus ? 'Активен' : 'Заблокирован'}"`);
    });
  });

  document.querySelectorAll('#users-table-body tr').forEach(row => {
    const userId = parseInt(row.getAttribute('data-user-id'), 10);
    if (!userId) return;

    const nameEl = row.querySelector('.user-cell-name');
    const emailEl = row.querySelector('.user-cell-email');
    const tgEl = row.querySelector('.user-cell-tg');

    [nameEl, emailEl, tgEl].forEach(el => {
      if (el) {
        el.addEventListener('dblclick', () => {
          if (callbacks.onStartEdit) callbacks.onStartEdit(userId);
        });
      }
    });
  });

  document.querySelectorAll('.btn-inline-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      if (callbacks.onStartEdit) callbacks.onStartEdit(userId);
    });
  });

  document.querySelectorAll('.btn-cancel-inline').forEach(btn => {
    btn.addEventListener('click', () => {
      if (callbacks.onCancelEdit) callbacks.onCancelEdit();
    });
  });

  document.querySelectorAll('.btn-save-inline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      if (callbacks.onSaveInline) callbacks.onSaveInline(userId);
    });
  });

  document.querySelectorAll('.inline-edit-name, .inline-edit-email, .inline-edit-tg').forEach(inp => {
    inp.addEventListener('keydown', (e) => {
      const tr = inp.closest('tr');
      const userId = tr ? parseInt(tr.getAttribute('data-user-id'), 10) : null;
      if (!userId) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (callbacks.onSaveInline) callbacks.onSaveInline(userId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (callbacks.onCancelEdit) callbacks.onCancelEdit();
      }
    });
  });

  document.querySelectorAll('.btn-edit-user-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      if (callbacks.onOpenEditModal) callbacks.onOpenEditModal(userId);
    });
  });

  document.querySelectorAll('.btn-pwd-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      const userName = e.currentTarget.getAttribute('data-name');
      if (callbacks.onOpenPasswordModal) callbacks.onOpenPasswordModal(userId, userName);
    });
  });

  document.querySelectorAll('.btn-details-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      if (callbacks.onOpenDetailsModal) callbacks.onOpenDetailsModal(userId);
    });
  });

  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      const userName = e.currentTarget.getAttribute('data-name');
      if (callbacks.onOpenDeleteModal) callbacks.onOpenDeleteModal(userId, userName);
    });
  });
}
