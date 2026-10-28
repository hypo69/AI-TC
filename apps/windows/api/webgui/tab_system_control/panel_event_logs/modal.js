/**
 * Модуль модального окна деталей события Windows Event Log и AI-диагностики.
 * 
 * Updated: 2026-10-17 00:30:00
 */

import { escapeHtml, getSeverityClass, t } from '../common/ui_utils.js';

/**
 * Открытие модального окна подробного просмотра события.
 * Интегрировано с универсальным модальным окном AIModalDialog / AITableModal.
 * 
 * @param {Object} entry - Объект события Windows Event Log.
 * @param {string} panelId - Идентификатор панели в разметке.
 * @param {string} currentChannel - Текущий выбранный канал.
 */
export function showEventDetails(entry, panelId = 'panel-system-control-3', currentChannel = 'System') {
  if (!entry) return;

  const modal = window.AIModalDialog || window.AITableModal;
  if (modal) {
    const lvl = entry.level || 'Info';
    const isErr = String(lvl).toLowerCase().includes('err') || String(lvl).toLowerCase().includes('crit');
    const isWarn = String(lvl).toLowerCase().includes('warn');
    const badgeCls = isErr ? 'badge bg-danger' : (isWarn ? 'badge bg-warning text-dark' : 'badge bg-info text-dark');
    const chan = (entry.channel || currentChannel || 'System').replace(/^evt:/i, '');

    modal.show({
      icon: isErr ? '🚨' : (isWarn ? '⚠️' : '📋'),
      title: `Событие #${entry.event_id > 0 ? entry.event_id : 'LOG'} (${entry.provider || entry.source || 'Windows'})`,
      subtitle: `Уровень: ${lvl} | ${entry.timestamp || ''}`,
      panelId: panelId,
      tableType: 'security_event',
      badges: [
        { text: lvl, class: badgeCls },
        { text: chan, class: 'badge border text-secondary' }
      ],
      metadata: [
        { label: 'Event ID', value: entry.event_id > 0 ? String(entry.event_id) : '-' },
        { label: 'Поставщик / Источник', value: entry.provider || entry.source || '-' },
        { label: 'Уровень важности', value: lvl },
        { label: 'Время регистрации', value: entry.timestamp || '-' },
        { label: 'Канал логов', value: chan },
        { label: 'Компьютер / Хост', value: entry.computer || 'LOCAL' },
        { label: 'PID процесса', value: entry.process_id > 0 ? String(entry.process_id) : '-' }
      ],
      rawTitle: 'Текст сообщения журнала событий',
      rawContent: entry.message || entry.raw_data || '',
      requestData: {
        event_id: entry.event_id,
        provider: entry.provider || entry.source,
        level: lvl,
        channel: chan,
        computer: entry.computer
      }
    });
    return;
  }

  const modalEl = document.getElementById('slc-event-detail-modal');
  if (!modalEl) return;

  const setElTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  };

  setElTxt('slc-modal-time', entry.timestamp);
  const lvlEl = document.getElementById('slc-modal-level');
  if (lvlEl) lvlEl.innerHTML = `<span class="badge ${getSeverityClass(entry.level)}">${escapeHtml(entry.level)}</span>`;
  setElTxt('slc-modal-id', entry.event_id > 0 ? String(entry.event_id) : '-');
  setElTxt('slc-modal-provider', entry.provider || entry.source || '-');
  setElTxt('slc-modal-computer', entry.computer || '-');
  setElTxt('slc-modal-pid', entry.process_id > 0 ? String(entry.process_id) : '-');
  setElTxt('slc-modal-channel', (entry.channel || currentChannel).replace(/^evt:/i, ''));
  setElTxt('slc-modal-message', entry.message);

  const aiExplanation = document.getElementById('slc-modal-ai-explanation');
  if (aiExplanation) {
    aiExplanation.innerHTML = escapeHtml(t('systemControl.modalAiPrompt', 'Нажмите «Анализ контекста», чтобы провести диагностику выбранной записи.'));
  }

  const diagnoseBtn = document.getElementById('btn-slc-modal-diagnose');
  if (diagnoseBtn) {
    diagnoseBtn.onclick = async () => {
      aiExplanation.innerHTML = `<div class="spinner-border spinner-border-sm text-info me-2"></div>${escapeHtml(t('systemControl.modalAiAnalyzing', 'Анализ выбранной записи...'))}`;
      try {
        const cleanChan = (entry.channel || currentChannel).replace(/^evt:/i, '');
        const res = await fetch('/api/v1/system_logs/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: cleanChan,
            timestamp: entry.timestamp,
            event_id: entry.event_id || 0,
            provider: entry.provider || entry.source || '',
            level: entry.level || '',
            message: entry.message || '',
            target_entry: entry,
            query_text: `Event diagnostic ${entry.provider || entry.source} (ID ${entry.event_id || 0}): ${entry.message || ''}`,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const report = await res.json();
        aiExplanation.innerHTML = `
          <div class="mb-2"><strong class="text-info">${escapeHtml(t('systemControl.modalAiSummary', 'Сводка:'))}</strong> ${escapeHtml(report.summary)}</div>
          <div class="mb-2"><strong class="text-warning">${escapeHtml(t('systemControl.modalAiRootCause', 'Причина / Анализ:'))}</strong> ${escapeHtml(report.root_cause)}</div>
          <h6 class="small text-uppercase text-muted fw-bold mb-1">${escapeHtml(t('systemControl.modalAiRecs', 'Рекомендации:'))}</h6>
          <ul class="mb-0 ps-3">
            ${(report.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        `;
      } catch (e) {
        aiExplanation.innerHTML = `<div class="text-danger">${escapeHtml(t('systemControl.errorDiagnose', 'Ошибка диагностики:'))} ${escapeHtml(e.message)}</div>`;
      }
    };
  }

  if (window.bootstrap?.Modal) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
}
