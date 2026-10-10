/**
 * =============================================================================
 * Process Name: Windows Forensics Tab - Main Script
 * =============================================================================
 * Description:
 *   Клиентский скрипт управления интерфейсом форензики и таймлайна активности.
 *
 * Usage Examples:
 *   HTML Integration:
 *     <script src="/windows/api/webgui/forensics_tab/main.js?v=20261010_v2" type="module"></script>
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/forensics_tab
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-10 20:33:00
 * =============================================================================
 */

(function () {
  'use strict';

  let autoRefreshTimer = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== null && text !== undefined ? String(text) : '--';
  }

  function formatTime(isoStr) {
    if (!isoStr) return '--:--:--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
             ' (' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ')';
    } catch (_) {
      return isoStr;
    }
  }

  async function apiFetch(url) {
    if (window.api && typeof window.api.fetch === 'function') {
      return await window.api.fetch(url);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(HTTP : );
    return await res.json();
  }

  async function fetchForensicsActivity() {
    try {
      const data = await apiFetch('/api/v1/system/diagnostics/forensics');
      if (!data) return;

      if (data.foreground_window) {
        setText('diag-fg-title', data.foreground_window.title || 'Рабочий стол Windows');
        setText('diag-fg-proc', Процесс:  (PID: ));
      }

      const idleSec = data.user_idle_seconds !== undefined ? Number(data.user_idle_seconds) : 0;
      setText('diag-user-idle-time', ${idleSec.toFixed(1)} сек);
      const statusBadge = document.getElementById('diag-user-status-badge');
      if (statusBadge) {
        if (idleSec > 300) {
          statusBadge.className = 'badge bg-warning-subtle text-warning border border-warning';
          statusBadge.textContent = 'Пользователь отошел (>5 мин)';
        } else {
          statusBadge.className = 'badge bg-success-subtle text-success border border-success';
          statusBadge.textContent = 'Пользователь активен';
        }
      }

      // Camera Apps
      const camContainer = document.getElementById('diag-cam-access-list');
      if (camContainer) {
        if (data.camera_active_apps && data.camera_active_apps.length > 0) {
          camContainer.innerHTML = data.camera_active_apps.map(a => 
            <div class="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary-subtle">
              <span class="text-truncate" style="max-width: 140px;" title=""></span>
              <span class="badge " style="font-size: 0.65rem;">
                
              </span>
            </div>
          ).join('');
        } else {
          camContainer.innerHTML = '<span class="text-muted small">Нет активных обращений к камере</span>';
        }
      }

      // Mic Apps
      const micContainer = document.getElementById('diag-mic-access-list');
      if (micContainer) {
        if (data.microphone_active_apps && data.microphone_active_apps.length > 0) {
          micContainer.innerHTML = data.microphone_active_apps.map(a => 
            <div class="d-flex align-items-center justify-content-between py-1 border-bottom border-secondary-subtle">
              <span class="text-truncate" style="max-width: 140px;" title=""></span>
              <span class="badge " style="font-size: 0.65rem;">
                
              </span>
            </div>
          ).join('');
        } else {
          micContainer.innerHTML = '<span class="text-muted small">Нет активных обращений к микрофону</span>';
        }
      }

      // Timeline History Table
      const timelineTbody = document.getElementById('diag-timeline-tbody');
      if (timelineTbody) {
        const historyList = data.history || [];
        setText('diag-timeline-count', ${historyList.length} срезов);
        if (historyList.length === 0) {
          timelineTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Снимков активности в базе пока нет. Они накапливаются демоном телеметрии...</td></tr>';
        } else {
          timelineTbody.innerHTML = historyList.map(h => {
            const fg = h.foreground_window || {};
            const timeStr = formatTime(h.timestamp);
            const idle = Number(h.user_idle_seconds || 0).toFixed(0);
            const hasCam = (h.camera_active_apps || []).some(x => x.is_active_now);
            const hasMic = (h.microphone_active_apps || []).some(x => x.is_active_now);
            let sensorBadge = '<span class="text-muted">-</span>';
            if (hasCam && hasMic) {
              sensorBadge = '<span class="badge bg-danger" title="Камера + Микрофон">Cam + Mic</span>';
            } else if (hasCam) {
              sensorBadge = '<span class="badge bg-danger" title="Камера активна">Cam</span>';
            } else if (hasMic) {
              sensorBadge = '<span class="badge bg-warning text-dark" title="Микрофон активен">Mic</span>';
            }

            return 
              <tr>
                <td class="text-muted font-monospace small"></td>
                <td class="fw-bold text-info"><i class="bi bi-window text-secondary me-1"></i> <span class="text-muted small">()</span></td>
                <td class="text-body text-truncate" style="max-width: 320px;" title=""></td>
                <td style="text-align: right;" class="font-monospace "> с</td>
                <td style="text-align: center;"></td>
              </tr>
            ;
          }).join('');
        }
      }

      // UserAssist Apps Table
      const uaTbody = document.getElementById('diag-userassist-tbody');
      if (uaTbody && data.userassist_top_apps) {
        setText('diag-userassist-count', ${data.userassist_top_apps.length} программ);
        if (data.userassist_top_apps.length === 0) {
          uaTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Данных UserAssist в реестре не обнаружено (или трекинг отключен в Windows)</td></tr>';
        } else {
          uaTbody.innerHTML = data.userassist_top_apps.map(a => 
            <tr>
              <td class="fw-bold text-white"><i class="bi bi-app text-info me-1.5"></i></td>
              <td style="text-align: right;" class="text-info font-monospace"> раз</td>
              <td style="text-align: right;" class="text-warning font-monospace"></td>
              <td class="small text-muted text-truncate" style="max-width: 280px;" title=""></td>
            </tr>
          ).join('');
        }
      }
    } catch (err) {
      console.warn('[ForensicsTab] fetchForensicsActivity error:', err);
    }
  }

  const POLL_ID = 'forensics';

  function getFrequency() {
    try {
      const saved = localStorage.getItem(poll_freq_);
      if (saved) return saved;
    } catch (_) {}
    return 'manual';
  }

  function setFrequency(freq) {
    try {
      localStorage.setItem(poll_freq_, freq);
    } catch (_) {}
    applyPoller(freq, false);
  }

  function stopPolling() {
    if (window.unregisterTabPoller) {
      window.unregisterTabPoller(	ab-forensics_);
    }
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function applyPoller(freq, runInitial = false) {
    stopPolling();
    if (freq === 'start' || freq === 'manual') {
      if (runInitial && (window.isTabActive ? window.isTabActive('tab-forensics') : true)) {
        fetchForensicsActivity();
      }
      return;
    }

    const intervalSec = parseInt(freq, 10);
    if (isNaN(intervalSec) || intervalSec <= 0) return;

    const intervalMs = intervalSec * 1000;
    const pollerId = 	ab-forensics_;

    if (window.registerTabPoller) {
      window.registerTabPoller('tab-forensics', fetchForensicsActivity, intervalMs, { pollerId, immediate: runInitial });
    } else {
      if (runInitial && (window.isTabActive ? window.isTabActive('tab-forensics') : true)) {
        fetchForensicsActivity();
      }
      autoRefreshTimer = setInterval(() => {
        if (window.isTabActive ? window.isTabActive('tab-forensics') : true) {
          fetchForensicsActivity();
        }
      }, intervalMs);
    }
  }

  function bindEvents() {
    const btnRefresh = document.getElementById('btn-diag-forensics-refresh');
    if (btnRefresh) {
      btnRefresh.onclick = () => fetchForensicsActivity();
    }

    const select = document.getElementById('diag-forensics-poll-freq');
    if (select) {
      select.onchange = (e) => {
        const newFreq = e.target.value;
        setFrequency(newFreq);
        if (newFreq !== 'manual' && newFreq !== 'start') {
          fetchForensicsActivity();
        }
        if (window.showToast) {
          const label = select.options[select.selectedIndex]?.text || newFreq;
          window.showToast(Частота опроса форензики: , 'info');
        }
      };
    }
  }

  async function initForensicsTab() {
    bindEvents();
    const currentFreq = getFrequency();
    const select = document.getElementById('diag-forensics-poll-freq');
    if (select) select.value = currentFreq;
    applyPoller(currentFreq, true);
  }

  window.initForensicsTab = initForensicsTab;
  window.activateForensicsTab = () => {
    applyPoller(getFrequency(), true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.isTabActive ? window.isTabActive('tab-forensics') : false) {
        initForensicsTab();
      } else {
        bindEvents();
      }
    });
  } else {
    if (window.isTabActive ? window.isTabActive('tab-forensics') : false) {
      initForensicsTab();
    } else {
      bindEvents();
    }
  }
})();