/**
 * Модуль панели сводного дашборда сбоев и стабильности системы (Summary Dashboard).
 * 
 * Отображает агрегированные KPI надежности Windows:
 * - Сбои питания (Kernel-Power 41 / 6008)
 * - Критические ошибки синего экрана (BSOD BugCheck)
 * - Ошибки драйверов и PnP-устройств
 * - Подозрительная активность и аномалии процессов
 * 
 * Updated: 2026-10-17 00:26:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let cachedFailuresData = null;
let activeSummarySubtab = 'power';

/**
 * Получение кэшированных данных сводки сбоев.
 * @returns {Object|null}
 */
export function getCachedFailuresData() {
  return cachedFailuresData;
}

/**
 * Загрузка агрегированной сводки сбоев и отказов Windows.
 * 
 * @param {number|null} hours - Период выборки в часах.
 * @param {boolean} force - Принудительное обновление.
 * @param {Function} isTabActive - Функция проверки активности вкладки.
 */
export async function loadFailuresSummary(hours = null, force = false, isTabActive = () => true) {
  if (!isTabActive()) return;
  const periodSelect = document.getElementById('sum-period-select');
  const selectedHours = hours || (periodSelect ? parseInt(periodSelect.value, 10) : 720);

  const riskBadge = document.getElementById('sum-overall-risk-badge');
  if (riskBadge) {
    riskBadge.textContent = 'Анализ...';
    riskBadge.className = 'badge bg-secondary-subtle text-secondary border';
  }

  try {
    const resp = await fetch(`/api/v1/system_logs/failures_summary?hours=${selectedHours}`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json();
    cachedFailuresData = data;

    // 1. Обновление карточек KPI
    const metrics = data.metrics || {};
    const powerCnt = document.getElementById('sum-power-count');
    const powerRatio = document.getElementById('sum-power-ratio');
    const powerLast = document.getElementById('sum-power-last');
    if (powerCnt) powerCnt.textContent = metrics.power_failures_count ?? 0;
    if (powerRatio) powerRatio.textContent = `${metrics.clean_shutdown_ratio ?? 0}%`;

    const lastPwr = (data.power_failures && data.power_failures[0]) ? data.power_failures[0].timestamp : 'Нет сбоев';
    if (powerLast) powerLast.textContent = lastPwr;

    const bsodCnt = document.getElementById('sum-bsod-count');
    const bsodCode = document.getElementById('sum-bsod-code');
    const bsodDumpStatus = document.getElementById('sum-bsod-dump-status');
    if (bsodCnt) bsodCnt.textContent = metrics.bsod_count ?? 0;
    if (data.bsod_incidents && data.bsod_incidents.length > 0) {
      const lastBsod = data.bsod_incidents[0];
      if (bsodCode) bsodCode.textContent = lastBsod.bugcheck_symbol || lastBsod.bugcheck_code || 'Сбой ядра';
      if (bsodDumpStatus) bsodDumpStatus.textContent = lastBsod.timestamp || 'Зафиксирован';
    } else {
      if (bsodCode) bsodCode.textContent = 'Чистый журнал (0x0)';
      if (bsodDumpStatus) bsodDumpStatus.textContent = 'Дампы не обнаружены';
    }

    const drvCnt = document.getElementById('sum-drivers-count');
    const drvPnp = document.getElementById('sum-drivers-pnp');
    const drvLog = document.getElementById('sum-drivers-log');
    if (drvCnt) drvCnt.textContent = metrics.driver_errors_count ?? 0;
    const pnpCount = (data.driver_errors || []).filter(d => d.source === 'pnp_device').length;
    const logCount = (data.driver_errors || []).filter(d => d.source === 'system_log').length;
    if (drvPnp) drvPnp.textContent = pnpCount;
    if (drvLog) drvLog.textContent = logCount;

    const suspCnt = document.getElementById('sum-suspicious-count');
    const suspProc = document.getElementById('sum-susp-proc');
    const suspSpikes = document.getElementById('sum-susp-spikes');
    if (suspCnt) suspCnt.textContent = metrics.suspicious_activity_count ?? 0;
    const procCount = (data.suspicious_activity || []).filter(s => s.category === 'process_anomaly').length;
    const spikeCount = (data.suspicious_activity || []).filter(s => s.category !== 'process_anomaly').length;
    if (suspProc) suspProc.textContent = procCount;
    if (suspSpikes) suspSpikes.textContent = spikeCount;

    // Счетчики на бейджах табов
    const badgePwr = document.getElementById('badge-cnt-power');
    const badgeBsod = document.getElementById('badge-cnt-bsod');
    const badgeDrv = document.getElementById('badge-cnt-drivers');
    const badgeSusp = document.getElementById('badge-cnt-suspicious');
    if (badgePwr) badgePwr.textContent = (data.power_failures || []).length;
    if (badgeBsod) badgeBsod.textContent = (data.bsod_incidents || []).length;
    if (badgeDrv) badgeDrv.textContent = (data.driver_errors || []).length;
    if (badgeSusp) badgeSusp.textContent = (data.suspicious_activity || []).length;

    // Интегральный бейдж риска
    if (riskBadge) {
      const r = metrics.overall_risk || 'ok';
      if (r === 'critical') {
        riskBadge.textContent = 'Критический риск';
        riskBadge.className = 'badge sum-badge-critical';
      } else if (r === 'warning') {
        riskBadge.textContent = 'Умеренный риск';
        riskBadge.className = 'badge sum-badge-warning';
      } else {
        riskBadge.textContent = 'Система стабильна';
        riskBadge.className = 'badge sum-badge-ok';
      }
    }

    // 2. Рендеринг таблиц
    renderPowerFailuresTable(data.power_failures || []);
    renderBsodTable(data.bsod_incidents || []);
    renderDriverErrorsTable(data.driver_errors || []);
    renderSuspiciousTable(data.suspicious_activity || []);

    switchSummarySubtab(activeSummarySubtab || 'power');
  } catch (err) {
    console.error('[FailuresSummary] Ошибка загрузки сводки сбоев:', err);
    if (riskBadge) {
      riskBadge.textContent = 'Ошибка загрузки';
      riskBadge.className = 'badge bg-danger-subtle text-danger border';
    }
  }
}

/**
 * Переключение активной субвкладки сводного дашборда.
 * 
 * @param {string} subtab - 'power' | 'bsod' | 'drivers' | 'suspicious'.
 */
export function switchSummarySubtab(subtab) {
  activeSummarySubtab = subtab;
  const panes = {
    power: document.getElementById('sum-pane-power'),
    bsod: document.getElementById('sum-pane-bsod'),
    drivers: document.getElementById('sum-pane-drivers'),
    suspicious: document.getElementById('sum-pane-suspicious'),
  };
  const cards = {
    power: document.getElementById('sum-card-power'),
    bsod: document.getElementById('sum-card-bsod'),
    drivers: document.getElementById('sum-card-drivers'),
    suspicious: document.getElementById('sum-card-suspicious'),
  };
  const btns = {
    power: document.getElementById('btn-sum-tab-power'),
    bsod: document.getElementById('btn-sum-tab-bsod'),
    drivers: document.getElementById('btn-sum-tab-drivers'),
    suspicious: document.getElementById('btn-sum-tab-suspicious'),
  };

  Object.keys(panes).forEach(k => {
    if (panes[k]) panes[k].classList.toggle('d-none', k !== subtab);
    if (cards[k]) cards[k].classList.toggle('active', k === subtab);
    if (btns[k]) btns[k].classList.toggle('active', k === subtab);
  });

  const counter = document.getElementById('sum-table-counter');
  if (counter && cachedFailuresData) {
    if (subtab === 'power') {
      counter.textContent = `Сбоев питания: ${(cachedFailuresData.power_failures || []).length}`;
    } else if (subtab === 'bsod') {
      counter.textContent = `Инцидентов BSOD: ${(cachedFailuresData.bsod_incidents || []).length}`;
    } else if (subtab === 'drivers') {
      counter.textContent = `Ошибок драйверов: ${(cachedFailuresData.driver_errors || []).length}`;
    } else if (subtab === 'suspicious') {
      counter.textContent = `Аномалий активности: ${(cachedFailuresData.suspicious_activity || []).length}`;
    }
  }
}

/**
 * Рендеринг таблицы сбоев питания.
 * @param {Array} failures
 */
export function renderPowerFailuresTable(failures) {
  const tbody = document.getElementById('sum-power-tbody');
  if (!tbody) return;
  if (!failures || failures.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-check2-circle text-success me-2"></i>Сбоев электропитания за выбранный период не зафиксировано</td></tr>';
    return;
  }
  tbody.innerHTML = failures.map(f => {
    const ts = f.timestamp || 'Н/Д';
    const reason = escapeHtml(f.reason || 'Внезапное выключение (Kernel-Power / 6008)');
    const uptime = escapeHtml(f.uptime_human || 'Н/Д');
    const initiator = escapeHtml(f.initiator || 'Неизвестный источник');
    const payload = encodeURIComponent(JSON.stringify(f));
    return `
      <tr class="interactive-table-row" data-power='${payload}' style="cursor: pointer;" title="Кликните для просмотра деталей и диагностики через AI">
        <td class="font-monospace small text-nowrap"><i class="bi bi-clock-history me-1.5 text-danger"></i>${escapeHtml(ts)}</td>
        <td><span class="badge bg-danger-subtle text-danger border border-danger-subtle">Неожиданное</span></td>
        <td class="text-break">${reason}</td>
        <td class="font-monospace small text-body">${uptime}</td>
        <td class="small text-truncate" style="max-width: 200px;" title="${initiator}">${initiator}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr.interactive-table-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('button, a, input, select, .no-modal-trigger')) return;
      const raw = row.getAttribute('data-power');
      if (raw && window.AIModalDialog) {
        const item = JSON.parse(decodeURIComponent(raw));
        window.AIModalDialog.show({
          title: `Сбой питания: ${item.session_id || item.timestamp}`,
          subtitle: item.reason || 'Внезапное отключение питания хоста',
          icon: '⚡',
          tableType: 'power_failure',
          badges: [{ text: 'Неожиданное отключение', class: 'badge bg-danger' }],
          metadata: [
            { label: 'Время события', value: item.timestamp || 'Н/Д' },
            { label: 'Аптайм до сбоя', value: item.uptime_human || 'Н/Д' },
            { label: 'Инициатор', value: item.initiator || 'Н/Д' },
            { label: 'Event ID', value: String(item.event_id || 41) }
          ],
          rawTitle: 'Структура события Kernel-Power',
          rawContent: JSON.stringify(item, null, 2),
          autoRun: false
        });
      }
    };
  });
}

/**
 * Рендеринг таблицы инцидентов синего экрана (BSOD).
 * @param {Array} bsods
 */
export function renderBsodTable(bsods) {
  const tbody = document.getElementById('sum-bsod-tbody');
  if (!tbody) return;
  if (!bsods || bsods.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-shield-check text-success me-2"></i>Дампов памяти и критических сбоев BSOD не зафиксировано</td></tr>';
    return;
  }
  tbody.innerHTML = bsods.map(b => {
    const ts = b.timestamp || 'Н/Д';
    const code = escapeHtml(b.bugcheck_code || '0x00000000');
    const sym = escapeHtml(b.bugcheck_symbol || 'KERNEL_MODE_EXCEPTION');
    const dump = escapeHtml(b.dump_path || 'Minidump');
    const desc = escapeHtml(b.description || 'Аппаратный сбой или критическая ошибка ядра');
    const payload = encodeURIComponent(JSON.stringify(b));
    return `
      <tr class="interactive-table-row" data-bsod='${payload}' style="cursor: pointer;" title="Кликните для глубокого анализа минидампа через AI">
        <td class="font-monospace small text-nowrap"><i class="bi bi-exclamation-triangle-fill text-danger me-1.5"></i>${escapeHtml(ts)}</td>
        <td class="font-monospace fw-bold text-danger">${code}</td>
        <td class="fw-semibold text-break">${sym}</td>
        <td class="small text-truncate" style="max-width: 250px;" title="${dump}">${dump}</td>
        <td class="small text-break">${desc}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr.interactive-table-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('button, a, input, select, .no-modal-trigger')) return;
      const raw = row.getAttribute('data-bsod');
      if (raw && window.AIModalDialog) {
        const item = JSON.parse(decodeURIComponent(raw));
        window.AIModalDialog.show({
          title: `BSOD BugCheck: ${item.bugcheck_code}`,
          subtitle: item.bugcheck_symbol || 'Критический сбой ядра Windows',
          icon: '💀',
          tableType: 'bsod',
          badges: [{ text: item.bugcheck_code, class: 'badge bg-danger' }],
          metadata: [
            { label: 'Символическое имя', value: item.bugcheck_symbol || 'UNKNOWN' },
            { label: 'Путь к дампу', value: item.dump_path || 'MEMORY.DMP' },
            { label: 'Параметры P1..P4', value: item.parameters ? item.parameters.join(', ') : 'Н/Д' },
            { label: 'Причина', value: item.description || 'Н/Д' }
          ],
          rawTitle: 'Метаданные краш-дампа BSOD',
          rawContent: JSON.stringify(item, null, 2),
          autoRun: false
        });
      }
    };
  });
}

/**
 * Рендеринг таблицы ошибок драйверов.
 * @param {Array} drivers
 */
export function renderDriverErrorsTable(drivers) {
  const tbody = document.getElementById('sum-drivers-tbody');
  if (!tbody) return;
  if (!drivers || drivers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="bi bi-check2-circle text-success me-2"></i>Ошибок и сбоев драйверов устройств не обнаружено</td></tr>';
    return;
  }
  tbody.innerHTML = drivers.map(d => {
    const ts = d.timestamp || 'Н/Д';
    const name = escapeHtml(d.name || d.device_name || 'Драйвер');
    const err = escapeHtml(d.error_code || '0x0');
    const src = escapeHtml(d.source || 'PnP');
    const status = escapeHtml(d.status || 'Сбой');
    const payload = encodeURIComponent(JSON.stringify(d));
    return `
      <tr class="interactive-table-row" data-driver='${payload}' style="cursor: pointer;" title="Кликните для просмотра рекомендаций по устранению">
        <td class="font-monospace small text-nowrap"><i class="bi bi-cpu me-1.5 text-warning"></i>${escapeHtml(ts)}</td>
        <td class="fw-semibold text-break">${name}</td>
        <td class="font-monospace small text-danger">${err}</td>
        <td><span class="badge bg-secondary-subtle text-secondary border">${src}</span></td>
        <td class="small text-break">${status}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr.interactive-table-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('button, a, input, select, .no-modal-trigger')) return;
      const raw = row.getAttribute('data-driver');
      if (raw && window.AIModalDialog) {
        const item = JSON.parse(decodeURIComponent(raw));
        window.AIModalDialog.show({
          title: `Драйвер/Устройство: ${item.name}`,
          subtitle: `Код ошибки: ${item.error_code} (${item.status})`,
          icon: '🔧',
          tableType: 'driver',
          badges: [{ text: item.error_code, class: 'badge bg-warning text-dark' }],
          metadata: [
            { label: 'Класс/Источник', value: item.device_class || 'System' },
            { label: 'Статус устройства', value: item.status || 'Error' },
            { label: 'Идентификатор', value: item.instance_id || 'Н/Д' },
            { label: 'Решение', value: item.remediation_cmd || 'Проверить состояние службы или драйвера' }
          ],
          rawTitle: 'Диагностика драйвера',
          rawContent: JSON.stringify(item, null, 2),
          autoRun: false
        });
      }
    };
  });
}

/**
 * Рендеринг таблицы подозрительной активности и аномалий процессов.
 * @param {Array} activities
 */
export function renderSuspiciousTable(activities) {
  const tbody = document.getElementById('sum-suspicious-tbody');
  if (!tbody) return;
  if (!activities || activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-shield-check text-success me-2"></i>Подозрительной активности и аномалий телеметрии не обнаружено</td></tr>';
    return;
  }
  tbody.innerHTML = activities.map(a => {
    const ts = a.timestamp || 'Н/Д';
    const proc = escapeHtml(a.process_name || 'System');
    const cat = escapeHtml(a.category || 'anomaly');
    const sev = a.severity || 'warning';
    const desc = escapeHtml(a.description || a.title || 'Аномалия');
    const metrics = a.metrics ? Object.entries(a.metrics).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Н/Д';
    const badgeClass = sev === 'critical' ? 'bg-danger-subtle text-danger border-danger-subtle' : (sev === 'warning' ? 'bg-warning-subtle text-warning border-warning-subtle' : 'bg-info-subtle text-info border-info-subtle');
    const payload = encodeURIComponent(JSON.stringify(a));
    return `
      <tr class="interactive-table-row" data-susp='${payload}' style="cursor: pointer;" title="Кликните для диагностики аномалии через AI">
        <td class="font-monospace small text-nowrap"><i class="bi bi-activity me-1.5 text-warning"></i>${escapeHtml(ts)}</td>
        <td class="fw-semibold text-break">${proc} ${a.pid ? `<span class="badge bg-secondary-subtle text-secondary font-monospace">PID ${a.pid}</span>` : ''}</td>
        <td><span class="badge bg-body-secondary text-body border">${cat}</span></td>
        <td><span class="badge ${badgeClass} border">${sev}</span></td>
        <td class="small text-break">${desc}</td>
        <td class="font-monospace small text-muted text-truncate" style="max-width: 160px;" title="${escapeHtml(metrics)}">${escapeHtml(metrics)}</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr.interactive-table-row').forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('button, a, input, select, .no-modal-trigger')) return;
      const raw = row.getAttribute('data-susp');
      if (raw && window.AIModalDialog) {
        const item = JSON.parse(decodeURIComponent(raw));
        window.AIModalDialog.show({
          title: item.title || `Аномалия телеметрии: ${item.process_name}`,
          subtitle: item.description || 'Аномальное поведение системы',
          icon: '🛡️',
          tableType: 'process',
          badges: [{ text: item.category, class: 'badge bg-warning text-dark' }],
          metadata: [
            { label: 'Процесс', value: item.process_name || 'N/A' },
            { label: 'PID', value: String(item.pid || 0) },
            { label: 'Путь', value: item.executable_path || 'Н/Д' },
            { label: 'Уровень риска', value: item.severity || 'warning' }
          ],
          rawTitle: 'Телеметрический профиль аномалии',
          rawContent: JSON.stringify(item, null, 2),
          autoRun: false
        });
      }
    };
  });
}

/**
 * Инициализация интерактивных элементов сводного дашборда.
 */
export function initSummaryDashboard() {
  document.querySelectorAll('.sum-metric-card').forEach(card => {
    card.onclick = () => {
      const subtab = card.getAttribute('data-subtab');
      if (subtab) switchSummarySubtab(subtab);
    };
  });

  document.querySelectorAll('#sum-subtabs-nav button').forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');
      if (target) switchSummarySubtab(target);
    };
  });

  const periodSelect = document.getElementById('sum-period-select');
  if (periodSelect && !periodSelect._bound) {
    periodSelect._bound = true;
    periodSelect.onchange = () => {
      loadFailuresSummary(parseInt(periodSelect.value, 10), true);
    };
  }

  const refreshBtn = document.getElementById('btn-sum-refresh');
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn._bound = true;
    refreshBtn.onclick = () => {
      loadFailuresSummary(null, true);
    };
  }

  const aiBtn = document.getElementById('btn-sum-ask-ai');
  if (aiBtn && !aiBtn._bound) {
    aiBtn._bound = true;
    aiBtn.onclick = () => {
      if (!cachedFailuresData || !window.AIModalDialog) return;
      window.AIModalDialog.show({
        title: 'Комплексный анализ стабильности и сбоев Windows',
        subtitle: `Сбоев питания: ${cachedFailuresData.metrics?.power_failures_count || 0}, BSOD: ${cachedFailuresData.metrics?.bsod_count || 0}, Ошибок драйверов: ${cachedFailuresData.metrics?.driver_errors_count || 0}`,
        icon: '🚨',
        tableType: 'system_failures',
        badges: [
          { text: `Уровень риска: ${cachedFailuresData.metrics?.overall_risk || 'N/A'}`, class: cachedFailuresData.metrics?.overall_risk === 'critical' ? 'badge bg-danger' : 'badge bg-warning' }
        ],
        metadata: [
          { label: 'Период выборки', value: `${document.getElementById('sum-period-select')?.value || 720} часов` },
          { label: 'Чистых выключений', value: `${cachedFailuresData.metrics?.clean_shutdown_ratio || 0}%` },
          { label: 'Всего сессий питания', value: String(cachedFailuresData.metrics?.total_sessions || 0) }
        ],
        rawTitle: 'Агрегированный JSON сводки сбоев и телеметрии',
        rawContent: JSON.stringify(cachedFailuresData, null, 2),
        autoRun: true
      });
    };
  }

  const exportBtn = document.getElementById('btn-sum-export');
  if (exportBtn && !exportBtn._bound) {
    exportBtn._bound = true;
    exportBtn.onclick = () => {
      if (!cachedFailuresData) return;
      const blob = new Blob([JSON.stringify(cachedFailuresData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_failures_summary_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }
}
