/**
 * @file apps/windows/api/webgui/tab_defender_firewall/panel_diag_tasks/panel.js
 * @description Панель ИИ-диагностики безопасности и управления фоновыми задачами (сканирование, обновление сигнатур)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:27:00
 */

import { fetchJSON, showAlert } from '../common/ui_utils.js';

let isDiagLoaded = false;
const activeTaskPollers = {};

/**
 * Сброс кеша ИИ-диагностики
 */
export function resetDiagCache() {
  isDiagLoaded = false;
}

/**
 * Загрузка сводки ИИ-диагностики безопасности (Security Posture Score)
 * @param {boolean} force
 */
export async function loadDiagnostics(force = false) {
  if (!force && isDiagLoaded) return;
  try {
    const rep = await fetchJSON('/api/v1/defender/diagnostics');
    isDiagLoaded = true;

    const scoreVal = document.getElementById('def-score-val');
    const scoreSub = document.getElementById('def-score-sub');
    const diagScoreDisplay = document.getElementById('def-diag-score-display');
    const diagSummaryDisplay = document.getElementById('def-diag-summary-display');
    const recsContainer = document.getElementById('def-diag-recs-container');
    const critsContainer = document.getElementById('def-diag-criticals-container');

    const scoreColor = rep.security_score >= 80 ? 'text-success' : (rep.security_score >= 50 ? 'text-warning' : 'text-danger');

    if (scoreVal) {
      scoreVal.textContent = `${rep.security_score}/100`;
      scoreVal.className = `def-card-value ${scoreColor}`;
    }
    if (scoreSub) scoreSub.textContent = rep.status_summary;

    if (diagScoreDisplay) {
      diagScoreDisplay.textContent = `${rep.security_score}/100`;
      diagScoreDisplay.className = `display-4 fw-bold ${scoreColor}`;
    }
    if (diagSummaryDisplay) diagSummaryDisplay.textContent = rep.status_summary;

    if (recsContainer) {
      if (rep.recommendations && rep.recommendations.length > 0) {
        recsContainer.innerHTML = `
          <ol class="ps-3 mb-0">
            ${rep.recommendations.map(r => `<li class="py-1 text-body">${r}</li>`).join('')}
          </ol>
        `;
      } else {
        recsContainer.innerHTML = '<div class="text-success">Все рекомендации соблюдены. Защита оптимальна.</div>';
      }
    }

    if (critsContainer) {
      if (rep.critical_findings && rep.critical_findings.length > 0) {
        critsContainer.innerHTML = `
          <ul class="ps-3 mb-0 text-danger">
            ${rep.critical_findings.map(c => `<li class="py-1">${c}</li>`).join('')}
          </ul>
        `;
      } else {
        critsContainer.innerHTML = '<div class="text-muted">Критических уязвимостей не зафиксировано.</div>';
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading diagnostics:', err);
  }
}

/**
 * Опрос фоновой задачи сканирования или обновления сигнатур
 * @param {string} taskId Идентификатор задачи
 * @param {string} taskLabel Название операции
 * @param {HTMLButtonElement|null} triggerBtn Кнопка вызова
 * @param {Function} onComplete Callback по завершении
 */
export async function pollTask(taskId, taskLabel, triggerBtn, onComplete) {
  if (!taskId) return;
  if (activeTaskPollers[taskId]) return;

  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.dataset.originalHtml = triggerBtn.innerHTML;
    triggerBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> ${taskLabel}...`;
  }

  showAlert(`⏳ Запущен фоновый процесс: ${taskLabel} (ID: ${taskId})`);

  const interval = 2500;
  const maxAttempts = 240;
  let attempts = 0;

  activeTaskPollers[taskId] = setInterval(async () => {
    if (window.isTabActive && !window.isTabActive('tab-defender-firewall') && !window.isTabActive('tab-defender')) return;
    attempts++;
    try {
      const task = await fetchJSON(`/api/v1/defender/tasks/${taskId}`);
      if (!task || task.status === 'running' || task.status === 'pending') {
        if (attempts >= maxAttempts) {
          clearInterval(activeTaskPollers[taskId]);
          delete activeTaskPollers[taskId];
          if (triggerBtn && triggerBtn.dataset.originalHtml) {
            triggerBtn.innerHTML = triggerBtn.dataset.originalHtml;
            triggerBtn.disabled = false;
          }
          showAlert(`Таймаут ожидания задачи ${taskLabel} (фоновый процесс продолжается в Windows).`, true);
        }
        return;
      }

      clearInterval(activeTaskPollers[taskId]);
      delete activeTaskPollers[taskId];

      if (triggerBtn && triggerBtn.dataset.originalHtml) {
        triggerBtn.innerHTML = triggerBtn.dataset.originalHtml;
        triggerBtn.disabled = false;
      }

      const durationInfo = task.duration_seconds ? ` [${task.duration_seconds}с]` : '';
      if (task.status === 'completed' && task.success) {
        let extraMsg = '';
        if (task.windows_event) {
          extraMsg = ` (Windows Event ${task.windows_event.event_id}: ${task.windows_event.category})`;
        }
        showAlert(`✅ ${taskLabel} успешно завершено${durationInfo}! ${task.message || ''}${extraMsg}`);
      } else {
        showAlert(`❌ ${taskLabel} завершилось ошибкой${durationInfo}: ${task.error || task.message || 'Сбой выполнения'}`, true);
      }

      if (onComplete) await onComplete();
    } catch (err) {
      console.error(`[DefenderTab] Polling error for task ${taskId}:`, err);
    }
  }, interval);
}

/**
 * Привязка обработчиков действий Defender
 * @param {Function} onRefreshAll Callback полного обновления данных
 */
export function setupActions(onRefreshAll) {
  const btnQuick = document.getElementById('btn-def-quick-scan');
  if (btnQuick) {
    btnQuick.onclick = async () => {
      try {
        const res = await fetchJSON('/api/v1/defender/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_type: 'quick' }),
        });
        if (res && res.task_id) {
          pollTask(res.task_id, 'Быстрое сканирование', btnQuick, onRefreshAll);
        } else {
          showAlert(`Быстрое сканирование: ${res.message || 'Запущено'}`);
          if (onRefreshAll) onRefreshAll();
        }
      } catch (err) {
        showAlert(`Ошибка запуска сканирования: ${err.message}`, true);
      }
    };
  }

  const btnFull = document.getElementById('btn-def-full-scan');
  if (btnFull) {
    btnFull.onclick = async () => {
      try {
        const res = await fetchJSON('/api/v1/defender/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_type: 'full' }),
        });
        if (res && res.task_id) {
          pollTask(res.task_id, 'Полное сканирование системы', btnFull, onRefreshAll);
        } else {
          showAlert(`Полное сканирование: ${res.message || 'Запущено'}`);
        }
      } catch (err) {
        showAlert(`Ошибка полного сканирования: ${err.message}`, true);
      }
    };
  }

  const btnUpdate = document.getElementById('btn-def-update-sigs');
  if (btnUpdate) {
    btnUpdate.onclick = async () => {
      try {
        const res = await fetchJSON('/api/v1/defender/update-signatures', { method: 'POST' });
        if (res && res.task_id) {
          pollTask(res.task_id, 'Обновление баз сигнатур Defender', btnUpdate, onRefreshAll);
        } else {
          showAlert(`Обновление сигнатур: ${res.message || 'Запущено'}`);
          if (onRefreshAll) onRefreshAll();
        }
      } catch (err) {
        showAlert(`Ошибка обновления баз: ${err.message}`, true);
      }
    };
  }

  const btnAiDiag = document.getElementById('btn-def-ai-diag');
  if (btnAiDiag) {
    btnAiDiag.onclick = () => {
      const diagTabBtn = document.getElementById('def-tab-diag-btn');
      if (diagTabBtn && window.bootstrap && window.bootstrap.Tab) {
        const tab = new window.bootstrap.Tab(diagTabBtn);
        tab.show();
        loadDiagnostics(true);
      }
    };
  }

  const btnCopyMsg = document.getElementById('btn-def-copy-msg');
  if (btnCopyMsg) {
    btnCopyMsg.onclick = () => {
      const rawEl = document.getElementById('def-detail-raw-msg');
      if (rawEl && rawEl.textContent) {
        navigator.clipboard.writeText(rawEl.textContent).then(() => {
          const originalHtml = btnCopyMsg.innerHTML;
          btnCopyMsg.innerHTML = '<i class="bi bi-check2"></i> <span>Скопировано!</span>';
          btnCopyMsg.classList.remove('btn-outline-secondary');
          btnCopyMsg.classList.add('btn-success');
          setTimeout(() => {
            btnCopyMsg.innerHTML = originalHtml;
            btnCopyMsg.classList.remove('btn-success');
            btnCopyMsg.classList.add('btn-outline-secondary');
          }, 2000);
        }).catch(err => {
          console.error('[DefenderTab] Clipboard copy failed:', err);
        });
      }
    };
  }
}
