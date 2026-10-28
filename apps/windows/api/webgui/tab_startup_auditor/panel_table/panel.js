/**
 * Модуль таблицы элементов автозапуска, фильтрации и переключения состояний.
 * Файл: apps/windows/api/webgui/tab_startup_auditor/panel_table/panel.js
 * Updated: 2026-10-17 03:22:00
 */

import { apiFetch, getRiskBadge } from '../common/ui_utils.js';
import { renderSummaryCards } from '../panel_summary/panel.js';

let allEntries = [];
let currentSummary = null;
let isAuditLoading = false;

/**
 * Возвращает текущий массив записей автозапуска.
 * @returns {Array<Object>}
 */
export function getAllEntries() {
  return allEntries;
}

/**
 * Загружает сводный отчет аудита точек автозапуска.
 */
export async function loadAuditData() {
  if (isAuditLoading) return;
  isAuditLoading = true;

  const tbody = document.getElementById('sa-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          Выполняется сканирование точек автозапуска Windows...
        </td>
      </tr>
    `;
  }

  try {
    const report = await apiFetch('/api/v1/startup-auditor/audit');
    allEntries = report?.entries || [];
    currentSummary = report?.summary || {};

    renderSummaryCards(report);
    renderFilteredTable();
  } catch (err) {
    console.error('[StartupAuditor] Error loading audit report:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-danger">
            Ошибка загрузки данных аудита: ${err.message}
          </td>
        </tr>
      `;
    }
  } finally {
    isAuditLoading = false;
  }
}

/**
 * Асинхронно перезапускает сбор данных автозапуска через API телеметрии.
 */
export async function refreshStartupTelemetry() {
  const btn = document.getElementById('sa-btn-refresh-telemetry');
  const spinner = document.getElementById('sa-refresh-spinner');
  const statusText = document.getElementById('sa-telemetry-last-snap');

  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.add('spinner-border', 'spinner-border-sm');

  try {
    if (statusText) statusText.textContent = 'Телеметрия: сбор снимка...';

    const res = await apiFetch('/api/v1/startup-auditor/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res && res.report) {
      allEntries = res.report.entries || [];
      currentSummary = res.report.summary || {};
      renderSummaryCards(res.report);
      renderFilteredTable();
    }

    const count = res.changes_count || (res.changes ? res.changes.length : 0);
    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (statusText) {
      statusText.textContent = count > 0 
        ? `Телеметрия: снимок ${timeStr} (изменений: ${count})`
        : `Телеметрия: снимок ${timeStr} (без изменений)`;
    }

    const badge = document.getElementById('sa-changes-badge');
    if (badge && count > 0) {
      badge.textContent = count;
      badge.classList.remove('d-none');
    }

    if (count > 0) {
      window.showToast?.(`Снимок сохранен! Зафиксировано изменений: ${count}`, 'warning');
    } else {
      window.showToast?.('Снимок телеметрии успешно зафиксирован (изменений нет)', 'success');
    }
  } catch (err) {
    console.error('[StartupAuditor] Error refreshing telemetry snapshot:', err);
    if (statusText) statusText.textContent = 'Телеметрия: ошибка сбора';
    window.showToast?.(`Ошибка обновления телеметрии: ${err.message}`, 'danger');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.remove('spinner-border', 'spinner-border-sm');
  }
}

/**
 * Фильтрует записи и перерисовывает таблицу.
 */
export function renderFilteredTable() {
  const tbody = document.getElementById('sa-table-body');
  const tableCount = document.getElementById('sa-table-count');
  if (!tbody) return;

  const query = (document.getElementById('sa-search-input')?.value || '').toLowerCase().trim();
  const riskFilter = (document.getElementById('sa-filter-risk')?.value || '').toLowerCase();
  const locFilter = (document.getElementById('sa-filter-location')?.value || '').toLowerCase();
  const stateFilter = (document.getElementById('sa-filter-state')?.value || '').toLowerCase();

  const filtered = allEntries.filter(e => {
    if (query) {
      const fullText = `${e.name || ''} ${e.command || ''} ${e.executable_path || ''} ${e.publisher || ''} ${e.category || ''}`.toLowerCase();
      if (!fullText.includes(query)) return false;
    }
    if (riskFilter && (e.risk_level || '').toLowerCase() !== riskFilter) {
      return false;
    }
    if (locFilter && (e.location_type || '').toLowerCase() !== locFilter) {
      return false;
    }
    if (stateFilter === 'enabled' && !e.is_enabled) return false;
    if (stateFilter === 'disabled' && e.is_enabled) return false;

    return true;
  });

  if (tableCount) {
    tableCount.textContent = `Показано: ${filtered.length} из ${allEntries.length}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <div class="fs-4 mb-2">🔍</div>
          <div>Элементы автозапуска по заданным критериям не найдены</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const isEnabled = e.is_enabled;
    const statusBadge = isEnabled
      ? '<span class="sa-badge sa-badge-enabled"><i class="bi bi-check-circle-fill"></i> ВКЛ</span>'
      : '<span class="sa-badge sa-badge-disabled"><i class="bi bi-dash-circle"></i> ОТКЛ</span>';

    const riskBadge = getRiskBadge(e.risk_level);
    const isBroken = !e.file_exists && e.executable_path;
    
    const pathDisplay = isBroken
      ? `<div class="d-flex align-items-center gap-1 text-danger small font-monospace">
           <i class="bi bi-x-octagon-fill text-danger flex-shrink-0"></i>
           <span class="text-truncate fw-semibold" style="max-width: 480px;" title="${e.executable_path || e.command}">[Файл не найден] ${e.executable_path || e.command}</span>
         </div>`
      : `<div class="font-monospace small text-truncate" style="max-width: 480px; color: var(--text-color);" title="${e.command || e.executable_path}">
           ${e.executable_path || e.command}
         </div>`;

    const argsDisplay = e.arguments ? `
      <div class="d-flex align-items-center gap-1 font-monospace text-truncate mt-1 text-muted" style="max-width: 480px; font-size: 0.73rem;" title="${e.arguments}">
        <span class="badge bg-secondary-subtle text-secondary-emphasis border border-secondary" style="font-size: 0.68rem; padding: 1px 4px;">ARG</span>
        <span class="text-truncate">${e.arguments}</span>
      </div>` : '';

    const toggleIcon = isEnabled
      ? '<i class="bi bi-toggle2-on text-success" style="font-size: 1.4rem;"></i>'
      : '<i class="bi bi-toggle2-off text-muted" style="font-size: 1.4rem;"></i>';
    const toggleTitle = isEnabled ? 'Отключить элемент автозапуска' : 'Включить элемент автозапуска';

    let impactBadge = '';
    if (!isEnabled) {
      impactBadge = '<span class="sa-badge sa-badge-disabled">Отключено</span>';
    } else if (e.boot_impact === 'Высокое') {
      impactBadge = '<span class="sa-badge sa-risk-critical">Высокое</span>';
    } else if (e.boot_impact === 'Среднее') {
      impactBadge = '<span class="sa-badge sa-risk-warning">Среднее</span>';
    } else {
      impactBadge = '<span class="sa-badge sa-badge-cat">Низкое</span>';
    }

    return `
      <tr class="sa-row-item" data-id="${e.id}" style="cursor: pointer;" title="Нажмите для подробного AI-аудита">
        <td class="text-center">${statusBadge}</td>
        <td>
          <div class="fw-semibold text-truncate" style="max-width: 230px; color: var(--text-color);" title="${e.name}">${e.name}</div>
          <div class="small text-truncate text-muted" style="max-width: 230px; font-size: 0.73rem;" title="${e.publisher || 'Неизвестен'}">${e.publisher || 'Неизвестный издатель'}</div>
        </td>
        <td><span class="sa-badge sa-badge-loc">${e.location_type}</span></td>
        <td><span class="sa-badge sa-badge-cat">${e.category || 'Неизвестно'}</span></td>
        <td class="text-center">${riskBadge}</td>
        <td>
          ${pathDisplay}
          ${argsDisplay}
        </td>
        <td class="text-center">${impactBadge}</td>
        <td class="text-center">
          <button class="sa-toggle-btn" data-id="${e.id}" data-enabled="${isEnabled}" title="${toggleTitle}">
            ${toggleIcon}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Навешивание клика на строки для открытия универсального модального окна ИИ-помощника
  tbody.querySelectorAll('.sa-row-item').forEach(row => {
    row.onclick = (evt) => {
      if (evt.target.closest('.sa-toggle-btn')) return;
      const entryId = row.getAttribute('data-id');
      const entry = allEntries.find(item => item.id === entryId);
      if (entry) {
        openStartupAIModal(entry);
      }
    };
  });

  // Навешивание обработчиков переключения toggle
  tbody.querySelectorAll('.sa-toggle-btn').forEach(btn => {
    btn.onclick = async (evt) => {
      evt.stopPropagation();
      const entryId = btn.getAttribute('data-id');
      const currentState = btn.getAttribute('data-enabled') === 'true';
      const newState = !currentState;
      try {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        const res = await apiFetch('/api/v1/startup-auditor/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entryId, enable: newState })
        });
        if (res.success) {
          window.showToast?.(`Автозагрузка ${newState ? 'включена' : 'отключена'}`, 'success');
          await loadAuditData();
        } else {
          window.showToast?.(`Ошибка переключения: ${res.message}`, 'danger') || alert(`Ошибка переключения: ${res.message}`);
        }
      } catch (err) {
        window.showToast?.(`Ошибка: ${err.message}`, 'danger') || alert(`Ошибка: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    };
  });
}

/**
 * Открывает универсальное модальное окно ИИ-ассистента для записи автозапуска.
 * @param {Object} entry - Запись элемента автозапуска.
 */
export function openStartupAIModal(entry) {
  if (!entry) return;

  const modalService = window.AIModalDialog || window.AITableModal;
  if (!modalService || typeof modalService.show !== 'function') {
    console.warn('[StartupAuditor] Универсальное модальное окно AIModalDialog недоступно, попытка отложенной загрузки');
    const script = document.createElement('script');
    script.src = '/html/ai_modal_dialog/main.js?v=20261017_v1';
    script.onload = () => openStartupAIModal(entry);
    document.head.appendChild(script);
    return;
  }

  const isEnabled = Boolean(entry.is_enabled);
  const badges = [
    { text: entry.location_type || 'Registry', class: 'badge bg-primary' },
    { text: entry.category || 'Startup', class: 'badge bg-secondary' },
    { text: isEnabled ? 'ВКЛ' : 'ОТКЛ', class: isEnabled ? 'badge bg-success' : 'badge bg-warning text-dark' },
    {
      text: `Риск: ${entry.risk_level || 'low'}`,
      class: entry.risk_level === 'critical' ? 'badge bg-danger' : (entry.risk_level === 'suspicious' || entry.risk_level === 'warning' ? 'badge bg-warning text-dark' : 'badge bg-secondary')
    }
  ];

  const metadata = [
    { label: 'Программа', value: entry.name },
    { label: 'Издатель', value: entry.publisher || 'Неизвестный разработчик' },
    { label: 'Точка автозапуска', value: entry.location_type || 'registry_run' },
    { label: 'Категория', value: entry.category || 'Неизвестно' },
    { label: 'Влияние на запуск', value: entry.boot_impact || 'Низкое' },
    {
      label: 'Цифровая подпись',
      value: entry.is_signed ? 'Подписан (Valid)' : 'Без подписи / Неизвестно'
    },
    {
      label: 'Статус файла',
      value: entry.file_exists ? 'Файл существует' : 'Файл не найден (битая ссылка)'
    },
    {
      label: 'Размер файла',
      value: entry.file_size_kb > 0 ? `${entry.file_size_kb.toFixed(1)} KB` : '-'
    },
    {
      label: 'Расположение / Ключ',
      value: entry.location_path || 'Не указан',
      fullWidth: true
    },
    {
      label: 'Исполняемый путь',
      value: entry.executable_path || entry.command || '-',
      isCode: true,
      fullWidth: true
    },
    {
      label: 'Команда и аргументы',
      value: entry.command || '-',
      isCode: true,
      fullWidth: true
    }
  ];

  modalService.show({
    icon: '🚀',
    title: entry.name || 'Элемент автозапуска',
    subtitle: entry.executable_path || entry.command || entry.location_path || 'Автозагрузка Windows',
    tableType: 'startup',
    panelId: 'software_scanner-startup_auditor',
    badges: badges,
    metadata: metadata,
    rawContent: JSON.stringify(entry, null, 2),
    requestData: {
      entry_id: entry.id,
      name: entry.name,
      publisher: entry.publisher,
      executable_path: entry.executable_path,
      command: entry.command,
      arguments: entry.arguments,
      location_type: entry.location_type,
      location_path: entry.location_path,
      risk_level: entry.risk_level,
      is_enabled: entry.is_enabled,
      file_exists: entry.file_exists,
      is_signed: entry.is_signed,
      boot_impact: entry.boot_impact
    }
  });
}

