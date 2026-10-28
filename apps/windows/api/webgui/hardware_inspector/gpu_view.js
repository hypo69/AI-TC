/**
 * =============================================================================
 * Process Name: Hardware Inspector - GPU View
 * =============================================================================
 * Description:
 *   Рендеринг детализированных графиков GPU с вызовами Plotly для счетчиков
 *   VRAM, Copy Engine и 3D Subsystems.
 *
 * File: gpu_view.js
 * Package: apps/windows/api/webgui/hardware_inspector
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-13 15:40:00
 * =============================================================================
 */

/**
 * Отрисовка детализированных графиков GPU через Plotly (VRAM, Copy Engine, 3D Subsystems).
 * @param {Object} gpuData Данные счетчиков GPU
 * @param {string} [targetContainerId] Идентификатор контейнера для вывода
 */
export function renderGpuDetailCharts(gpuData = {}, targetContainerId = 'gpu-detailed-charts') {
  const vramData = gpuData.vram || [30, 35, 40, 45, 50, 48, 52];
  const copyEngineData = gpuData.copy_engine || [5, 12, 8, 15, 2, 4, 10];
  const subsystems3dData = gpuData.subsystems_3d || [45, 60, 75, 80, 70, 85, 90];

  const timestamps = gpuData.timestamps || ['-60s', '-50s', '-40s', '-30s', '-20s', '-10s', 'now'];

  const traces = [
    {
      x: timestamps,
      y: vramData,
      name: 'VRAM Usage (%)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#0dcaf0', width: 2 }
    },
    {
      x: timestamps,
      y: copyEngineData,
      name: 'Copy Engine (%)',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ffc107', width: 2, dash: 'dot' }
    },
    {
      x: timestamps,
      y: subsystems3dData,
      name: '3D Subsystems (%)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#dc3545', width: 2 }
    }
  ];

  const layout = {
    title: 'GPU Subsystem Load & Memory Metrics',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e2e8f0', size: 11 },
    margin: { l: 40, r: 20, t: 40, b: 30 },
    legend: { orientation: 'h', y: 1.15 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.1)', range: [0, 100] }
  };

  const container = document.getElementById(targetContainerId);
  if (container && typeof window.Plotly !== 'undefined') {
    window.Plotly.newPlot(targetContainerId, traces, layout, { responsive: true, displayModeBar: false });
  }

  return { traces, layout };
}

if (typeof window !== 'undefined') {
  window.renderGpuDetailCharts = renderGpuDetailCharts;
}
