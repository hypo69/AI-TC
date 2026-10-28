/**
 * Модуль панели истории телеметрии системы из SQLite базы telemetry.db.
 * Файл: apps/windows/api/webgui/tab_about_system/panel_history/panel.js
 * Updated: 2026-10-20 09:15:00
 */

import { apiFetch, escapeHtml } from '../common/ui_utils.js';

let currentHistoryMetric = 'all';

/**
 * Синхронизирует визуальное состояние кнопок фильтров в модальном окне.
 * @param {string} metric - Активная метрика
 */
function syncFilterUi(metric) {
  const filterBtns = document.querySelectorAll('#about-history-filter-group .btn-history-filter');
  filterBtns.forEach((btn) => {
    const isTarget = btn.getAttribute('data-metric') === metric;
    btn.classList.toggle('btn-info', isTarget);
    btn.classList.toggle('text-dark', isTarget);
    btn.classList.toggle('fw-bold', isTarget);
    btn.classList.toggle('active', isTarget);
    btn.classList.toggle('btn-outline-secondary', !isTarget);
  });
  const metricSelect = document.getElementById('about-history-metric-select');
  if (metricSelect && metricSelect.value !== metric) {
    metricSelect.value = metric;
  }
}

/**
 * Инициализирует панель истории телеметрии.
 * Загрузка данных истории выполняется исключительно On-Demand при открытии модального окна.
 */
export function initHistoryPanel() {
  bindHistoryEvents();
}

/**
 * Привязывает события к фильтрам и элементам управления истории.
 */
export function bindHistoryEvents() {
  // 1. Открытие модального окна истории телеметрии On-Demand
  const modalEl = document.getElementById('aboutSystemHistoryModal');
  if (modalEl && !modalEl._historyBound) {
    modalEl._historyBound = true;
    modalEl.addEventListener('show.bs.modal', (event) => {
      const button = event.relatedTarget;
      const metric = button?.getAttribute('data-metric') || currentHistoryMetric || 'all';
      syncFilterUi(metric);
      fetchAboutSystemHistory(metric);
    });
  }

  // 2. Селектор метрики
  const metricSelect = document.getElementById('about-history-metric-select');
  if (metricSelect) {
    metricSelect.onchange = () => {
      currentHistoryMetric = metricSelect.value || 'all';
      syncFilterUi(currentHistoryMetric);
      fetchAboutSystemHistory(currentHistoryMetric);
    };
  }

  // 3. Селектор лимита записей
  const limitSelect = document.getElementById('about-history-limit-select');
  if (limitSelect) {
    limitSelect.onchange = () => {
      fetchAboutSystemHistory(currentHistoryMetric);
    };
  }

  // 4. Кнопка ручного обновления истории
  const btnRefresh = document.getElementById('btn-about-history-refresh');
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      fetchAboutSystemHistory(currentHistoryMetric);
    };
  }

  // 5. Кнопки фильтров внутри модального окна
  const filterBtns = document.querySelectorAll('#about-history-filter-group .btn-history-filter');
  filterBtns.forEach((btn) => {
    btn.onclick = () => {
      const metric = btn.getAttribute('data-metric') || 'all';
      currentHistoryMetric = metric;
      syncFilterUi(metric);
      fetchAboutSystemHistory(metric);
    };
  });
}

/**
 * Загружает исторические записи телеметрии из базы данных telemetry.db.
 * @param {string} [metric='all'] - Имя метрики или 'all'.
 */
export async function fetchAboutSystemHistory(metric = 'all') {
  currentHistoryMetric = metric;
  const tbody = document.getElementById('about-history-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-info mb-1" role="status"></div>
          <div>Запрос истории из базы данных telemetry.db...</div>
        </td>
      </tr>
    `;
  }

  const limitSelect = document.getElementById('about-history-limit-select');
  const limit = limitSelect ? parseInt(limitSelect.value, 10) || 30 : 30;

  try {
    const url = `/api/v1/about-system/history?limit=${limit}&metric=${encodeURIComponent(metric)}`;
    const data = await apiFetch(url);
    renderAboutSystemHistory(data, metric);
  } catch (err) {
    console.error('[AboutSystemTab] fetchAboutSystemHistory error:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-triangle-fill me-1"></i>
            Ошибка при получении истории из БД: ${escapeHtml(err.message || String(err))}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Отрисовывает таблицу с историческими записями из telemetry.db.
 * @param {Object} resData - Ответ API с историческими записями.
 * @param {string} metric - Текущий фильтр метрик.
 */
export function renderAboutSystemHistory(resData, metric) {
  const tbody = document.getElementById('about-history-tbody');
  const countBadge = document.getElementById('about-history-count-badge');
  const metaEl = document.getElementById('about-history-db-meta');

  if (!resData || !Array.isArray(resData.history) || resData.history.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4 text-muted">
            <i class="bi bi-database-slash fs-4 d-block mb-1 text-secondary"></i>
            В базе данных telemetry.db пока нет сохраненных срезов телеметрии.
          </td>
        </tr>
      `;
    }
    if (countBadge) countBadge.textContent = 'Записей в базе: 0';
    return;
  }

  const history = resData.history;
  if (countBadge) countBadge.textContent = `Записей в выборке: ${history.length}`;
  if (metaEl && resData.meta && resData.meta.source) {
    metaEl.textContent = `Источник: ${resData.meta.source} (${resData.meta.table || 'system_snapshots'})`;
  }

  if (!tbody) return;

  let rowsHtml = '';
  history.forEach(item => {
    const id = item.id || 0;
    let dateFormatted = '--:--:--';
    if (item.timestamp) {
      try {
        const d = new Date(item.timestamp);
        dateFormatted = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
      } catch (_) {
        dateFormatted = item.timestamp;
      }
    }

    const host = escapeHtml(item.hostname || '--');
    const os = escapeHtml(item.os_name || 'Windows');

    const cpuVal = item.cpu_total_percent !== null && item.cpu_total_percent !== undefined ? Number(item.cpu_total_percent) : 0;
    const cpuColor = cpuVal > 85 ? 'text-danger fw-bold' : (cpuVal > 60 ? 'text-warning' : 'text-info');
    const cpuFreq = item.cpu_frequency_mhz ? `${item.cpu_frequency_mhz} MHz` : '';

    const ramUsed = item.memory_used_gb !== null && item.memory_used_gb !== undefined ? Number(item.memory_used_gb).toFixed(1) : '0.0';
    const ramTot = item.memory_total_gb !== null && item.memory_total_gb !== undefined ? Number(item.memory_total_gb).toFixed(1) : '0.0';
    const ramPct = item.memory_percent !== null && item.memory_percent !== undefined ? Number(item.memory_percent).toFixed(1) : '0.0';
    const ramColor = Number(ramPct) > 85 ? 'text-danger' : (Number(ramPct) > 65 ? 'text-warning' : 'text-success');

    const gpuLoad = item.gpu_load_percent !== null && item.gpu_load_percent !== undefined ? `${item.gpu_load_percent}%` : '--';
    const gpuTemp = item.gpu_temp_c !== null && item.gpu_temp_c !== undefined ? ` / ${item.gpu_temp_c}°C` : '';

    const cFree = item.storage_c_free_gb !== null && item.storage_c_free_gb !== undefined ? `${item.storage_c_free_gb} GB` : '--';
    const diskIo = item.disk_io_total_mb_s !== null && item.disk_io_total_mb_s !== undefined ? `${Number(item.disk_io_total_mb_s).toFixed(2)} MB/s` : '0.00 MB/s';
    const uptime = escapeHtml(item.uptime_human || '--');

    rowsHtml += `
      <tr>
        <td class="text-muted">#${id}</td>
        <td class="text-nowrap text-light">${escapeHtml(dateFormatted)}</td>
        <td class="text-truncate" style="max-width: 140px;" title="${host} (${os})">
          <span class="text-white">${host}</span>
          <small class="text-muted d-block" style="font-size: 0.70rem;">${os}</small>
        </td>
        <td style="text-align: right;">
          <span class="${cpuColor}">${cpuVal.toFixed(1)}%</span>
          <small class="text-muted d-block" style="font-size: 0.70rem;">${cpuFreq}</small>
        </td>
        <td style="text-align: right;">
          <span class="${ramColor}">${ramUsed} / ${ramTot} GB</span>
          <small class="text-muted d-block" style="font-size: 0.70rem;">${ramPct}%</small>
        </td>
        <td style="text-align: right;">
          <span class="text-light">${gpuLoad}</span>
          <small class="text-danger" style="font-size: 0.70rem;">${gpuTemp}</small>
        </td>
        <td style="text-align: right;" class="text-info">${cFree}</td>
        <td style="text-align: right;" class="text-white">${diskIo}</td>
        <td style="text-align: right;" class="text-muted">${uptime}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}
