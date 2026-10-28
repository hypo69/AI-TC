/**
 * Модуль панели закрепленных приложений и быстрого запуска.
 * Файл: apps/windows/api/webgui/tab_taskbar/panel_pinned_apps/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Загружает перечень закрепленных на панели задач приложений.
 */
export async function loadPinnedApps() {
  const container = document.getElementById('pinned-apps-container');
  try {
    const res = await fetch('/api/v1/taskbar/apps');
    if (!res.ok) return;
    const apps = await res.json();
    if (!container) return;

    if (apps.length === 0) {
      container.innerHTML = '<div class="text-muted small p-3 text-center">Нет закрепленных ярлыков</div>';
      return;
    }

    container.innerHTML = `<div class="list-group list-group-flush">${apps.map(a => `
      <div class="list-group-item d-flex justify-content-between align-items-center p-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-app text-primary"></i>
          <div>
            <div class="fw-semibold small">${escapeHtml(a.name)}</div>
            <div class="text-muted font-monospace" style="font-size: 0.72rem;">${escapeHtml(a.target_path || a.link_path)}</div>
          </div>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    if (container) container.innerHTML = `<div class="text-danger small p-2">Ошибка: ${err.message}</div>`;
  }
}

/**
 * Обрабатывает отправку формы запуска приложения.
 * @param {Event} e - Событие формы.
 * @param {Function} [onLaunched] - Коллбек обновления после старта.
 */
export async function handleLaunchApp(e, onLaunched) {
  if (e) e.preventDefault();
  const path = document.getElementById('launch-app-path')?.value || '';
  const args = document.getElementById('launch-app-args')?.value || '';
  const admin = document.getElementById('launch-app-admin')?.checked || false;

  try {
    const res = await fetch('/api/v1/taskbar/apps/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_path: path, arguments: args || null, admin })
    });
    const data = await res.json();
    if (res.ok) {
      if (window.toast) window.toast.success('Приложение запущено', data.message);
      const pathInput = document.getElementById('launch-app-path');
      if (pathInput) pathInput.value = '';
      if (onLaunched) setTimeout(() => onLaunched(), 1000);
    } else {
      if (window.toast) window.toast.error('Ошибка запуска', data.detail || 'Сбой');
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка сети', err.message);
  }
}
