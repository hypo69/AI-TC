/**
 * Модуль модальных окон для панели жизненного цикла питания (Power Lifecycle).
 * 
 * Включает детальный просмотр сессии питания (boot time, shutdown time, аптайм, цепочка инициаторов)
 * и просмотр сырого XML события Windows Event Log.
 * 
 * Updated: 2026-10-17 00:28:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Отображение модального окна деталей сессии электропитания.
 * 
 * @param {string} sessionId - Идентификатор сессии.
 * @param {Array} allPowerSessions - Список всех сессий питания.
 */
export function showPowerSessionDetailModal(sessionId, allPowerSessions = []) {
  const session = allPowerSessions.find(s => s.session_id === sessionId);
  if (!session) return;

  const modal = window.AIModalDialog || window.AITableModal;
  const isUnexp = session.unexpected_shutdown || session.clean_shutdown === false;

  if (modal) {
    modal.show({
      icon: isUnexp ? '⚡' : '🔄',
      title: `Сессия питания: ${session.session_id}`,
      subtitle: `Статус: ${session.shutdown_type || 'Active'} | Аптайм: ${session.uptime_human || '--'}`,
      panelId: 'panel-system-control-4',
      tableType: 'power_session',
      badges: [
        { text: session.shutdown_type || 'Active', class: isUnexp ? 'badge bg-danger' : 'badge bg-success' },
        { text: session.uptime_human || 'Active', class: 'badge border text-secondary' }
      ],
      metadata: [
        { label: 'ID сессии', value: session.session_id },
        { label: 'Время старта (Boot)', value: session.boot_time || '-' },
        { label: 'Время завершения', value: session.shutdown_time || 'Активна' },
        { label: 'Инициатор', value: session.initiator || 'Система' },
        { label: 'Процесс', value: session.process || 'N/A' },
        { label: 'Причина выключения', value: session.reason || 'N/A', fullWidth: true }
      ],
      rawTitle: 'Контекст и хронология событий сессии',
      rawContent: JSON.stringify(session, null, 2),
      requestData: {
        session_id: session.session_id,
        initiator: session.initiator,
        process: session.process,
        reason: session.reason,
        shutdown_type: session.shutdown_type,
        unexpected: session.unexpected_shutdown
      }
    });
    return;
  }

  const modalTitle = document.getElementById('pwr-modal-title');
  const modalBody = document.getElementById('pwr-modal-body');
  if (modalTitle) modalTitle.textContent = `Сессия питания: ${session.session_id}`;

  if (modalBody) {
    let eventsListHtml = '<div class="text-muted small">Нет связанных событий</div>';
    if (session.events && session.events.length > 0) {
      eventsListHtml = session.events.map(ev => `
        <div class="pwr-detail-card p-2 mb-2">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">Event ${ev.event_id}</span>
            <span class="font-monospace small text-muted">${escapeHtml(ev.timestamp)}</span>
          </div>
          <div class="small fw-semibold text-primary">${escapeHtml(ev.provider || '')}</div>
          <div class="small mt-1">${escapeHtml(ev.reason || ev.details?.message || '')}</div>
          ${ev.process ? `<div class="small text-muted font-monospace mt-1">Процесс: ${escapeHtml(ev.process)} | Пользователь: ${escapeHtml(ev.user || '--')}</div>` : ''}
        </div>
      `).join('');
    }

    modalBody.innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-6">
          <div class="pwr-detail-card p-2.5">
            <div class="text-muted small">🚀 Время старта (Boot):</div>
            <div class="font-monospace fw-bold text-info mt-1">${escapeHtml(session.boot_time)}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="pwr-detail-card p-2.5">
            <div class="text-muted small">⏹️ Завершение работы:</div>
            <div class="font-monospace fw-bold ${session.shutdown_time ? '' : 'text-success'} mt-1">
              ${session.shutdown_time ? escapeHtml(session.shutdown_time) : 'Сессия активна'}
            </div>
          </div>
        </div>
      </div>

      <div class="pwr-detail-card p-3 mb-3">
        <h6 class="fw-bold text-warning mb-2"><i class="bi bi-sliders me-1.5"></i>Параметры завершения</h6>
        <div class="row g-2 small">
          <div class="col-4 text-muted">Тип завершения:</div>
          <div class="col-8 fw-semibold">${escapeHtml(session.shutdown_type)}</div>
          
          <div class="col-4 text-muted">Аптайм сессии:</div>
          <div class="col-8 font-monospace fw-bold">${escapeHtml(session.uptime_human || '--')}</div>

          <div class="col-4 text-muted">Инициатор:</div>
          <div class="col-8">${escapeHtml(session.initiator || 'SYSTEM / Hardware')}</div>

          <div class="col-4 text-muted">Процесс:</div>
          <div class="col-8 font-monospace text-info">${escapeHtml(session.process || '--')}</div>

          <div class="col-4 text-muted">Код причины:</div>
          <div class="col-8 font-monospace text-secondary">${escapeHtml(session.reason_code || '--')}</div>

          <div class="col-4 text-muted">Текст причины:</div>
          <div class="col-8">${escapeHtml(session.reason || '--')}</div>

          ${session.comment ? `
            <div class="col-4 text-muted">Комментарий:</div>
            <div class="col-8 font-italic">${escapeHtml(session.comment)}</div>
          ` : ''}

          ${session.bugcheck ? `
            <div class="col-4 text-danger fw-bold">BSOD BugCheck:</div>
            <div class="col-8 text-danger font-monospace fw-bold">${escapeHtml(session.bugcheck)}</div>
          ` : ''}
        </div>
      </div>

      ${session.initiator_chain && session.initiator_chain.length > 0 ? `
        <div class="pwr-detail-card p-3 mb-3">
          <h6 class="fw-bold text-info mb-2"><i class="bi bi-diagram-3 me-1.5"></i>Корреляция цепочки вызова</h6>
          <div class="d-flex align-items-center flex-wrap gap-1 font-monospace small">
            ${session.initiator_chain.map((step, idx) => `
              <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle p-2">${escapeHtml(step)}</span>
              ${idx < session.initiator_chain.length - 1 ? '<i class="bi bi-arrow-right text-muted"></i>' : ''}
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="pwr-detail-card p-3">
        <h6 class="fw-bold mb-2"><i class="bi bi-list-nested me-1.5"></i>Хронология событий в рамках сессии</h6>
        <div style="max-height: 250px; overflow-y: auto;">
          ${eventsListHtml}
        </div>
      </div>
    `;

    const modalEl = document.getElementById('pwrSessionDetailModal');
    if (modalEl && window.bootstrap) {
      const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      modalInstance.show();
    }
  }
}

/**
 * Отображение сырого XML события в модальном окне.
 * 
 * @param {string} xmlString - Сырой XML текст события.
 */
export function showPowerXmlModal(xmlString) {
  const pre = document.getElementById('pwr-xml-content');
  if (pre) pre.textContent = xmlString;

  const modalEl = document.getElementById('pwrXmlDetailModal');
  if (modalEl && window.bootstrap) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}
