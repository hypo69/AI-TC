/**
 * Модуль панели тестирования скорости интернета и пинга.
 * Файл: apps/windows/api/webgui/tab_network/panel_speedtest/panel.js
 * Updated: 2026-10-17 01:55:00
 */

let isSpeedtestRunning = false;

/**
 * Загружает последний сохраненный результат speedtest из кэша.
 */
export async function fetchLatestSpeedtest() {
  try {
    const res = await fetch('/api/network/speedtest/latest');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.download) {
      renderSpeedtestResults(data);
    }
  } catch (e) {
    console.debug('[NetworkTab] No latest speedtest data:', e);
  }
}

/**
 * Запускает полный замер скорости интернет-соединения.
 */
export async function runInternetSpeedtest() {
  if (isSpeedtestRunning) return;
  isSpeedtestRunning = true;

  const btn = document.getElementById('btn-run-speedtest');
  const statusText = document.getElementById('speedtest-status-text');
  const summaryText = document.getElementById('speed-summary-text');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Тестирование...';
  }
  if (statusText) statusText.innerText = 'Измерение Ping, Download и Upload...';
  if (summaryText) summaryText.innerText = 'Выполняется подключение к узлам Cloudflare & DNS серверам для замера скорости...';

  try {
    const res = await fetch('/api/network/speedtest/run', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderSpeedtestResults(data);
    if (statusText) statusText.innerText = `Завершено в ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error('[NetworkTab] Speedtest error:', e);
    window.showToast?.('Ошибка при выполнении теста скорости: ' + e.message, 'danger') || alert('Ошибка при выполнении теста скорости: ' + e.message);
    if (statusText) statusText.innerText = 'Ошибка теста скорости';
  } finally {
    isSpeedtestRunning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-play-fill me-1"></i> Запустить тест скорости';
    }
  }
}

/**
 * Отрисовывает результаты замера скорости в интерфейсе.
 * @param {Object} data - Результаты speedtest.
 */
export function renderSpeedtestResults(data) {
  const valDown = document.getElementById('speed-val-download');
  const subDown = document.getElementById('speed-sub-download');
  const valUp = document.getElementById('speed-val-upload');
  const subUp = document.getElementById('speed-sub-upload');
  const valPing = document.getElementById('speed-val-ping');
  const subJitter = document.getElementById('speed-sub-jitter');
  const valGrade = document.getElementById('speed-val-grade');
  const subIsp = document.getElementById('speed-sub-isp');
  const badgeIp = document.getElementById('speed-badge-ip');
  const badgeLoc = document.getElementById('speed-badge-location');
  const summaryText = document.getElementById('speed-summary-text');
  const kpiSpeed = document.getElementById('net-kpi-speed');
  const kpiPing = document.getElementById('net-kpi-ping');
  const serversTbody = document.getElementById('speed-servers-tbody');

  const downMbps = data?.download?.speed_mbps || 0;
  const downMBs = data?.download?.speed_mb_s || 0;
  const upMbps = data?.upload?.speed_mbps || 0;
  const upMBs = data?.upload?.speed_mb_s || 0;
  const pingMs = data?.ping_ms || 0;
  const jitterMs = data?.jitter_ms || 0;
  const meta = data?.meta || {};
  const quality = data?.quality || {};

  if (valDown) valDown.innerText = `${downMbps} Mbps`;
  if (subDown) subDown.innerText = `${downMBs} MB/s (${data?.download?.duration_s || 0}s)`;
  if (valUp) valUp.innerText = `${upMbps} Mbps`;
  if (subUp) subUp.innerText = `${upMBs} MB/s (${data?.upload?.duration_s || 0}s)`;
  if (valPing) valPing.innerText = `${pingMs} ms`;
  if (subJitter) subJitter.innerText = `Jitter: ${jitterMs} ms`;

  if (valGrade) {
    valGrade.innerText = quality.rating || '--';
    valGrade.style.color = quality.color || '#fbbf24';
  }
  if (subIsp) subIsp.innerText = `Провайдер: ${meta.isp || 'Неизвестно'}`;

  if (badgeIp) badgeIp.innerText = `Внешний IP: ${meta.ip || '--'}`;
  if (badgeLoc) badgeLoc.innerText = `Локация: ${meta.city || ''} ${meta.country || ''} (${meta.colo || 'Edge'})`.trim();
  if (summaryText) summaryText.innerText = `${quality.grade || 'Готово'}. ${quality.summary || ''}`;

  if (kpiSpeed) kpiSpeed.innerText = `${downMbps} Mbps`;
  if (kpiPing) kpiPing.innerText = `Ping: ${pingMs} ms`;

  if (serversTbody && Array.isArray(data?.servers)) {
    serversTbody.innerHTML = data.servers.map(s => {
      const isOnline = s.avg_ms > 0;
      const statusBadge = isOnline 
        ? '<span class="proto-badge status-badge-up">Online</span>' 
        : '<span class="proto-badge status-badge-down">Offline</span>';

      return `
        <tr>
          <td class="fw-bold text-body"><i class="bi bi-hdd-network me-1 text-info"></i>${s.name}</td>
          <td class="text-secondary font-monospace">${s.host}</td>
          <td style="text-align: right;" class="text-info fw-bold font-monospace">${isOnline ? `${s.avg_ms} ms` : '--'}</td>
          <td style="text-align: right;" class="text-muted font-monospace">${isOnline ? `${s.min_ms} ms` : '--'}</td>
          <td style="text-align: right;" class="text-muted font-monospace">${isOnline ? `${s.max_ms} ms` : '--'}</td>
          <td style="text-align: right;" class="text-warning font-monospace">${isOnline ? `${s.jitter_ms} ms` : '--'}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }
}
