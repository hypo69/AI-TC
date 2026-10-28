/**
 * Модуль панели сводки параметров панели задач и активных окон.
 * Файл: apps/windows/api/webgui/tab_taskbar/panel_summary/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Загружает сводную информацию о панели задач и основном окне.
 */
export async function loadSummary() {
  try {
    const res = await fetch('/api/v1/taskbar/summary');
    if (!res.ok) return;
    const data = await res.json();

    const rectEl = document.getElementById('metric-tb-rect');
    if (rectEl && data.taskbar_rect) {
      rectEl.textContent = `${data.taskbar_rect.width}x${data.taskbar_rect.height} px`;
    }

    const alignEl = document.getElementById('metric-tb-align');
    if (alignEl && data.settings) {
      alignEl.textContent = data.settings.alignment === 1 ? 'По центру' : 'По левому краю';
    }

    const winEl = document.getElementById('metric-tb-windows');
    if (winEl) {
      winEl.textContent = `${data.visible_windows_count} / ${data.windows_count}`;
    }

    const fgEl = document.getElementById('metric-tb-fg');
    if (fgEl) {
      fgEl.textContent = data.foreground_window?.title || '—';
      fgEl.title = data.foreground_window?.title || '';
    }

    const osBadge = document.getElementById('tb-os-badge');
    if (osBadge) {
      osBadge.textContent = data.is_win11 ? 'Windows 11 (Center/Left Taskbar)' : 'Windows 10 / Classic';
    }
  } catch (err) {
    console.error('[TaskbarTab] Ошибка загрузки summary:', err);
  }
}
