/**
 * =============================================================================
 * Process Name: Windows System32 Commands Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский контроллер-оркестратор каталога штатных средств Windows System32,
 *   слоев Control Plane, AITelemetry Tiers и пульта интерактивного запуска команд.
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_system32_commands
 * Updated: 2026-10-17 01:55:00
 * =============================================================================
 */

import { escapeHtml } from './common/ui_utils.js';
import { updateSummaryMetrics } from './panel_summary/panel.js';
import {
  setToolsList,
  setCurrentTierFilter,
  setSearchQuery,
  renderToolsGrid
} from './panel_grid/panel.js';
import { loadHostInventory } from './panel_inventory_modal/panel.js';
import { setupAiCommandRunner } from './panel_ai_runner/panel.js';

/**
 * Загружает сводку метрик и каталог инструментов System32.
 */
export async function loadCatalog() {
  const container = document.getElementById('system32-cards-container');
  if (!container) return;

  try {
    const [catRes, sumRes] = await Promise.all([
      fetch('/api/v1/system32/catalog'),
      fetch('/api/v1/system32/summary')
    ]);

    if (!catRes.ok) throw new Error(`HTTP ${catRes.status}`);
    const catData = await catRes.json();
    const tools = catData.tools || [];
    setToolsList(tools);

    if (sumRes.ok) {
      const sumData = await sumRes.json();
      updateSummaryMetrics(sumData, tools.length);
    }

    renderToolsGrid();
  } catch (err) {
    console.error('[System32CommandsTab] Error loading catalog:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-12 text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle fs-3 mb-2"></i>
          <div>Не удалось загрузить каталог System32: ${escapeHtml(err.message)}</div>
          <button class="btn btn-outline-primary btn-sm mt-2" onclick="location.reload()">Повторить</button>
        </div>
      `;
    }
  }
}

/**
 * Привязывает обработчики к фильтрам уровней (tiers) и поисковой строке.
 */
function setupFilters() {
  const tierGroup = document.getElementById('tier-filters');
  if (tierGroup) {
    tierGroup.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        tierGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setCurrentTierFilter(btn.getAttribute('data-tier') || 'all');
        renderToolsGrid();
      };
    });
  }

  const searchInput = document.getElementById('tool-search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  if (searchInput) {
    searchInput.oninput = () => {
      setSearchQuery(searchInput.value);
      renderToolsGrid();
    };
  }
  if (clearBtn && searchInput) {
    clearBtn.onclick = () => {
      searchInput.value = '';
      setSearchQuery('');
      renderToolsGrid();
    };
  }

  const refreshBtn = document.getElementById('btn-refresh-system32-catalog');
  if (refreshBtn) {
    refreshBtn.onclick = () => { loadCatalog(); };
  }

  const invBtn = document.getElementById('btn-open-inventory-modal');
  if (invBtn) {
    invBtn.onclick = () => { loadHostInventory(); };
  }
}

/**
 * Инициализация вкладки System32 Commands.
 */
export function init() {
  setupFilters();
  setupAiCommandRunner();
  loadCatalog();
}

window.initSystem32CommandsTab = init;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
