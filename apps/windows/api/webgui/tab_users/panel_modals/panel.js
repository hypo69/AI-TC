/**
 * @file apps/windows/api/webgui/tab_users/panel_modals/panel.js
 * @description Модальные окна управления учетными записями (создание, редактирование, сброс паролей, профиль, удаление)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:34:00
 */

import { apiFetch, showStatusAlert, generatePassword, escapeHtml } from '../common/ui_utils.js';

/**
 * Инициализация слушателей модальных окон
 * @param {Function} onRefresh Callback обновления списка пользователей
 */
export function initModalListeners(onRefresh) {
  const btnOpenCreate = document.getElementById('btn-open-create-user');
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener('click', () => {
      const form = document.getElementById('form-create-user');
      if (form) form.reset();
      const adminSw = document.getElementById('create-user-is-admin');
      if (adminSw) adminSw.checked = false;
      const roleLabel = document.getElementById('create-role-label');
      if (roleLabel) {
        roleLabel.textContent = 'Пользователь (user)';
        roleLabel.className = 'text-info';
      }
      const actSw = document.getElementById('create-user-is-active');
      if (actSw) actSw.checked = true;
      const verSw = document.getElementById('create-user-verified');
      if (verSw) verSw.checked = true;

      const modalEl = document.getElementById('modal-create-user');
      if (window.bootstrap && window.bootstrap.Modal) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    });
  }

  const createAdminSw = document.getElementById('create-user-is-admin');
  const createRoleLabel = document.getElementById('create-role-label');
  if (createAdminSw && createRoleLabel) {
    createAdminSw.addEventListener('change', (e) => {
      createRoleLabel.textContent = e.target.checked ? 'Администратор (admin)' : 'Пользователь (user)';
      createRoleLabel.className = e.target.checked ? 'text-warning' : 'text-info';
    });
  }

  const editAdminSw = document.getElementById('edit-user-is-admin');
  const editRoleLabel = document.getElementById('edit-role-label');
  if (editAdminSw && editRoleLabel) {
    editAdminSw.addEventListener('change', (e) => {
      editRoleLabel.textContent = e.target.checked ? 'Администратор (admin)' : 'Пользователь (user)';
      editRoleLabel.className = e.target.checked ? 'text-warning' : 'text-info';
    });
  }

  const btnGenCreatePwd = document.getElementById('btn-gen-create-password');
  if (btnGenCreatePwd) {
    btnGenCreatePwd.addEventListener('click', () => {
      const pwdInput = document.getElementById('create-user-password');
      if (pwdInput) pwdInput.value = generatePassword(12);
    });
  }

  const btnGenPwdVal = document.getElementById('btn-gen-pwd-val');
  if (btnGenPwdVal) {
    btnGenPwdVal.addEventListener('click', () => {
      const pwdInput = document.getElementById('pwd-input-val');
      if (pwdInput) pwdInput.value = generatePassword(12);
    });
  }

  // Create User Form Submit
  const formCreate = document.getElementById('form-create-user');
  if (formCreate) {
    formCreate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-create-user');
      if (submitBtn) submitBtn.disabled = true;

      const isAdmin = document.getElementById('create-user-is-admin')?.checked ? 1 : 0;
      const payload = {
        email: document.getElementById('create-user-email')?.value.trim(),
        name: document.getElementById('create-user-name')?.value.trim(),
        password: document.getElementById('create-user-password')?.value.trim(),
        role: isAdmin ? 'admin' : 'user',
        is_admin: isAdmin,
        is_active: document.getElementById('create-user-is-active')?.checked ? 1 : 0,
        is_email_verified: document.getElementById('create-user-verified')?.checked ? 1 : 0
      };

      try {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const modalEl = document.getElementById('modal-create-user');
        if (window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        showStatusAlert(`Пользователь ${escapeHtml(payload.name)} успешно создан!`, 'success');
        if (onRefresh) onRefresh();
      } catch (err) {
        showStatusAlert(`Ошибка создания пользователя: ${err.message}`, 'danger');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Edit User Form Submit
  const formEdit = document.getElementById('form-edit-user');
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-edit-user');
      if (submitBtn) submitBtn.disabled = true;

      const userId = parseInt(document.getElementById('edit-user-id')?.value, 10);
      const isAdmin = document.getElementById('edit-user-is-admin')?.checked ? 1 : 0;
      const payload = {
        email: document.getElementById('edit-user-email')?.value.trim(),
        name: document.getElementById('edit-user-name')?.value.trim(),
        role: isAdmin ? 'admin' : 'user',
        is_admin: isAdmin,
        is_active: document.getElementById('edit-user-is-active')?.checked ? 1 : 0,
        is_email_verified: document.getElementById('edit-user-verified')?.checked ? 1 : 0
      };

      try {
        await apiFetch(`/api/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const modalEl = document.getElementById('modal-edit-user');
        if (window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        showStatusAlert(`Данные пользователя #${userId} успешно обновлены!`, 'success');
        if (onRefresh) onRefresh();
      } catch (err) {
        showStatusAlert(`Ошибка обновления: ${err.message}`, 'danger');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Password Form Submit
  const formPwd = document.getElementById('form-password-user');
  if (formPwd) {
    formPwd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-pwd-user');
      if (submitBtn) submitBtn.disabled = true;

      const userId = parseInt(document.getElementById('pwd-user-id')?.value, 10);
      const newPassword = document.getElementById('pwd-input-val')?.value.trim();

      try {
        await apiFetch(`/api/admin/users/${userId}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword })
        });
        const modalEl = document.getElementById('modal-password-user');
        if (window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        showStatusAlert(`Пароль для пользователя #${userId} успешно установлен!`, 'success');
        if (onRefresh) onRefresh();
      } catch (err) {
        showStatusAlert(`Ошибка установки пароля: ${err.message}`, 'danger');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Confirm Delete Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-user');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      btnConfirmDelete.disabled = true;
      const userId = parseInt(document.getElementById('delete-user-id')?.value, 10);

      try {
        await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        const modalEl = document.getElementById('modal-delete-user');
        if (window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        showStatusAlert(`Пользователь #${userId} успешно удалён.`, 'success');
        if (onRefresh) onRefresh();
      } catch (err) {
        showStatusAlert(`Ошибка удаления пользователя: ${err.message}`, 'danger');
      } finally {
        btnConfirmDelete.disabled = false;
      }
    });
  }
}

/**
 * Открытие модального окна редактирования
 * @param {Object} user
 */
export function openEditModal(user) {
  if (!user) return;
  const isEditAdmin = Boolean(user.is_admin || user.role === 'admin');

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : '';
  };

  setVal('edit-user-id', user.id);
  const badge = document.getElementById('edit-user-id-badge');
  if (badge) badge.textContent = user.id;

  setVal('edit-user-email', user.email || '');
  setVal('edit-user-name', user.name || '');

  const editAdminSw = document.getElementById('edit-user-is-admin');
  const editRoleLabel = document.getElementById('edit-role-label');
  if (editAdminSw) {
    editAdminSw.checked = isEditAdmin;
    editAdminSw.disabled = (user.id === 1);
    if (editRoleLabel) {
      editRoleLabel.textContent = isEditAdmin ? 'Администратор (admin)' : 'Пользователь (user)';
      editRoleLabel.className = isEditAdmin ? 'text-warning' : 'text-info';
    }
  }

  const actSw = document.getElementById('edit-user-is-active');
  if (actSw) actSw.checked = Boolean(user.is_active);

  const verSw = document.getElementById('edit-user-verified');
  if (verSw) verSw.checked = Boolean(user.is_email_verified);

  const modalEl = document.getElementById('modal-edit-user');
  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Открытие модального окна смены пароля
 * @param {number} userId
 * @param {string} userName
 */
export function openPasswordModal(userId, userName) {
  const pwdId = document.getElementById('pwd-user-id');
  if (pwdId) pwdId.value = userId;

  const pwdTarget = document.getElementById('pwd-user-target');
  if (pwdTarget) pwdTarget.textContent = `${userName} (ID #${userId})`;

  const pwdVal = document.getElementById('pwd-input-val');
  if (pwdVal) pwdVal.value = '';

  const modalEl = document.getElementById('modal-password-user');
  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Открытие модального окна подробного досье и настроек пользователя
 * @param {number} userId
 */
export async function openDetailsModal(userId) {
  const modalEl = document.getElementById('modal-details-user');
  const contentEl = document.getElementById('details-user-content');
  if (!modalEl || !contentEl) return;

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  contentEl.innerHTML = `
    <div class="text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
      Загрузка профиля пользователя...
    </div>`;

  try {
    const data = await apiFetch(`/api/admin/users/${userId}`);
    const u = data.user || {};
    const s = data.settings || {};
    const perms = data.permissions || [];

    contentEl.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <h6 class="text-primary border-bottom pb-1 mb-2">👤 Основные данные</h6>
          <table class="table table-sm table-borderless small mb-0">
            <tr><td class="text-muted" style="width:120px;">ID:</td><td class="fw-bold">${u.id}</td></tr>
            <tr><td class="text-muted">Email:</td><td>${escapeHtml(u.email)} ${u.is_email_verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-secondary">Unverified</span>'}</td></tr>
            <tr><td class="text-muted">Имя:</td><td>${escapeHtml(u.name || '—')}</td></tr>
            <tr><td class="text-muted">Роль:</td><td><span class="badge bg-info text-dark">${escapeHtml(u.role || 'user')}</span> ${u.is_admin ? '<span class="badge bg-warning text-dark">Admin</span>' : ''}</td></tr>
            <tr><td class="text-muted">Статус:</td><td>${u.is_active ? '<span class="text-success">Активен</span>' : '<span class="text-danger">Заблокирован</span>'}</td></tr>
            <tr><td class="text-muted">Пароль:</td><td>${u.has_password ? '<span class="text-success">Установлен</span>' : '<span class="text-muted">Не задан</span>'}</td></tr>
            <tr><td class="text-muted">Создан:</td><td>${escapeHtml(u.created_at || '—')}</td></tr>
            <tr><td class="text-muted">Последний вход:</td><td>${escapeHtml(u.last_login || '—')}</td></tr>
          </table>
        </div>
        <div class="col-md-6">
          <h6 class="text-info border-bottom pb-1 mb-2">✈️ Telegram & Настройки</h6>
          <table class="table table-sm table-borderless small mb-0">
            <tr><td class="text-muted" style="width:130px;">Telegram ID:</td><td>${u.telegram_id ? escapeHtml(u.telegram_id) : '<span class="text-muted">Не привязан</span>'}</td></tr>
            <tr><td class="text-muted">TG Username:</td><td>${u.telegram_username ? `@${escapeHtml(u.telegram_username)}` : '<span class="text-muted">—</span>'}</td></tr>
            <tr><td class="text-muted">Тема UI:</td><td>${escapeHtml(s.theme || 'dark')}</td></tr>
            <tr><td class="text-muted">Язык:</td><td>${escapeHtml(s.language || 'ru')}</td></tr>
            <tr><td class="text-muted">TTS голос:</td><td>${escapeHtml(s.tts_voice || 'ru-RU-DmitryNeural')} (${escapeHtml(s.tts_system || 'edge-tts')})</td></tr>
            <tr><td class="text-muted">Модель чата:</td><td>${escapeHtml(s.model || 'По умолчанию')}</td></tr>
          </table>
        </div>
        <div class="col-12 mt-3">
          <h6 class="text-warning border-bottom pb-1 mb-2">🛡️ Разрешения системы</h6>
          <div class="d-flex flex-wrap gap-1">
            ${perms.length > 0 ? perms.map(p => `<span class="badge bg-secondary">${escapeHtml(p)}</span>`).join('') : '<span class="text-muted small">Нет явных разрешений</span>'}
          </div>
        </div>
        ${s.system_instruction ? `
        <div class="col-12 mt-2">
          <h6 class="border-bottom pb-1 mb-1">📝 Пользовательская системная инструкция</h6>
          <pre class="bg-body-tertiary p-2 rounded border small font-monospace" style="max-height:120px;overflow-y:auto;">${escapeHtml(s.system_instruction)}</pre>
        </div>` : ''}
      </div>`;
  } catch (err) {
    contentEl.innerHTML = `<div class="text-danger py-3">Ошибка загрузки данных: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Открытие модального окна подтверждения удаления
 * @param {number} userId
 * @param {string} userName
 */
export function openDeleteModal(userId, userName) {
  const delId = document.getElementById('delete-user-id');
  if (delId) delId.value = userId;

  const target = document.getElementById('delete-user-name-target');
  if (target) target.textContent = `${userName} (ID #${userId})`;

  const modalEl = document.getElementById('modal-delete-user');
  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}
