/**
 * Модуль панели корреляций и графиков Chart.js исследования телеметрии.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/panel_correlations_charts/panel.js
 * Updated: 2026-10-17 01:55:00
 */

let trChartsInstances = [];

/**
 * Отрисовка матрицы корреляций метрик.
 * @param {Array<Object>} correlations - Список корреляций.
 */
export function renderCorrelations(correlations) {
  const tbody = document.getElementById('tr-correlations-tbody');
  const countBadge = document.getElementById('tr-correlations-count');
  if (!tbody) return;

  if (!correlations || correlations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Корреляции не рассчитаны</td></tr>';
    if (countBadge) countBadge.textContent = '0 пар';
    return;
  }

  if (countBadge) countBadge.textContent = `${correlations.length} пар`;

  tbody.innerHTML = correlations
    .map((c) => {
      const absVal = Math.abs(c.coefficient);
      let coeffBadgeClass = 'bg-secondary';
      if (absVal >= 0.7) coeffBadgeClass = 'bg-danger';
      else if (absVal >= 0.5) coeffBadgeClass = 'bg-warning text-dark';
      else if (absVal >= 0.3) coeffBadgeClass = 'bg-info text-dark';

      return `
        <tr>
          <td><code class="text-info">${c.metric_a}</code></td>
          <td><code class="text-info">${c.metric_b}</code></td>
          <td><span class="badge ${coeffBadgeClass} font-monospace">${c.coefficient > 0 ? '+' : ''}${c.coefficient.toFixed(3)}</span></td>
          <td>${c.sample_size} точек</td>
          <td class="text-light text-opacity-75">${c.interpretation}</td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Отрисовка интерактивных графиков Chart.js.
 * @param {Array<Object>} charts - Список данных графиков.
 */
export function renderCharts(charts) {
  const container = document.getElementById('tr-charts-container');
  if (!container) return;

  trChartsInstances.forEach((inst) => {
    try {
      inst.destroy();
    } catch {}
  });
  trChartsInstances = [];

  if (!charts || charts.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted py-4">Нет доступных графиков</div>';
    return;
  }

  container.innerHTML = '';

  charts.forEach((ch, idx) => {
    const col = document.createElement('div');
    col.className = 'col-12 col-xl-6';

    const canvasId = `tr-chart-canvas-${idx}`;
    col.innerHTML = `
      <div class="card bg-dark border-secondary h-100 shadow-sm">
        <div class="card-header bg-transparent border-secondary d-flex justify-content-between align-items-center">
          <span class="fw-bold text-light">${ch.title}</span>
          <span class="badge bg-secondary small">${ch.chart_type}</span>
        </div>
        <div class="card-body p-2" style="position: relative; height: 280px;">
          <canvas id="${canvasId}"></canvas>
        </div>
      </div>
    `;
    container.appendChild(col);

    const ctx = document.getElementById(canvasId);
    if (ctx && typeof Chart !== 'undefined') {
      const labels = (ch.labels || []).map((l) => (l.length > 19 ? l.slice(11, 19) : l));
      const datasets = (ch.datasets || []).map((ds) => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color || '#3b82f6',
        backgroundColor: (ds.color || '#3b82f6') + '22',
        borderWidth: 2,
        fill: ch.chart_type === 'area',
        tension: 0.25,
        pointRadius: ds.data && ds.data.length > 50 ? 0 : 3,
      }));

      const newInst = new Chart(ctx, {
        type: ch.chart_type === 'bar' ? 'bar' : 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: { color: '#9ca3af', font: { size: 10 } },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: { color: '#9ca3af', font: { size: 10 } },
            },
          },
          plugins: {
            legend: {
              labels: { color: '#e5e7eb', boxWidth: 12, font: { size: 11 } },
            },
          },
        },
      });
      trChartsInstances.push(newInst);
    }
  });
}
