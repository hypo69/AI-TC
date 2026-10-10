/**
 * =============================================================================
 * Process Name: Windows Web Interface - Software Scanner Script
 * =============================================================================
 * Description:
 *   Клиентский модуль управления вкладкой глубокого сканирования ПО и спящих программ.
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/software_scanner_tab
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-10 19:28:00
 * =============================================================================
 */

let currentInventory = [];
let currentOrphans = [];
let activeFilter = 'all';

/**
 * Инициализация вкладки глубокого сканера ПО.
 */
export async function init() {
  setupEventListeners();
  await loadLatestScanResults();
}

/**
 * Настройка обработчиков событий элементов управления.
 */
function setupEventListeners() {
  const btnScan = document.getElementById('sw-btn-trigger-scan');
  if (btnScan) {
    btnScan.addEventListener('click', () => triggerScan());
  }

  const searchInput = document.getElementById('sw-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderTable());
  }

  const filterButtons = document.querySelectorAll('#sw-status-filter-group button');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });
}

/**
 * Запуск глубокого сканирования по требованию.
 */
async function triggerScan() {
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

  try {
    const res = await fetch('/api/windows/software-scanner/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });

    if (!res.ok) {
      throw new Error(`Ошибка сканирования: ${res.statusText}`);
    }

    const report = await res.json();
    processScanReport(report);

    if (window.showToast) {
      window.showToast(`Сканирование завершено: найдено ${report.stats?.total_software_identified || 0} программ`, 'success');
    }
  } catch (err) {
    console.error('[SoftwareScannerTab] Ошибка:', err);
    if (window.showToast) {
      window.showToast(`Ошибка сканирования: ${err.message}`, 'error');
    }
  } finally {
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
 * Загрузка последнего сохраненного отчета сканирования.
 */
async function loadLatestScanResults() {
  try {
    const res = await fetch('/api/windows/software-scanner/latest-report');
    if (res.ok) {
      const report = await res.json();
      if (report && report.inventory && report.inventory.length > 0) {
        processScanReport(report);
      }
    }
  } catch (err) {
    console.debug('[SoftwareScannerTab] Отчет по умолчанию еще не сформирован:', err);
  }
}

/**
 * Обработка и вывод данных отчета сканирования.
 */
function processScanReport(report) {
  if (!report) return;

  const stats = report.stats || {};
  currentInventory = report.inventory || [];
  currentOrphans = report.orphan_items || [];

  // Обновление метрик
  updateMetric('sw-metric-total-evidence', stats.total_evidence_found || 0);
  updateMetric('sw-metric-total-apps', stats.total_software_identified || 0);
  updateMetric('sw-metric-active-apps', stats.active_count || 0);
  updateMetric('sw-metric-dormant-apps', stats.dormant_count || 0);
  updateMetric('sw-metric-orphan-items', stats.orphan_count || 0);
  updateMetric('sw-metric-duration', `${Math.round(stats.duration_ms || 0)} мс`);

  renderTable();
  renderOrphans();
}

/**
 * Вспомогательное обновление числовой метрики.
 */
function updateMetric(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value;
}

/**
 * Рендеринг таблицы программ с учетом поиска и активного фильтра.
 */
function renderTable() {
  const tbody = document.getElementById('sw-table-body');
  const countBadge = document.getElementById('sw-table-count-badge');
  const searchInput = document.getElementById('sw-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!tbody) return;

  let filtered = currentInventory.filter(card => {
    // Фильтр по статусу
    if (activeFilter === 'dormant' && card.status !== 'dormant' && card.status !== 'never_launched') return false;
    if (activeFilter === 'active' && card.status !== 'active') return false;
    if (activeFilter === 'orphan' && !card.is_orphan && card.status !== 'orphan') return false;
    if (activeFilter === 'store_app' && card.status !== 'store_app') return false;

    // Поиск
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

  tbody.innerHTML = filtered.slice(0, 150).map(card => {
    const statusBadge = getStatusBadge(card);
    const lastRunStr = formatLastRun(card);
    const pathStr = card.install_location || card.main_executable || '—';

    return `
      <tr>
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
        <td>${statusBadge}</td>
        <td>
          <div class="fw-medium">${lastRunStr}</div>
          <div class="text-muted" style="font-size: 0.72rem;">${card.last_execution ? card.last_execution.substring(0, 10) : ''}</div>
        </td>
        <td>
          <span class="badge bg-secondary font-monospace">${card.run_count || 0}</span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline-info me-1 btn-evidence-details" data-card-id="${card.id}" title="Просмотреть все найденные следы">
            <i class="bi bi-info-circle"></i> Следы (${(card.evidence || []).length})
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Навешивание обработчиков клика по деталям
  tbody.querySelectorAll('.btn-evidence-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.getAttribute('data-card-id');
      const targetCard = currentInventory.find(c => c.id === cardId);
      if (targetCard) {
        showEvidenceModal(targetCard);
      }
    });
  });
}

/**
 * Рендеринг таблицы сирот и битых записей.
 */
function renderOrphans() {
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

  tbody.innerHTML = currentOrphans.map(item => `
    <tr>
      <td><span class="badge bg-danger-subtle text-danger border border-danger">${escapeHtml(item.source)}</span></td>
      <td class="font-monospace text-break">${escapeHtml(item.path)}</td>
      <td class="text-warning">${escapeHtml(item.product_name || 'Неизвестная причина')}</td>
    </tr>
  `).join('');
}

/**
 * Формирование бейджа статуса программы.
 */
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

/**
 * Форматирование строки времени последнего запуска.
 */
function formatLastRun(card) {
  if (card.days_since_last_run !== null && card.days_since_last_run !== undefined) {
    return `${card.days_since_last_run} дн. назад`;
  }
  return 'Не зафиксирован';
}

/**
 * Открытие модального окна подробных свидетельств.
 */
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
    listEl.innerHTML = (card.evidence || []).map(ev => `
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

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

/**
 * Экранирование HTML для предотвращения XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Автоматический запуск при загрузке вкладки
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
