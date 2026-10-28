/**
 * =============================================================================
 * Process Name: Windows App Internals - Common UI Utilities
 * =============================================================================
 * Description:
 *   Общие утилиты интерфейса вкладки «Внутренняя кухня»: навигация по URL hash,
 *   нормализация идентификаторов панелей, динамическая загрузка скриптов и системные нотификации.
 *
 * File: ui_utils.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_app_internals/common
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 15:25:00
 * =============================================================================
 */

export const TAB_ID = 'tab-app-internals';

/**
 * Проверяет, активна ли данная вкладка в текущий момент.
 * @returns {boolean} Флаг активности вкладки.
 */
export function isAppInternalsTabActive() {
  if (typeof document !== 'undefined' && document.hidden) {
    return false;
  }
  if (typeof window.isTabActive === 'function') {
    return Boolean(window.isTabActive(TAB_ID) || window.isTabActive('app-internals'));
  }
  const pane = document.getElementById(TAB_ID) || document.getElementById('app-internals');
  return pane ? pane.classList.contains('active') : false;
}

/**
 * Нормализует строковый идентификатор или алиас суб-панели к каноническому виду.
 * @param {string} rawId - Сырой идентификатор панели.
 * @returns {string} Канонический идентификатор панели.
 */
export function normalizeSubTabId(rawId) {
  if (!rawId) return 'telemetry';
  const s = String(rawId).toLowerCase().trim().replace(/^#/, '');
  if (s.includes('telemetry') || s.includes('metric') || s.includes('cpu')) return 'telemetry';
  if (s.includes('model') || s.includes('provider') || s.includes('foundry') || s.includes('ollama')) return 'models';
  if (s.includes('log-setting') || s.includes('logging-setting')) return 'settings';
  if (s.includes('log') || s.includes('journal')) return 'logs';
  if (s.includes('etw') || s.includes('tracing') || s.includes('trace') || s.includes('perf')) return 'etw';
  if (s.includes('setting') || (s.includes('param') && !s.includes('wikillm'))) return 'settings';
  if (s.includes('instrument') || s.includes('tool')) return 'instruments';
  if (s.includes('editor') || s.includes('article') || s.includes('knowledge') || s.includes('statya')) return 'wikillm-editor';
  if (s.includes('wikillm-param') || s.includes('wikillm_param') || s.includes('model-param')) return 'wikillm-params';
  if (s.includes('wikillm-db') || s.includes('wikillm_db') || s.includes('wikillm') || s.includes('mariadb')) return 'wikillm-db';
  return 'telemetry';
}

/**
 * Возвращает идентификатор текущей активной суб-панели.
 * @returns {string} Канонический ID суб-панели.
 */
export function getActiveSubTabId() {
  const activeBtn = document.querySelector('#app-internals-subtabs-nav button.active');
  if (activeBtn) {
    const pId = activeBtn.getAttribute('data-panel-id');
    if (pId) return normalizeSubTabId(pId);
    const target = activeBtn.getAttribute('data-bs-target') || '';
    return normalizeSubTabId(target);
  }
  return 'telemetry';
}

/**
 * Считывает суб-панель из URL hash (#tab-app-internals#<panel_id>).
 * @returns {string|null} ID субпанели или null.
 */
export function getPanelFromHash() {
  const hash = (typeof location !== 'undefined' ? location.hash : '') || '';
  if (!hash) return null;
  const cleanHash = hash.replace(/^#/, '');
  const parts = cleanHash.split('#');
  if (parts.length >= 2) {
    const mainPart = parts[0];
    if (mainPart === TAB_ID || mainPart === 'app-internals' || mainPart === 'tab-app-internals') {
      return normalizeSubTabId(parts[1]);
    }
  } else if (parts.length === 1) {
    const single = parts[0];
    if (single !== TAB_ID && single !== 'app-internals' && single !== 'tab-app-internals') {
      const norm = normalizeSubTabId(single);
      if (norm) return norm;
    }
  }
  return null;
}

/**
 * Обновляет URL hash активной суб-панелью (#tab-app-internals#<panel_id>) без перезагрузки страницы.
 * @param {string} panelId - Идентификатор панели.
 */
export function updateUrlWithPanel(panelId) {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const canonical = normalizeSubTabId(panelId);
  const search = location.search || '';
  const newHash = `#${TAB_ID}#${canonical}`;
  if (location.hash !== newHash) {
    try {
      history.replaceState(null, null, `${location.pathname}${search}${newHash}`);
    } catch (_) {}
  }
}

/**
 * Динамическая загрузка и выполнение скрипта модуля с ожиданием onload.
 * @param {string} src - Путь к файлу скрипта
 * @returns {Promise<void>}
 */
export function loadScript(src) {
  return new Promise((resolve) => {
    const cleanSrc = src.split('?')[0];
    const existing = document.querySelector(`script[src^="${cleanSrc}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (err) => {
      console.warn(`[AppInternals] Не удалось загрузить скрипт ${src}:`, err);
      resolve();
    };
    document.body.appendChild(s);
  });
}

/**
 * Отображение всплывающего уведомления toast.
 * @param {string} message - Текст уведомления
 * @param {'info' | 'success' | 'warning' | 'danger'} [type='info'] - Тип уведомления
 */
export function notifyUser(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.info(`[AppInternals Toast: ${type}] ${message}`);
  }
}
