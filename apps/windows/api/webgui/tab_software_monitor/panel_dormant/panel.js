/**
 * =============================================================================
 * Process Name: Windows Software Scanner - Dormant & Orphans Panel
 * =============================================================================
 * Description:
 *   Модуль сканирования спящих программ (>90 дней не запускавшихся) и сирот
 *   (битые ключи реестра, остаточные папки, недействительные службы и задачи).
 *
 * File: panel_dormant/panel.js
 * Project: ai-windows-admin
 * Package: apps/windows/api/webgui/tab_software_scanner/panel_dormant
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 20:20:00
 * =============================================================================
 */

import { escapeHtml } from '../common/ui_utils.js';

let currentInventory = [];
let currentOrphans = [];
let activeFilter = 'all';
let isDormantInitialized = false;
let isSoftwareAuditLoading = false;

/**
 * Инициализирует модуль сканера спящих программ и сирот.
 */
export function initDormantScanner() {
  if (isDormantInitialized) return;
  isDormantInitialized = true;

  setupDormantEventListeners();
  loadLatestScanResults();
}

/**
 * Настраивает обработчики событий элементов управления сканера.
 */
function setupDormantEventListeners() {
  const btnScan = document.getElementById('sw-btn-trigger-scan');
  if (btnScan) {
    btnScan.addEventListener('click', () => triggerScan());
  }

  const searchInput = document.getElementById('sw-scanner-search-input') || document.getElementById('sw-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderTable());
  }

  const filterButtons = document.querySelectorAll('#sw-status-filter-group button');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });
}

/**
 * Запускает процесс сканирования следов ПО.
 */
export async function triggerScan() {
  if (isSoftwareAuditLoading) return;
  isSoftwareAuditLoading = true;

  const modeSelect = document.getElementById('sw-scan-mode-select');
  const mode = modeSelect ? modeSelect.value : 'deep';

  const statusBadge = document.getElementById('sw-scanner-status-badge');
  const btnScan = document.getElementById('sw-btn-trigger-scan');

  if (statusBadge) {
    statusBadge.className = 'badge rounded-pill bg-warning-subtle text-warning border border-warning px-3 py-2';
    statusBadge.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Сканирование...';
  }
  if (btnScan) {
    btnScan.disabled = true;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error('Превышено время ожидания глубокого сканирования ПО (120с)'));
  }, 120000);

  try {
    const res = await fetch('/api/windows/software-scanner/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      throw new Error(`Ошибка сканирования: ${res.statusText}`);
    }

    const report = await res.json();
    processScanReport(report);

    if (window.toast) {
      window.toast.success('Глубокий сканер ПО', `Сканирование завершено: найдено ${report.stats?.total_software_identified || 0} программ`);
    } else if (window.showToast) {
      window.showToast(`Сканирование завершено: найдено ${report.stats?.total_software_identified || 0} программ`, 'success');
    }
  } catch (err) {
    console.error('[SoftwareScannerTab] Ошибка:', err);
    await loadLatestScanResults();

    if (window.toast) {
      window.toast.warning('Глубокий сканер ПО', `Отображен локальный отчет: ${err.message}`);
    } else if (window.showToast) {
      window.showToast(`Отображен локальный отчет: ${err.message}`, 'warning');
    }
  } finally {
    clearTimeout(timeoutId);
    isSoftwareAuditLoading = false;
    if (statusBadge) {
      statusBadge.className = 'badge rounded-pill bg-success-subtle text-success border border-success px-3 py-2';
      statusBadge.textContent = '● Готов к запуску';
    }
    if (btnScan) {
      btnScan.disabled = false;
    }
  }
}

/**
 * Загружает последний сохраненный отчет сканирования из telemetry.db.
 */
export async function loadLatestScanResults() {
  const statusBadge = document.getElementById('sw-scanner-status-badge');
  try {
    const res = await fetch('/api/windows/software-scanner/latest-report');
    if (res.ok) {
      const report = await res.json();
      if (report && report.inventory && report.inventory.length > 0) {
        processScanReport(report);
        if (statusBadge) {
          statusBadge.className = 'badge rounded-pill bg-success-subtle text-success border border-success px-3 py-2';
          statusBadge.innerHTML = `<i class="bi bi-database-check me-1"></i> telemetry.db (${report.inventory.length} ПО)`;
        }
      }
    }
  } catch (err) {
    console.debug('[SoftwareScannerTab] Отчет по умолчанию еще не сформирован в telemetry.db:', err);
  }
}

/**
 * Обрабатывает данные отчета и обновляет метрики со списками.
 * @param {Object} report - Отчет сканирования.
 */
function processScanReport(report) {
  if (!report) return;

  const stats = report.stats || {};
  currentInventory = report.inventory || [];
  currentOrphans = report.orphan_items || [];

  updateMetric('sw-metric-total-evidence', stats.total_evidence_found || (currentInventory.length + currentOrphans.length));
  updateMetric('sw-metric-total-apps', stats.total_software_identified || currentInventory.length);
  updateMetric('sw-metric-active-apps', stats.active_count || currentInventory.filter((c) => c.status === 'active').length);
  updateMetric('sw-metric-dormant-apps', stats.dormant_count || currentInventory.filter((c) => c.status === 'dormant' || c.status === 'never_launched').length);
  updateMetric('sw-metric-orphan-items', stats.orphan_count || currentOrphans.length);
  updateMetric('sw-metric-duration', `${Math.round(stats.duration_ms || 0)} мс`);

  const statusBadge = document.getElementById('sw-scanner-status-badge');
  if (statusBadge && !isSoftwareAuditLoading) {
    statusBadge.className = 'badge rounded-pill bg-success-subtle text-success border border-success px-3 py-2';
    statusBadge.innerHTML = `<i class="bi bi-database-check me-1"></i> telemetry.db (${currentInventory.length} ПО)`;
  }

  renderTable();
  renderOrphans();
}

function updateMetric(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value;
}

/**
 * Рендерит таблицу программ согласно поисковому запросу и фильтру.
 */
export function renderTable() {
  const tbody = document.getElementById('sw-table-body');
  const countBadge = document.getElementById('sw-table-count-badge');
  const searchInput = document.getElementById('sw-scanner-search-input') || document.getElementById('sw-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!tbody) return;

  const filtered = currentInventory.filter((card) => {
    if (activeFilter === 'dormant' && card.status !== 'dormant' && card.status !== 'never_launched') return false;
    if (activeFilter === 'active' && card.status !== 'active') return false;
    if (activeFilter === 'orphan' && !card.is_orphan && card.status !== 'orphan') return false;
    if (activeFilter === 'store_app' && card.status !== 'store_app') return false;

    if (query) {
      const matchName = (card.name || '').toLowerCase().includes(query);
      const matchPub = (card.publisher || '').toLowerCase().includes(query);
      const matchLoc = (card.install_location || '').toLowerCase().includes(query);
      const matchExe = (card.main_executable || '').toLowerCase().includes(query);
      return matchName || matchPub || matchLoc || matchExe;
    }

    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} из ${currentInventory.length}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="text-center py-4 text-muted" colspan="6">
          ${currentInventory.length === 0 ? 'Нет данных. Запустите сканирование.' : 'Программы по заданным критериям не найдены.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 150).map((card) => {
    const statusBadge = getStatusBadge(card);
    const lastRunStr = formatLastRun(card);
    const pathStr = card.install_location || card.main_executable || '—';

    return `
      <tr class="sw-scanner-row" data-card-id="${card.id}" style="cursor: pointer;" title="Кликните для вызова ИИ-Ассистента">
        <td>
          <div class="fw-bold text-light">${escapeHtml(card.name)}</div>
          <div class="text-muted small font-monospace text-truncate" style="max-width: 380px;" title="${escapeHtml(pathStr)}">
            ${escapeHtml(pathStr)}
          </div>
        </td>
        <td>
          <div>${escapeHtml(card.publisher || '—')}</div>
          <div class="text-secondary small">${escapeHtml(card.version || '—')}</div>
        </td>
        <td class="sw-badge-cell" data-card-id="${card.id}">${statusBadge}</td>
        <td>
          <div class="fw-medium">${lastRunStr}</div>
          <div class="text-muted" style="font-size: 0.72rem;">${card.last_execution ? card.last_execution.substring(0, 10) : ''}</div>
        </td>
        <td>
          <span class="badge bg-secondary font-monospace">${card.run_count || 0}</span>
        </td>
        <td style="text-align: right;">
          <div class="d-flex align-items-center justify-content-end gap-1">
            <button class="btn btn-sm btn-outline-info btn-evidence-details" data-card-id="${card.id}" title="Просмотреть все найденные следы">
              <i class="bi bi-info-circle"></i> Следы (${(card.evidence || []).length})
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-evidence-details').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.getAttribute('data-card-id');
      const targetCard = currentInventory.find((c) => c.id === cardId);
      if (targetCard) {
        showEvidenceModal(targetCard);
      }
    });
  });

  tbody.querySelectorAll('.sw-scanner-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, select, .no-modal-trigger')) {
        return;
      }
      const cardId = row.getAttribute('data-card-id');
      const targetCard = currentInventory.find((c) => c.id === cardId);
      if (targetCard && window.AIModalDialog && window.AIModalDialog.open) {
        window.AIModalDialog.open({ program: targetCard, panelId: 'software-scanner' });
      }
    });
  });
}

/**
 * Рендерит таблицу сирот и поврежденных записей.
 */
export function renderOrphans() {
  const container = document.getElementById('panel-software-scanner-orphans');
  const tbody = document.getElementById('sw-orphans-table-body');
  const badge = document.getElementById('sw-orphans-count-badge');

  if (!container || !tbody) return;

  if (currentOrphans.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  if (badge) badge.textContent = currentOrphans.length;

  tbody.innerHTML = currentOrphans.map((item) => `
    <tr>
      <td><span class="badge bg-danger-subtle text-danger border border-danger">${escapeHtml(item.source)}</span></td>
      <td class="font-monospace text-break">${escapeHtml(item.path)}</td>
      <td class="text-warning">${escapeHtml(item.product_name || 'Неизвестная причина')}</td>
    </tr>
  `).join('');
}

function getStatusBadge(card) {
  if (card.status === 'dormant') {
    return '<span class="badge bg-warning-subtle text-warning border border-warning">🟡 Dormant (Спящее)</span>';
  } else if (card.status === 'never_launched') {
    return '<span class="badge bg-secondary-subtle text-secondary border border-secondary">⚪ Без запусков</span>';
  } else if (card.status === 'active') {
    return '<span class="badge bg-success-subtle text-success border border-success">🟢 Active</span>';
  } else if (card.status === 'orphan' || card.is_orphan) {
    return '<span class="badge bg-danger-subtle text-danger border border-danger">🔴 Orphan</span>';
  } else if (card.status === 'store_app') {
    return '<span class="badge bg-info-subtle text-info border border-info">Store App</span>';
  } else if (card.status === 'portable') {
    return '<span class="badge bg-primary-subtle text-primary border border-primary">Portable</span>';
  }
  return '<span class="badge bg-secondary">Неизвестно</span>';
}

function formatLastRun(card) {
  if (card.days_since_last_run !== null && card.days_since_last_run !== undefined) {
    return `${card.days_since_last_run} дн. назад`;
  }
  return 'Не зафиксирован';
}

function showEvidenceModal(card) {
  const modalEl = document.getElementById('sw-evidence-modal');
  const titleEl = document.getElementById('sw-evidence-modal-title');
  const summaryEl = document.getElementById('sw-evidence-modal-summary');
  const listEl = document.getElementById('sw-evidence-modal-list');

  if (!modalEl) return;

  if (titleEl) titleEl.textContent = `Следы: ${card.name}`;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="card bg-secondary bg-opacity-10 border-secondary p-2 mb-2">
        <div><strong>Издатель:</strong> ${escapeHtml(card.publisher || '—')}</div>
        <div><strong>Версия:</strong> ${escapeHtml(card.version || '—')}</div>
        <div><strong>Команда деинсталляции:</strong> <code>${escapeHtml(card.uninstall_string || '—')}</code></div>
      </div>
    `;
  }

  if (listEl) {
    listEl.innerHTML = (card.evidence || []).map((ev) => `
      <div class="list-group-item bg-dark text-light border-secondary">
        <div class="d-flex align-items-center justify-content-between mb-1">
          <span class="badge bg-primary">${escapeHtml(ev.evidence_type)}</span>
          <span class="badge bg-secondary">${escapeHtml(ev.source)}</span>
        </div>
        <div class="small font-monospace text-break text-info">${escapeHtml(ev.path)}</div>
        ${ev.last_execution ? `<div class="small text-muted mt-1">Метка времени: ${escapeHtml(ev.last_execution)}</div>` : ''}
      </div>
    `).join('');
  }

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = new window.bootstrap.Modal(modalEl);
    modal.show();
  }
}
