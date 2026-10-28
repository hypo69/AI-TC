/**
 * Модуль панели журнала активности операций панели управления (Activity Logs).
 * 
 * Updated: 2026-10-17 00:26:00
 */

import { escapeHtml, t } from '../common/ui_utils.js';

/**
 * Загрузка истории активности операций администрирования из API.
 * 
 * @param {boolean} force - Принудительное обновление без проверки активного источника.
 * @param {Function} isTabActive - Функция проверки активности вкладки.
 */
export async function loadSccActivityLogs(force = false, isTabActive = () => true) {
  if (!isTabActive()) return;
  const tbody = document.getElementById('scc-logs-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/v1/system_logs/activity');
    if (!res.ok) return;
    const data = await res.json();
    const logs = data.logs || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-3">${t('systemControl.emptyActivity', 'Журнал активности пуст.')}</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(l.timestamp)}</td>
        <td><span class="badge bg-secondary font-monospace">${escapeHtml(l.action)}</span></td>
        <td style="color: var(--text-color);">${escapeHtml(l.target)}</td>
        <td><span class="badge ${l.status === 'SUCCESS' || l.status === 'OK' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(l.status)}</span></td>
        <td class="small text-truncate" style="max-width: 280px; color: var(--text-muted);" title="${escapeHtml(l.details)}">${escapeHtml(l.details)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.warn('[SystemLogs] Ошибка загрузки журнала активности:', e);
  }
}

/**
 * Инициализация обработчиков событий панели журнала активности.
 */
export function initActivityPanel() {
  const btnRefresh = document.getElementById('btn-scc-refresh-logs');
  if (btnRefresh && !btnRefresh._bound) {
    btnRefresh._bound = true;
    btnRefresh.addEventListener('click', () => loadSccActivityLogs(true));
  }
}
