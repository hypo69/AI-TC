/**
 * =============================================================================
 * Process Name: Windows Telemetry Research Tab - Main Orchestrator
 * =============================================================================
 * Description:
 *   Клиентский контроллер-оркестратор аналитического исследования телеметрии.
 *   Координирует запуск расчетов, гипотезы, корреляции, графики Chart.js,
 *   аномалии и журнал записей с пагинацией.
 *
 * File: main.js
 * Package: apps/windows/api/webgui/tab_telemetry_research
 * Updated: 2026-10-17 01:55:00
 * =============================================================================
 */

import { openHtmlDashboard, downloadJsonReport } from './common/ui_utils.js';
import { loadSources } from './panel_sources/panel.js';
import { renderKPI, renderHypotheses } from './panel_kpi_hypotheses/panel.js';
import { renderCorrelations, renderCharts } from './panel_correlations_charts/panel.js';
import { renderAnomalies } from './panel_anomalies_devices/panel.js';
import {
  loadRecords,
  getTrCurrentPage,
  setTrCurrentPage,
  getTrTotalPages,
  setTrSearchQuery
} from './panel_records/panel.js';

let trCurrentReport = null;

/**
 * Запуск глубокого исследования телеметрии.
 */
export async function runResearch() {
  const btnRun = document.getElementById('tr-btn-run');
  const selectSource = document.getElementById('tr-select-source');
  const sourcePath = selectSource ? selectSource.value : null;

  if (btnRun) {
    btnRun.disabled = true;
    btnRun.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Анализ...';
  }

  try {
    const res = await fetch('/apps/telemetry_research/run-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: sourcePath || null }),
    });

    if (!res.ok) {
      throw new Error(`Ошибка сервера: ${res.status}`);
    }

    const report = await res.json();
    trCurrentReport = report;

    renderKPI(report);
    renderHypotheses(report.hypotheses);
    renderCorrelations(report.correlations);
    renderCharts(report.base_report?.charts);
    renderAnomalies(report.base_report?.anomalies, report.base_report?.device_summary);

    if (window.toast) {
      window.toast.success('Исследование завершено', `Проанализировано ${report.base_report?.records_analyzed ?? 0} записей.`);
    }
  } catch (err) {
    console.error('[TelemetryResearch] Ошибка анализа:', err);
    if (window.toast) {
      window.toast.error('Сбой исследования', err.message);
    }
  } finally {
    if (btnRun) {
      btnRun.disabled = false;
      btnRun.innerHTML = '<i class="bi bi-play-circle-fill"></i> <span>Исследовать</span>';
    }
  }
}

/**
 * Привязка событий элементов управления вкладки.
 */
function bindEvents() {
  document.getElementById('tr-btn-run')?.addEventListener('click', () => runResearch());
  document.getElementById('tr-btn-dashboard')?.addEventListener('click', () => openHtmlDashboard());
  document.getElementById('tr-btn-json')?.addEventListener('click', () => downloadJsonReport(trCurrentReport));
  document.getElementById('tr-select-source')?.addEventListener('change', () => runResearch());

  const searchBtn = document.getElementById('tr-records-search-btn');
  const searchInput = document.getElementById('tr-records-search');
  if (searchBtn && searchInput) {
    const onSearch = () => {
      setTrSearchQuery(searchInput.value.trim());
      setTrCurrentPage(1);
      loadRecords();
    };
    searchBtn.onclick = onSearch;
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') onSearch();
    };
  }

  const prevBtn = document.getElementById('tr-records-prev-btn');
  const nextBtn = document.getElementById('tr-records-next-btn');
  if (prevBtn) {
    prevBtn.onclick = () => {
      const page = getTrCurrentPage();
      if (page > 1) {
        setTrCurrentPage(page - 1);
        loadRecords();
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      const page = getTrCurrentPage();
      const total = getTrTotalPages();
      if (page < total) {
        setTrCurrentPage(page + 1);
        loadRecords();
      }
    };
  }

  const recordsTabBtn = document.getElementById('tr-tab-records-btn');
  if (recordsTabBtn) {
    recordsTabBtn.addEventListener('shown.bs.tab', () => loadRecords());
  }
}

/**
 * Инициализация вкладки исследования телеметрии.
 */
export async function initTelemetryResearchTab() {
  bindEvents();
  await loadSources();
  await runResearch();
}

window.initTelemetryResearchTab = initTelemetryResearchTab;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTelemetryResearchTab);
} else {
  initTelemetryResearchTab();
}
