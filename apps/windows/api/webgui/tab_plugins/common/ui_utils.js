/**
 * Вспомогательные утилиты для вкладки управления плагинами.
 * Файл: apps/windows/api/webgui/tab_plugins/common/ui_utils.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Выводит системное уведомление пользователю.
 * @param {string} message - Текст сообщения.
 * @param {string} [type='info'] - Тип уведомления (success, info, warning, danger).
 */
export function showPluginNotification(message, type = 'info') {
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
    return;
  }
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  console.log(`[Plugin Notification ${type}]: ${message}`);
}

/**
 * Проверяет, запущен ли интерфейс в режиме обычного пользователя или администратора.
 * @returns {boolean} True, если UI запущен для обычного пользователя.
 */
export function isRunningInUserInterface() {
  if (document.getElementById('user-interface')) return true;
  if (window.location.pathname.includes('/user')) return true;
  if (!document.getElementById('admin-interface')) {
    if (typeof window.isUserAdmin === 'function') {
      return !window.isUserAdmin();
    }
    return true;
  }
  return false;
}
