/**
 * Модуль управления языковыми пакетами (Русский, Иврит, Английский),
 * клавиатурными раскладками и часовыми поясами.
 * Файл: apps/windows/api/webgui/tab_about_system/panel_regional_network/localization.js
 * Updated: 2026-10-28 14:32:00
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
 * Форматирует сводную строку активных языков и раскладок для карточки «О системе».
 * @param {Array<Object>} packs - Список языковых пакетов.
 * @returns {string} Человекочитаемая сводка раскладок.
 */
export function formatActivePacksSummary(packs = []) {
  if (!Array.isArray(packs) || packs.length === 0) {
    return 'Русский (RU), English (US), עברית (IL)';
  }
  const active = [...packs]
    .filter(p => p.is_active)
    .sort((a, b) => (a.order_index || 99) - (b.order_index || 99));

  if (active.length === 0) {
    return 'Русский (RU), English (US), עברית (IL)';
  }

  return active.map(p => {
    const layouts = Array.isArray(p.keyboard_layouts) ? p.keyboard_layouts : [];
    const layoutNames = layouts.map(l => l.name || l.klid).filter(Boolean);
    const shortTag = (p.tag || '').split('-')[0].toUpperCase();
    const defMark = p.is_default_input ? '★ ' : '';
    if (layoutNames.length > 1) {
      return `${defMark}${p.native_name || shortTag} [${shortTag}: ${layoutNames.length} раскл.]`;
    }
    return `${defMark}${p.native_name || shortTag} [${shortTag}]`;
  }).join(' • ');
}

/**
 * Отрисовывает карточки управления тройкой языковых пакетов (Русский, Иврит, Английский)
 * и их клавиатурными раскладками.
 * @param {Array<Object>} packs - Список языковых пакетов с раскладками.
 * @param {Function} onManagePack - Обработчик действий: (tag, action, klid, btnEl) => Promise<void>.
 */
export function renderLanguagePacksList(packs = [], onManagePack = null) {
  const container = document.getElementById('reg-lang-packs-container');
  if (!container) return;

  const defaultPacks = [
    {
      tag: 'ru-RU',
      name: 'Русский (Россия)',
      native_name: 'Русский',
      lcid: '0419',
      is_installed: false,
      is_active: false,
      is_display_language: false,
      is_default_input: false,
      order_index: 0,
      keyboard_layouts: [],
      available_layouts: [
        { klid: '00000419', name: 'Русская (Стандартная ЙЦУКЕН)', preload_slot: 0, is_default: true },
        { klid: '00010419', name: 'Русская (Машинопись)', preload_slot: 0, is_default: false },
        { klid: '00020419', name: 'Русская (Мнемоническая)', preload_slot: 0, is_default: false },
        { klid: 'a0000419', name: 'Русская фонетическая (WinRus Student)', preload_slot: 0, is_default: false },
      ],
    },
    {
      tag: 'he-IL',
      name: 'Иврит (Израиль)',
      native_name: 'עברית (Hebrew)',
      lcid: '040D',
      is_installed: false,
      is_active: false,
      is_display_language: false,
      is_default_input: false,
      order_index: 0,
      keyboard_layouts: [],
      available_layouts: [
        { klid: '0002040D', name: 'Иврит (Стандартная, SI-1452)', preload_slot: 0, is_default: true },
        { klid: '0000040D', name: 'Иврит (Традиционная)', preload_slot: 0, is_default: false },
      ],
    },
    {
      tag: 'en-US',
      name: 'Английский (США)',
      native_name: 'English (United States)',
      lcid: '0409',
      is_installed: false,
      is_active: false,
      is_display_language: false,
      is_default_input: false,
      order_index: 0,
      keyboard_layouts: [],
      available_layouts: [
        { klid: '00000409', name: 'Английская США (QWERTY)', preload_slot: 0, is_default: true },
        { klid: '00020409', name: 'Английская США (Международная)', preload_slot: 0, is_default: false },
        { klid: '00010409', name: 'Английская США (Dvorak)', preload_slot: 0, is_default: false },
      ],
    },
  ];

  const packMap = new Map();
  defaultPacks.forEach(p => packMap.set(p.tag.toLowerCase(), { ...p }));

  if (Array.isArray(packs) && packs.length > 0) {
    packs.forEach(p => {
      const key = (p.tag || '').toLowerCase();
      if (packMap.has(key)) {
        const base = packMap.get(key);
        packMap.set(key, {
          ...base,
          ...p,
          keyboard_layouts: Array.isArray(p.keyboard_layouts) ? p.keyboard_layouts : base.keyboard_layouts,
          available_layouts: (Array.isArray(p.available_layouts) && p.available_layouts.length > 0)
            ? p.available_layouts
            : base.available_layouts,
        });
      } else {
        packMap.set(key, { ...p });
      }
    });
  }

  const items = Array.from(packMap.values());
  const activeCount = items.filter(x => x.is_active).length;

  const flagIcons = {
    'ru-ru': '🇷🇺',
    'he-il': '🇮🇱',
    'en-us': '🇺🇸',
    'en-gb': '🇬🇧',
  };

  container.innerHTML = items.map(p => {
    const tag = p.tag || '';
    const tagLower = tag.toLowerCase();
    const flag = flagIcons[tagLower] || '🌐';
    const isInstalled = !!p.is_installed;
    const isActive = !!p.is_active;
    const isDisplay = !!p.is_display_language;
    const isDefaultInput = !!p.is_default_input;
    const orderIdx = Number(p.order_index || 0);
    const lcid = p.lcid || '';

    const activeLayouts = Array.isArray(p.keyboard_layouts) ? p.keyboard_layouts : [];
    const activeKlids = new Set(activeLayouts.map(l => String(l.klid || '').toUpperCase()));
    const availableLayouts = (Array.isArray(p.available_layouts) ? p.available_layouts : [])
      .filter(av => !activeKlids.has(String(av.klid || '').toUpperCase()));

    // Бейджи статусов пакета
    const muiBadge = isInstalled
      ? `<span class="badge border border-success text-success bg-transparent py-0.5 px-2" title="Языковой пакет MUI установлен в системе">
          <i class="bi bi-box-seam-fill me-1"></i>MUI установлен
         </span>`
      : `<span class="badge border border-warning text-warning bg-transparent py-0.5 px-2" title="Пакет интерфейса MUI не установлен">
          <i class="bi bi-cloud-slash me-1"></i>MUI не установлен
         </span>`;

    const inputOrderBadge = isActive
      ? `<span class="badge ${isDefaultInput ? 'border border-info text-info' : 'border border-secondary text-body'} bg-transparent py-0.5 px-2" title="Порядок переключения языка ввода (Alt+Shift / Win+Space)">
          <i class="bi bi-keyboard-fill me-1"></i>${isDefaultInput ? 'Ввод #1 (По умолч.)' : `Ввод #${orderIdx || '?'}`}
         </span>`
      : `<span class="badge border border-secondary text-muted bg-transparent py-0.5 px-2">
          <i class="bi bi-slash-circle me-1"></i>Ввод отключен
         </span>`;

    const displayBadge = isDisplay
      ? `<span class="badge border border-primary text-primary bg-transparent py-0.5 px-2" title="Текущий язык интерфейса Windows (Display Language)">
          <i class="bi bi-window-desktop me-1"></i>Язык интерфейса ОС
         </span>`
      : '';

    // Список активных клавиатурных раскладок
    let layoutsHtml = '';
    if (activeLayouts.length > 0) {
      layoutsHtml = activeLayouts.map(l => {
        const klidStr = String(l.klid || '').toUpperCase();
        const slotBadge = l.preload_slot
          ? `<span class="badge bg-secondary-subtle text-muted font-monospace py-0 px-1 me-1" title="Слот в HKCU\\Keyboard Layout\\Preload">#${l.preload_slot}</span>`
          : '';
        const canRemove = activeLayouts.length > 1;
        const removeBtn = canRemove
          ? `<button type="button" class="btn btn-sm btn-link text-danger p-0 ms-1 btn-lang-pack-action"
                data-tag="${escapeHtml(tag)}" data-action="remove_layout" data-klid="${escapeHtml(klidStr)}"
                title="Удалить раскладку ${escapeHtml(l.name)} [${escapeHtml(klidStr)}]">
                <i class="bi bi-x-circle"></i>
             </button>`
          : `<span class="text-muted small ms-1" title="Базовая раскладка языка"><i class="bi bi-lock-fill" style="font-size: 0.7rem;"></i></span>`;

        return `
          <div class="d-flex align-items-center justify-content-between py-1 px-2 rounded border mb-1" style="background: var(--surface-2); border-color: var(--border-color) !important;">
            <div class="d-flex align-items-center text-truncate me-1" style="font-size: 0.78rem;">
              ${slotBadge}
              <i class="bi bi-keyboard text-info me-1.5"></i>
              <span class="text-body text-truncate" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>
            </div>
            <div class="d-flex align-items-center flex-shrink-0">
              <span class="badge font-monospace text-muted border border-secondary-subtle py-0 px-1" style="font-size: 0.68rem;" title="Keyboard Layout ID (KLID)">${escapeHtml(klidStr)}</span>
              ${removeBtn}
            </div>
          </div>
        `;
      }).join('');
    } else {
      layoutsHtml = `
        <div class="text-muted small fst-italic py-1.5 px-2 rounded border text-center mb-1" style="background: var(--surface-2); border-color: var(--border-color) !important; font-size: 0.76rem;">
          Нет активных раскладок клавиатуры
        </div>
      `;
    }

    // Блок добавления дополнительной раскладки
    let addLayoutHtml = '';
    if (availableLayouts.length > 0) {
      const selectId = `reg-add-klid-${escapeHtml(tagLower)}`;
      const opts = availableLayouts.map(av =>
        `<option value="${escapeHtml(av.klid)}">${escapeHtml(av.name)} [${escapeHtml(av.klid)}]</option>`
      ).join('');
      addLayoutHtml = `
        <div class="input-group input-group-sm mt-1.5">
          <select id="${selectId}" class="form-select form-select-sm bg-dark text-body border-secondary font-monospace" style="font-size: 0.73rem;">
            ${opts}
          </select>
          <button type="button" class="btn btn-sm btn-outline-info px-2 btn-lang-pack-add-layout"
            data-tag="${escapeHtml(tag)}" data-select-id="${selectId}"
            title="Добавить выбранную раскладку клавиатуры">
            <i class="bi bi-plus-lg"></i> Раскладка
          </button>
        </div>
      `;
    }

    // Кнопки управления пакетом
    const btnDefaultInput = (isActive && !isDefaultInput)
      ? `<button type="button" class="btn btn-sm btn-outline-info py-0.5 px-2 font-monospace btn-lang-pack-action"
          data-tag="${escapeHtml(tag)}" data-action="set_default_input"
          title="Сделать основным языком ввода по умолчанию (#1)">
          <i class="bi bi-star me-1"></i>Сделать #1
         </button>`
      : (isDefaultInput
        ? `<span class="badge bg-info-subtle text-info border border-info border-opacity-25 py-1 px-2 font-monospace">
            <i class="bi bi-star-fill me-1"></i>Основной ввод (#1)
           </span>`
        : '');

    const btnDisplayLang = !isDisplay
      ? `<button type="button" class="btn btn-sm btn-outline-primary py-0.5 px-2 font-monospace btn-lang-pack-action"
          data-tag="${escapeHtml(tag)}" data-action="set_display_language"
          title="Установить как язык интерфейса Windows (потребуется перезаход в систему)">
          <i class="bi bi-window-desktop me-1"></i>Интерфейс ОС
         </button>`
      : '';

    let btnPrimaryToggle = '';
    if (!isInstalled && !isActive) {
      btnPrimaryToggle = `
        <button type="button" class="btn btn-sm btn-info text-dark fw-semibold py-0.5 px-2.5 font-monospace btn-lang-pack-action"
          data-tag="${escapeHtml(tag)}" data-action="install"
          title="Установить языковой пакет и включить раскладку">
          <i class="bi bi-cloud-arrow-down me-1"></i>Установить пакет
        </button>`;
    } else if (!isActive) {
      btnPrimaryToggle = `
        <button type="button" class="btn btn-sm btn-outline-success py-0.5 px-2.5 font-monospace btn-lang-pack-action"
          data-tag="${escapeHtml(tag)}" data-action="activate"
          title="Включить язык в список раскладок ввода">
          <i class="bi bi-plus-circle me-1"></i>Включить ввод
        </button>`;
    } else if (activeCount > 1) {
      btnPrimaryToggle = `
        <button type="button" class="btn btn-sm btn-outline-secondary py-0.5 px-2 font-monospace btn-lang-pack-action"
          data-tag="${escapeHtml(tag)}" data-action="deactivate"
          title="Убрать язык из активного списка переключения раскладок">
          <i class="bi bi-dash-circle me-1"></i>Отключить
        </button>`;
    }

    return `
      <div class="col-12 col-lg-4">
        <div class="p-2.5 rounded border h-100 d-flex flex-column justify-content-between" style="background: var(--surface-1); border-color: var(--border-color) !important;">
          <div>
            <!-- Шапка карточки языка -->
            <div class="d-flex align-items-center justify-content-between mb-1">
              <div class="d-flex align-items-center gap-1.5">
                <span style="font-size: 1.35rem; line-height: 1;">${flag}</span>
                <div>
                  <div class="fw-bold small text-body lh-sm">${escapeHtml(p.native_name || p.name)}</div>
                  <div class="text-muted" style="font-size: 0.74rem;">${escapeHtml(p.name)}</div>
                </div>
              </div>
              <div class="text-end">
                <span class="badge font-monospace text-info border border-info-subtle py-0.5 px-1.5" style="background: var(--surface-2); font-size: 0.72rem;">${escapeHtml(tag)}</span>
                ${lcid ? `<div class="text-muted font-monospace mt-0.5" style="font-size: 0.65rem;">LCID: ${escapeHtml(lcid)}</div>` : ''}
              </div>
            </div>

            <!-- Статусы пакета -->
            <div class="d-flex align-items-center flex-wrap gap-1 my-2">
              ${muiBadge}
              ${inputOrderBadge}
              ${displayBadge}
            </div>

            <!-- Секция раскладок клавиатуры -->
            <div class="mt-2 pt-2 border-top" style="border-color: var(--border-color) !important;">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <span class="small fw-semibold text-muted" style="font-size: 0.74rem;">
                  <i class="bi bi-keyboard me-1"></i>Раскладки клавиатуры (${activeLayouts.length}):
                </span>
              </div>
              ${layoutsHtml}
              ${addLayoutHtml}
            </div>
          </div>

          <!-- Панель действий с языковым пакетом -->
          <div class="pt-2 mt-2.5 border-top d-flex align-items-center justify-content-between flex-wrap gap-1" style="border-color: var(--border-color) !important;">
            <div class="d-flex align-items-center flex-wrap gap-1">
              ${btnDefaultInput}
              ${btnDisplayLang}
            </div>
            <div>
              ${btnPrimaryToggle}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (onManagePack) {
    container.querySelectorAll('.btn-lang-pack-action').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const tag = btn.getAttribute('data-tag');
        const action = btn.getAttribute('data-action') || 'activate';
        const klid = btn.getAttribute('data-klid') || '';
        if (!tag) return;
        await onManagePack(tag, action, klid, btn);
      };
    });

    container.querySelectorAll('.btn-lang-pack-add-layout').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const tag = btn.getAttribute('data-tag');
        const selectId = btn.getAttribute('data-select-id');
        const selEl = selectId ? document.getElementById(selectId) : null;
        const klid = selEl ? selEl.value : '';
        if (!tag || !klid) return;
        await onManagePack(tag, 'add_layout', klid, btn);
      };
    });
  }
}
