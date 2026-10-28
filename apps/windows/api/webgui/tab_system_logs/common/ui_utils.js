/**
 * =============================================================================
 * Название: Вспомогательные утилиты интерфейса системных логов
 * =============================================================================
 * Описание:
 *   Экранирование HTML, сопоставление уровней важности со стилями бейджей,
 *   а также работа с локальным кешем журнала в localStorage браузера.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/common/ui_utils.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

export const BROWSER_CACHE_PREFIX = 'ai_win_log_cache_';

/**
 * Возвращает ключ локального кеша для канала журнала.
 * @param {string} channel - Имя журнала.
 * @returns {string} Ключ в localStorage.
 */
export function getBrowserCacheKey(channel) {
  return `${BROWSER_CACHE_PREFIX}${channel || 'System'}`;
}

/**
 * Сохраняет события журнала в локальный кеш браузера.
 * @param {string} channel - Имя журнала.
 * @param {Array} events - Список событий.
 */
export function saveLogToBrowserCache(channel, events) {
  try {
    const payload = {
      channel: channel || 'System',
      cachedAt: Date.now(),
      cachedAtFormatted: new Date().toLocaleString('ru-RU'),
      events: events || []
    };
    localStorage.setItem(getBrowserCacheKey(channel), JSON.stringify(payload));
    updateCacheDateBadge(payload.cachedAtFormatted);
  } catch (e) {
    console.warn('Не удалось сохранить журнал в кеш браузера (localStorage):', e);
  }
}

/**
 * Загружает события журнала из локального кеша браузера.
 * @param {string} channel - Имя журнала.
 * @returns {Object|null} Кешированные данные или null.
 */
export function loadLogFromBrowserCache(channel) {
  try {
    const raw = localStorage.getItem(getBrowserCacheKey(channel));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Ошибка чтения журнала из кеша браузера:', e);
    return null;
  }
}

/**
 * Обновляет бейдж даты и времени локального кеша в шапке панели.
 * @param {string} formattedDate - Отформатированная строка даты.
 */
export function updateCacheDateBadge(formattedDate) {
  const badge = document.getElementById('slc-cache-date-badge');
  const label = document.getElementById('slc-cache-date-text');
  if (badge && label) {
    if (formattedDate) {
      label.textContent = `Кеш: ${formattedDate}`;
      badge.classList.remove('d-none');
      badge.classList.add('d-inline-flex');
    } else {
      badge.classList.add('d-none');
      badge.classList.remove('d-inline-flex');
    }
  }
}

/**
 * Экранирует специальные символы HTML для предотвращения XSS.
 * @param {string} str - Исходный текст.
 * @returns {string} Безопасный текст.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Сопоставляет уровень важности записи журнала со стилевым классом бейджа.
 * @param {string} level - Уровень важности (Critical, Error, Warning, Information, Verbose).
 * @returns {string} CSS-класс для бейджа.
 */
export function getSeverityClass(level) {
  const lvl = (level || '').toLowerCase();
  if (lvl.includes('crit')) return 'badge-crit';
  if (lvl.includes('err')) return 'badge-err';
  if (lvl.includes('warn')) return 'badge-warn';
  if (lvl.includes('verb')) return 'badge-verb';
  return 'badge-inf';
}
