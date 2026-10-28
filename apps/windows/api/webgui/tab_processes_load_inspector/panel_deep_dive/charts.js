/**
 * Модуль управления графиками Chart.js для паспорта инстанса Deep Dive.
 * Синхронизированные 4 графика: CPU, RAM, GPU, Disk I/O с динамическим обновлением.
 * Файл: apps/windows/api/webgui/tab_processes_load_inspector/panel_deep_dive/charts.js
 * Updated: 2026-10-17 01:30:00
 */

let chartCpu = null;
let chartRam = null;
let chartGpu = null;
let chartDisk = null;
let currentChartInterval = '1m';

/**
 * Возвращает текущий выбранный интервал графиков.
 * @returns {string} Интервал ('1m', '5m', '1h', '24h').
 */
export function getChartInterval() {
  return currentChartInterval;
}

/**
 * Устанавливает интервал графиков.
 * @param {string} interval - Интервал ('1m', '5m', '1h', '24h').
 */
export function setChartInterval(interval) {
  currentChartInterval = interval;
}

/**
 * Инициализирует 4 графика Chart.js (CPU, RAM, GPU, Disk).
 */
export function initCharts() {
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#888', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }
      },
      y: {
        display: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#888', font: { size: 9 } }
      }
    },
    plugins: {
      legend: { labels: { color: '#bbb', font: { size: 10 }, boxWidth: 10 } },
      tooltip: { mode: 'index', intersect: false }
    }
  };

  const ctxCpu = document.getElementById('chart-proc-cpu')?.getContext('2d');
  if (ctxCpu && !chartCpu && window.Chart) {
    chartCpu = new Chart(ctxCpu, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'ЦП Общая %', data: [], borderColor: '#0dcaf0', backgroundColor: 'rgba(13, 202, 240, 0.1)', borderWidth: 1.5, fill: true, tension: 0.2 },
          { label: 'User Mode %', data: [], borderColor: '#818cf8', borderWidth: 1, borderDash: [4, 4], fill: false, tension: 0.2 },
          { label: 'Потоки', data: [], borderColor: '#f59e0b', borderWidth: 1, fill: false }
        ]
      },
      options: commonChartOptions
    });
  }

  const ctxRam = document.getElementById('chart-proc-ram')?.getContext('2d');
  if (ctxRam && !chartRam && window.Chart) {
    chartRam = new Chart(ctxRam, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Working Set (MB)', data: [], borderColor: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.15)', borderWidth: 1.5, fill: true, tension: 0.2 },
          { label: 'Private (MB)', data: [], borderColor: '#f97316', borderWidth: 1.2, fill: false, tension: 0.2 }
        ]
      },
      options: commonChartOptions
    });
  }

  const ctxGpu = document.getElementById('chart-proc-gpu')?.getContext('2d');
  if (ctxGpu && !chartGpu && window.Chart) {
    chartGpu = new Chart(ctxGpu, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'GPU Load %', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1.5, fill: true, tension: 0.2 },
          { label: 'VRAM (MB)', data: [], borderColor: '#34d399', borderWidth: 1, fill: false }
        ]
      },
      options: commonChartOptions
    });
  }

  const ctxDisk = document.getElementById('chart-proc-disk')?.getContext('2d');
  if (ctxDisk && !chartDisk && window.Chart) {
    chartDisk = new Chart(ctxDisk, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Чтение (KB/s)', data: [], borderColor: '#38bdf8', borderWidth: 1.2, tension: 0.2 },
          { label: 'Запись (KB/s)', data: [], borderColor: '#ef4444', borderWidth: 1.2, tension: 0.2 }
        ]
      },
      options: commonChartOptions
    });
  }
}

/**
 * Перерисовывает и подгоняет размеры всех графиков.
 */
export function resizeCharts() {
  [chartCpu, chartRam, chartGpu, chartDisk].forEach(c => {
    try {
      c?.resize();
      c?.update();
    } catch (_) {}
  });
}

/**
 * Обновляет данные на 4 графиках по списку полученных сэмплов.
 * @param {Array<Object>} samples - Сэмплы метрик инстанса.
 */
export function updateChartSamples(samples) {
  if (!Array.isArray(samples)) return;

  const labels = samples.map(s => {
    try {
      return new Date(s.timestamp).toLocaleTimeString('ru-RU', { hour12: false });
    } catch {
      return '';
    }
  });

  if (chartCpu) {
    chartCpu.data.labels = labels;
    chartCpu.data.datasets[0].data = samples.map(s => s.cpu_percent);
    chartCpu.data.datasets[1].data = samples.map(s => s.cpu_user_time);
    chartCpu.data.datasets[2].data = samples.map(s => s.thread_count);
    chartCpu.update();
  }

  if (chartRam) {
    chartRam.data.labels = labels;
    chartRam.data.datasets[0].data = samples.map(s => s.working_set_mb);
    chartRam.data.datasets[1].data = samples.map(s => s.private_bytes_mb);
    chartRam.update();
  }

  if (chartGpu) {
    chartGpu.data.labels = labels;
    chartGpu.data.datasets[0].data = samples.map(s => s.gpu_load_percent);
    chartGpu.data.datasets[1].data = samples.map(s => s.gpu_vram_mb);
    chartGpu.update();
  }

  if (chartDisk) {
    chartDisk.data.labels = labels;
    chartDisk.data.datasets[0].data = samples.map(s => (s.disk_read_bytes_sec / 1024).toFixed(1));
    chartDisk.data.datasets[1].data = samples.map(s => (s.disk_write_bytes_sec / 1024).toFixed(1));
    chartDisk.update();
  }
}
