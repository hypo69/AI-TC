/**
 * Модуль управления языковыми пакетами и часовыми поясами.
 * Файл: apps/windows/api/webgui/tab_about_system/panel_regional_network/localization.js
 * Updated: 2026-10-17 00:58:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Отрисовывает элементы выбора часового пояса с фильтрацией.
 * @param {Array<Object>} timezones - Список часовых поясов.
 * @param {string} [filterQuery=''] - Поисковая строка.
 * @param {string} [selectedTzId=''] - Выбранный ID часового пояса.
 */
export function renderTimezonesList(timezones, filterQuery = '', selectedTzId = '') {
  const tzSelect = document.getElementById('reg-tz-select');
  if (!tzSelect) return;
  const q = (filterQuery || '').toLowerCase();
  const filtered = (timezones || []).filter(tz => {
    if (!q) return true;
    return (tz.id || '').toLowerCase().includes(q) || (tz.name || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    tzSelect.innerHTML = '<option value="" disabled>Ничего не найдено</option>';
    return;
  }

  tzSelect.innerHTML = filtered.map(tz => {
    const isSel = tz.id === selectedTzId ? 'selected' : '';
    return `<option value="${escapeHtml(tz.id)}" ${isSel}>${escapeHtml(tz.name || tz.id)}</option>`;
  }).join('');

  const selLabel = document.getElementById('reg-tz-selected-label');
  if (selLabel) {
    const cur = tzSelect.value;
    selLabel.textContent = cur ? `Выбран: ${cur}` : 'Выберите пояс из списка';
  }
}

/**
 * Отрисовывает список языковых пакетов (Русский, Иврит, Английский).
 * @param {Array<Object>} packs - Список языковых пакетов.
 * @param {Function} onInstallPack - Обработчик установки пакета.
 */
export function renderLanguagePacksList(packs = [], onInstallPack = null) {
  const container = document.getElementById('reg-lang-packs-container');
  if (!container) return;

  const defaultPacks = [
    { tag: 'ru-RU', name: 'Русский (Russian)', native_name: 'Русский', is_installed: false, is_active: false },
    { tag: 'he-IL', name: 'עברית (Hebrew)', native_name: 'עברית', is_installed: false, is_active: false },
    { tag: 'en-US', name: 'English (United States)', native_name: 'English', is_installed: false, is_active: false },
  ];

  const packMap = new Map();
  defaultPacks.forEach(p => packMap.set(p.tag.toLowerCase(), { ...p }));

  if (Array.isArray(packs) && packs.length > 0) {
    packs.forEach(p => {
      const key = (p.tag || '').toLowerCase();
      if (packMap.has(key)) {
        packMap.set(key, { ...packMap.get(key), ...p });
      } else {
        packMap.set(key, { ...p });
      }
    });
  }

  const items = Array.from(packMap.values());

  const flagIcons = {
    'ru-ru': '🇷🇺',
    'he-il': '🇮🇱',
    'en-us': '🇺🇸',
    'en-gb': '🇬🇧',
  };

  container.innerHTML = items.map(p => {
    const tagLower = (p.tag || '').toLowerCase();
    const flag = flagIcons[tagLower] || '🌐';
    const isInstalled = !!p.is_installed;
    const isActive = !!p.is_active;

    let statusBadge = '';
    if (isInstalled) {
      statusBadge = `<span class="badge border border-success text-success bg-transparent py-0.5 px-2">
        <i class="bi bi-check-circle-fill me-1"></i>Установлен
      </span>`;
    } else {
      statusBadge = `<span class="badge border border-secondary text-muted bg-transparent py-0.5 px-2">
        <i class="bi bi-dash-circle me-1"></i>Не установлен
      </span>`;
    }

    let activeBadge = '';
    if (isActive) {
      activeBadge = `<span class="badge border border-info text-info bg-transparent py-0.5 px-2 ms-1">
        <i class="bi bi-keyboard-fill me-1"></i>В раскладке
      </span>`;
    }

    let actionBtn = '';
    if (isInstalled && isActive) {
      actionBtn = `<button class="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-0.5 font-monospace" disabled title="Язык уже установлен и активен">
        <i class="bi bi-check2-all me-1 text-success"></i>Подключен
      </button>`;
    } else if (isInstalled && !isActive) {
      actionBtn = `<button class="btn btn-sm btn-outline-info rounded-pill px-2.5 py-0.5 font-monospace btn-install-lang-pack" data-tag="${escapeHtml(p.tag)}" title="Добавить в раскладки ввода пользователя">
        <i class="bi bi-plus-lg me-1"></i>Активировать
      </button>`;
    } else {
      actionBtn = `<button class="btn btn-sm btn-info text-dark fw-semibold rounded-pill px-2.5 py-0.5 font-monospace btn-install-lang-pack" data-tag="${escapeHtml(p.tag)}" title="Установить языковой пакет в Windows">
        <i class="bi bi-cloud-arrow-down me-1"></i>Установить
      </button>`;
    }

    return `
      <div class="col-12 col-md-4">
        <div class="p-2.5 rounded border h-100 d-flex flex-column justify-content-between" style="background: var(--surface-1); border-color: var(--border-color) !important;">
          <div>
            <div class="d-flex align-items-center justify-content-between mb-1.5">
              <div class="d-flex align-items-center gap-1.5">
                <span style="font-size: 1.25rem; line-height: 1;">${flag}</span>
                <span class="fw-bold small text-body">${escapeHtml(p.native_name || p.name)}</span>
              </div>
              <span class="badge font-monospace text-muted border border-secondary-subtle py-0 px-1.5" style="background: var(--surface-2); font-size: 0.72rem;">${escapeHtml(p.tag)}</span>
            </div>
            <div class="text-truncate text-muted small mb-2" style="font-size: 0.78rem;">
              ${escapeHtml(p.name)}
            </div>
            <div class="d-flex align-items-center flex-wrap gap-1 mb-2">
              ${statusBadge}
              ${activeBadge}
            </div>
          </div>
          <div class="pt-2 border-top d-flex justify-content-end" style="border-color: var(--border-color) !important;">
            ${actionBtn}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (onInstallPack) {
    container.querySelectorAll('.btn-install-lang-pack').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const tag = btn.getAttribute('data-tag');
        if (!tag) return;
        await onInstallPack(tag, btn);
      };
    });
  }
}
