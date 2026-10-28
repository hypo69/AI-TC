/**
 * Модуль панели управления индикацией прогресса задач (ITaskbarList3 UX Progress).
 * Файл: apps/windows/api/webgui/tab_taskbar/panel_ux_progress/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Передает параметры индикатора прогресса окну HWND через COM ITaskbarList3.
 * @param {Function} [onUpdated] - Коллбек после применения.
 */
export async function handleApplyUxProgress(onUpdated) {
  const hwnd = parseInt(document.getElementById('select-ux-target-window')?.value || '0', 10);
  const state = document.getElementById('select-ux-progress-state')?.value || 'normal';
  const val = parseInt(document.getElementById('range-ux-progress')?.value || '50', 10);

  if (!hwnd) {
    if (window.toast) window.toast.warning('Внимание', 'Выберите целевое окно');
    return;
  }

  try {
    const res = await fetch('/api/v1/taskbar/ux/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hwnd, state, completed: val, total: 100 })
    });
    if (res.ok && window.toast) {
      window.toast.success('ITaskbarList3', `Прогресс ${val}% передан окну HWND ${hwnd}`);
      if (onUpdated) await onUpdated();
    }
  } catch (err) {
    if (window.toast) window.toast.error('Ошибка', err.message);
  }
}
