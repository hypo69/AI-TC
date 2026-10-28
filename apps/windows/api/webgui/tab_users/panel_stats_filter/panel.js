/**
 * @file apps/windows/api/webgui/tab_users/panel_stats_filter/panel.js
 * @description Панель статистики и фильтров каталога пользователей (роли, статусы, текстовый поиск)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:32:00
 */

/**
 * Отрисовка метрических карточек пользователей
 * @param {Object} stats Объект статистики {total, active, admins, telegram}
 */
export function renderStats(stats) {
  const s = stats || {};
  const totalEl = document.getElementById('stat-total-users');
  const activeEl = document.getElementById('stat-active-users');
  const adminEl = document.getElementById('stat-admin-users');
  const tgEl = document.getElementById('stat-tg-users');

  if (totalEl) totalEl.textContent = s.total || 0;
  if (activeEl) activeEl.textContent = s.active || 0;
  if (adminEl) adminEl.textContent = s.admins || 0;
  if (tgEl) tgEl.textContent = s.telegram || 0;
}

/**
 * Инициализация слушателей фильтров и поискового инпута
 * @param {Function} onSearch Callback при изменении строки поиска
 * @param {Function} onRoleChange Callback при смене фильтра роли
 * @param {Function} onStatusChange Callback при смене фильтра статуса
 */
export function initFilterListeners(onSearch, onRoleChange, onStatusChange) {
  const searchInput = document.getElementById('users-search-input');
  const searchClear = document.getElementById('users-search-clear');
  let debounceTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (searchClear) {
        searchClear.classList.toggle('d-none', !val);
      }
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (onSearch) onSearch(val.trim());
      }, 300);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClear.classList.add('d-none');
      if (onSearch) onSearch('');
    });
  }

  const filterRole = document.getElementById('users-filter-role');
  if (filterRole) {
    filterRole.addEventListener('change', (e) => {
      if (onRoleChange) onRoleChange(e.target.value);
    });
  }

  const filterStatus = document.getElementById('users-filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      if (onStatusChange) onStatusChange(e.target.value);
    });
  }
}
