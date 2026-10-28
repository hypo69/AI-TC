/**
 * Модуль панели показателей сессий питания и таймера времени работы системы (Uptime).
 * Файл: apps/windows/api/webgui/tab_power_lifecycle/panel_summary/panel.js
 * Updated: 2026-10-17 01:55:00
 */

let uptimeSeconds = 0;
let uptimeInterval = null;

/**
 * Отрисовывает верхние карточки сводки сессий питания.
 * @param {Object} summary - Сводка от бэкенда.
 */
export function renderSummary(summary) {
  if (!summary) return;

  const curBootEl = document.getElementById('pwr-current-boot');
  if (curBootEl) curBootEl.textContent = `Загрузка: ${summary.current_boot_time || '--'}`;

  const curUptimeEl = document.getElementById('pwr-current-uptime');
  if (curUptimeEl) {
    curUptimeEl.textContent = summary.current_uptime_human || '--';
    uptimeSeconds = summary.current_uptime_seconds || 0;
  }

  const totalSessionsEl = document.getElementById('pwr-total-sessions');
  if (totalSessionsEl) totalSessionsEl.textContent = summary.total_sessions_count;

  const totalBadge = document.getElementById('pwr-total-sessions-badge');
  if (totalBadge) totalBadge.textContent = `${summary.total_sessions_count} Сессий`;

  const cleanCountEl = document.getElementById('pwr-clean-count');
  if (cleanCountEl) cleanCountEl.textContent = summary.clean_shutdowns_count;

  const cleanRatioEl = document.getElementById('pwr-clean-ratio');
  if (cleanRatioEl) {
    const total = summary.total_sessions_count || 1;
    const ratio = Math.round((summary.clean_shutdowns_count / total) * 100);
    cleanRatioEl.textContent = `${ratio} %`;
  }

  const lastInitEl = document.getElementById('pwr-last-initiator');
  if (lastInitEl) {
    lastInitEl.textContent = `Инициатор: ${summary.last_initiator || 'Штатный'}`;
  }

  const unexpCountEl = document.getElementById('pwr-unexpected-count');
  if (unexpCountEl) unexpCountEl.textContent = summary.unexpected_shutdowns_count;

  const unexpBadge = document.getElementById('pwr-unexpected-badge');
  if (unexpBadge) {
    unexpBadge.textContent = `${summary.unexpected_shutdowns_count} Сбоев`;
    if (summary.unexpected_shutdowns_count > 0) {
      unexpBadge.className = 'badge bg-danger font-monospace';
    } else {
      unexpBadge.className = 'badge bg-success font-monospace';
    }
  }

  const bsodEl = document.getElementById('pwr-bsod-count');
  if (bsodEl) bsodEl.textContent = `BSOD (1001): ${summary.bsod_count || 0}`;
}

/**
 * Запускает локальный секундный таймер для активного аптайма.
 */
export function startUptimeCounter() {
  if (uptimeInterval) clearInterval(uptimeInterval);
  uptimeInterval = setInterval(() => {
    uptimeSeconds += 1;
    const curUptimeEl = document.getElementById('pwr-current-uptime');
    if (curUptimeEl && uptimeSeconds > 0) {
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const sec = Math.floor(uptimeSeconds % 60);
      const parts = [];
      if (days > 0) parts.push(`${days}д`);
      if (hours > 0 || days > 0) parts.push(`${hours}ч`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}м`);
      parts.push(`${sec}с`);
      curUptimeEl.textContent = parts.join(' ');
    }
  }, 1000);
}
