/**
 * Модуль панели журналов и событий безопасности Microsoft Defender.
 * 
 * Отвечает за:
 * - Мониторинг статуса антивирусной защиты в реальном времени (Real-Time Protection, Cloud)
 * - Историю обнаружения угроз и вредоносных программ (Event ID 1006 / 1116)
 * - Аудит блокировок Controlled Folder Access (CFA / Ransomware protection)
 * - Аудит правил Attack Surface Reduction (ASR / Exploit Guard)
 * - Быстрое сканирование и обновление антивирусных сигнатур
 * 
 * Updated: 2026-10-20 19:15:00
 */

import { escapeHtml, formatTime, getSeverityClass, initTableResizers, t } from '../common/ui_utils.js';

let allDefenderEvents = [];
let allDefenderThreats = [];
let defenderStatusData = null;
let isDefenderInitialized = false;

const DEFENDER_CATEGORIES = {
  1000: { name: 'Сканирование начато', en: 'Scan Started', cat: 'scans', icon: 'bi-search', badge: 'bg-info' },
  1001: { name: 'Сканирование завершено', en: 'Scan Completed', cat: 'scans', icon: 'bi-check-circle', badge: 'bg-success' },
  1002: { name: 'Сканирование отменено', en: 'Scan Cancelled', cat: 'scans', icon: 'bi-slash-circle', badge: 'bg-warning text-dark' },
  1005: { name: 'Сбой сканирования', en: 'Scan Failed', cat: 'scans', icon: 'bi-x-circle', badge: 'bg-danger' },
  1006: { name: 'Обнаружена угроза (Вредонос)', en: 'Malware Detected', cat: 'threats', icon: 'bi-bug-fill', badge: 'bg-danger' },
  1007: { name: 'Угроза нейтрализована', en: 'Malware Remediated', cat: 'threats', icon: 'bi-shield-check', badge: 'bg-success' },
  1008: { name: 'Сбой нейтрализации угрозы', en: 'Remediation Failed', cat: 'threats', icon: 'bi-exclamation-octagon-fill', badge: 'bg-danger' },
  1015: { name: 'Подозрительное поведение', en: 'Suspicious Behavior', cat: 'threats', icon: 'bi-eye-fill', badge: 'bg-warning text-dark' },
  1116: { name: 'Обнаружен вирус / вредонос', en: 'Malware Detected', cat: 'threats', icon: 'bi-radioactive', badge: 'bg-danger' },
  1117: { name: 'Действие выполнено', en: 'Action Taken', cat: 'threats', icon: 'bi-shield-shaded', badge: 'bg-info' },
  1121: { name: 'Блокировка Network Protection', en: 'Network Protection Block', cat: 'network', icon: 'bi-globe-americas', badge: 'bg-warning text-dark' },
  1122: { name: 'Аудит Network Protection', en: 'Network Protection Audit', cat: 'network', icon: 'bi-globe', badge: 'bg-secondary' },
  1123: { name: 'Блокировка CFA (Ransomware)', en: 'Controlled Folder Access Block', cat: 'cfa', icon: 'bi-lock-fill', badge: 'bg-warning text-dark' },
  1124: { name: 'Аудит CFA', en: 'Controlled Folder Access Audit', cat: 'cfa', icon: 'bi-folder-check', badge: 'bg-secondary' },
  1125: { name: 'Блокировка ASR (Exploit Guard)', en: 'Attack Surface Reduction Block', cat: 'asr', icon: 'bi-lightning-fill', badge: 'bg-warning text-dark' },
  1126: { name: 'Аудит ASR', en: 'Attack Surface Reduction Audit', cat: 'asr', icon: 'bi-lightning', badge: 'bg-secondary' },
  2000: { name: 'Сигнатуры обновлены', en: 'Signature Updated', cat: 'signatures', icon: 'bi-cloud-check', badge: 'bg-success' },
  2001: { name: 'Сбой обновления сигнатур', en: 'Signature Update Failed', cat: 'signatures', icon: 'bi-cloud-slash', badge: 'bg-danger' },
  2002: { name: 'Обновление сигнатур отменено', en: 'Signature Update Cancelled', cat: 'signatures', icon: 'bi-cloud-minus', badge: 'bg-secondary' },
  2003: { name: 'Движок Defender обновлен', en: 'Engine Updated', cat: 'signatures', icon: 'bi-cpu-fill', badge: 'bg-info text-dark' },
  5000: { name: 'Защита в реальном времени ВКЛ', en: 'Real-time Protection Enabled', cat: 'protection', icon: 'bi-shield-fill-check', badge: 'bg-success' },
  5001: { name: 'Защита в реальном времени ВЫКЛ', en: 'Real-time Protection Disabled', cat: 'protection', icon: 'bi-shield-fill-x', badge: 'bg-danger' },
  5007: { name: 'Конфигурация Defender изменена', en: 'Configuration Changed', cat: 'protection', icon: 'bi-sliders', badge: 'bg-warning text-dark' },
};

/**
 * Получение всех событий Defender.
 * @returns {Array}
 */
export function getAllDefenderEvents() {
  return allDefenderEvents;
}

/**
 * Нормализация сырого события Windows Defender.
 * @param {Object} e - Исходный объект события.
 * @returns {Object} Нормализованный объект.
 */
export function normalizeDefenderEvent(e) {
  const eid = Number(e.event_id || e.Id || 0);
  const info = DEFENDER_CATEGORIES[eid] || {
    name: 'Событие безопасности',
    en: 'Security Event',
    cat: 'general',
    icon: 'bi-shield',
    badge: 'bg-secondary'
  };
  return {
    event_id: eid,
    timestamp: e.timestamp || e.TimeCreated || new Date().toISOString(),
    level: e.level || e.LevelDisplayName || (info.cat === 'threats' ? 'Warning' : 'Information'),
    category: e.category || (window.currentLang === 'en' ? info.en : info.name),
    category_key: info.cat,
    icon: info.icon,
    badge: info.badge,
    message: e.message || e.Message || e.raw_data || '',
    details: e.details || {}
  };
}

/**
 * Рендеринг сводных KPI карточек статуса Microsoft Defender.
 */
export function renderDefenderSummary(status, threats, events) {
  const statusBadge = document.getElementById('def-status-badge');
  const statusText = document.getElementById('def-status-text');
  const cloudStatus = document.getElementById('def-cloud-status');
  const threatsBadge = document.getElementById('def-threats-badge');
  const threatsCount = document.getElementById('def-threats-count');
  const threatsDesc = document.getElementById('def-threats-desc');
  const blocksCount = document.getElementById('def-blocks-count');
  const sigBadge = document.getElementById('def-sig-badge');
  const sigVersion = document.getElementById('def-sig-version');
  const engineVersion = document.getElementById('def-engine-version');

  if (status) {
    const isEnabled = status.is_enabled !== false && status.real_time_protection !== false && status.antivirus_enabled !== false;
    if (statusBadge) {
      statusBadge.className = isEnabled ? 'badge bg-success font-monospace' : 'badge bg-danger font-monospace';
      statusBadge.textContent = isEnabled ? 'ACTIVE' : 'DISABLED';
    }
    if (statusText) {
      statusText.textContent = isEnabled ? 'Включена (Real-Time)' : 'Отключена / Неактивна';
    }
    if (cloudStatus) {
      const cloudActive = status.cloud_protection !== false && status.behavior_monitor_enabled !== false;
      cloudStatus.textContent = `Cloud: ${cloudActive ? 'Включена' : 'Отключена'}`;
    }
    if (sigVersion) {
      sigVersion.textContent = status.signatures_version || status.antivirus_signature_version || 'vLatest';
    }
    if (sigBadge && status.signatures_version) {
      sigBadge.textContent = status.signatures_version.split('.').slice(0, 2).join('.') || 'vLatest';
    }
    if (engineVersion) {
      engineVersion.textContent = `Engine: ${status.engine_version || 'Defender Engine'}`;
    }
  }

  const threatCountVal = (threats && threats.length) || (events ? events.filter(e => e.category_key === 'threats').length : 0);
  if (threatsCount) threatsCount.textContent = threatCountVal;
  if (threatsBadge) {
    if (threatCountVal > 0) {
      threatsBadge.className = 'badge bg-danger font-monospace';
      threatsBadge.textContent = `${threatCountVal} Угроз`;
    } else {
      threatsBadge.className = 'badge bg-success font-monospace';
      threatsBadge.textContent = '0 Угроз';
    }
  }
  if (threatsDesc && threats && threats.length > 0) {
    threatsDesc.textContent = `Посл: ${threats[0].threat_name || threats[0].name || 'Detected'}`;
  }

  const blocksTotal = events ? events.filter(e => e.category_key === 'cfa' || e.category_key === 'asr' || e.category_key === 'network').length : 0;
  if (blocksCount) blocksCount.textContent = blocksTotal;
}

/**
 * Фильтрация и рендеринг таблицы событий Defender.
 */
export function filterAndRenderDefenderEvents() {
  const tbody = document.getElementById('def-events-tbody');
  const counter = document.getElementById('def-events-counter');
  const tableBadge = document.getElementById('def-table-badge');
  if (!tbody) return;

  const searchVal = (document.getElementById('def-events-search')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('def-category-select')?.value || '';
  const lvlFilter = (document.getElementById('def-level-select')?.value || '').toLowerCase().trim();

  const filtered = allDefenderEvents.filter(e => {
    if (catFilter && e.category_key !== catFilter) return false;
    if (lvlFilter) {
      const lvl = (e.level || '').toLowerCase();
      if (!lvl.includes(lvlFilter)) return false;
    }
    if (searchVal) {
      const matchMsg = (e.message || '').toLowerCase().includes(searchVal);
      const matchId = String(e.event_id || '').includes(searchVal);
      const matchCat = (e.category || '').toLowerCase().includes(searchVal);
      if (!matchMsg && !matchId && !matchCat) return false;
    }
    return true;
  });

  if (counter) counter.textContent = `${filtered.length} событий`;
  if (tableBadge) tableBadge.textContent = `${filtered.length} событий`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">${t('systemControl.defNoEvents', 'Событий Windows Defender не найдено.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((e, idx) => {
    const timeStr = formatTime(e.timestamp);
    const isWarnOrErr = (e.level || '').toLowerCase().includes('warn') || (e.level || '').toLowerCase().includes('err') || (e.level || '').toLowerCase().includes('crit') || e.category_key === 'threats';
    return `
      <tr data-index="${idx}" class="${isWarnOrErr ? 'table-danger-subtle' : ''}">
        <td class="font-monospace small" style="color: var(--text-muted);">${escapeHtml(timeStr)}</td>
        <td><span class="badge ${getSeverityClass(e.level)} text-uppercase" style="font-size: 0.68rem;">${escapeHtml(e.level || 'Info')}</span></td>
        <td class="font-monospace small fw-bold" style="color: #0284c7;">${e.event_id || '-'}</td>
        <td>
          <span class="badge ${e.badge || 'bg-secondary'} d-inline-flex align-items-center gap-1 font-monospace" style="font-size: 0.72rem;">
            <i class="bi ${e.icon || 'bi-shield'}"></i>
            <span>${escapeHtml(e.category)}</span>
          </span>
        </td>
        <td class="text-truncate" style="max-width: 480px; color: var(--text-color);" title="${escapeHtml(e.message)}">
          ${escapeHtml(e.message)}
        </td>
        <td>
          <button class="btn btn-xs btn-outline-info rounded-pill px-2 py-0.5 def-detail-btn" data-index="${idx}" title="Посмотреть детали события">
            <i class="bi bi-info-circle"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr').forEach(row => {
    row.onclick = () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('table-active'));
      row.classList.add('table-active');
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const ev = filtered[idx];
      if (ev) showDefenderEventDetail(ev);
    };
  });
}

/**
 * Отображение детальной карточки события безопасности Defender.
 * 
 * @param {Object} ev - Объект события Defender.
 */
export function showDefenderEventDetail(ev) {
  const modal = window.AIModalDialog || window.AITableModal;
  if (modal && ev) {
    const isThreat = ev.category_key === 'threats' || (ev.level || '').toLowerCase().includes('crit') || (ev.level || '').toLowerCase().includes('err');
    modal.show({
      icon: isThreat ? '🚨' : '🛡️',
      title: `Defender ID ${ev.event_id}: ${ev.category || 'Безопасность'}`,
      subtitle: `Уровень: ${ev.level || 'Info'} | ${ev.timestamp || ''}`,
      panelId: 'panel-system-control-defender-filter',
      tableType: 'security_event',
      badges: [
        { text: ev.level || 'Info', class: `badge ${getSeverityClass(ev.level)}` },
        { text: ev.category || 'Defender', class: 'badge bg-secondary' }
      ],
      metadata: [
        { label: 'Event ID', value: String(ev.event_id) },
        { label: 'Категория', value: ev.category || 'Защита' },
        { label: 'Уровень', value: ev.level || 'Info' },
        { label: 'Время регистрации', value: ev.timestamp || '-' },
        { label: 'Журнал', value: 'Microsoft-Windows-Windows Defender/Operational', isCode: true, fullWidth: true }
      ],
      rawTitle: 'Подробности и параметры события Defender',
      rawContent: ev.message || '',
      requestData: {
        event_id: ev.event_id,
        category: ev.category,
        category_key: ev.category_key,
        level: ev.level,
        description: ev.message
      }
    });
    return;
  }

  const modalEl = document.getElementById('defEventDetailModal');
  const bodyEl = document.getElementById('def-modal-body');
  const titleEl = document.getElementById('def-modal-title');
  if (!modalEl || !bodyEl || !ev) return;

  if (titleEl) {
    titleEl.innerHTML = `<i class="bi ${ev.icon || 'bi-shield-check'} text-info me-2"></i><span>Событие Defender ID ${ev.event_id}: ${escapeHtml(ev.category)}</span>`;
  }

  bodyEl.innerHTML = `
    <div class="row g-2 mb-3 small font-monospace">
      <div class="col-sm-6"><strong class="text-muted">Время:</strong> <span style="color: var(--text-color);">${escapeHtml(ev.timestamp)}</span></div>
      <div class="col-sm-6"><strong class="text-muted">Уровень:</strong> <span class="badge ${getSeverityClass(ev.level)}">${escapeHtml(ev.level || 'Info')}</span></div>
      <div class="col-sm-6"><strong class="text-muted">Event ID:</strong> <span class="fw-bold text-info">${ev.event_id}</span></div>
      <div class="col-sm-6"><strong class="text-muted">Категория:</strong> <span class="badge ${ev.badge || 'bg-secondary'}">${escapeHtml(ev.category)}</span></div>
      <div class="col-sm-12"><strong class="text-muted">Канал:</strong> <span class="text-warning">Microsoft-Windows-Windows Defender/Operational</span></div>
    </div>
    <div class="p-3 mb-3 rounded border" style="background: var(--surface-2); border-color: var(--border-color) !important;">
      <h6 class="small text-uppercase text-muted fw-bold mb-2">Описание события</h6>
      <div class="small font-monospace" style="white-space: pre-wrap; word-break: break-word; color: var(--text-color);">${escapeHtml(ev.message || 'Нет описания')}</div>
    </div>
    <div class="p-3 rounded border" style="background: var(--surface-2); border-color: var(--border-color) !important;">
      <h6 class="fw-bold text-primary mb-1"><i class="bi bi-shield-lock me-1"></i> Рекомендация безопасности</h6>
      <div class="small text-muted">
        ${ev.category_key === 'threats' ? '⚠️ Обнаружена угроза! Рекомендуется выполнить проверку карантина или запустить полное сканирование.' : (ev.category_key === 'cfa' ? '🔒 Блокировка доступа к защищенным папкам. Проверьте доверенные приложения в Controlled Folder Access.' : (ev.category_key === 'signatures' ? '📦 Статус баз антивирусных сигнатур Defender. Обновления применяются автоматически.' : '🛡️ Стандартное событие мониторинга и безопасности Microsoft Defender.'))}
      </div>
    </div>
  `;

  if (window.bootstrap && window.bootstrap.Modal) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

/**
 * Загрузка актуальных данных Defender из API.
 * 
 * @param {boolean} force - Принудительное обновление.
 * @param {Function} isTabActive - Функция проверки активности вкладки.
 */
export async function loadDefenderData(force = false, isTabActive = () => true) {
  if (!isTabActive()) return;
  try {
    const statusPromise = fetch('/api/v1/defender/status')
      .then(r => r.ok ? r.json() : null)
      .catch(e => { console.debug('[Defender] Ошибка статуса:', e); return null; });

    const threatsPromise = fetch('/api/v1/defender/threats?limit=50')
      .then(r => r.ok ? r.json() : [])
      .catch(e => { console.debug('[Defender] Ошибка истории угроз:', e); return []; });

    const eventsPromise = fetch('/api/v1/defender/events?limit=150')
      .then(async r => {
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
        const fallbackRes = await fetch('/api/v1/system_logs/events?channel=Microsoft-Windows-Windows%20Defender/Operational&hours=720&limit=150');
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          return fbData.events || fbData.entries || [];
        }
        return [];
      })
      .catch(e => { console.debug('[Defender] Ошибка событий:', e); return []; });

    const [status, threats, events] = await Promise.all([statusPromise, threatsPromise, eventsPromise]);
    defenderStatusData = status;
    allDefenderThreats = Array.isArray(threats) ? threats : [];
    allDefenderEvents = (Array.isArray(events) ? events : []).map(normalizeDefenderEvent);

    renderDefenderSummary(defenderStatusData, allDefenderThreats, allDefenderEvents);
    filterAndRenderDefenderEvents();
  } catch (err) {
    console.warn('[Defender] Ошибка загрузки данных Defender:', err);
  }
}

/**
 * Инициализация обработчиков событий панели журналов Defender.
 */
export function initDefenderLogsPanel() {
  if (isDefenderInitialized) return;
  isDefenderInitialized = true;

  const refreshBtn = document.getElementById('def-refresh-btn');
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn._bound = true;
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
      try {
        await loadDefenderData(true);
        if (window.toast) window.toast.success(t('systemControl.btnRefresh', 'Обновлено'), 'События Defender успешно обновлены');
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `<i class="bi bi-arrow-clockwise me-1"></i><span>${t('systemControl.btnRefresh', 'Обновить')}</span>`;
      }
    });
  }

  const auditBtn = document.getElementById('def-audit-btn');
  if (auditBtn && !auditBtn._bound) {
    auditBtn._bound = true;
    auditBtn.addEventListener('click', async () => {
      auditBtn.disabled = true;
      auditBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Аудит...';
      try {
        const res = await fetch('/api/v1/defender/refresh', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadDefenderData(true);
        if (window.toast) window.toast.success('Аудит Defender', 'Снимок безопасности Defender успешно обновлен в БД');
      } catch (e) {
        console.warn('[Defender] Ошибка аудита:', e);
        if (window.toast) window.toast.error('Ошибка', 'Не удалось провести аудит Defender: ' + e.message);
      } finally {
        auditBtn.disabled = false;
        auditBtn.innerHTML = `<i class="bi bi-shield-check me-1"></i><span>${t('systemControl.defBtnAudit', 'Аудит статуса')}</span>`;
      }
    });
  }

  const scanBtn = document.getElementById('def-quick-scan-btn');
  if (scanBtn && !scanBtn._bound) {
    scanBtn._bound = true;
    scanBtn.addEventListener('click', async () => {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Старт...';
      try {
        const res = await fetch('/api/v1/defender/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_type: 'quick' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const task = await res.json();
        if (window.toast) window.toast.info('Сканирование Defender', `Запущено быстрое сканирование (Task ID: ${task.task_id || 'active'})`);
        setTimeout(() => loadDefenderData(true), 3000);
      } catch (e) {
        console.warn('[Defender] Ошибка сканирования:', e);
        if (window.toast) window.toast.error('Ошибка', 'Не удалось запустить сканирование: ' + e.message);
      } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = `<i class="bi bi-play-circle me-1"></i><span>${t('systemControl.defBtnScan', 'Быстрое скан')}</span>`;
      }
    });
  }

  const updateSigBtn = document.getElementById('def-update-sig-btn');
  if (updateSigBtn && !updateSigBtn._bound) {
    updateSigBtn._bound = true;
    updateSigBtn.addEventListener('click', async () => {
      updateSigBtn.disabled = true;
      updateSigBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Обновление...';
      try {
        const res = await fetch('/api/v1/defender/update-signatures', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const task = await res.json();
        if (window.toast) window.toast.info('Обновление сигнатур', `Запущено фоновое обновление баз (Task ID: ${task.task_id || 'active'})`);
        setTimeout(() => loadDefenderData(true), 3000);
      } catch (e) {
        console.warn('[Defender] Ошибка обновления баз:', e);
        if (window.toast) window.toast.error('Ошибка', 'Не удалось обновить базы: ' + e.message);
      } finally {
        updateSigBtn.disabled = false;
        updateSigBtn.innerHTML = `<i class="bi bi-cloud-arrow-down me-1"></i><span>${t('systemControl.defBtnUpdateSig', 'Обновить базы')}</span>`;
      }
    });
  }

  const searchInput = document.getElementById('def-events-search');
  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    searchInput.addEventListener('input', () => filterAndRenderDefenderEvents());
  }

  const catSelect = document.getElementById('def-category-select');
  if (catSelect && !catSelect._bound) {
    catSelect._bound = true;
    catSelect.addEventListener('change', () => filterAndRenderDefenderEvents());
  }

  const lvlSelect = document.getElementById('def-level-select');
  if (lvlSelect && !lvlSelect._bound) {
    lvlSelect._bound = true;
    lvlSelect.addEventListener('change', () => filterAndRenderDefenderEvents());
  }

  initTableResizers();
}
