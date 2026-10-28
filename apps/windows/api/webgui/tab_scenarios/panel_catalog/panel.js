/**
 * =============================================================================
 * Название: Панель каталога сценариев тестирования
 * =============================================================================
 * Описание:
 *   Загрузка списка сценариев с бэкенда, фильтрация по категориям,
 *   отрисовка карточек в боковой панели и запуск отдельных проверок.
 *
 * Файл: apps/windows/api/webgui/tab_scenarios/panel_catalog/panel.js
 * Пакет: windows/api/webgui/tab_scenarios
 * Автор: hypo69
 * Updated: 2026-10-17 01:15:00
 * =============================================================================
 */

import { escapeHtml, categoryIcons } from '../common/ui_utils.js';
import { runScenario, isScenarioRunning } from '../panel_execution/results.js';

let scenariosList = [];
let currentFilter = 'all';

/**
 * Локальный fallback-список сценариев при недоступности API.
 */
const fallbackScenarios = [
  {
    id: 'quick_check',
    title: 'Быстрая проверка (Smoke Test)',
    description: 'Экспресс-проверка целостности окружения, доступности ядра FastAPI, AI-провайдеров, свободного места и ключевых логов. Рекомендуется после установки.',
    category: 'quick',
    icon: '⚡',
    recommended: true,
    estimated_duration_sec: 2,
  },
  {
    id: 'log_audit',
    title: 'Запустить аудит логов',
    description: 'Комплексный анализ файлов логов (info.log, errors.log, app.log) и журналов событий Windows. Поиск критических ошибок и аномалий.',
    category: 'logs',
    icon: '📜',
    recommended: false,
    estimated_duration_sec: 3,
  },
  {
    id: 'system_inspector',
    title: 'Диагностика системы и оборудования',
    description: 'Срез телеметрии: загрузка ядер процессора, температура, оперативная память, свободное место на дисках и фоновые процессы.',
    category: 'diagnostics',
    icon: '🖥️',
    recommended: false,
    estimated_duration_sec: 3,
  },
  {
    id: 'windows_admin',
    title: 'Аудит автозапуска и служб Windows',
    description: 'Проверка записей реестра Run/RunOnce, папки автозагрузки, системных служб Windows и прав текущего процесса.',
    category: 'security',
    icon: '🛡️',
    recommended: false,
    estimated_duration_sec: 4,
  },
  {
    id: 'network_test',
    title: 'Проверка сетевой доступности и портов',
    description: 'Тестирование локального шлюза, разрешения DNS, открытых серверных портов (8000) и доступности внешних AI-сервисов.',
    category: 'network',
    icon: '🌐',
    recommended: false,
    estimated_duration_sec: 4,
  },
  {
    id: 'ai_providers_check',
    title: 'Проверка статуса AI-провайдеров',
    description: 'Опрос сконфигурированных AI-моделей (Google Gemini, AGY, Ollama, Foundry) и замер времени отклика инференса.',
    category: 'ai',
    icon: '🤖',
    recommended: false,
    estimated_duration_sec: 5,
  },
];

/**
 * Загружает список доступных сценариев с бэкенда или использует резервный список.
 */
export async function loadScenarios() {
  const container = document.getElementById('scenarios-cards-container');
  if (!container) return;

  try {
    const res = await fetch('/api/v1/scenarios');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    scenariosList = await res.json();
  } catch (err) {
    console.warn('[ScenariosTab] Ошибка загрузки /api/v1/scenarios, используется локальный fallback:', err);
    scenariosList = fallbackScenarios;
  }
  renderScenariosGrid();
}

/**
 * Отрисовывает карточки сценариев с учетом текущего активного фильтра.
 */
export function renderScenariosGrid() {
  const container = document.getElementById('scenarios-cards-container');
  if (!container) return;

  const filtered = scenariosList.filter(sc => {
    if (currentFilter === 'all') return true;
    return sc.category === currentFilter;
  });

  const badgeEl = document.getElementById('scenarios-count-badge');
  if (badgeEl) {
    badgeEl.innerText = `Доступно: ${filtered.length}`;
  }
  const headerBadgeEl = document.getElementById('scenarios-count-badge-header');
  if (headerBadgeEl) {
    headerBadgeEl.innerText = `${scenariosList.length}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-4 text-muted small">В этой категории нет сценариев.</div>';
    return;
  }

  const isRunning = isScenarioRunning();

  container.innerHTML = filtered.map(sc => {
    const isRecommended = Boolean(sc.recommended);
    const borderClass = isRecommended ? 'border-success border-opacity-50 shadow-sm' : 'border-secondary-subtle';
    const bgHeader = isRecommended ? 'bg-success bg-opacity-10' : 'bg-transparent';
    const btnClass = isRecommended ? 'btn-success' : 'btn-outline-primary';

    return `
      <div class="col-12">
        <div class="card ${borderClass} transition-all hover-shadow">
          <div class="card-header ${bgHeader} border-secondary-subtle py-2 px-3 d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-5">${sc.icon || categoryIcons[sc.category] || '🎬'}</span>
              <strong class="small">${escapeHtml(sc.title)}</strong>
            </div>
            <div>
              ${isRecommended ? '<span class="badge bg-success small">Рекомендуется</span>' : `<span class="badge bg-secondary small">${sc.estimated_duration_sec || 3} сек</span>`}
            </div>
          </div>
          <div class="card-body p-3 d-flex flex-column justify-content-between">
            <p class="text-muted small mb-2" style="font-size: 0.8rem; line-height: 1.35;">
              ${escapeHtml(sc.description)}
            </p>
            <div class="d-flex align-items-center justify-content-between gap-2 mt-auto pt-2 border-top border-secondary-subtle">
              <span class="text-secondary small" style="font-size: 0.72rem;">
                ID: <code>${escapeHtml(sc.id)}</code>
              </span>
              <button class="btn ${btnClass} btn-sm py-1 px-3 d-flex align-items-center gap-1 btn-run-scenario-item" data-scenario-id="${escapeHtml(sc.id)}" ${isRunning ? 'disabled' : ''}>
                <i class="bi bi-play-fill"></i>
                <span>Запустить</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Привязка обработчиков запуска карточек
  container.querySelectorAll('.btn-run-scenario-item').forEach(btn => {
    btn.onclick = () => {
      const scId = btn.getAttribute('data-scenario-id');
      if (scId) runScenario(scId, () => renderScenariosGrid());
    };
  });
}

/**
 * Устанавливает фильтр по категории сценариев.
 * @param {string} filter - Имя категории ('all', 'quick', 'logs', 'diagnostics', 'security').
 */
export function setCategoryFilter(filter) {
  currentFilter = filter || 'all';
  renderScenariosGrid();
}
