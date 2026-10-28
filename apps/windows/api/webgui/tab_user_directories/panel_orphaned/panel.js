/**
 * =============================================================================
 * Process Name: Windows User Directories - Orphaned Directories Panel
 * =============================================================================
 * Description:
 *   Модуль обнаружения, аудита и безопасной очистки «осиротевших» (orphaned)
 *   пользовательских директорий, оставшихся на диске после удаления учетных записей.
 *
 * File: panel.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories/panel_orphaned
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

import { state, escapeHtml, showAlert } from '../common/ui_utils.js';
import { loadSummary } from '../panel_summary/panel.js';

/**
 * Открытие модального окна управления осиротевшими директориями.
 * @returns {Promise<void>}
 */
export async function openOrphanedModal() {
  const modalEl = document.getElementById('modal-orphaned-user-dirs');
  if (!modalEl) return;
  if (window.bootstrap?.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
  await loadOrphanedDirs();
}

/**
 * Загрузка списка осиротевших директорий с бэкенда.
 * @returns {Promise<void>}
 */
export async function loadOrphanedDirs() {
  const tbody = document.getElementById('modal-orphaned-dirs-tbody');
  const countEl = document.getElementById('modal-orphaned-count');
  const sizeEl = document.getElementById('modal-orphaned-size');
  const filesEl = document.getElementById('modal-orphaned-files');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-warning me-2"></div> Сканирование...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/admin/user-directories/orphaned');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.orphanedDirs = data.orphaned_dirs || [];

    if (countEl) countEl.textContent = data.total || 0;
    if (sizeEl) sizeEl.textContent = data.total_size_formatted || '0 B';
    if (filesEl) filesEl.textContent = data.total_files || 0;

    const badge = document.getElementById('badge-orphaned-count');
    if (badge) badge.textContent = data.total || 0;

    renderOrphanedDirsTable();
  } catch (err) {
    console.error('Ошибка загрузки осиротевших директорий:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-3 text-danger small">
            Ошибка сканирования: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Рендеринг таблицы осиротевших каталогов.
 */
export function renderOrphanedDirsTable() {
  const tbody = document.getElementById('modal-orphaned-dirs-tbody');
  if (!tbody) return;

  if (state.orphanedDirs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-success small">
          <i class="bi bi-check-circle fs-4 d-block mb-1"></i>
          Осиротевших каталогов не обнаружено. Все директории привязаны к активным пользователям!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.orphanedDirs.map(d => `
    <tr>
      <td>
        <div class="fw-bold font-monospace text-warning small">${escapeHtml(d.dir_name)}</div>
        <div class="text-muted small" style="font-size: 0.72rem;">${escapeHtml(d.full_path)}</div>
      </td>
      <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(d.reason)}</span></td>
      <td class="text-center font-monospace">${d.files_count}</td>
      <td class="text-center font-monospace small">${d.size_formatted}</td>
      <td class="small text-muted font-monospace" style="font-size: 0.76rem;">${d.modified_formatted}</td>
      <td class="text-center">
        <button class="btn btn-xs btn-outline-danger btn-clean-single-orphaned" 
                data-dir="${escapeHtml(d.dir_name)}" 
                title="Удалить этот каталог">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-clean-single-orphaned').forEach(btn => {
    btn.onclick = () => {
      const dirName = btn.dataset.dir;
      if (confirm(`Удалить осиротевший каталог "${dirName}"?`)) {
        cleanOrphanedDirs([dirName]);
      }
    };
  });
}

/**
 * Очистка осиротевших каталогов (конкретных или всех).
 * @param {Array<string>|null} [dirsList=null] - Список имен директорий или null для всех
 * @returns {Promise<void>}
 */
export async function cleanOrphanedDirs(dirsList = null) {
  if (!dirsList && !confirm('Вы уверены, что хотите удалить ВСЕ осиротевшие каталоги пользователей? Это действие необратимо.')) {
    return;
  }

  try {
    const payload = dirsList ? { dirs: dirsList } : {};
    const res = await fetch('/api/admin/user-directories/orphaned/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    showAlert(`Удалено каталогов: ${data.deleted_count}, освобождено места: ${data.freed_formatted}`, 'success');

    await loadOrphanedDirs();
    await loadSummary();
  } catch (err) {
    console.error('Ошибка очистки осиротевших каталогов:', err);
    showAlert(`Ошибка очистки каталогов: ${err.message}`, 'danger');
  }
}
