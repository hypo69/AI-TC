/**
 * Модуль самостоятельной панели глубокой телеметрии батареи и электропитания (Battery Deep Telemetry).
 * 
 * Включает:
 * - Телеметрия источника питания (AC Mains / Battery)
 * - Уровень заряда аккумулятора и статус (Заряжается / Разряд)
 * - Сравнение заводской емкости (Design Capacity) и текущей (Full Charge Capacity)
 * - Процент деградации (Battery Degradation / Wear Level)
 * - Профиль электропитания и расчетное время автономной работы
 * - Независимый опрос через GET /api/v1/system/diagnostics/battery
 * 
 * Файл: apps/windows/api/webgui/tab_about_system/panel_battery/panel.js
 * Updated: 2026-10-20 17:38:00
 */

import { apiFetch, setText, escapeHtml } from '../common/ui_utils.js?v=20261020_v4';

/**
 * Применение данных телеметрии батареи к панели Battery Deep Telemetry.
 * @param {Object} data - Объект с данными батареи или battery_wear.
 */
export function applyBatteryData(data) {
  if (!data) return;
  try {
    const b = data.battery_wear || data.battery || data;
    const batContainer = document.getElementById('diag-battery-details-container');
    const batSourceBadge = document.getElementById('diag-battery-source-badge');

    if (batSourceBadge) {
      if (!b.has_battery) {
        batSourceBadge.textContent = 'AC Mains 220V';
        batSourceBadge.className = 'ui-badge ui-badge-info font-monospace';
      } else {
        const isChg = Boolean(b.is_charging);
        batSourceBadge.textContent = isChg ? 'AC Adapter (Зарядка)' : 'Battery (Разряд)';
        const bCls = isChg ? 'ui-badge-success' : (b.percent < 20 ? 'ui-badge-danger' : 'ui-badge-warning');
        batSourceBadge.className = `ui-badge font-monospace ${bCls}`;
      }
    }

    if (!batContainer) return;

    if (!b.has_battery) {
      batContainer.innerHTML = `
        <div class="diag-meter-card">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-3">
              <i class="bi bi-plug-fill fs-2 text-info"></i>
              <div>
                <div class="fw-semibold text-body">Стационарный компьютер — прямое питание от электросети 220V</div>
                <div class="small text-muted font-monospace mt-0.5">
                  Источник: <span class="text-info">${escapeHtml(b.power_source || 'AC Mains')}</span> | 
                  Профиль: <span class="text-body">${escapeHtml(b.power_profile || 'AC Mains / Desktop')}</span>
                </div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="ui-badge ui-badge-success font-monospace">
                <i class="bi bi-check-circle"></i>Сеть 220V подключена
              </span>
            </div>
          </div>
        </div>
      `;
    } else {
      const isChg = Boolean(b.is_charging);
      const pct = b.percent != null ? Number(b.percent) : 100;
      const pctColor = isChg ? 'success' : (pct < 20 ? 'danger' : (pct < 50 ? 'warning' : 'info'));
      const wearPct = b.wear_level_pct != null ? Number(b.wear_level_pct) : 0;
      const wearColor = wearPct > 20 ? 'danger fw-bold' : (wearPct > 10 ? 'warning' : 'success');
      const designCap = b.design_capacity_mwh ? `${Number(b.design_capacity_mwh).toLocaleString()} mWh` : '—';
      const fullCap = b.full_charge_capacity_mwh ? `${Number(b.full_charge_capacity_mwh).toLocaleString()} mWh` : '—';

      let timeLeftStr = '';
      if (b.secs_left && b.secs_left > 0) {
        const mins = Math.floor(b.secs_left / 60);
        const hrs = (mins / 60).toFixed(1);
        timeLeftStr = `<span class="ui-badge ui-badge-info font-monospace ms-2">${hrs} ч осталось (${mins} мин)</span>`;
      }

      batContainer.innerHTML = `
        <div class="row g-3 align-items-center mb-3">
          <div class="col-12 col-md-4">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="small text-muted font-monospace"><i class="bi bi-battery-charging text-warning me-1"></i>Уровень заряда</span>
              <span class="fw-bold font-monospace text-${pctColor}">${pct}%</span>
            </div>
            <div class="about-sys-progress-track" style="height: 8px;">
              <div class="about-sys-progress-bar bg-${pctColor}" style="width: ${pct}%;"></div>
            </div>
            <div class="small text-muted mt-1 font-monospace">${isChg ? 'Подключено к адаптеру питания' : 'Автономная работа от батареи'}${timeLeftStr}</div>
          </div>
          <div class="col-12 col-md-8">
            <div class="row g-2">
              <div class="col-6 col-sm-3">
                <div class="diag-meter-card p-2">
                  <div class="small text-muted font-monospace">Заводская емкость</div>
                  <div class="fw-bold font-monospace text-body mt-0.5">${designCap}</div>
                </div>
              </div>
              <div class="col-6 col-sm-3">
                <div class="diag-meter-card p-2">
                  <div class="small text-muted font-monospace">Текущая емкость</div>
                  <div class="fw-bold font-monospace text-info mt-0.5">${fullCap}</div>
                </div>
              </div>
              <div class="col-6 col-sm-3">
                <div class="diag-meter-card p-2">
                  <div class="small text-muted font-monospace">Деградация (Износ)</div>
                  <div class="fw-bold font-monospace text-${wearColor} mt-0.5">${wearPct}% износа</div>
                </div>
              </div>
              <div class="col-6 col-sm-3">
                <div class="diag-meter-card p-2">
                  <div class="small text-muted font-monospace">Профиль питания</div>
                  <div class="fw-bold font-monospace text-body mt-0.5 text-truncate" title="${escapeHtml(b.power_profile || 'Balanced')}">${escapeHtml(b.power_profile || 'Balanced')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.warn('[AboutSystemTab] applyBatteryData error:', err);
  }
}

/**
 * Запрашивает независимую телеметрию батареи с сервера (GET /api/v1/system/diagnostics/battery).
 * @param {boolean} [forceRefresh=false] - Флаг принудительного обновления.
 */
export async function fetchBatteryWear(forceRefresh = false) {
  try {
    const data = await apiFetch('/api/v1/system/diagnostics/battery', { forceRefresh });
    if (data) {
      applyBatteryData(data);
    }
    return data;
  } catch (err) {
    console.warn('[AboutSystemTab] fetchBatteryWear error:', err);
    return null;
  }
}

/**
 * Привязка событий интерактивных элементов панели батареи.
 */
export function bindBatteryEvents() {
  const btnRefresh = document.getElementById('btn-diag-battery-refresh');
  if (btnRefresh && !btnRefresh._bound) {
    btnRefresh._bound = true;
    btnRefresh.addEventListener('click', async () => {
      const origHtml = btnRefresh.innerHTML;
      btnRefresh.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Опрос...';
      btnRefresh.disabled = true;
      try {
        if (typeof window.refreshAboutSystemData === 'function') {
          await window.refreshAboutSystemData(true);
        } else {
          await fetchBatteryWear(true);
        }
      } finally {
        btnRefresh.innerHTML = origHtml;
        btnRefresh.disabled = false;
      }
    });
  }
}
