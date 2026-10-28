/**
 * Модуль панели поведенческой форензики и активности (Forensics & UserAssist).
 * 
 * Отвечает за мониторинг активного окна переднего плана, таймлайн активности пользователя,
 * детекцию простоя (idle), аудит доступа к камере и микрофону, а также историю UserAssist.
 * 
 * Updated: 2026-10-20 19:15:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let isForensicsInitialized = false;
const FORENSICS_SUBTAB_KEY = 'slc_forensics_active_subtab';

/**
 * Инициализация панели форензики, привязка переключателей субвкладок и кнопок обновления.
 */
export function initForensicsPanel() {
  if (isForensicsInitialized) return;
  isForensicsInitialized = true;

  const btnTimeline = document.getElementById('slc-subtab-forensics-timeline-btn');
  const btnUserAssist = document.getElementById('slc-subtab-forensics-userassist-btn');

  if (btnTimeline) {
    btnTimeline.addEventListener('click', () => switchForensicsSubTab('timeline'));
  }
  if (btnUserAssist) {
    btnUserAssist.addEventListener('click', () => switchForensicsSubTab('userassist'));
  }

  const savedSubtab = localStorage.getItem(FORENSICS_SUBTAB_KEY) || 'timeline';
  switchForensicsSubTab(savedSubtab);

  const btnRefresh = document.getElementById('btn-source-forensics');
  if (btnRefresh && !btnRefresh._forensicsBound) {
    btnRefresh._forensicsBound = true;
    btnRefresh.addEventListener('click', () => loadForensicsData(true));
  }
}

/**
 * Переключение суб-вкладок форензики (Таймлайн окон / Реестр UserAssist).
 * 
 * @param {string} subtabId - Идентификатор подвкладки ('timeline' | 'userassist').
 */
export function switchForensicsSubTab(subtabId) {
  const btnId = subtabId === 'userassist' ? 'slc-subtab-forensics-userassist-btn' : 'slc-subtab-forensics-timeline-btn';
  const paneId = subtabId === 'userassist' ? 'slc-subpane-forensics-userassist' : 'slc-subpane-forensics-timeline';

  ['slc-subpane-forensics-timeline', 'slc-subpane-forensics-userassist'].forEach(id => {
    const pane = document.getElementById(id);
    if (pane) {
      if (id === paneId) {
        pane.classList.remove('d-none');
        pane.classList.add('show', 'active');
      } else {
        pane.classList.add('d-none');
        pane.classList.remove('show', 'active');
      }
    }
  });

  const btn = document.getElementById(btnId);
  if (btn) {
    if (window.bootstrap && window.bootstrap.Tab) {
      const tabInstance = window.bootstrap.Tab.getOrCreateInstance(btn);
      tabInstance.show();
    } else {
      btn.click();
    }
    try {
      localStorage.setItem(FORENSICS_SUBTAB_KEY, btnId === 'slc-subtab-forensics-userassist-btn' ? 'userassist' : 'timeline');
    } catch (_) {}
  }
}

/**
 * Загрузка телеметрии форензики с бэкенда и рендеринг интерфейса.
 * 
 * @param {boolean} forceRefresh - Принудительное обновление данных.
 * @param {Function} isTabActive - Функция проверки активности вкладки.
 */
export async function loadForensicsData(forceRefresh = false, isTabActive = () => true) {
  if (!isTabActive()) return;
  try {
    const url = forceRefresh ? '/api/v1/system/diagnostics/forensics?refresh=true' : '/api/v1/system/diagnostics/forensics';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data) return;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val !== null && val !== undefined ? String(val) : '--';
    };

    const formatTimestamp = (isoStr) => {
      if (!isoStr) return '--:--:--';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
               ' (' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ')';
      } catch (_) {
        return isoStr;
      }
    };

    // 1. Активное окно переднего плана
    if (data.foreground_window) {
      setText('slc-diag-fg-title', data.foreground_window.title || 'Рабочий стол Windows');
      setText('slc-diag-fg-proc', `Процесс: ${data.foreground_window.process_name || 'unknown'} (PID: ${data.foreground_window.pid || 0})`);
    }

    // 2. Статус простоя пользователя
    const idleSec = data.user_idle_seconds !== undefined ? Number(data.user_idle_seconds) : 0;
    setText('slc-diag-user-idle-time', `${idleSec.toFixed(1)} с`);
    const statusBadge = document.getElementById('slc-diag-user-status-badge');
    if (statusBadge) {
      if (idleSec > 300) {
        statusBadge.className = 'badge bg-warning-subtle text-warning border border-warning';
        statusBadge.textContent = 'Пользователь неактивен (>5 мин)';
      } else {
        statusBadge.className = 'badge bg-success-subtle text-success border border-success';
        statusBadge.textContent = 'Активен сейчас';
      }
    }

    // 3. Активность веб-камеры
    const camContainer = document.getElementById('slc-diag-cam-access-list');
    if (camContainer) {
      if (data.camera_active_apps && data.camera_active_apps.length > 0) {
        camContainer.innerHTML = data.camera_active_apps.map(a => `
          <div class="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary-subtle">
            <span class="text-truncate" style="max-width: 140px;" title="${escapeHtml(a.app_name)}">${escapeHtml(a.app_name)}</span>
            <span class="badge ${a.is_active_now ? 'bg-danger' : 'bg-secondary'}" style="font-size: 0.65rem;">
              ${a.is_active_now ? 'Активен сейчас' : 'Недавний доступ'}
            </span>
          </div>
        `).join('');
      } else {
        camContainer.innerHTML = '<span class="text-muted small">Обращений к камере не обнаружено</span>';
      }
    }

    // 4. Активность микрофона
    const micContainer = document.getElementById('slc-diag-mic-access-list');
    if (micContainer) {
      if (data.microphone_active_apps && data.microphone_active_apps.length > 0) {
        micContainer.innerHTML = data.microphone_active_apps.map(a => `
          <div class="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary-subtle">
            <span class="text-truncate" style="max-width: 140px;" title="${escapeHtml(a.app_name)}">${escapeHtml(a.app_name)}</span>
            <span class="badge ${a.is_active_now ? 'bg-danger' : 'bg-secondary'}" style="font-size: 0.65rem;">
              ${a.is_active_now ? 'Активен сейчас' : 'Недавний доступ'}
            </span>
          </div>
        `).join('');
      } else {
        micContainer.innerHTML = '<span class="text-muted small">Обращений к микрофону не обнаружено</span>';
      }
    }

    // 5. Хронологический таймлайн переключения окон
    const timelineTbody = document.getElementById('slc-diag-timeline-tbody');
    if (timelineTbody) {
      const historyList = data.history || [];
      setText('slc-diag-timeline-count', `${historyList.length} событий`);
      setText('slc-subtab-forensics-timeline-badge', `${historyList.length}`);
      if (historyList.length === 0) {
        timelineTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">История переключения окон пока пуста. Накопление телеметрии...</td></tr>';
      } else {
        timelineTbody.innerHTML = historyList.map(h => {
          const fg = h.foreground_window || {};
          const timeStr = formatTimestamp(h.timestamp);
          const idle = Number(h.user_idle_seconds || 0).toFixed(0);
          const hasCam = (h.camera_active_apps || []).some(x => x.is_active_now);
          const hasMic = (h.microphone_active_apps || []).some(x => x.is_active_now);
          let sensorBadge = '<span class="text-muted">-</span>';
          if (hasCam && hasMic) {
            sensorBadge = '<span class="badge bg-danger" title="Камера + Микрофон">Cam + Mic</span>';
          } else if (hasCam) {
            sensorBadge = '<span class="badge bg-danger" title="Веб-камера">Cam</span>';
          } else if (hasMic) {
            sensorBadge = '<span class="badge bg-warning text-dark" title="Микрофон">Mic</span>';
          }

          return `
            <tr>
              <td class="text-muted font-monospace small">${escapeHtml(timeStr)}</td>
              <td class="fw-bold text-info"><i class="bi bi-window text-secondary me-1"></i>${escapeHtml(fg.process_name || 'unknown')} <span class="text-muted small">(${fg.pid || 0})</span></td>
              <td class="text-body text-truncate" style="max-width: 320px;" title="${escapeHtml(fg.title || '')}">${escapeHtml(fg.title || '-')}</td>
              <td class="font-monospace ${idle > 300 ? 'text-warning' : 'text-body'}">${idle} с</td>
              <td>${sensorBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 6. Анализ UserAssist (ROT13 запуск программ из реестра)
    const uaTbody = document.getElementById('slc-diag-userassist-tbody');
    if (uaTbody && data.userassist_top_apps) {
      setText('slc-diag-userassist-count', `${data.userassist_top_apps.length} программ`);
      setText('slc-subtab-forensics-userassist-badge', `${data.userassist_top_apps.length}`);
      if (data.userassist_top_apps.length === 0) {
        uaTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Записи UserAssist не обнаружены в реестре текущего профиля Windows</td></tr>';
      } else {
        uaTbody.innerHTML = data.userassist_top_apps.map(a => `
          <tr>
            <td class="fw-bold text-white"><i class="bi bi-app text-info me-1"></i>${escapeHtml(a.name)}</td>
            <td class="text-info font-monospace">${a.run_count} раз</td>
            <td class="text-warning font-monospace">${escapeHtml(a.focus_formatted)}</td>
            <td class="small text-muted text-truncate" style="max-width: 280px;" title="${escapeHtml(a.path)}">${escapeHtml(a.path)}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('[SystemControl:Forensics] Ошибка загрузки форензики:', err);
  }
}
