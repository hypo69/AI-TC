/**
 * =============================================================================
 * Название: Вкладка сценариев тестирования и автоматизации - Главный оркестратор
 * =============================================================================
 * Описание:
 *   Точка входа и оркестратор модулей вкладки tab_scenarios (/tc).
 *   Интегрирует каталог экспресс-сценариев, визуализатор графа LangGraph DAG,
 *   SafeOps систему подтверждения действий и интеллектуальный AI Ассистент хоста.
 *
 * Файл: apps/windows/api/webgui/tab_scenarios/main.js
 * Пакет: windows/api/webgui/tab_scenarios
 * Автор: hypo69
 * Updated: 2026-10-22 03:45:00
 * =============================================================================
 */

import {
  loadScenarios,
  renderScenariosGrid,
  setCategoryFilter
} from './panel_catalog/panel.js';
import {
  runScenario,
  startDAGScenario,
  renderDAG
} from './panel_execution/results.js';
import {
  setupMiniChat,
  loadQuestionsFromConfig
} from './panel_chat/chat.js';

let isEventsSetup = false;

// Экспорт глобальных функций для внешнего хост-контейнера и iframe
window.runScenario = runScenario;
window.startDAGScenario = startDAGScenario;
window.renderDAG = renderDAG;
window.loadScenarios = loadScenarios;
window.initScenariosTab = initScenariosTab;
window.initChatTab = initScenariosTab;

/**
 * Привязывает обработчики управляющих кнопок интерфейса вкладки.
 */
function setupEvents() {
  if (isEventsSetup) return;
  isEventsSetup = true;

  // Кнопка быстрой проверки окружения
  const btnQuick = document.getElementById('btn-run-quick-check');
  if (btnQuick) {
    btnQuick.onclick = () => runScenario('quick_check', () => renderScenariosGrid());
  }

  // Кнопка запуска всех сценариев
  const btnAll = document.getElementById('btn-run-all-scenarios');
  if (btnAll) {
    btnAll.onclick = () => runScenario('all', () => renderScenariosGrid());
  }

  // Кнопка обновления списка сценариев
  const btnRefresh = document.getElementById('btn-scenario-refresh-list');
  if (btnRefresh) {
    btnRefresh.onclick = () => loadScenarios();
  }

  // Кнопка закрытия панели результатов
  const btnCloseRes = document.getElementById('btn-close-result-panel');
  if (btnCloseRes) {
    btnCloseRes.onclick = () => {
      const panel = document.getElementById('scenario-result-panel');
      if (panel) panel.style.display = 'none';
    };
  }

  // Кнопки фильтрации по категориям
  const filterContainer = document.getElementById('scenario-category-filters');
  if (filterContainer) {
    filterContainer.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        filterContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter') || 'all';
        setCategoryFilter(filter);
      };
    });
  }

  setupMiniChat();
}

/**
 * Главная точка инициализации вкладки сценариев.
 */
export async function initScenariosTab() {
  console.log('[ScenariosTab] Инициализация вкладки сценариев и диагностики (/tc)...');
  setupEvents();
  loadQuestionsFromConfig();
  await loadScenarios();
  console.log('[ScenariosTab] Вкладка сценариев готова к работе.');
}

// Автоматическая инициализация при загрузке документа
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScenariosTab);
} else {
  initScenariosTab();
}
