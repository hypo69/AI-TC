/**
 * Модуль панели системных событий питания (Event Log) и просмотра сырого XML.
 * Файл: apps/windows/api/webgui/tab_power_lifecycle/panel_events/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let allEvents = [];

export function getAllEvents() {
  return allEvents;
}

export function setAllEvents(events) {
  allEvents = events || [];
}

/**
 * Фильтрует и отрисовывает таблицу событий Event Log.
 */
export function filterAndRenderEvents() {
  const tbody = document.getElementById('pwr-events-tbody');
  const counter = document.getElementById('pwr-events-counter');
  if (!tbody) return;

  const searchVal = (document.getElementById('pwr-events-search')?.value || '').toLowerCase().trim();
  const eidFilter = document.getElementById('pwr-event-id-filter')?.value || '';

  const filtered = allEvents.filter(e => {
    if (eidFilter && String(e.event_id) !== String(eidFilter)) return false;
    if (searchVal) {
      const prov = (e.provider || '').toLowerCase();
      const user = (e.user || '').toLowerCase();
      const proc = (e.process || '').toLowerCase();
      const reason = (e.reason || '').toLowerCase();
      const msg = (e.details?.message || '').toLowerCase();
      if (!prov.includes(searchVal) && !user.includes(searchVal) && !proc.includes(searchVal) && !reason.includes(searchVal) && !msg.includes(searchVal)) {
        return false;
      }
    }
    return true;
  });

  if (counter) counter.textContent = `Событий: ${filtered.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          События журнала, удовлетворяющие критериям поиска, не найдены.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    let eidBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle font-monospace">${e.event_id}</span>`;
    if (e.event_id === 1074) {
      eidBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning font-monospace fw-bold">1074 User32</span>';
    } else if (e.event_id === 41) {
      eidBadge = '<span class="badge bg-danger-subtle text-danger border border-danger font-monospace fw-bold">41 Kernel-Power</span>';
    } else if (e.event_id === 6008) {
      eidBadge = '<span class="badge bg-danger-subtle text-danger border border-danger font-monospace fw-bold">6008 EventLog</span>';
    } else if (e.event_id === 12 || e.event_id === 6005 || e.event_id === 6009) {
      eidBadge = `<span class="badge bg-success-subtle text-success border border-success font-monospace">${e.event_id} Boot</span>`;
    } else if (e.event_id === 13 || e.event_id === 6006) {
      eidBadge = `<span class="badge bg-info-subtle text-info border border-info font-monospace">${e.event_id} Clean</span>`;
    } else if (e.event_id === 1001) {
      eidBadge = '<span class="badge bg-danger text-white font-monospace fw-bold">1001 BSOD</span>';
    }

    let userProc = '<span class="text-muted">--</span>';
    if (e.user || e.process) {
      userProc = `<div class="fw-semibold text-primary">${escapeHtml(e.user || '')}</div>`;
      if (e.process) userProc += `<div class="font-monospace small text-muted">${escapeHtml(e.process)}</div>`;
    }

    const desc = e.reason || e.details?.message || '--';

    return `
      <tr>
        <td class="font-monospace small">${escapeHtml(e.timestamp)}</td>
        <td>${eidBadge}</td>
        <td class="small text-muted font-monospace">${escapeHtml(e.provider)}</td>
        <td><span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">${escapeHtml(e.event_type)}</span></td>
        <td>${userProc}</td>
        <td class="small">${escapeHtml(desc)}</td>
        <td class="text-center">
          ${e.raw_xml ? `
            <button class="btn btn-xs btn-outline-secondary p-1 px-2 pwr-xml-btn" data-xml="${escapeHtml(e.raw_xml)}" title="Просмотреть XML">
              <i class="bi bi-code-square"></i>
            </button>
          ` : '<span class="text-muted">-</span>'}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.pwr-xml-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const xml = btn.dataset.xml;
      showXmlModal(xml);
    });
  });
}

/**
 * Открывает модальное окно просмотра XML события.
 * @param {string} xmlString
 */
export function showXmlModal(xmlString) {
  const pre = document.getElementById('pwr-xml-content');
  if (pre) pre.textContent = xmlString;

  const modalEl = document.getElementById('pwrXmlDetailModal');
  if (modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    modal.show();
  }
}
