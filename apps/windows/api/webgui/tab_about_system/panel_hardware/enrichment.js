/**
 * Модуль обогащения спецификаций оборудования и истории компонентов (Hardware Enrichment & Lifecycle).
 * 
 * Отвечает за:
 * - Поиск ссылок на спецификации оборудования на сайтах вендоров
 * - Интерактивную модальную историю установок, переустановок и отключений
 * - Запрос даты выпуска оборудования через AI-агента по серийному номеру
 * - Фоновый поллер статуса обогащения компонентов
 * 
 * Updated: 2026-10-20 16:55:00
 */

import { escapeHtml, formatIsoDate, isValidHttpUrl, apiFetch } from '../common/ui_utils.js';

let hwEnrichmentPollTimer = null;
let hwEnrichmentPollAttempts = 0;

/**
 * Генерация HTML-блока обогащения для узла дерева оборудования.
 * @param {Object} node
 * @returns {string}
 */
export function getHardwareEnrichmentHtml(node) {
  if (!node || node.is_pnp_group || (node.category || '').toLowerCase().includes('pnp')) return '';
  const isPresent = node.is_present !== false;
  const installCount = Number(node.install_count || 1);

  const presenceBadgeHtml = isPresent
    ? `<span class="ui-badge ui-badge-success font-monospace" title="Компонент обнаружен и активен в системе">
         <i class="bi bi-check-circle-fill me-1"></i>В системе
       </span>`
    : `<span class="ui-badge ui-badge-danger font-monospace" title="Компонент отключен или перестал обнаруживаться с ${escapeHtml(formatIsoDate(node.removed_at))}">
         <i class="bi bi-x-circle-fill me-1"></i>Отключен (${escapeHtml(formatIsoDate(node.removed_at))})
       </span>`;

  const reinstalledBadgeHtml = installCount > 1
    ? `<span class="ui-badge ui-badge-info font-monospace" title="Компонент переустанавливался/подключался повторно ${installCount} раз(а)">
         <i class="bi bi-arrow-repeat me-1"></i>Установок: ${installCount}
       </span>`
    : '';

  const datesHtml = node.first_seen
    ? `<span class="text-body-secondary small font-monospace d-none d-md-inline" title="Обнаружен впервые: ${escapeHtml(formatIsoDate(node.first_seen))}&#10;Последнее подтверждение: ${escapeHtml(formatIsoDate(node.last_seen))}">
         <i class="bi bi-clock me-1 text-info"></i>${escapeHtml(formatIsoDate(node.first_seen))}
       </span>`
    : '';

  const historyBtnHtml = node.component_key
    ? `<button class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 text-decoration-none shadow-sm" 
               onclick="window.openHardwareComponentHistory('${escapeHtml(node.component_key)}'); event.stopPropagation();" 
               title="Посмотреть полную историю установки, переустановок и отключений компонента">
         <i class="bi bi-clock-history"></i>
         <span>История</span>
       </button>`
    : '';

  let prodDateHtml = '';
  if (node.production_date && node.production_date !== 'N/A') {
    prodDateHtml = `
      <span class="ui-badge ui-badge-info font-monospace" 
            title="Дата производства: ${escapeHtml(node.production_date)}&#10;Источник: ${escapeHtml(node.production_date_source || 'Вендор')}">
        <i class="bi bi-calendar3"></i>Выпуск: ${escapeHtml(node.production_date)}
      </span>
    `;
  } else if (node.component_key) {
    prodDateHtml = `
      <button class="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1 text-decoration-none shadow-sm" 
              id="btn-prod-date-${escapeHtml(node.component_key)}"
              onclick="window.requestComponentProductionDate('${escapeHtml(node.component_key)}'); event.stopPropagation();" 
              title="Опросить обученного AI-агента для поиска даты производства вендора по серийному номеру">
        <i class="bi bi-calendar-event"></i>
        <span>Дата выпуска</span>
      </button>
    `;
  }

  return `
    <div class="about-sys-enrichment-bar d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 px-3 mb-2.5 rounded border border-secondary-subtle bg-body-tertiary" 
         data-enrichment-key="${escapeHtml(node.component_key || '')}">
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${prodDateHtml}
        ${presenceBadgeHtml}
        ${reinstalledBadgeHtml}
        ${datesHtml}
        ${historyBtnHtml}
      </div>
      <div class="text-body-secondary small font-monospace d-flex align-items-center gap-2">
        <span class="text-truncate" title="Аппаратный ID: ${escapeHtml(node.component_key || '--')}">
          <i class="bi bi-fingerprint me-1 text-info"></i>${escapeHtml(node.component_key || '--')}
        </span>
      </div>
    </div>
  `;
}

/**
 * Открытие модального окна истории компонента оборудования.
 * @param {string} componentKey
 */
export async function openHardwareComponentHistory(componentKey) {
  if (!componentKey) return;
  const modalEl = document.getElementById('aboutHardwareComponentHistoryModal');
  const subtitleEl = document.getElementById('about-hw-modal-subtitle');
  const bodyEl = document.getElementById('about-hw-modal-body');
  if (!modalEl || !bodyEl) return;

  if (subtitleEl) subtitleEl.textContent = `Аппаратный ID: ${componentKey}`;
  bodyEl.innerHTML = `
    <div class="text-center py-4 text-muted small">
      <div class="spinner-border spinner-border-sm text-info mb-2" role="status"></div>
      <div>Загрузка хронологии компонента...</div>
    </div>
  `;

  try {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.show();
    }
  } catch (_) {}

  try {
    const data = await apiFetch(`/api/v1/about-system/hardware-component-history?component_key=${encodeURIComponent(componentKey)}`);
    const comp = data.component || {};
    const events = Array.isArray(data.history) ? data.history : [];

    const isPresent = comp.is_present !== 0;
    const firstSeenStr = formatIsoDate(comp.first_seen);
    const lastSeenStr = formatIsoDate(comp.last_seen);
    const removedAtStr = comp.removed_at ? formatIsoDate(comp.removed_at) : '—';
    const cycles = comp.install_count || 1;

    let eventsHtml = '';
    if (events.length === 0) {
      eventsHtml = '<div class="text-muted small text-center py-3">Событий установки не зафиксировано</div>';
    } else {
      eventsHtml = `
        <div class="timeline mt-3">
          <table class="table table-sm table-dark table-striped align-middle mb-0" style="font-size: 0.78rem;">
            <thead>
              <tr class="text-secondary border-secondary">
                <th style="width: 25%;">Дата и время</th>
                <th style="width: 20%;">Событие</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(ev => {
                let badge = '';
                if (ev.event_type === 'installed') {
                  badge = '<span class="ui-badge ui-badge-success"><i class="bi bi-plus-circle me-1"></i>Установка</span>';
                } else if (ev.event_type === 'reinstalled') {
                  badge = '<span class="ui-badge ui-badge-info"><i class="bi bi-arrow-repeat me-1"></i>Переустановка</span>';
                } else if (ev.event_type === 'removed') {
                  badge = '<span class="ui-badge ui-badge-danger"><i class="bi bi-dash-circle me-1"></i>Отключен</span>';
                } else {
                  badge = `<span class="ui-badge ui-badge-neutral">${escapeHtml(ev.event_type)}</span>`;
                }

                let detailsText = '';
                if (ev.details && typeof ev.details === 'object') {
                  detailsText = Object.entries(ev.details).map(([k, v]) => `${k}: ${v}`).join(' | ');
                } else if (ev.details_json) {
                  detailsText = ev.details_json;
                }

                return `
                  <tr>
                    <td class="font-monospace text-light">${escapeHtml(formatIsoDate(ev.timestamp))}</td>
                    <td>${badge}</td>
                    <td class="text-muted font-monospace small">${escapeHtml(detailsText || '—')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="card bg-body-tertiary border-secondary mb-3">
        <div class="card-body p-3">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <h6 class="mb-0 fw-bold text-info">${escapeHtml(comp.name || componentKey)}</h6>
            <div>
              ${isPresent 
                ? '<span class="ui-badge ui-badge-success"><i class="bi bi-check-circle me-1"></i>В системе</span>' 
                : '<span class="ui-badge ui-badge-danger"><i class="bi bi-x-circle me-1"></i>Отключен</span>'}
            </div>
          </div>
          <div class="row g-2 text-body-secondary small font-monospace" style="font-size: 0.75rem;">
            <div class="col-sm-6">
              <strong>Категория:</strong> ${escapeHtml(comp.category || '--')}<br/>
              <strong>Производитель:</strong> ${escapeHtml(comp.vendor || '--')}<br/>
              <strong>Модель:</strong> ${escapeHtml(comp.model || '--')}
            </div>
            <div class="col-sm-6">
              <strong>Первое появление:</strong> ${escapeHtml(firstSeenStr)}<br/>
              <strong>Последнее подтверждение:</strong> ${escapeHtml(lastSeenStr)}<br/>
              <strong>Дата отключения:</strong> ${escapeHtml(removedAtStr)}<br/>
              <strong>Всего циклов установки:</strong> ${cycles}
            </div>
          </div>
        </div>
      </div>
      <h6 class="fw-bold text-secondary mb-2" style="font-size: 0.82rem;">
        <i class="bi bi-journal-text me-1 text-info"></i>Хронология событий оборудования
      </h6>
      ${eventsHtml}
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">Ошибка загрузки истории компонента: ${escapeHtml(err.message)}</div>`;
  }
}

export function stopHardwareEnrichmentPoller() {
  if (hwEnrichmentPollTimer) {
    clearInterval(hwEnrichmentPollTimer);
    hwEnrichmentPollTimer = null;
  }
  hwEnrichmentPollAttempts = 0;
}

export function findNodeEnrichmentSlot(key) {
  if (!key) return null;
  const nodes = document.querySelectorAll('.about-sys-tree-node[data-component-key]');
  for (const n of nodes) {
    if (n.getAttribute('data-component-key') === key) {
      return n.querySelector('.about-sys-enrichment-slot');
    }
  }
  return null;
}

export function startHardwareEnrichmentPoller(hardwareData = []) {
  // Опрос спецификаций оборудования полностью отключен
  stopHardwareEnrichmentPoller();
}

export async function requestComponentProductionDate(componentKey, hardwareData = []) {
  if (!componentKey) return;
  const btn = document.getElementById(`btn-prod-date-${componentKey}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <span class="spinner-border spinner-border-sm text-info me-1" role="status"></span>
      <span>Агент ищет дату...</span>
    `;
  }

  try {
    const data = await apiFetch(`/api/v1/about-system/hardware/query-production-date?component_key=${encodeURIComponent(componentKey)}`, {
      method: 'POST'
    });

    const targetNode = hardwareData.find(n => n.component_key === componentKey);
    if (targetNode) {
      if (data.success && data.production_date) {
        targetNode.production_date = data.production_date;
        targetNode.production_date_source = data.production_source || 'AI Agent';
      } else {
        targetNode.production_date = 'N/A';
        targetNode.production_date_source = 'Серийный номер не декодирован';
      }
      const slot = findNodeEnrichmentSlot(componentKey);
      if (slot) {
        slot.innerHTML = getHardwareEnrichmentHtml(targetNode);
      }
    }
  } catch (err) {
    console.warn('[AboutSystemTab] production date request failed:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-exclamation-circle text-danger me-1"></i>Ошибка`;
    }
  }
}
