/**
 * @file apps/windows/api/webgui/tab_defender_firewall/panel_threats_events/panel.js
 * @description Панель аудита исключений, журнала угроз/карантина, цепочек процессов и событий Windows Defender
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:26:00
 */

import { fetchJSON } from '../common/ui_utils.js';

let currentEvents = [];
let currentThreats = [];
let isExclusionsLoaded = false;
let isThreatsLoaded = false;
let isProcsLoaded = false;
let isEventsLoaded = false;

/**
 * Сброс флагов кеша
 */
export function resetThreatsEventsCache() {
  isExclusionsLoaded = false;
  isThreatsLoaded = false;
  isProcsLoaded = false;
  isEventsLoaded = false;
}

/**
 * Парсинг ключ-значение из текстового сообщения Windows Event
 * @param {string} msg
 * @returns {Array<{key: string, val: string}>}
 */
export function parseMessageProps(msg) {
  if (!msg || typeof msg !== 'string') return [];
  const lines = msg.split(/\r?\n/);
  const props = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/^[\t\s*•\-]+/, '');
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx > 0 && colonIdx < 50) {
      const key = cleaned.substring(0, colonIdx).trim();
      const val = cleaned.substring(colonIdx + 1).trim();
      if (key.toLowerCase() !== 'http' && key.toLowerCase() !== 'https' && val) {
        props.push({ key, val });
      }
    }
  }
  if (props.length === 0 && msg.includes(':')) {
    const regex = /([A-Za-zА-Яа-я0-9\s/_\-()]+?):\s*([^:\n\r]+?)(?=(?:[A-Za-zА-Яа-я0-9\s/_\-()]+?:|$))/g;
    let match;
    while ((match = regex.exec(msg)) !== null) {
      const k = match[1].trim();
      const v = match[2].trim();
      if (k && v && k.length < 50 && k.toLowerCase() !== 'http' && k.toLowerCase() !== 'https') {
        props.push({ key: k, val: v });
      }
    }
  }
  return props;
}

/**
 * Отображение модального окна деталей события
 * @param {Object} event
 */
export function showEventDetail(event) {
  if (!event) return;
  const modalEl = document.getElementById('def-detail-modal');
  if (!modalEl) return;

  const titleEl = document.getElementById('def-detail-modal-title');
  const iconEl = document.getElementById('def-detail-modal-icon');
  const badgeEl = document.getElementById('def-detail-modal-badge');
  const timeEl = document.getElementById('def-detail-time');
  const levelEl = document.getElementById('def-detail-level');
  const catEl = document.getElementById('def-detail-category');
  const idEl = document.getElementById('def-detail-id');
  const propsSection = document.getElementById('def-detail-props-section');
  const propsTbody = document.getElementById('def-detail-props-tbody');
  const rawMsgEl = document.getElementById('def-detail-raw-msg');
  const footerHint = document.getElementById('def-detail-footer-hint');

  const isWarning = (event.level || '').toLowerCase().includes('warn');
  const isDanger = (event.level || '').toLowerCase().includes('err') || (event.level || '').toLowerCase().includes('crit') || [1006, 1015, 1116, 1117, 1121, 1123, 1125].includes(Number(event.event_id));

  if (titleEl) titleEl.textContent = `Событие безопасности: ${event.category || 'Windows Defender'}`;
  if (iconEl) iconEl.textContent = isDanger ? '🚨' : (isWarning ? '⚠️' : '📜');
  if (badgeEl) {
    badgeEl.textContent = `Event ID: ${event.event_id}`;
    badgeEl.className = `badge ${isDanger ? 'bg-danger' : (isWarning ? 'bg-warning text-dark' : 'bg-primary')}`;
  }
  if (timeEl) timeEl.textContent = event.timestamp || '-';
  if (levelEl) {
    levelEl.innerHTML = `<span class="badge ${isDanger ? 'bg-danger' : (isWarning ? 'bg-warning text-dark' : 'bg-secondary')}">${event.level || 'Info'}</span>`;
  }
  if (catEl) catEl.textContent = event.category || 'General';
  if (idEl) idEl.textContent = event.event_id || '-';

  const props = parseMessageProps(event.message);
  if (propsSection && propsTbody) {
    if (props.length > 0) {
      propsTbody.innerHTML = props.map(p => `
        <tr>
          <th class="text-secondary fw-semibold text-nowrap py-1 px-2" style="width: 32%;">${p.key}</th>
          <td class="font-monospace text-body py-1 px-2" style="word-break: break-all;">${p.val}</td>
        </tr>
      `).join('');
      propsSection.classList.remove('d-none');
    } else {
      propsSection.classList.add('d-none');
      propsTbody.innerHTML = '';
    }
  }

  if (rawMsgEl) rawMsgEl.textContent = event.message || 'Нет описания.';
  if (footerHint) footerHint.textContent = `Журнал: Microsoft-Windows-Windows Defender/Operational | Event ID: ${event.event_id}`;

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Отображение деталей угрозы
 * @param {Object} threat
 */
export function showThreatDetail(threat) {
  if (!threat) return;
  const modalEl = document.getElementById('def-detail-modal');
  if (!modalEl) return;

  const titleEl = document.getElementById('def-detail-modal-title');
  const iconEl = document.getElementById('def-detail-modal-icon');
  const badgeEl = document.getElementById('def-detail-modal-badge');
  const timeEl = document.getElementById('def-detail-time');
  const levelEl = document.getElementById('def-detail-level');
  const catEl = document.getElementById('def-detail-category');
  const idEl = document.getElementById('def-detail-id');
  const propsSection = document.getElementById('def-detail-props-section');
  const propsTbody = document.getElementById('def-detail-props-tbody');
  const rawMsgEl = document.getElementById('def-detail-raw-msg');
  const footerHint = document.getElementById('def-detail-footer-hint');

  if (titleEl) titleEl.textContent = `Обнаруженная угроза: ${threat.threat_name || 'Неизвестно'}`;
  if (iconEl) iconEl.textContent = '🚨';
  if (badgeEl) {
    badgeEl.textContent = `Threat ID: ${threat.threat_id || '-'}`;
    badgeEl.className = 'badge bg-danger';
  }
  if (timeEl) timeEl.textContent = threat.last_detection_time || threat.initial_detection_time || '-';
  if (levelEl) {
    levelEl.innerHTML = `<span class="badge bg-danger">${(threat.severity || 'High').toUpperCase()}</span>`;
  }
  if (catEl) catEl.textContent = threat.category || 'Malware';
  if (idEl) idEl.textContent = threat.threat_id || '-';

  const threatProps = [
    { key: 'Название угрозы', val: threat.threat_name },
    { key: 'Категория', val: threat.category },
    { key: 'Уровень опасности', val: threat.severity },
    { key: 'Текущий статус', val: threat.status },
    { key: 'Код действия очистки', val: threat.cleaning_action },
    { key: 'Время обнаружения', val: threat.initial_detection_time },
    { key: 'Последняя активность', val: threat.last_detection_time },
    { key: 'Ресурсы / Файлы', val: (threat.resources || []).join('\n') },
  ].filter(p => p.val);

  if (propsSection && propsTbody) {
    propsTbody.innerHTML = threatProps.map(p => `
      <tr>
        <th class="text-secondary fw-semibold text-nowrap py-1 px-2" style="width: 32%;">${p.key}</th>
        <td class="font-monospace text-body py-1 px-2" style="word-break: break-all; white-space: pre-wrap;">${p.val}</td>
      </tr>
    `).join('');
    propsSection.classList.remove('d-none');
  }

  if (rawMsgEl) {
    rawMsgEl.textContent = `Threat: ${threat.threat_name}\nID: ${threat.threat_id}\nSeverity: ${threat.severity}\nStatus: ${threat.status}\nResources:\n${(threat.resources || []).join('\n')}`;
  }
  if (footerHint) footerHint.textContent = `Источник: Get-MpThreatDetection / Microsoft Defender Threat History`;

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Загрузка и рендеринг аудита исключений
 * @param {boolean} force
 */
export async function loadExclusions(force = false) {
  if (!force && isExclusionsLoaded) return;
  try {
    const rep = await fetchJSON('/api/v1/defender/exclusions');
    isExclusionsLoaded = true;

    const countVal = document.getElementById('def-exclusions-val');
    const countSub = document.getElementById('def-exclusions-sub');
    const summaryBadge = document.getElementById('def-exc-summary-badge');
    const recBox = document.getElementById('def-exc-recommendation-box');
    const tbody = document.getElementById('def-exclusions-tbody');

    if (countVal) countVal.textContent = rep.total_exclusions;
    if (countSub) countSub.textContent = `${rep.suspicious_count} подозрительных`;
    if (summaryBadge) summaryBadge.textContent = `${rep.total_exclusions} исключений (${rep.suspicious_count} риск)`;
    if (recBox) recBox.textContent = rep.summary_recommendation;

    const allItems = [...rep.path_exclusions, ...rep.extension_exclusions, ...rep.process_exclusions];

    if (tbody) {
      if (allItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Исключения отсутствуют. Защита работает без пропусков.</td></tr>';
      } else {
        tbody.innerHTML = allItems.map(itm => {
          let riskBadge = '<span class="badge bg-success">Безопасно</span>';
          if (itm.risk_level === 'critical') riskBadge = '<span class="badge def-badge-critical">КРИТИЧЕСКИЙ</span>';
          else if (itm.risk_level === 'high') riskBadge = '<span class="badge def-badge-disabled">ВЫСОКИЙ</span>';
          else if (itm.risk_level === 'medium') riskBadge = '<span class="badge def-badge-warn">СРЕДНИЙ</span>';

          return `
            <tr>
              <td><span class="badge bg-body-secondary text-body border">${itm.type.toUpperCase()}</span></td>
              <td class="font-monospace text-body">${itm.value}</td>
              <td class="text-center">${riskBadge}</td>
              <td class="text-secondary small">${itm.risk_reason}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading exclusions:', err);
  }
}

/**
 * Загрузка журнала угроз и карантина
 * @param {boolean} force
 */
export async function loadThreats(force = false) {
  if (!force && isThreatsLoaded) return;
  try {
    const threats = await fetchJSON('/api/v1/defender/threats?limit=50');
    isThreatsLoaded = true;
    currentThreats = Array.isArray(threats) ? threats : [];

    const countBadge = document.getElementById('def-threats-count-badge');
    const countVal = document.getElementById('def-threats-val');
    const countSub = document.getElementById('def-threats-sub');
    const tbody = document.getElementById('def-threats-tbody');

    if (countBadge) countBadge.textContent = `${currentThreats.length} записей`;
    if (countVal) countVal.textContent = currentThreats.length;

    const quarantined = currentThreats.filter(t => (t.status || '').toLowerCase().includes('quarantine')).length;
    if (countSub) countSub.textContent = `Карантин: ${quarantined}`;

    if (tbody) {
      if (currentThreats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Активных и архивных угроз не зафиксировано.</td></tr>';
      } else {
        tbody.innerHTML = currentThreats.map((t, idx) => `
          <tr class="def-clickable-row" data-threat-idx="${idx}" title="Нажмите для просмотра подробностей">
            <td class="fw-semibold text-danger">${t.threat_name}</td>
            <td><span class="badge bg-body-secondary text-body border">${t.category}</span></td>
            <td class="text-center"><span class="badge bg-warning text-dark">${(t.severity || 'Unknown').toUpperCase()}</span></td>
            <td><span class="badge bg-success">${t.status}</span></td>
            <td class="text-secondary small font-monospace">${t.last_detection_time || t.initial_detection_time || '-'}</td>
            <td class="text-secondary font-monospace small text-truncate" style="max-width: 280px;">${(t.resources || []).join(', ')}</td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.def-clickable-row').forEach(row => {
          row.addEventListener('click', () => {
            const idx = parseInt(row.getAttribute('data-threat-idx'), 10);
            if (!isNaN(idx) && currentThreats[idx]) {
              showThreatDetail(currentThreats[idx]);
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading threats:', err);
  }
}

/**
 * Загрузка цепочек процессов и индикаторов Fileless-атак
 * @param {boolean} force
 */
export async function loadProcesses(force = false) {
  if (!force && isProcsLoaded) return;
  try {
    const chains = await fetchJSON('/api/v1/defender/process-tree');
    isProcsLoaded = true;
    const badge = document.getElementById('def-procs-count-badge');
    const tbody = document.getElementById('def-procs-tbody');

    if (badge) badge.textContent = `${chains.length} аномалий`;

    if (tbody) {
      if (chains.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Подозрительных связей процессов и fileless индикаторов не обнаружено.</td></tr>';
      } else {
        tbody.innerHTML = chains.map(c => `
          <tr>
            <td class="font-monospace text-warning">${c.parent_process} (PID: ${c.parent_pid || '-'})</td>
            <td class="font-monospace text-danger fw-semibold">${c.child_process}</td>
            <td class="text-center text-secondary">${c.child_pid || '-'}</td>
            <td class="text-center"><span class="badge def-badge-critical">${c.severity.toUpperCase()}</span></td>
            <td class="text-secondary small">
              <div>${c.reason}</div>
              ${c.command_line ? `<div class="font-monospace text-muted mt-1" style="font-size: 0.68rem;">cmd: ${c.command_line}</div>` : ''}
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading process chains:', err);
  }
}

/**
 * Загрузка журнала событий Defender Operational
 * @param {boolean} force
 */
export async function loadEvents(force = false) {
  if (!force && isEventsLoaded) return;
  try {
    const events = await fetchJSON('/api/v1/defender/events?limit=50');
    isEventsLoaded = true;
    currentEvents = Array.isArray(events) ? events : [];
    const badge = document.getElementById('def-events-count-badge');
    const tbody = document.getElementById('def-events-tbody');

    if (badge) badge.textContent = `${currentEvents.length} событий`;

    if (tbody) {
      if (currentEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Событий в журнале Defender Operational не обнаружено.</td></tr>';
      } else {
        tbody.innerHTML = currentEvents.map((e, idx) => `
          <tr class="def-clickable-row" data-event-idx="${idx}" title="Нажмите для просмотра подробностей">
            <td class="font-monospace fw-semibold text-info">${e.event_id}</td>
            <td class="text-secondary small font-monospace text-nowrap">${e.timestamp}</td>
            <td><span class="badge ${e.level.toLowerCase().includes('err') || e.level.toLowerCase().includes('crit') ? 'bg-danger' : (e.level.toLowerCase().includes('warn') ? 'bg-warning text-dark' : 'bg-secondary')}">${e.level}</span></td>
            <td><span class="badge bg-body-secondary text-body border">${e.category}</span></td>
            <td class="text-body small" style="word-break: break-word;">${e.message}</td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.def-clickable-row').forEach(row => {
          row.addEventListener('click', () => {
            const idx = parseInt(row.getAttribute('data-event-idx'), 10);
            if (!isNaN(idx) && currentEvents[idx]) {
              showEventDetail(currentEvents[idx]);
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading events:', err);
  }
}
