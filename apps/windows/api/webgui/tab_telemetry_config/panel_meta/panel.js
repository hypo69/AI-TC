/**
 * Модуль панели метаинформации о файле конфигурации телеметрии.
 * Файл: apps/windows/api/webgui/tab_telemetry_config/panel_meta/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Обновляет отображение пути к файлу, даты изменения и бейджа текущего режима.
 * @param {string} path - Путь к файлу конфигурации.
 * @param {string} mtime - Дата/время последней модификации.
 * @param {string} mode - Режим сбора (hybrid / standard / etc).
 * @param {string} telemetryMode - Режим телеметрии (tc / telemetry).
 */
export function updateMeta(path, mtime, mode, telemetryMode) {
  const pathEl = document.getElementById('tc-cfg-file-path');
  if (pathEl && path) pathEl.innerText = path;

  const mtimeEl = document.getElementById('tc-cfg-mtime');
  if (mtimeEl && mtime) {
    try {
      const d = new Date(mtime);
      mtimeEl.innerText = d.toLocaleString('ru-RU');
    } catch (_) {
      mtimeEl.innerText = mtime;
    }
  }

  const tMode = (telemetryMode || 'telemetry').toUpperCase();
  const modeBadge = document.getElementById('tc-cfg-active-mode-badge');
  if (modeBadge) {
    modeBadge.innerText = `Режим: ${tMode}`;
    modeBadge.className = `badge border fs-8 ${
      tMode === 'TC' ? 'bg-warning-subtle text-warning border-warning-subtle' :
      'bg-primary-subtle text-primary border-primary-subtle'
    }`;
  }

  const currentModeStatus = document.getElementById('tc-current-mode-status');
  if (currentModeStatus) {
    currentModeStatus.innerText = tMode === 'TC' ? 'TC (РЕАЛЬНОЕ ВРЕМЯ)' : 'СТАНДАРТНЫЙ (TELEMETRY)';
    currentModeStatus.className = `badge border ${tMode === 'TC' ? 'bg-warning-subtle text-warning border-warning-subtle' : 'bg-primary-subtle text-primary border-primary-subtle'}`;
  }
}
