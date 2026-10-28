/**
 * Модуль панели выбора источников телеметрии.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/panel_sources/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Загрузка списка доступных файлов источников телеметрии.
 */
export async function loadSources() {
  const select = document.getElementById('tr-select-source');
  if (!select) return;

  try {
    const res = await fetch('/apps/telemetry_research/sources');
    if (!res.ok) return;
    const files = await res.json();
    select.innerHTML = '<option value="">Все доступные логи телеметрии</option>';
    (files || []).forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.path;
      const sizeKb = (f.size_bytes / 1024).toFixed(1);
      opt.textContent = `${f.name} (${sizeKb} KB)`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('[TelemetryResearch] Ошибка загрузки источников:', err);
  }
}
