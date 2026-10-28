/**
 * =============================================================================
 * Process Name: Windows User Directories - Storage Summary Panel
 * =============================================================================
 * Description:
 *   Модуль загрузки глобальной статистики хранилища пользовательских данных:
 *   общее число профилей пользователей, суммарный объем данных, счетчик файлов
 *   и размер осиротевших каталогов.
 *
 * File: panel.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories/panel_summary
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

/**
 * Загрузка сводной статистики хранилища пользователей.
 * @returns {Promise<void>}
 */
export async function loadSummary() {
  try {
    const res = await fetch('/api/admin/user-directories/summary');
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === 'ok' && data.summary) {
      const s = data.summary;
      const elUsers = document.getElementById('metric-total-users');
      const elStorage = document.getElementById('metric-total-storage');
      const elFiles = document.getElementById('metric-total-files');
      const elOrphaned = document.getElementById('metric-orphaned-size');

      if (elUsers) elUsers.textContent = s.total_users || 0;
      if (elStorage) elStorage.textContent = s.total_storage_formatted || '0 B';
      if (elFiles) elFiles.textContent = s.total_files_count || 0;
      if (elOrphaned) elOrphaned.textContent = s.orphaned_formatted || '0 B';
    }
  } catch (err) {
    console.warn('Ошибка загрузки сводки хранилища:', err);
  }
}

/**
 * Загрузка счетчика осиротевших каталогов в бейдж тулбара.
 * @returns {Promise<void>}
 */
export async function loadOrphanedBadge() {
  try {
    const res = await fetch('/api/admin/user-directories/orphaned');
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === 'ok') {
      const badge = document.getElementById('badge-orphaned-count');
      if (badge) badge.textContent = data.total || 0;
    }
  } catch (err) {
    console.warn('Ошибка проверки осиротевших каталогов:', err);
  }
}
