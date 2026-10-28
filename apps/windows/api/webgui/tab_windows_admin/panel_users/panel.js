/**
 * =============================================================================
 * Название: Панель управления учетными записями и сессиями Windows
 * =============================================================================
 * Описание:
 *   Отображение локальных и доменных пользователей, фильтрация (администраторы,
 *   скрытые, онлайн), создание учетных записей, отключение сессий, удаление
 *   и вызов модального окна универсального ИИ-досье (AIModalDialog).
 *
 * Файл: apps/windows/api/webgui/tab_windows_admin/panel_users/panel.js
 * Пакет: windows/api/webgui/tab_windows_admin
 * Автор: hypo69
 * Updated: 2026-10-20 17:18:00
 * =============================================================================
 */

import { escapeHtml } from '../common/ui_utils.js';
import { fetchStatus } from '../panel_overview/panel.js';

let _accountsCache = [];
let currentUserFilter = 'all';

export function getAccountsCache() {
  return _accountsCache;
}

export function getCurrentUserFilter() {
  return currentUserFilter;
}

export function setCurrentUserFilter(filter) {
  currentUserFilter = filter || 'all';
}

/**
 * Загрузка учетных записей Windows с фильтрацией.
 * @param {string} [filterType=currentUserFilter] - Тип фильтра ('all', 'active', 'hidden', 'admins').
 */
export async function fetchAccounts(filterType = currentUserFilter) {
  try {
    const res = await fetch(`/api/sysadmin/accounts?filter_type=${encodeURIComponent(filterType)}`);
    if (!res.ok) return;
    const data = await res.json();
    _accountsCache = data.accounts || [];

    const badge = document.getElementById('winadmin-users-badge');
    if (badge) badge.innerText = `${_accountsCache.length} аккаунтов (${data.total || _accountsCache.length} всего)`;

    renderUsersTable(_accountsCache);
  } catch (e) {
    console.error('[WinAdminTab] Ошибка загрузки аккаунтов:', e);
    const tbody = document.getElementById('winadmin-users-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger p-3">Ошибка загрузки аккаунтов: ${escapeHtml(e.message)}</td></tr>`;
    }
  }
}

/**
 * Отрисовка таблицы учетных записей.
 * @param {Array} accounts - Список пользователей.
 */
export function renderUsersTable(accounts) {
  const tbody = document.getElementById('winadmin-users-tbody');
  if (!tbody) return;

  if (!accounts || accounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-3">Учетные записи по выбранному фильтру не найдены</td></tr>';
    return;
  }

  tbody.innerHTML = accounts.map((u, idx) => {
    const badges = [];
    if (u.is_admin) badges.push('<span class="ui-badge ui-badge-warning me-1">Admin</span>');
    if (u.is_hidden) badges.push('<span class="ui-badge ui-badge-neutral me-1">Скрытый</span>');
    if (!u.enabled) badges.push('<span class="ui-badge ui-badge-danger me-1">Отключен</span>');

    let statusBadge = '<span class="ui-badge ui-badge-neutral">Офлайн</span>';
    if (u.is_logged_in) {
      statusBadge = '<span class="ui-badge ui-badge-success">● В сети</span>';
    } else if (!u.enabled) {
      statusBadge = '<span class="ui-badge ui-badge-danger">Отключен</span>';
    }

    const resInfo = u.process_count > 0
      ? `<span class="text-info">${u.process_count} проц.</span> <span class="text-muted">(${u.memory_rss_mb || 0} MB)</span>`
      : '<span class="text-muted">-</span>';

    const profInfo = u.profile_size_mb > 0
      ? `<span title="${escapeHtml(u.profile_path || '')}">${u.profile_size_mb} MB</span>`
      : (u.profile_path ? `<span class="text-muted" title="${escapeHtml(u.profile_path)}">Локальный</span>` : '<span class="text-muted">-</span>');

    const groupsStr = (u.groups && u.groups.length > 0) ? u.groups.join(', ') : 'Users';
    const fullNameDesc = u.full_name ? `${escapeHtml(u.full_name)}` : (u.description ? `<span class="text-muted">${escapeHtml(u.description)}</span>` : '<span class="text-muted">—</span>');

    return `
      <tr class="winadmin-user-row" data-idx="${idx}" style="cursor: pointer;" title="Нажмите для открытия досье Principal">
        <td>
          <div class="d-flex align-items-center gap-1.5">
            <i class="bi bi-person-circle text-primary fs-6"></i>
            <div>
              <span class="fw-semibold text-body">${escapeHtml(u.name)}</span>
              <div class="mt-0.5">${badges.join('')}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="small">${fullNameDesc}</div>
        </td>
        <td>
          <div class="text-truncate text-secondary small" style="max-width: 140px;" title="${escapeHtml(groupsStr)}">${escapeHtml(groupsStr)}</div>
          <div class="font-monospace text-muted small text-truncate" style="max-width: 130px;" title="${escapeHtml(u.sid || '')}">${escapeHtml((u.sid || '').slice(-12) || '-')}</div>
        </td>
        <td class="small">
          ${profInfo}
        </td>
        <td class="small font-monospace">
          ${resInfo}
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          ${u.is_logged_in ? `
            <button class="btn btn-xs btn-outline-warning py-0 px-1.5 btn-disconnect-user me-1" data-user="${escapeHtml(u.name)}" title="Отключить сессию">
              Выход
            </button>
          ` : ''}
          <button class="btn btn-xs btn-outline-danger py-0 px-1.5 btn-delete-user" data-user="${escapeHtml(u.name)}" title="Удалить пользователя">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.winadmin-user-row').forEach(row => {
    row.onclick = (evt) => {
      if (evt.target.closest('button, a, input, select, .no-modal-trigger')) return;
      const idx = parseInt(row.getAttribute('data-idx'), 10);
      const u = accounts[idx];
      if (u) openUserAiModal(u);
    };
  });

  tbody.querySelectorAll('.btn-disconnect-user').forEach(btn => {
    btn.onclick = async (evt) => {
      evt.stopPropagation();
      const user = btn.getAttribute('data-user');
      if (confirm(`Отключить сессию пользователя ${user}?`)) {
        await fetch(`/api/sysadmin/users/${encodeURIComponent(user)}/disconnect`, { method: 'POST' });
        fetchAccounts(currentUserFilter);
        fetchStatus();
      }
    };
  });

  tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.onclick = (evt) => {
      evt.stopPropagation();
      const user = btn.getAttribute('data-user');
      if (user) deleteUserAction(user);
    };
  });
}

/**
 * Фильтрация таблицы пользователей по тексту.
 * @param {string} query - Поисковый запрос.
 */
export function filterUsersTable(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderUsersTable(_accountsCache);
    return;
  }
  const filtered = _accountsCache.filter(u =>
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.full_name && u.full_name.toLowerCase().includes(q)) ||
    (u.sid && u.sid.toLowerCase().includes(q)) ||
    (u.description && u.description.toLowerCase().includes(q))
  );
  renderUsersTable(filtered);
}

/**
 * Открытие универсального модального окна ИИ-ассистента для учетной записи Windows.
 * @param {Object|string} identifierOrObj - Объект пользователя или имя учетной записи.
 */
export async function openUserAiModal(identifierOrObj) {
  let u = (typeof identifierOrObj === 'object' && identifierOrObj !== null)
    ? identifierOrObj
    : (_accountsCache || []).find(a => a.name === identifierOrObj || a.sid === identifierOrObj);

  if (!u && typeof identifierOrObj === 'string') {
    try {
      const res = await fetch(`/api/windows/identity/explain/${encodeURIComponent(identifierOrObj)}`);
      if (res.ok) {
        u = await res.json();
      }
    } catch (_) {}
    if (!u) u = { name: identifierOrObj };
  }
  if (!u) return;

  const globalModal = window.AIModalDialog || window.AITableModal || (window.parent && (window.parent.AIModalDialog || window.parent.AITableModal));
  if (!globalModal) {
    alert(`Пользователь: ${u.name}\nSID: ${u.sid || '—'}\nСтатус: ${u.is_logged_in ? 'В сети' : 'Офлайн'}`);
    return;
  }

  const badges = [
    { text: u.is_admin ? 'Администратор' : 'Пользователь', class: u.is_admin ? 'ui-badge ui-badge-danger' : 'ui-badge ui-badge-primary' },
    { text: u.is_logged_in ? 'В сети' : 'Офлайн', class: u.is_logged_in ? 'ui-badge ui-badge-success' : 'ui-badge ui-badge-neutral' }
  ];
  if (u.is_hidden) badges.push({ text: 'Скрытый', class: 'ui-badge ui-badge-neutral' });
  if (!u.enabled) badges.push({ text: 'Отключен', class: 'ui-badge ui-badge-danger' });

  const metadata = [
    { label: 'Имя пользователя', value: u.name },
    { label: 'Полное имя', value: u.full_name || '—' },
    { label: 'Описание', value: u.description || '—' },
    { label: 'SID субъекта', value: u.sid || '—', isCode: true },
    { label: 'Группы безопасности', value: (u.groups && u.groups.length > 0) ? u.groups.join(', ') : 'Users' },
    { label: 'Каталог профиля', value: u.profile_path || '—', fullWidth: true },
    { label: 'Активных процессов', value: String(u.process_count || 0) },
    { label: 'Память процессов (RAM)', value: `${u.memory_rss_mb || 0} MB` }
  ];

  globalModal.show({
    icon: '👤',
    title: `Пользователь: ${u.name}`,
    subtitle: `SID: ${u.sid || '—'} | ${u.is_logged_in ? 'В сети' : 'Офлайн'}`,
    panelId: 'panel-winadmin-users',
    tableType: 'user_account',
    badges: badges,
    metadata: metadata,
    rawTitle: 'Телеметрия учетной записи Windows',
    rawContent: JSON.stringify(u, null, 2),
    requestData: u
  });
}

/**
 * Обработка отправки формы создания пользователя.
 */
export async function handleCreateUserSubmit() {
  const username = document.getElementById('create-user-name')?.value?.trim();
  const password = document.getElementById('create-user-pwd')?.value || null;
  const fullName = document.getElementById('create-user-fullname')?.value?.trim() || '';
  const description = document.getElementById('create-user-desc')?.value?.trim() || '';

  if (!username) {
    alert('Введите имя пользователя');
    return;
  }

  try {
    const res = await fetch('/api/windows/identity/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password: password || undefined,
        full_name: fullName,
        description,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Не удалось создать пользователя');

    alert(`Пользователь '${username}' успешно создан`);

    const modalEl = document.getElementById('createUserModal');
    if (modalEl && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    document.getElementById('create-user-form')?.reset();
    await fetchAccounts(currentUserFilter);
    await fetchStatus();
  } catch (err) {
    alert(`Ошибка создания пользователя: ${err.message}`);
  }
}

/**
 * Удаление локального пользователя.
 * @param {string} username - Имя удаляемого пользователя.
 */
export async function deleteUserAction(username) {
  if (!confirm(`Вы уверены, что хотите удалить пользователя '${username}'?`)) return;
  try {
    const res = await fetch(`/api/windows/identity/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка удаления');
    alert(`Пользователь '${username}' удален`);
    await fetchAccounts(currentUserFilter);
    await fetchStatus();
  } catch (err) {
    alert(`Ошибка удаления: ${err.message}`);
  }
}
