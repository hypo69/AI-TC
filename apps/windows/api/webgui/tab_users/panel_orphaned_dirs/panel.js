/**
 * @file apps/windows/api/webgui/tab_users/panel_orphaned_dirs/panel.js
 * @description Панель инспекции и очистки мертвых директорий пользователей в хранилище data/users/
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:35:00
 */

import { apiFetch, showStatusAlert, formatBytes, formatDate, escapeHtml } from '../common/ui_utils.js';

/**
 * Загрузка списка не привязанных (orphaned) директорий пользователей
 */
export async function loadOrphanedDirs() {
  const tbody = document.getElementById('orphaned-dirs-tbody');
  const countEl = document.getElementById('orphaned-dirs-count');
  const sizeEl = document.getElementById('orphaned-dirs-size');
  const filesEl = document.getElementById('orphaned-dirs-files');
  const btnCleanupAll = document.getElementById('btn-cleanup-all-orphaned');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-warning me-2" role="status"></div>
          Сканирование хранилища data/users/...
        </td>
      </tr>`;
  }

  try {
    const data = await apiFetch('/api/admin/users/orphaned-dirs');
    const dirs = data.orphaned_dirs || [];

    if (countEl) countEl.textContent = data.total || 0;
    if (sizeEl) sizeEl.textContent = formatBytes(data.total_size_bytes || 0);
    if (filesEl) filesEl.textContent = data.total_files || 0;

    if (btnCleanupAll) {
      btnCleanupAll.disabled = (dirs.length === 0);
    }

    if (!tbody) return;

    if (dirs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-success">
            <i class="bi bi-check-circle-fill fs-4 d-block mb-1"></i>
            Мертвых директорий не обнаружено. Все папки соответствуют активным пользователям.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = dirs.map(d => {
      const badgeClass = d.is_test_dir ? 'bg-secondary' : 'bg-warning text-dark';
      return `
        <tr data-dir-name="${escapeHtml(d.name)}">
          <td class="font-monospace fw-bold text-light">
            <i class="bi bi-folder text-warning me-1"></i>${escapeHtml(d.name)}
          </td>
          <td>
            <span class="badge ${badgeClass} small">${escapeHtml(d.reason)}</span>
          </td>
          <td class="text-center">${d.files_count}</td>
          <td class="text-center">${formatBytes(d.size_bytes)}</td>
          <td class="small">${formatDate(d.modified_at)}</td>
          <td class="text-center">
            <button class="btn btn-outline-danger btn-sm py-0 px-2 btn-delete-single-orphaned" data-dir="${escapeHtml(d.name)}" title="Удалить директорию">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete-single-orphaned').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dirName = btn.getAttribute('data-dir');
        if (!dirName) return;
        if (!confirm(`Удалить мертвую директорию "${dirName}"?`)) return;

        btn.disabled = true;
        try {
          await apiFetch('/api/admin/users/orphaned-dirs/clean', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dirs: [dirName] })
          });
          showStatusAlert(`Директория "${dirName}" успешно удалена.`, 'success');
          loadOrphanedDirs();
        } catch (err) {
          showStatusAlert(`Ошибка удаления директории ${dirName}: ${err.message}`, 'danger');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error('[UsersTab] Error loading orphaned dirs:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-octagon fs-4 d-block mb-1"></i>
            Ошибка сканирования: ${escapeHtml(err.message)}
          </td>
        </tr>`;
    }
  }
}

/**
 * Инициализация слушателей модального окна мертвых директорий
 */
export function initOrphanedDirsListeners() {
  const btnCheckOrphaned = document.getElementById('btn-check-orphaned-dirs');
  if (btnCheckOrphaned) {
    btnCheckOrphaned.addEventListener('click', () => {
      const modalEl = document.getElementById('modal-orphaned-dirs');
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
        loadOrphanedDirs();
      }
    });
  }

  const btnRefreshOrphaned = document.getElementById('btn-refresh-orphaned-dirs');
  if (btnRefreshOrphaned) {
    btnRefreshOrphaned.addEventListener('click', () => {
      loadOrphanedDirs();
    });
  }

  const btnCleanupAll = document.getElementById('btn-cleanup-all-orphaned');
  if (btnCleanupAll) {
    btnCleanupAll.addEventListener('click', async () => {
      if (!confirm('Вы уверены, что хотите удалить ВСЕ обнаруженные мертвые директории пользователей? Это действие необратимо.')) {
        return;
      }
      btnCleanupAll.disabled = true;
      try {
        const res = await apiFetch('/api/admin/users/orphaned-dirs/clean', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        showStatusAlert(`Успешно удалено мертвых директорий: ${res.total_deleted} (освобождено: ${formatBytes(res.freed_bytes)})`, 'success');
        loadOrphanedDirs();
      } catch (err) {
        showStatusAlert(`Ошибка очистки мертвых директорий: ${err.message}`, 'danger');
      } finally {
        btnCleanupAll.disabled = false;
      }
    });
  }
}
