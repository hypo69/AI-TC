/**
 * =============================================================================
 * Название: Модальное окно детализации события и ИИ-диагностики
 * =============================================================================
 * Описание:
 *   Отображение полной структуры записи журнала событий и отправка запроса
 *   на семантический контекстный анализ причин инцидента через ИИ.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_details_modal/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml, getSeverityClass } from '../common/ui_utils.js';

let selectedEvent = null;

export function getSelectedEvent() {
  return selectedEvent;
}

export function setSelectedEvent(entry) {
  selectedEvent = entry;
}

/**
 * Отображает модальное окно деталей события и настраивает кнопку ИИ-диагностики.
 * @param {Object} entry - Объект записи журнала событий.
 * @param {string} [currentChannel='System'] - Имя активного канала.
 */
export function showEventModal(entry, currentChannel = 'System') {
  if (!entry) return;
  selectedEvent = entry;

  const modalEl = document.getElementById('slc-event-detail-modal');
  if (!modalEl) return;

  const timeEl = document.getElementById('slc-modal-time');
  const levelEl = document.getElementById('slc-modal-level');
  const idEl = document.getElementById('slc-modal-id');
  const providerEl = document.getElementById('slc-modal-provider');
  const computerEl = document.getElementById('slc-modal-computer');
  const pidEl = document.getElementById('slc-modal-pid');
  const channelEl = document.getElementById('slc-modal-channel');
  const msgEl = document.getElementById('slc-modal-message');

  if (timeEl) timeEl.textContent = entry.timestamp || '';
  if (levelEl) levelEl.innerHTML = `<span class="badge ${getSeverityClass(entry.level)}">${escapeHtml(entry.level)}</span>`;
  if (idEl) idEl.textContent = entry.event_id > 0 ? String(entry.event_id) : '-';
  if (providerEl) providerEl.textContent = entry.provider || entry.source || '';
  if (computerEl) computerEl.textContent = entry.computer || 'Localhost';
  if (pidEl) pidEl.textContent = entry.process_id > 0 ? String(entry.process_id) : '-';
  if (channelEl) channelEl.textContent = entry.channel || currentChannel;
  if (msgEl) msgEl.textContent = entry.message || '';

  const aiExplanation = document.getElementById('slc-modal-ai-explanation');
  if (aiExplanation) {
    aiExplanation.innerHTML = `Нажмите «Анализ контекста», чтобы провести диагностику выбранной записи и сопутствующих событий.`;
  }

  const diagnoseBtn = document.getElementById('btn-slc-modal-diagnose');
  if (diagnoseBtn) {
    diagnoseBtn.onclick = async () => {
      if (aiExplanation) {
        aiExplanation.innerHTML = `<div class="spinner-border spinner-border-sm text-info me-2"></div>Анализ выбранной записи...`;
      }
      try {
        const res = await fetch('/api/v1/system_logs/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_timestamp: entry.timestamp,
            window_minutes: 5,
            channel: entry.channel || currentChannel,
            event_id: entry.event_id || 0,
            provider: entry.provider || entry.source || '',
            level: entry.level || '',
            message: entry.message || '',
            target_entry: entry,
            query_text: `Диагностика события ${entry.provider || entry.source} (ID ${entry.event_id || 0}): ${entry.message || ''}`,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const report = await res.json();
        if (aiExplanation) {
          aiExplanation.innerHTML = `
            <div class="mb-2"><strong class="text-info">Сводка:</strong> ${escapeHtml(report.summary)}</div>
            <div class="mb-2"><strong class="text-warning">Причина / Анализ:</strong> ${escapeHtml(report.root_cause)}</div>
            <h6 class="small text-uppercase text-muted fw-bold mb-1">Рекомендации:</h6>
            <ul class="mb-0 ps-3">
              ${(report.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          `;
        }
      } catch (err) {
        if (aiExplanation) {
          aiExplanation.innerHTML = `<div class="text-danger">Ошибка диагностики: ${escapeHtml(err.message)}</div>`;
        }
      }
    };
  }

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
}
