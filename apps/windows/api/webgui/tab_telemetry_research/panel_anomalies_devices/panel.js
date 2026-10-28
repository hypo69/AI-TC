/**
 * Модуль панели обнаруженных аномалий и состояния оборудования.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/panel_anomalies_devices/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Отрисовка аномалий и сводки состояния устройств.
 * @param {Array<Object>} anomalies - Список аномалий.
 * @param {Object} deviceSummary - Сводка состояния оборудования.
 */
export function renderAnomalies(anomalies, deviceSummary) {
  const tbody = document.getElementById('tr-anomalies-tbody');
  const anomBadge = document.getElementById('tr-anomalies-badge');
  const devBadge = document.getElementById('tr-devices-badge');
  const devContent = document.getElementById('tr-devices-content');

  if (anomBadge) anomBadge.textContent = anomalies ? `${anomalies.length}` : '0';

  if (tbody) {
    if (!anomalies || anomalies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-success py-3"><i class="bi bi-check-circle"></i> Аномалий в метриках не зафиксировано</td></tr>';
    } else {
      tbody.innerHTML = anomalies
        .map((a) => {
          const sevClass = a.severity === 'critical' ? 'bg-danger' : a.severity === 'high' ? 'bg-warning text-dark' : 'bg-info text-dark';
          return `
            <tr>
              <td class="text-muted">${a.timestamp ? a.timestamp.slice(11, 19) : '--'}</td>
              <td><strong>${a.metric}</strong></td>
              <td><span class="badge ${sevClass}">${a.severity}</span></td>
              <td><code class="text-warning">${a.value}</code> / ${a.threshold}</td>
              <td class="text-light text-opacity-75">${a.message}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  if (deviceSummary && devContent) {
    const hasIssues = deviceSummary.error_count > 0 || (deviceSummary.flapping_devices && deviceSummary.flapping_devices.length > 0);
    if (devBadge) {
      devBadge.className = `badge ${hasIssues ? 'bg-danger' : 'bg-success'}`;
      devBadge.textContent = hasIssues ? 'Внимание' : 'Норма';
    }

    let flapHtml = '<span class="text-success">Нет</span>';
    if (deviceSummary.flapping_devices && deviceSummary.flapping_devices.length > 0) {
      flapHtml = deviceSummary.flapping_devices.map((d) => `<span class="badge bg-warning text-dark me-1">${d}</span>`).join('');
    }

    devContent.innerHTML = `
      <div class="mb-2"><strong>Всего инцидентов:</strong> ${deviceSummary.total_events || 0}</div>
      <div class="mb-2"><strong>Ошибок и сбоев:</strong> <span class="${deviceSummary.error_count > 0 ? 'text-danger fw-bold' : 'text-success'}">${deviceSummary.error_count || 0}</span></div>
      <div class="mb-2"><strong>Флаппирующие устройства:</strong> ${flapHtml}</div>
    `;
  }
}
