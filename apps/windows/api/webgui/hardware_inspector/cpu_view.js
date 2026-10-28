/**
 * =============================================================================
 * Process Name: Hardware Inspector - CPU View
 * =============================================================================
 * Description:
 *   Рендеринг загрузки процессора и всех логических ядер/потоков CPU.
 *
 * File: cpu_view.js
 * Package: apps/windows/api/webgui/hardware_inspector
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-13 15:40:00
 * =============================================================================
 */

/**
 * Отрисовка всех ядер процессора синхронно с длиной массива logical_cores.
 * @param {Object} data Данные ответа CPU API
 * @param {HTMLElement|string} [container] Контейнер для вывода карточек ядер
 * @returns {Array<Object>} Массив отрисованных ядер
 */
export function renderCpuView(data, container = null) {
  if (!data || !data.cpu) return [];

  const logicalCores = Array.isArray(data.cpu.logical_cores)
    ? data.cpu.logical_cores
    : (typeof data.cpu.logical_cores === 'number'
        ? Array.from({ length: data.cpu.logical_cores }, (_, i) => ({ index: i + 1, load_percent: data.cpu.load_percent || 0 }))
        : (Array.isArray(data.cpu.cores) ? data.cpu.cores : []));

  const targetEl = typeof container === 'string'
    ? document.querySelector(container)
    : (container || document.getElementById('cpu-cores-container') || document.getElementById('sys-metric-cpu-cores'));

  const renderedCores = logicalCores.map((core, i) => {
    const idx = core.index !== undefined ? core.index : i + 1;
    const load = core.load_percent !== undefined ? Number(core.load_percent) : (core.load !== undefined ? Number(core.load) : 0);
    return {
      id: `core-${idx}`,
      name: `Core #${idx}`,
      load: load,
      html: `
        <div class="card p-2 m-1 sys-core-card" id="core-card-${idx}">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-bold">Core #${idx}</span>
            <span class="badge ${load >= 80 ? 'bg-danger' : 'bg-primary'}">${load.toFixed(0)}%</span>
          </div>
          <div class="progress mt-1" style="height: 6px;">
            <div class="progress-bar ${load >= 80 ? 'bg-danger' : 'bg-primary'}" style="width: ${Math.min(100, Math.max(0, load))}%;"></div>
          </div>
        </div>
      `
    };
  });

  if (targetEl) {
    targetEl.innerHTML = renderedCores.map(c => c.html).join('');
  }

  return renderedCores;
}

if (typeof window !== 'undefined') {
  window.renderCpuView = renderCpuView;
}
