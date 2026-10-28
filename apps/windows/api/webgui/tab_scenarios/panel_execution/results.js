/**
 * =============================================================================
 * Название: Панель выполнения сценариев и графа LangGraph DAG
 * =============================================================================
 * Описание:
 *   Запуск сценариев диагностики, отображение структурированных результатов шагов,
 *   визуализация направленного ациклического графа (DAG) и согласование действий
 *   с администратором (Human-in-the-Loop).
 *
 * Файл: apps/windows/api/webgui/tab_scenarios/panel_execution/results.js
 * Пакет: windows/api/webgui/tab_scenarios
 * Автор: hypo69
 * Updated: 2026-10-17 01:15:00
 * =============================================================================
 */

import { escapeHtml, statusIcons } from '../common/ui_utils.js';

let isRunning = false;

/**
 * Проверяет, запущен ли в данный момент сценарий.
 * @returns {boolean} Флаг выполнения.
 */
export function isScenarioRunning() {
  return isRunning;
}

/**
 * Отображает структурированные результаты выполнения сценария в интерфейсе.
 * @param {Object} res - Объект результата выполнения от бэкенда.
 */
export function displayScenarioResults(res) {
  const titleEl = document.getElementById('result-scenario-title');
  const metaEl = document.getElementById('result-scenario-meta');
  const iconEl = document.getElementById('result-status-icon');
  const durationBadge = document.getElementById('result-duration-badge');
  const summaryBanner = document.getElementById('result-summary-banner');
  const summaryText = document.getElementById('result-summary-text');
  const stepsContainer = document.getElementById('scenario-steps-container');
  const progressBar = document.getElementById('scenario-progress-bar');

  if (titleEl) titleEl.innerText = res.title || res.scenario_id;
  if (metaEl) metaEl.innerText = `Шагов: ${res.total_steps || 0} (Пройдено: ${res.passed_steps || 0}, Замечаний: ${res.warn_steps || 0}, Ошибок: ${res.failed_steps || 0})`;
  if (durationBadge) durationBadge.innerText = `${res.duration_ms || 0} ms`;

  // Стилизация общего статуса
  if (res.status === 'ok') {
    if (iconEl) iconEl.innerText = '✅';
    if (summaryBanner) summaryBanner.className = 'alert alert-success py-2 px-3 mb-3 small d-flex align-items-start gap-2';
    if (progressBar) progressBar.className = 'progress-bar bg-success';
  } else if (res.status === 'warn') {
    if (iconEl) iconEl.innerText = '⚠️';
    if (summaryBanner) summaryBanner.className = 'alert alert-warning py-2 px-3 mb-3 small d-flex align-items-start gap-2';
    if (progressBar) progressBar.className = 'progress-bar bg-warning';
  } else {
    if (iconEl) iconEl.innerText = '❌';
    if (summaryBanner) summaryBanner.className = 'alert alert-danger py-2 px-3 mb-3 small d-flex align-items-start gap-2';
    if (progressBar) progressBar.className = 'progress-bar bg-danger';
  }

  if (summaryText) summaryText.innerText = res.summary || 'Прогон завершен.';

  // Отрисовка шагов сценария
  if (stepsContainer && Array.isArray(res.steps)) {
    stepsContainer.innerHTML = res.steps.map((step, idx) => {
      const icon = statusIcons[step.status] || '🔹';
      const badgeBg = step.status === 'ok' ? 'bg-success' : (step.status === 'warn' ? 'bg-warning text-dark' : 'bg-danger');
      const hasData = step.data && Object.keys(step.data).length > 0;
      const dataId = `step-data-${idx}`;

      return `
        <div class="card border border-secondary-subtle p-2 rounded">
          <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div class="d-flex align-items-center gap-2">
              <span>${icon}</span>
              <strong class="small">${escapeHtml(step.name)}</strong>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${badgeBg} small" style="font-size: 0.68rem;">${step.status.toUpperCase()}</span>
              <span class="text-secondary small" style="font-size: 0.7rem;">${step.duration_ms || 0} ms</span>
            </div>
          </div>
          <div class="text-muted small mt-1 ps-4" style="font-size: 0.78rem;">
            ${escapeHtml(step.details)}
          </div>
          ${step.recommendation ? `
            <div class="mt-1 ps-4 small text-warning" style="font-size: 0.75rem;">
              💡 <strong>Рекомендация:</strong> ${escapeHtml(step.recommendation)}
            </div>
          ` : ''}
          ${hasData ? `
            <div class="ps-4 mt-1">
              <button class="btn btn-link btn-sm p-0 text-primary text-decoration-none small" style="font-size: 0.72rem;" onclick="const el=document.getElementById('${dataId}'); if(el) el.classList.toggle('d-none')">
                🔍 Показать детали JSON
              </button>
              <div id="${dataId}" class="d-none mt-1 p-2 bg-body-secondary rounded border border-secondary font-monospace small overflow-auto" style="max-height: 140px; font-size: 0.7rem;">
                <pre class="m-0">${escapeHtml(JSON.stringify(step.data, null, 2))}</pre>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Генерация и визуализация графа LangGraph DAG
  if (res && res.scenario_id) {
    startDAGScenario(res.scenario_id, res.title, false);
  }
}

/**
 * Отрисовывает интерактивный граф шагов сценария LangGraph DAG.
 * @param {Object} sessionState - Состояние сессии графа.
 */
export function renderDAG(sessionState) {
  const dagContainer = document.getElementById('scenario-dag-container');
  const flowContainer = document.getElementById('dag-nodes-flow');
  const dagBadge = document.getElementById('dag-status-badge');
  const hitlCard = document.getElementById('scenario-hitl-card');

  if (!dagContainer || !flowContainer) return;
  dagContainer.style.display = 'block';

  if (dagBadge) {
    dagBadge.innerText = `DAG: ${sessionState.status || 'Active'}`;
    if (sessionState.status === 'COMPLETED') {
      dagBadge.className = 'badge bg-success-subtle text-success border border-success-subtle small';
    } else if (sessionState.status === 'PAUSED_FOR_USER_CONFIRMATION') {
      dagBadge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle small';
    } else if (sessionState.status === 'REJECTED' || sessionState.status === 'FAILED') {
      dagBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle small';
    } else {
      dagBadge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle small';
    }
  }

  const typeIcons = {
    PROBE: '🔍',
    USER_PROMPT: '⚠️',
    ACTION: '⚙️',
    VERDICT: '🏁',
  };

  const nodes = sessionState.nodes || [];
  flowContainer.innerHTML = nodes.map((node, i) => {
    const isCurrent = node.id === sessionState.current_step;
    const statusIcon = statusIcons[node.status] || (node.status === 'paused' ? '⏸️' : (node.status === 'running' ? '⏳' : '⚪'));
    const activeRing = isCurrent ? 'ring-2 ring-warning shadow' : '';
    const isPrompt = node.type === 'USER_PROMPT';

    const nodeHtml = `
      <div class="dag-node-card p-2 rounded border transition-all ${activeRing}" style="background-color: ${node.color}22; border-color: ${node.color} !important; min-width: 140px; max-width: 180px;">
        <div class="d-flex align-items-center justify-content-between gap-1 mb-1">
          <span class="badge" style="background-color: ${node.color}; color: ${isPrompt ? '#000' : '#fff'}; font-size: 0.65rem;">
            ${typeIcons[node.type] || '🔹'} ${node.type}
          </span>
          <span class="small" title="Статус: ${node.status}">${statusIcon}</span>
        </div>
        <div class="small fw-semibold text-truncate text-white" title="${escapeHtml(node.label)}">${escapeHtml(node.label)}</div>
        <div class="text-white-50 small mt-0.5" style="font-size: 0.68rem;" title="${escapeHtml(node.description)}">${escapeHtml(node.description)}</div>
      </div>
    `;

    if (i < nodes.length - 1) {
      return nodeHtml + `<div class="dag-arrow text-secondary px-1 fw-bold fs-5">➔</div>`;
    }
    return nodeHtml;
  }).join('');

  // Обработка запроса подтверждения администратора (Human-in-the-Loop)
  if (hitlCard) {
    if (sessionState.status === 'PAUSED_FOR_USER_CONFIRMATION' && sessionState.confirmation_prompt) {
      hitlCard.style.display = 'block';
      const pTitle = document.getElementById('hitl-prompt-title');
      const pMsg = document.getElementById('hitl-prompt-message');
      if (pTitle) pTitle.innerText = sessionState.confirmation_prompt.title || 'Требуется подтверждение';
      if (pMsg) pMsg.innerText = sessionState.confirmation_prompt.message || 'Сценарий ожидает решения администратора.';

      const btnApprove = document.getElementById('btn-hitl-approve');
      const btnReject = document.getElementById('btn-hitl-reject');

      if (btnApprove) {
        btnApprove.onclick = async () => {
          btnApprove.disabled = true;
          btnReject.disabled = true;
          try {
            const res = await fetch(`/api/v1/scenarios/session/${sessionState.session_id}/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'approve' }),
            });
            if (res.ok) {
              const updated = await res.json();
              renderDAG(updated);
            }
          } catch (err) {
            console.error('[DAG HITL] Ошибка подтверждения:', err);
          }
        };
      }

      if (btnReject) {
        btnReject.onclick = async () => {
          btnApprove.disabled = true;
          btnReject.disabled = true;
          try {
            const res = await fetch(`/api/v1/scenarios/session/${sessionState.session_id}/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reject' }),
            });
            if (res.ok) {
              const updated = await res.json();
              renderDAG(updated);
            }
          } catch (err) {
            console.error('[DAG HITL] Ошибка отклонения:', err);
          }
        };
      }
    } else {
      hitlCard.style.display = 'none';
    }
  }
}

/**
 * Инициализирует запуск графа сценария в формате LangGraph DAG.
 * @param {string} scenarioId - Идентификатор сценария.
 * @param {string} title - Название сценария.
 * @param {boolean} [requiresConfirmation=true] - Требуется ли подтверждение шагов.
 */
export async function startDAGScenario(scenarioId, title, requiresConfirmation = true) {
  try {
    const res = await fetch('/api/v1/scenarios/dag/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: scenarioId,
        title: title || scenarioId,
        requires_confirmation: requiresConfirmation,
      }),
    });
    if (res.ok) {
      const sessionState = await res.json();
      renderDAG(sessionState);
      return sessionState;
    }
  } catch (err) {
    console.error('[DAG] Ошибка запуска графа сценария:', err);
  }
  return null;
}

/**
 * Запускает выбранный сценарий тестирования через API.
 * @param {string} scenarioId - Идентификатор запускаемого сценария.
 * @param {Function} [onStatusChange] - Коллбек изменения статуса выполнения.
 */
export async function runScenario(scenarioId, onStatusChange) {
  if (isRunning) return;
  isRunning = true;
  if (typeof onStatusChange === 'function') onStatusChange(true);

  // Автоматическое открытие боковой панели сценариев
  const offcanvasEl = document.getElementById('scenariosOffcanvas');
  if (offcanvasEl && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
    try {
      const offcanvasInstance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
      offcanvasInstance.show();
    } catch (e) {
      console.warn('[ScenariosTab] Ошибка открытия offcanvas:', e);
    }
  }

  const resultPanel = document.getElementById('scenario-result-panel');
  const titleEl = document.getElementById('result-scenario-title');
  const metaEl = document.getElementById('result-scenario-meta');
  const iconEl = document.getElementById('result-status-icon');
  const durationBadge = document.getElementById('result-duration-badge');
  const summaryBanner = document.getElementById('result-summary-banner');
  const summaryText = document.getElementById('result-summary-text');
  const stepsContainer = document.getElementById('scenario-steps-container');
  const progressBar = document.getElementById('scenario-progress-bar');

  if (resultPanel) {
    resultPanel.style.display = '';
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (titleEl) titleEl.innerText = `Выполнение сценария [${scenarioId}]...`;
  if (metaEl) metaEl.innerText = 'Опрос системных подсистем и выполнение тестов...';
  if (iconEl) iconEl.innerText = '⏳';
  if (durationBadge) durationBadge.innerText = 'Выполняется...';
  if (summaryBanner) summaryBanner.className = 'alert alert-info py-2 px-3 mb-3 small d-flex align-items-start gap-2';
  if (summaryText) summaryText.innerText = 'Идет тестирование компонентов... Пожалуйста, подождите.';
  if (stepsContainer) stepsContainer.innerHTML = '<div class="text-center py-3 text-muted small"><div class="spinner-border spinner-border-sm text-primary mb-2"></div><div>Тестирование запущено...</div></div>';
  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated bg-primary';
  }

  const tStart = performance.now();
  try {
    const response = await fetch('/api/v1/scenarios/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: HTTP ${response.status}`);
    }

    const res = await response.json();
    displayScenarioResults(res);
  } catch (err) {
    console.error('[ScenariosTab] Ошибка выполнения сценария:', err);
    const totalDur = Math.round(performance.now() - tStart);
    displayScenarioResults({
      scenario_id: scenarioId,
      title: scenarioId,
      status: 'error',
      duration_ms: totalDur,
      total_steps: 1,
      passed_steps: 0,
      warn_steps: 0,
      failed_steps: 1,
      steps: [
        {
          name: 'Выполнение запроса сценария',
          status: 'error',
          duration_ms: totalDur,
          details: `Ошибка: ${err.message}`,
          recommendation: 'Проверьте соединение с бэкенд сервером FastAPI.',
        },
      ],
      summary: `Сбой при выполнении сценария: ${err.message}`,
    });
  } finally {
    isRunning = false;
    if (typeof onStatusChange === 'function') onStatusChange(false);
  }
}
