/**
 * =============================================================================
 * Process Name: Windows User Directories - User Files Explorer Panel
 * =============================================================================
 * Description:
 *   Модуль проводника файлов пользователя: навигация по поддиректориям,
 *   фильтрация по типам и расширениям, модальный предпросмотр содержимого
 *   (текст, код, изображения), скачивание и удаление файлов.
 *
 * File: panel.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories/panel_files
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

import { state, escapeHtml, showAlert, getFileIcon } from '../common/ui_utils.js';
import { loadSummary } from '../panel_summary/panel.js';

/**
 * Загрузка файлов выбранного пользователя.
 * @param {number} userId - ID пользователя
 * @returns {Promise<void>}
 */
export async function loadUserFiles(userId) {
  const tbody = document.getElementById('user-files-table-body');
  const footerStats = document.getElementById('explorer-footer-stats');
  const footerQuota = document.getElementById('explorer-footer-quota');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          Загрузка файлов пользователя...
        </td>
      </tr>
    `;
  }

  try {
    let url = `/api/admin/user-directories/users/${userId}/tree?`;
    const params = new URLSearchParams();
    if (state.currentSubfolder) params.append('subfolder', state.currentSubfolder);
    if (state.searchQuery) params.append('q', state.searchQuery);
    if (state.extFilter) params.append('extension', state.extFilter);

    const res = await fetch(url + params.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.files = data.items || [];

    if (footerStats) {
      footerStats.innerHTML = `Файлов: <strong>${data.total_items || 0}</strong> | Общий размер: <strong>${data.total_size_formatted || '0 B'}</strong>`;
    }

    const user = state.users.find(u => u.id === userId);
    if (footerQuota && user) {
      footerQuota.innerHTML = `Квота: <strong>${user.size_formatted} / ${user.quota_formatted}</strong> (${user.quota_percent}%)`;
    }

    renderUserFilesTable();
  } catch (err) {
    console.error('Ошибка загрузки файлов:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-danger small">
            Ошибка загрузки файлов: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Рендеринг таблицы файлов пользователя.
 */
export function renderUserFilesTable() {
  const tbody = document.getElementById('user-files-table-body');
  if (!tbody) return;

  if (state.files.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted small">
          <i class="bi bi-inbox fs-3 d-block mb-1 text-secondary"></i>
          В выбранном разделе нет файлов
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.files.map(f => {
    const isDir = f.is_dir;
    const icon = isDir
      ? '<i class="bi bi-folder-fill text-warning fs-6"></i>'
      : getFileIcon(f.extension);

    const subfolderBadge = f.subfolder === 'root'
      ? '<span class="badge bg-secondary-subtle text-secondary border">root</span>'
      : `<span class="badge bg-info-subtle text-info border border-info-subtle">${escapeHtml(f.subfolder)}</span>`;

    return `
      <tr>
        <td class="text-center">${icon}</td>
        <td>
          <div class="fw-semibold text-truncate text-white" style="max-width: 260px;" title="${escapeHtml(f.relative_path)}">
            ${escapeHtml(f.name)}
          </div>
          <div class="text-muted small font-monospace" style="font-size: 0.72rem;">
            ${escapeHtml(f.relative_path)}
          </div>
        </td>
        <td class="text-center">${subfolderBadge}</td>
        <td class="text-center font-monospace small">${f.size_formatted}</td>
        <td class="small text-muted font-monospace" style="font-size: 0.76rem;">${f.modified_formatted}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm" role="group">
            ${!isDir ? `
              <button class="btn btn-xs btn-outline-info btn-preview-file" 
                      data-path="${escapeHtml(f.relative_path)}" 
                      title="Предпросмотр файла">
                <i class="bi bi-eye"></i>
              </button>
              <a href="/api/admin/user-directories/users/${state.selectedUserId}/file/download?path=${encodeURIComponent(f.relative_path)}" 
                 class="btn btn-xs btn-outline-success" 
                 title="Скачать файл" 
                 download>
                <i class="bi bi-download"></i>
              </a>
            ` : ''}
            <button class="btn btn-xs btn-outline-danger btn-delete-file" 
                    data-path="${escapeHtml(f.relative_path)}" 
                    data-is-dir="${isDir}"
                    title="Удалить">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Обработчики предпросмотра
  tbody.querySelectorAll('.btn-preview-file').forEach(btn => {
    btn.onclick = () => {
      const path = btn.dataset.path;
      openFilePreview(state.selectedUserId, path);
    };
  });

  // Обработчики удаления
  tbody.querySelectorAll('.btn-delete-file').forEach(btn => {
    btn.onclick = () => {
      const path = btn.dataset.path;
      const isDir = btn.dataset.isDir === 'true';
      const promptText = isDir
        ? `Вы уверены, что хотите удалить директорию "${path}" со всем содержимым?`
        : `Вы уверены, что хотите удалить файл "${path}"?`;
      if (confirm(promptText)) {
        deleteFile(state.selectedUserId, path);
      }
    };
  });
}

/**
 * Открытие модального окна предпросмотра файла.
 * @param {number} userId - ID пользователя
 * @param {string} path - Относительный путь к файлу
 */
export async function openFilePreview(userId, path) {
  const modalEl = document.getElementById('modal-file-preview');
  if (!modalEl) return;

  const titleEl = document.getElementById('modal-file-preview-title');
  const pathEl = document.getElementById('preview-file-path');
  const sizeEl = document.getElementById('preview-file-size');
  const typeEl = document.getElementById('preview-file-type');
  const contentWrapper = document.getElementById('preview-content-wrapper');
  const downloadLink = document.getElementById('btn-preview-download-file');

  if (titleEl) titleEl.textContent = `Предпросмотр: ${path.split('/').pop()}`;
  if (pathEl) pathEl.textContent = `data/users/${userId}/${path}`;
  if (sizeEl) sizeEl.textContent = '...';
  if (typeEl) typeEl.textContent = '...';
  if (contentWrapper) {
    contentWrapper.innerHTML = `
      <div class="text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2"></div> Загрузка содержимого...
      </div>
    `;
  }
  if (downloadLink) {
    downloadLink.href = `/api/admin/user-directories/users/${userId}/file/download?path=${encodeURIComponent(path)}`;
  }

  if (window.bootstrap?.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  try {
    const res = await fetch(`/api/admin/user-directories/users/${userId}/file/preview?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.previewFile = data;

    if (sizeEl) sizeEl.textContent = data.size_formatted;
    if (typeEl) typeEl.textContent = data.mime_type || data.extension;

    if (contentWrapper) {
      if (data.is_image) {
        contentWrapper.innerHTML = `
          <div class="text-center p-2">
            <img src="${data.content}" class="img-fluid rounded border border-secondary shadow" style="max-height: 400px; object-fit: contain;">
          </div>
        `;
      } else {
        contentWrapper.textContent = data.content || '(Файл пуст)';
      }
    }
  } catch (err) {
    console.error('Ошибка предпросмотра файла:', err);
    if (contentWrapper) {
      contentWrapper.innerHTML = `<div class="text-danger p-3">Ошибка загрузки содержимого: ${err.message}</div>`;
    }
  }
}

/**
 * Удаление файла или папки.
 * @param {number} userId - ID пользователя
 * @param {string} path - Относительный путь к файлу
 */
export async function deleteFile(userId, path) {
  try {
    const res = await fetch(`/api/admin/user-directories/users/${userId}/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    showAlert(`Файл "${path}" успешно удален`, 'success');

    // Закрываем модальное окно предпросмотра, если оно открыто
    const previewModalEl = document.getElementById('modal-file-preview');
    if (previewModalEl && window.bootstrap?.Modal) {
      const modal = window.bootstrap.Modal.getInstance(previewModalEl);
      if (modal) modal.hide();
    }

    // Перезагружаем файлы и сводку
    await loadUserFiles(userId);
    await loadSummary();
    if (typeof window.refreshUserDirectoriesUsersList === 'function') {
      await window.refreshUserDirectoriesUsersList();
    }
  } catch (err) {
    console.error('Ошибка удаления файла:', err);
    showAlert(`Ошибка удаления файла: ${err.message}`, 'danger');
  }
}
