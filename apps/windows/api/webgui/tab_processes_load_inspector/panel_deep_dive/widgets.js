/**
 * Дополнительные виджеты паспорта инстанса Deep Dive:
 * Иерархия Lineage, сетевые сокеты, файловая активность и ресайзеры таблиц.
 * Файл: apps/windows/api/webgui/tab_processes_load_inspector/panel_deep_dive/widgets.js
 * Updated: 2026-10-18 08:25:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Загружает дерево Lineage (родительские и дочерние процессы) для выбранного инстанса.
 * @param {number} instanceId - Идентификатор инстанса.
 * @param {Function} onSelectInstance - Колбэк выбора другого инстанса при клике.
 */
export async function loadInstanceLineage(instanceId, onSelectInstance) {
  if (!instanceId) return;
  const container = document.getElementById('lineage-container');
  if (!container) return;

  try {
    const res = await fetch(`/api/v1/tab-processes-load-inspector/panel-deep-dive/${instanceId}/lineage`);
    if (!res.ok) {
      container.innerHTML = '<div class="text-muted small p-2">Генеалогические связи не найдены</div>';
      return;
    }

    const node = await res.json();
    let html = '<div class="d-flex flex-column gap-2">';

    if (node.parent) {
      html += `
        <div class="lineage-node-card d-flex align-items-center justify-content-between" data-inst-id="${node.parent.instance_id}">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-arrow-return-right text-muted"></i>
            <span class="fw-bold text-light">${escapeHtml(node.parent.name)}</span>
            <span class="badge bg-secondary">PID: ${node.parent.pid}</span>
            <span class="badge bg-dark border border-secondary text-info">#${node.parent.instance_id}</span>
          </div>
          <span class="badge bg-dark border border-secondary text-muted">Родитель</span>
        </div>
        <div class="text-center text-muted small my-0"><i class="bi bi-arrow-down"></i></div>
      `;
    }

    html += `
      <div class="lineage-node-card active d-flex align-items-center justify-content-between" data-inst-id="${node.instance_id}">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-6">⭐</span>
          <span class="fw-bold text-info fs-6">${escapeHtml(node.name)}</span>
          <span class="badge bg-primary">PID: ${node.pid}</span>
          <span class="badge bg-info text-dark fw-bold">#${node.instance_id}</span>
        </div>
        <span class="badge bg-success">[Текущий инстанс]</span>
      </div>
    `;

    if (node.children && node.children.length > 0) {
      html += '<div class="text-center text-muted small my-0"><i class="bi bi-arrow-down"></i></div>';
      html += '<div class="ms-4 d-flex flex-column gap-1.5">';
      node.children.forEach(c => {
        html += `
          <div class="lineage-node-card d-flex align-items-center justify-content-between" data-inst-id="${c.instance_id}">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-diagram-2 text-warning"></i>
              <span class="fw-bold text-light">${escapeHtml(c.name)}</span>
              <span class="badge bg-secondary">PID: ${c.pid}</span>
              <span class="badge bg-dark border border-secondary text-info">#${c.instance_id}</span>
            </div>
            <span class="badge bg-dark border border-secondary text-warning">Дочерний</span>
          </div>
        `;
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.lineage-node-card').forEach(card => {
      card.addEventListener('click', () => {
        const instId = card.getAttribute('data-inst-id');
        if (instId && onSelectInstance) {
          onSelectInstance(String(instId));
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<div class="text-danger small p-2">Ошибка Lineage: ${escapeHtml(e.message)}</div>`;
  }
}

/**
 * Загружает сетевые сокеты для выбранного инстанса.
 * @param {number} instanceId - Идентификатор инстанса.
 */
export async function loadInstanceSockets(instanceId) {
  if (!instanceId) return;
  const tbody = document.getElementById('inst-sockets-tbody');
  const countBadge = document.getElementById('badge-inst-sockets-count');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/v1/tab-processes-load-inspector/panel-deep-dive/${instanceId}/sockets`);
    if (!res.ok) return;

    const sockets = await res.json();
    if (countBadge) countBadge.textContent = sockets.length;

    if (!sockets || sockets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Нет активных сетевых сокетов</td></tr>';
      return;
    }

    tbody.innerHTML = sockets.map(s => `
      <tr>
        <td><span class="badge bg-dark border border-secondary text-info">${escapeHtml(s.protocol)}</span></td>
        <td class="font-monospace text-light">${escapeHtml(s.local_address)}</td>
        <td class="font-monospace text-warning">${escapeHtml(s.remote_address)}</td>
        <td><span class="badge bg-success-subtle text-success">${escapeHtml(s.status)}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.warn('[ProcessActivity] Error loading sockets:', e);
  }
}

/**
 * Загружает файловую активность выбранного инстанса.
 * @param {number} instanceId - Идентификатор инстанса.
 */
export async function loadInstanceFileActivity(instanceId) {
  if (!instanceId) return;
  const tbody = document.getElementById('inst-file-events-tbody');
  if (!tbody) return;

  try {
    const searchVal = document.getElementById('inst-file-search')?.value.trim() || '';
    let url = `/api/v1/tab-processes-load-inspector/panel-deep-dive/${instanceId}/file-activity?limit=50`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    const res = await fetch(url);
    if (!res.ok) return;

    const events = await res.json();
    if (!events || events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Журнал файловых операций чист</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(ev => `
      <tr>
        <td class="font-monospace text-muted" style="font-size: 0.74rem;">${ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('ru-RU') : '--'}</td>
        <td><span class="badge bg-info-subtle text-info">${escapeHtml(ev.action || 'MODIFY')}</span></td>
        <td class="font-monospace text-truncate text-light" style="max-width: 320px;" title="${escapeHtml(ev.file_path)}">${escapeHtml(ev.file_path)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.warn('[ProcessActivity] Error loading file activity:', e);
  }
}

/**
 * Инициализирует ресайзеры высоты таблиц в интерфейсе.
 */
export function initTableResizers() {
  if (typeof window.setupTableResizer === 'function') {
    window.setupTableResizer('sys-proc-table-resizer', 'sys-proc-table-container');
    window.setupTableResizer('proc-net-table-resizer', 'proc-net-table-container');
    window.setupTableResizer('proc-watcher-table-resizer', 'proc-watcher-table-container');
    window.setupTableResizer('pm-table-resizer', 'pm-table-container');
    window.setupTableResizer('inst-sockets-table-resizer', 'inst-sockets-table-container');
    window.setupTableResizer('inst-file-events-table-resizer', 'inst-file-events-table-container');
    window.setupTableResizer('proc-leaks-table-resizer', 'proc-leaks-table-container');
  }

  document.querySelectorAll('.sys-table-resizer').forEach(resizer => {
    const containerId = resizer.getAttribute('data-container-id');
    const container = document.getElementById(containerId);
    if (!container) return;

    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(120, Math.min(1200, startHeight + delta));
      container.style.maxHeight = `${newHeight}px`;
    };

    const onMouseUp = () => {
      resizer.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startHeight = container.offsetHeight;
      resizer.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    resizer.addEventListener('dblclick', () => {
      container.style.maxHeight = '700px';
    });
  });

  document.querySelectorAll('.btn-table-expand-100').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.sys-panel');
      const container = panel ? panel.querySelector('.table-responsive') : null;
      if (!container) return;
      const isMax = container.style.maxHeight === 'none';
      container.style.maxHeight = isMax ? '700px' : 'none';
      btn.textContent = isMax ? '100%' : 'Свернуть';
    });
  });
}
