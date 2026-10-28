/**
 * Модуль панели троттлинга процессора, качества ядра и сбоев BSOD (CPU Throttling & Hardware Diagnostics).
 * 
 * Отвечает за мониторинг задержек отложенных вызовов DPC / прерываний ISR, термального троттлинга PROCHOT,
 * ограничений энергопотребления (PL1/PL2 Limits), статуса шины PCIe видеокарты и дампов Minidump (BSOD).
 * 
 * Updated: 2026-10-20 14:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let isThrottlingInitialized = false;
let autoRefreshTimer = null;
const POLL_ID = 'throttling';

/**
 * Безопасное обновление текста элемента.
 * @param {string} id - Идентификатор элемента.
 * @param {string|number} text - Текст или число.
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text !== null && text !== undefined ? String(text) : '--';
}

/**
 * Получение сохраненной частоты опроса из хранилища.
 * @returns {string}
 */
function getFrequency() {
  try {
    const saved = localStorage.getItem(`poll_freq_${POLL_ID}`);
    if (saved) return saved;
  } catch (_) {}
  return 'manual';
}

/**
 * Сохранение и применение выбранной частоты опроса.
 * @param {string} freq - Частота ('manual', 'start', '3', '5', '10', '30', '60').
 */
function setFrequency(freq) {
  try {
    localStorage.setItem(`poll_freq_${POLL_ID}`, freq);
  } catch (_) {}
  applyPoller(freq, false);
}

/**
 * Остановка таймеров фонового опроса панели.
 */
export function stopThrottlingPolling() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

/**
 * Настройка таймера опроса данных панели.
 * @param {string} freq 
 * @param {boolean} runInitial 
 */
function applyPoller(freq, runInitial = false) {
  stopThrottlingPolling();
  if (freq === 'start' || freq === 'manual') {
    if (runInitial) {
      loadThrottlingData(false);
    }
    return;
  }

  const intervalSec = parseInt(freq, 10);
  if (isNaN(intervalSec) || intervalSec <= 0) return;

  if (runInitial) {
    loadThrottlingData(false);
  }

  autoRefreshTimer = setInterval(() => {
    loadThrottlingData(false);
  }, intervalSec * 1000);
}

/**
 * Загрузка телеметрии троттлинга и стабильности ядра с бэкенда.
 * @param {boolean} forceRefresh - Принудительное обновление через API.
 * @param {Function} isTabActive - Функция проверки активности вкладки.
 */
export async function loadThrottlingData(forceRefresh = false, isTabActive = () => true) {
  if (!isTabActive()) return;

  try {
    let url = '/api/v1/system/diagnostics/throttling';
    let res;
    if (forceRefresh) {
      try {
        res = await fetch('/api/v1/system/diagnostics/throttling/refresh', { method: 'POST' });
      } catch (_) {
        res = await fetch(url);
      }
    } else {
      res = await fetch(url);
    }

    if (!res || !res.ok) {
      throw new Error(`HTTP ${res ? res.status : 'ERR'}`);
    }

    const data = await res.json();
    if (!data) return;

    renderThrottlingData(data);
  } catch (err) {
    console.warn('[SystemControl:Throttling] Ошибка загрузки троттлинга:', err);
  }
}

/**
 * Отрисовка метрик троттлинга, шины PCIe и дампов BSOD.
 * @param {Object} data 
 */
function renderThrottlingData(data) {
  // 1. DPC Latency
  const dpcPct = typeof data.dpc_latency_pct === 'number' ? data.dpc_latency_pct : 0;
  setText('slc-diag-dpc-latency-val', `${dpcPct.toFixed(2)}%`);
  const dpcSub = document.getElementById('slc-diag-dpc-latency-sub');
  if (dpcSub) {
    if (data.dpc_status === 'severe') {
      dpcSub.innerHTML = '<span class="badge bg-danger-subtle text-danger border border-danger">Критическая латентность DPC</span>';
    } else if (data.dpc_status === 'elevated') {
      dpcSub.innerHTML = '<span class="badge bg-warning-subtle text-warning border border-warning">Повышенная задержка DPC</span>';
    } else {
      dpcSub.innerHTML = '<span class="badge bg-success-subtle text-success border border-success">Оптимально (&lt; 1.5%)</span>';
    }
  }

  // 2. ISR Latency
  const isrPct = typeof data.interrupt_latency_pct === 'number' ? data.interrupt_latency_pct : 0;
  setText('slc-diag-isr-latency-val', `${isrPct.toFixed(2)}%`);

  // 3. System Uptime
  setText('slc-diag-uptime-val', data.uptime_formatted || '--');

  // 4. PROCHOT & Power Limit Throttling
  const thVal = document.getElementById('slc-diag-throttling-status-val');
  const thSub = document.getElementById('slc-diag-throttling-status-sub');
  if (thVal && thSub) {
    if (data.thermal_throttling_detected) {
      thVal.textContent = 'PROCHOT Active';
      thVal.className = 'fs-4 fw-bold text-danger mt-1';
      thSub.textContent = 'Обнаружен термический сброс частот CPU';
    } else if (data.power_limit_throttling_detected) {
      thVal.textContent = 'Power Limit PL1/PL2';
      thVal.className = 'fs-4 fw-bold text-warning mt-1';
      thSub.textContent = 'Ограничение по энергопотреблению';
    } else {
      thVal.textContent = 'Inactive (Норма)';
      thVal.className = 'fs-4 fw-bold text-success mt-1';
      thSub.textContent = 'Терморежим и питание в норме';
    }
  }

  // 5. GPU PCIe Link
  if (data.gpu_pcie_link) {
    setText('slc-diag-gpu-pcie-name', data.gpu_pcie_link.gpu_name || 'GPU Accelerator');
    setText('slc-diag-gpu-pcie-speed', data.gpu_pcie_link.current_link_speed || 'PCIe 3.0 / 4.0');
    setText('slc-diag-gpu-pcie-width', data.gpu_pcie_link.current_link_width || 'x16 Lanes');
    setText('slc-diag-gpu-pcie-status', data.gpu_pcie_link.status || 'Штатный режим без деградации');
  }

  // 6. BSOD Minidump
  const bsodContainer = document.getElementById('slc-diag-bsod-container');
  if (bsodContainer && data.last_bsod_crashes) {
    setText('slc-diag-bsod-count', `${data.last_bsod_crashes.length} сбоев`);
    if (data.last_bsod_crashes.length === 0) {
      bsodContainer.innerHTML = `
        <div class="text-center py-4 text-success small">
          <i class="bi bi-check-circle-fill fs-5 d-block mb-1 text-success"></i>
          Аварийных дампов падения ядра (BSOD) в Minidump не обнаружено
        </div>
      `;
    } else {
      bsodContainer.innerHTML = data.last_bsod_crashes.map(c => `
        <div class="p-2 mb-1.5 rounded bg-black bg-opacity-25 border border-danger-subtle d-flex align-items-center justify-content-between">
          <div>
            <strong class="text-danger"><i class="bi bi-file-earmark-binary me-1"></i>${escapeHtml(c.file_name)}</strong>
            <div class="small text-muted font-monospace">${escapeHtml(c.timestamp)} (${c.size_kb} KB)</div>
          </div>
          <span class="badge bg-danger">Crash Dump</span>
        </div>
      `).join('');
    }
  }
}

/**
 * Инициализация элементов управления панели троттлинга.
 */
export function initThrottlingPanel() {
  if (isThrottlingInitialized) return;
  isThrottlingInitialized = true;

  const btnRefresh = document.getElementById('btn-slc-throttling-refresh');
  if (btnRefresh && !btnRefresh._bound) {
    btnRefresh._bound = true;
    btnRefresh.addEventListener('click', () => loadThrottlingData(true));
  }

  const select = document.getElementById('slc-throttling-poll-freq');
  if (select && !select._bound) {
    select._bound = true;
    select.value = getFrequency();
    select.addEventListener('change', (e) => {
      const newFreq = e.target.value;
      setFrequency(newFreq);
      if (newFreq !== 'manual' && newFreq !== 'start') {
        loadThrottlingData(false);
      }
      if (window.toast && typeof window.toast.info === 'function') {
        const label = select.options[select.selectedIndex]?.text || newFreq;
        window.toast.info('Частота опроса', `Установлена: ${label}`);
      }
    });
  }

  applyPoller(getFrequency(), true);
}
