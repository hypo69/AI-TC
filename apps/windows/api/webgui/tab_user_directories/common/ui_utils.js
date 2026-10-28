/**
 * =============================================================================
 * Process Name: Windows User Directories - Common UI Utilities & State
 * =============================================================================
 * Description:
 *   Общие утилиты пользовательского интерфейса вкладки управления пользовательскими
 *   директориями: реактивное состояние, экранирование HTML, системные алерты
 *   и сопоставление иконок файлов по их расширениям.
 *
 * File: ui_utils.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_user_directories/common
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-17 01:44:00
 * =============================================================================
 */

/**
 * Реактивное состояние модуля управления пользовательскими директориями.
 */
export const state = {
  users: [],
  selectedUserId: null,
  selectedUserName: '',
  currentSubfolder: '',
  searchQuery: '',
  extFilter: '',
  files: [],
  previewFile: null,
  orphanedDirs: [],
};

/**
 * Безопасное экранирование специальных символов HTML.
 * @param {string} text - Входной текст
 * @returns {string} Экранированный текст
 */
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Вывод всплывающего алерта в верхней панели вкладки.
 * @param {string} message - Текст сообщения
 * @param {'info' | 'success' | 'warning' | 'danger'} [type='info'] - Тип алерта
 */
export function showAlert(message, type = 'info') {
  const alertBox = document.getElementById('user-dirs-alert-box');
  const alertMsg = document.getElementById('user-dirs-alert-message');
  if (!alertBox || !alertMsg) return;

  alertBox.className = `alert alert-${type} alert-dismissible fade show mb-3 shadow-sm`;
  alertMsg.textContent = message;
  alertBox.classList.remove('d-none');

  setTimeout(() => {
    alertBox.classList.add('d-none');
  }, 6000);
}

/**
 * Получение HTML-разметки иконки по расширению файла.
 * @param {string} ext - Расширение файла
 * @returns {string} HTML иконки
 */
export function getFileIcon(ext) {
  const e = (ext || '').toLowerCase();
  switch (e) {
    case 'pdf':
      return '<i class="bi bi-file-earmark-pdf-fill text-danger fs-6"></i>';
    case 'txt':
    case 'md':
    case 'log':
      return '<i class="bi bi-file-earmark-text-fill text-info fs-6"></i>';
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return '<i class="bi bi-file-earmark-code-fill text-warning fs-6"></i>';
    case 'csv':
    case 'tsv':
    case 'xlsx':
      return '<i class="bi bi-file-earmark-spreadsheet-fill text-success fs-6"></i>';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'svg':
      return '<i class="bi bi-file-earmark-image-fill text-primary fs-6"></i>';
    case 'mp3':
    case 'wav':
    case 'ogg':
      return '<i class="bi bi-file-earmark-music-fill text-info fs-6"></i>';
    case 'py':
    case 'js':
    case 'sh':
    case 'ps1':
      return '<i class="bi bi-filetype-py text-warning fs-6"></i>';
    default:
      return '<i class="bi bi-file-earmark-fill text-secondary fs-6"></i>';
  }
}
