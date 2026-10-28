/**
 * Модуль панели инспекции окон Windows, оконных действий и ИИ-Copilot.
 * Файл: apps/windows/api/webgui/tab_taskbar/panel_windows/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let windowsCache = [];

/**
 * Возвращает текущий кэш обнаруженных окон.
 * @returns {Array<Object>}
 */
export function getWindowsCache() {
  return windowsCache;
}

/**
 * Загружает список открытых окон с сервера.
 * @param {Function} [onUpdated] - Коллбек для синхронизации истории.
 */
export async function loadWindows(onUpdated) {
  const tbody = document.getElementById('tbody-windows-list');
  try {
    const res = await fetch('/api/v1/taskbar/windows?only_visible=false&only_taskbar=false');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    windowsCache = await res.json();
    renderWindowsTable();
    populateWindowSelects();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-3 text-center">Ошибка: ${err.message}</td></tr>`;
    }
  }
}

/**
 * Отрисовывает таблицу окон с учетом поискового фильтра.
 */
export function renderWindowsTable() {
  const tbody = document.getElementById('tbody-windows-list');
  const filter = (document.getElementById('input-search-windows')?.value || '').toLowerCase();
  if (!tbody) return;

  const filtered = windowsCache.filter(w => {
    if (!filter) return w.title;
    return (w.title || '').toLowerCase().includes(filter) ||
           (w.process_name || '').toLowerCase().includes(filter) ||
           String(w.hwnd).includes(filter);
  });

  const badge = document.getElementById('badge-windows-count');
  if (badge) badge.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted p-4 text-center">Окна по фильтру не найдены</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(w => {
    const isFg = w.is_foreground ? '<span class="badge bg-warning text-dark me-1">Фокус</span>' : '';
    const stateBadge = w.is_minimized 
      ? '<span class="badge bg-secondary">Свернуто</span>' 
      : w.is_maximized 
        ? '<span class="badge bg-success">Развернуто</span>' 
        : '<span class="badge bg-info text-dark">Нормальное</span>';

    return `
      <tr class="${w.is_foreground ? 'table-active' : ''} taskbar-window-row" style="cursor: pointer;" onclick="window._taskbarActions.aiCopilot(${w.hwnd})" title="Кликните для ИИ-Copilot разбора окна">
        <td><code class="user-select-all">${w.hwnd}</code></td>
        <td class="text-truncate" style="max-width: 250px;" title="${escapeHtml(w.title)}">
          ${isFg}<strong>${escapeHtml(w.title || '(Без названия)')}</strong>
        </td>
        <td>
          <div class="fw-semibold text-truncate" style="max-width: 140px;">${escapeHtml(w.process_name || '—')}</div>
          <div class="text-muted small">PID: ${w.process_id}</div>
        </td>
        <td><small class="text-muted">${w.rect.width} × ${w.rect.height}</small></td>
        <td>${stateBadge}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="event.stopPropagation(); window._taskbarActions.activate(${w.hwnd})" title="Активировать"><i class="bi bi-lightning-fill"></i></button>
            <button class="btn btn-outline-secondary" onclick="event.stopPropagation(); window._taskbarActions.minimize(${w.hwnd})" title="Свернуть"><i class="bi bi-dash"></i></button>
            <button class="btn btn-outline-secondary" onclick="event.stopPropagation(); window._taskbarActions.maximize(${w.hwnd})" title="Развернуть"><i class="bi bi-square"></i></button>
            <button class="btn btn-outline-secondary" onclick="event.stopPropagation(); window._taskbarActions.restore(${w.hwnd})" title="Восстановить"><i class="bi bi-window"></i></button>
            <button class="btn btn-outline-danger" onclick="event.stopPropagation(); window._taskbarActions.close(${w.hwnd})" title="Закрыть"><i class="bi bi-x-lg"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Заполняет выпадающий список окон для прогресс-бара.
 */
export function populateWindowSelects() {
  const sel = document.getElementById('select-ux-target-window');
  if (!sel) return;
  const named = windowsCache.filter(w => w.title);
  sel.innerHTML = named.map(w => `<option value="${w.hwnd}">${w.hwnd} — ${escapeHtml(w.title.slice(0, 40))} (${w.process_name})</option>`).join('');
}

/**
 * Открытие модального окна AI Copilot для окна Windows.
 * @param {number} hwnd - Дескриптор окна.
 */
export async function openTaskbarWindowCopilotModal(hwnd) {
  const modalEl = document.getElementById('taskbarWindowAiCopilotModal');
  const bodyEl = document.getElementById('taskbar-copilot-modal-body');
  const actionsEl = document.getElementById('taskbar-copilot-actions');
  if (!modalEl || !bodyEl) return;

  const win = windowsCache.find(w => w.hwnd === hwnd) || { hwnd, title: '', process_name: '', process_id: 0 };

  bodyEl.innerHTML = `
    <div class="text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
      ИИ-Copilot анализирует окно HWND ${hwnd} (${escapeHtml(win.process_name || 'процесс')})...
    </div>
  `;
  if (actionsEl) actionsEl.innerHTML = '';

  const modalInstance = (typeof bootstrap !== 'undefined' && bootstrap.Modal)
    ? bootstrap.Modal.getOrCreateInstance(modalEl)
    : null;
  if (modalInstance) modalInstance.show();

  try {
    const q = new URLSearchParams({
      title: win.title || '',
      process_name: win.process_name || '',
      pid: String(win.process_id || 0)
    });
    const res = await fetch(`/api/v1/taskbar/windows/${hwnd}/copilot?${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const analysis = await res.json();

    const isSafe = analysis.risk_level === 'SAFE';
    const riskBadge = isSafe 
      ? '<span class="badge bg-success-subtle text-success border border-success px-2 py-1"><i class="bi bi-shield-check me-1"></i>Безопасный процесс (SAFE)</span>'
      : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1"><i class="bi bi-shield-exclamation me-1"></i>Внимание / Риск (CAUTION)</span>';

    const hiddenBadge = analysis.is_hidden_or_ghost 
      ? '<span class="badge bg-secondary ms-2"><i class="bi bi-eye-slash me-1"></i>Фоновое / Скрытое окно</span>' 
      : '<span class="badge bg-info-subtle text-info-emphasis border ms-2"><i class="bi bi-window me-1"></i>Отображаемое окно</span>';

    bodyEl.innerHTML = `
      <div class="card border-0 bg-light mb-3">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h6 class="fw-bold mb-0 text-primary">${escapeHtml(analysis.title || '(Без заголовка)')}</h6>
              <div class="small text-muted font-monospace">HWND: ${analysis.hwnd} | PID: ${analysis.pid} | Процесс: <strong>${escapeHtml(analysis.process_name)}</strong></div>
            </div>
            <div>
              ${riskBadge}
              ${hiddenBadge}
            </div>
          </div>
        </div>
      </div>

      <div class="card border-primary border-opacity-25 shadow-sm mb-3">
        <div class="card-header bg-primary bg-opacity-10 py-2 fw-semibold text-primary">
          <i class="bi bi-chat-left-dots-fill me-2"></i>Заключение ИИ-Анализа
        </div>
        <div class="card-body p-3">
          <p class="mb-2 fs-6">${escapeHtml(analysis.ai_explanation)}</p>
          <div class="p-2 rounded bg-body-secondary small">
            <strong>Рекомендуемое системное действие:</strong> ${escapeHtml(analysis.recommended_action)}
          </div>
        </div>
      </div>
    `;

    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-outline-primary btn-sm rounded-pill" onclick="window._taskbarActions.activate(${hwnd}); if (typeof bootstrap !== 'undefined' && bootstrap.Modal) bootstrap.Modal.getInstance(document.getElementById('taskbarWindowAiCopilotModal'))?.hide();">
          <i class="bi bi-lightning-fill me-1"></i>Активировать
        </button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="window._taskbarActions.minimize(${hwnd}); if (typeof bootstrap !== 'undefined' && bootstrap.Modal) bootstrap.Modal.getInstance(document.getElementById('taskbarWindowAiCopilotModal'))?.hide();">
          <i class="bi bi-dash me-1"></i>Свернуть
        </button>
        <button class="btn btn-outline-danger btn-sm rounded-pill" onclick="window._taskbarActions.close(${hwnd}); if (typeof bootstrap !== 'undefined' && bootstrap.Modal) bootstrap.Modal.getInstance(document.getElementById('taskbarWindowAiCopilotModal'))?.hide();">
          <i class="bi bi-x-lg me-1"></i>Закрыть окно
        </button>
      `;
    }
  } catch (err) {
    bodyEl.innerHTML = `
      <div class="alert alert-danger mb-0">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>Ошибка выполнения ИИ-анализа: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

/**
 * Выполняет пакетное действие над окнами (minimize_all, restore_all).
 * @param {string} action - Имя действия.
 * @param {Function} [onUpdated] - Коллбек обновления.
 */
export async function executeBatchWindowAction(action, onUpdated) {
  try {
    const res = await fetch('/api/v1/taskbar/windows/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      if (window.toast) window.toast.success('Действие выполнено', `Пакетное действие: ${action}`);
      if (onUpdated) await onUpdated();
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка', err.message);
  }
}
