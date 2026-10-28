/**
 * =============================================================================
 * Process Name: Windows User Directories Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Модульный клиентский оркестратор вкладки управления пользовательскими каталогами:
 *   координирует сводку хранилища, список профилей пользователей, проводник файлов,
 *   предпросмотр контента и очистку осиротевших директорий.
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

import { state } from './common/ui_utils.js';
import { loadSummary, loadOrphanedBadge } from './panel_summary/panel.js';
import { loadUsersList, renderUsersList } from './panel_users/panel.js';
import { loadUserFiles, deleteFile } from './panel_files/panel.js';
import {
  openOrphanedModal,
  loadOrphanedDirs,
  cleanOrphanedDirs,
} from './panel_orphaned/panel.js';

/**
 * Применение клиентских фильтров поиска.
 */
export function applyFilters() {
  renderUsersList();
  if (state.selectedUserId) {
    loadUserFiles(state.selectedUserId);
  }
}

/**
 * Полное обновление всех данных вкладки.
 * @returns {Promise<void>}
 */
export async function refreshData() {
  await Promise.all([
    loadSummary(),
    loadUsersList(),
    loadOrphanedBadge(),
  ]);
}

/**
 * Настройка обработчиков событий элементов управления.
 */
function setupEventListeners() {
  const refreshBtn = document.getElementById('btn-refresh-user-dirs');
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn._bound = true;
    refreshBtn.onclick = () => refreshData();
  }

  // Поиск с дебаунсом
  const searchInput = document.getElementById('user-dirs-search-input');
  const searchClear = document.getElementById('user-dirs-search-clear');
  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    let timeout = null;
    searchInput.oninput = () => {
      clearTimeout(timeout);
      state.searchQuery = searchInput.value.trim();
      if (searchClear) {
        searchClear.classList.toggle('d-none', !state.searchQuery);
      }
      timeout = setTimeout(() => {
        applyFilters();
      }, 300);
    };
  }

  if (searchClear && searchInput && !searchClear._bound) {
    searchClear._bound = true;
    searchClear.onclick = () => {
      searchInput.value = '';
      state.searchQuery = '';
      searchClear.classList.add('d-none');
      applyFilters();
    };
  }

  // Фильтр по расширениям
  const extSelect = document.getElementById('user-dirs-ext-filter');
  if (extSelect && !extSelect._bound) {
    extSelect._bound = true;
    extSelect.onchange = () => {
      state.extFilter = extSelect.value;
      if (state.selectedUserId) {
        loadUserFiles(state.selectedUserId);
      }
    };
  }

  // Фильтры подпапок
  const subfolderGroup = document.getElementById('subfolder-filter-group');
  if (subfolderGroup && !subfolderGroup._bound) {
    subfolderGroup._bound = true;
    subfolderGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-subfolder]');
      if (!btn) return;
      subfolderGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentSubfolder = btn.dataset.subfolder || '';
      if (state.selectedUserId) {
        loadUserFiles(state.selectedUserId);
      }
    });
  }

  // Кнопки модального окна осиротевших каталогов
  const openOrphanedBtn = document.getElementById('btn-open-orphaned-dirs-modal');
  if (openOrphanedBtn && !openOrphanedBtn._bound) {
    openOrphanedBtn._bound = true;
    openOrphanedBtn.onclick = () => openOrphanedModal();
  }

  const refreshOrphanedBtn = document.getElementById('btn-modal-refresh-orphaned');
  if (refreshOrphanedBtn && !refreshOrphanedBtn._bound) {
    refreshOrphanedBtn._bound = true;
    refreshOrphanedBtn.onclick = () => loadOrphanedDirs();
  }

  const cleanAllOrphanedBtn = document.getElementById('btn-modal-clean-all-orphaned');
  if (cleanAllOrphanedBtn && !cleanAllOrphanedBtn._bound) {
    cleanAllOrphanedBtn._bound = true;
    cleanAllOrphanedBtn.onclick = () => cleanOrphanedDirs();
  }

  // Кнопка удаления файла из предпросмотра
  const previewDeleteBtn = document.getElementById('btn-preview-delete-file');
  if (previewDeleteBtn && !previewDeleteBtn._bound) {
    previewDeleteBtn._bound = true;
    previewDeleteBtn.onclick = () => {
      if (state.previewFile && state.selectedUserId) {
        deleteFile(state.selectedUserId, state.previewFile.relative_path);
      }
    };
  }
}

/**
 * Инициализация вкладки пользовательских директорий.
 * @returns {Promise<void>}
 */
export async function initUserDirectoriesTab() {
  const root = document.getElementById('user-directories-tab-root');
  if (!root) return;

  setupEventListeners();
  await refreshData();
}

// Экспорт в глобальный контекст для совместимости с роутером
window.initUserDirectoriesTab = initUserDirectoriesTab;
window.activateUserDirectoriesTab = refreshData;
window.refreshUserDirectoriesUsersList = loadUsersList;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUserDirectoriesTab);
} else {
  initUserDirectoriesTab();
}

export default initUserDirectoriesTab;
