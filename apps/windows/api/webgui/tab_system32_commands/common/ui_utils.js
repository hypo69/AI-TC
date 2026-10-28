/**
 * Вспомогательные утилиты интерфейса каталога команд System32.
 * Файл: apps/windows/api/webgui/tab_system32_commands/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

export const tierColors = {
  OBSERVE: { bg: 'bg-success-subtle', text: 'text-success', border: 'border-success-subtle', badge: 'bg-success' },
  DIAGNOSE: { bg: 'bg-warning-subtle', text: 'text-warning', border: 'border-warning-subtle', badge: 'bg-warning text-dark' },
  CONTROL: { bg: 'bg-info-subtle', text: 'text-info', border: 'border-info-subtle', badge: 'bg-info text-dark' },
  ADMIN: { bg: 'bg-danger-subtle', text: 'text-danger', border: 'border-danger-subtle', badge: 'bg-danger' },
  DESTRUCTIVE: { bg: 'bg-dark-subtle', text: 'text-light', border: 'border-dark', badge: 'bg-dark text-danger fw-bold' },
  RECOVERY: { bg: 'bg-primary-subtle', text: 'text-primary', border: 'border-primary-subtle', badge: 'bg-primary' },
};

export const planeIcons = {
  CLI: '💻',
  POWERSHELL: '⚡',
  WMI_CIM: '🧩',
  COM: '🔌',
  WIN32_API: '⚙️',
  NATIVE_NT_API: '🔬',
  ETW: '⏱️',
  EVENT_LOG: '📜',
  REGISTRY: '🗝️',
  GUI_MMC_CPL: '🖥️',
};

/**
 * Экранирует HTML-спецсимволы.
 * @param {string} str - Исходная строка.
 * @returns {string} Экранированная строка.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
