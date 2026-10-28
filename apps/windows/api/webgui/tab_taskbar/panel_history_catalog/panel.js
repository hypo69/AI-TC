/**
 * Модуль панели истории действий с поддержкой Rollback и каталога команд.
 * Файл: apps/windows/api/webgui/tab_taskbar/panel_history_catalog/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let historyCache = [];
let commandsCache = [];

/**
 * Загружает историю операций над панелью задач из telemetry.db.
 */
export async function loadHistory() {
  const tbody = document.getElementById('tbody-history-list');
  try {
    const res = await fetch('/api/v1/taskbar/history?limit=50');
    if (!res.ok) return;
    historyCache = await res.json();
    renderHistoryTable();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger p-3 text-center">Ошибка: ${err.message}</td></tr>`;
    }
  }
}

/**
 * Отрисовывает таблицу истории операций.
 */
export function renderHistoryTable() {
  const tbody = document.getElementById('tbody-history-list');
  const badge = document.getElementById('badge-history-count');
  if (badge) badge.textContent = historyCache.length;
  if (!tbody) return;

  if (historyCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted p-4 text-center">История в telemetry.db пуста</td></tr>';
    return;
  }

  tbody.innerHTML = historyCache.map(h => {
    const rolledBadge = h.is_rolled_back 
      ? '<span class="badge bg-secondary">Откачено</span>' 
      : '<span class="badge bg-success-subtle text-success border border-success-subtle">Активно</span>';

    const canRollback = !h.is_rolled_back && h.previous_state;
    const timeShort = (h.timestamp || '').replace('T', ' ').slice(0, 19);

    let detailsStr = '';
    if (h.previous_state || h.new_state) {
      detailsStr = `<small class="text-muted font-monospace">${escapeHtml(JSON.stringify(h.new_state || h.details || {}).slice(0, 60))}</small>`;
    } else if (h.details) {
      detailsStr = `<small class="text-muted">${escapeHtml(JSON.stringify(h.details).slice(0, 60))}</small>`;
    }

    return `
      <tr class="${h.is_rolled_back ? 'opacity-75' : ''}">
        <td><code>#${h.id}</code></td>
        <td><small>${escapeHtml(timeShort)}</small></td>
        <td>
          <div class="fw-semibold"><code>${escapeHtml(h.command_id)}</code></div>
          <small class="text-muted">${escapeHtml(h.action_type)} ${h.target_hwnd ? `(HWND: ${h.target_hwnd})` : ''}</small>
        </td>
        <td>${detailsStr}</td>
        <td>${rolledBadge}</td>
        <td class="text-end">
          ${canRollback ? `
            <button class="btn btn-outline-warning btn-sm py-0 px-2" onclick="window._rollbackAction(${h.id})" title="Откатить это изменение">
              <i class="bi bi-arrow-counterclockwise me-1"></i> Откат
            </button>
          ` : '<span class="text-muted small">—</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Откатывает конкретное действие по ID из истории.
 * @param {number} historyId - ID записи в истории.
 * @param {Function} [onUpdated] - Коллбек обновления.
 */
export async function rollbackAction(historyId, onUpdated) {
  if (!confirm(`Откатить действие #${historyId}? Предыдущее состояние будет восстановлено.`)) return;
  try {
    const res = await fetch(`/api/v1/taskbar/history/${historyId}/rollback`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (window.toast) window.toast.success('Откат выполнен', data.message);
      if (onUpdated) await onUpdated();
    } else {
      if (window.toast) window.toast.error('Ошибка отката', data.detail || 'Сбой');
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка', err.message);
  }
}

/**
 * Откатывает последнее выполненное действие в системе.
 * @param {Function} [onUpdated] - Коллбек обновления.
 */
export async function rollbackLast(onUpdated) {
  try {
    const res = await fetch('/api/v1/taskbar/history/rollback-last', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (window.toast) window.toast.success('Откат выполнен', data.message);
      if (onUpdated) await onUpdated();
    } else {
      if (window.toast) window.toast.error('Ошибка отката', data.detail || 'Сбой');
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка', err.message);
  }
}

/**
 * Загружает каталог зарегистрированных команд панели задач.
 */
export async function loadCommandCatalog() {
  try {
    const res = await fetch('/api/v1/taskbar/commands');
    if (!res.ok) return;
    commandsCache = await res.json();
    renderCommandsTable();
  } catch (err) {
    console.error('[TaskbarTab] Ошибка каталога команд:', err);
  }
}

/**
 * Отрисовывает таблицу команд с фильтрацией по категории и риску.
 */
export function renderCommandsTable() {
  const tbody = document.getElementById('tbody-commands-list');
  const cat = document.getElementById('filter-cmd-category')?.value || '';
  const risk = document.getElementById('filter-cmd-risk')?.value || '';
  if (!tbody) return;

  const filtered = commandsCache.filter(c => {
    if (cat && (c.category || '').toLowerCase() !== cat.toLowerCase()) return false;
    if (risk && (c.risk || '').toLowerCase() !== risk.toLowerCase()) return false;
    return true;
  });

  const badge = document.getElementById('badge-commands-count');
  if (badge) badge.textContent = filtered.length;

  tbody.innerHTML = filtered.map(c => {
    const riskBadge = c.risk === 'safe' 
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle">safe</span>'
      : c.risk === 'caution'
        ? '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">caution</span>'
        : c.risk === 'admin'
          ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">admin</span>'
          : '<span class="badge bg-danger text-white">high</span>';

    const apiStr = c.api?.win32 || c.api?.com || c.api?.registry || c.api?.powershell || '—';

    return `
      <tr>
        <td><code>${escapeHtml(c.id)}</code></td>
        <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(c.execution_class)}</span></td>
        <td>${riskBadge}</td>
        <td>${escapeHtml(c.description)}</td>
        <td class="font-monospace small text-muted text-truncate" style="max-width: 200px;" title="${escapeHtml(apiStr)}">${escapeHtml(apiStr)}</td>
        <td class="text-end">
          <button class="btn btn-outline-primary btn-sm py-0 px-2" onclick="window._executeCommandDirect('${c.id}')" title="Выполнить">
            <i class="bi bi-play"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Выполняет системную команду напрямую с подтверждением риска.
 * @param {string} cmdId - Идентификатор команды.
 * @param {Function} [onExecuted] - Коллбек обновления.
 */
export async function executeCommandDirect(cmdId, onExecuted) {
  const meta = commandsCache.find(c => c.id === cmdId);
  if (meta?.requires_confirmation) {
    if (!confirm(`Команда ${cmdId} имеет повышенный риск (${meta.risk}). Подтвердить запуск?`)) return;
  }
  try {
    const res = await fetch('/api/v1/taskbar/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmdId, params: {}, confirmed_by_user: true })
    });
    const data = await res.json();
    if (res.ok && window.toast) {
      window.toast.success(`Команда ${cmdId}`, data.message || 'Выполнено успешно');
      if (onExecuted) await onExecuted();
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка', err.message);
  }
}
