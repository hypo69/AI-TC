<!--
=============================================================================
Process Name: Standards - WebGUI Engineering & Architecture Rules
=============================================================================
Description:
  Инженерный стандарт и свод обязательных правил разработки веб-интерфейсов (WebGUI)
  в экосистеме AI Windows Admin (оболочки /tc, /admin, /, модули вкладок tab_<tab_id>).

File: WEBGUI.md
Project: ai-windows-admin
Package: .ai/instructions/standards
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-15 17:05:00
=============================================================================
-->

# 🌐 Стандарт разработки веб-интерфейса (WebGUI) v1.1

**Статус:** ✅ Active  
**Версия:** 1.1 (Tab_<tab_id> & Sitemap Architecture Edition)  
**Автор:** hypo69  
**Copyright:** © 2026 hypo69  
**Область действия:** `apps/windows/api/webgui/`, все оболочки (`/`, `/tc`, `/admin`, `/chat`, `/helpdesk`) и вкладки `tab_<tab_id>`.

---

## 📋 Содержание
1. [RFC 2119 Ключевые требования](#1-rfc-2119-ключевые-требования)
2. [Архитектура Shell и Вкладок (Tabs)](#2-архитектура-shell-и-вкладок-tabs)
3. [Навигация и контракт атрибутов](#3-навигация-и-контракт-атрибутов)
4. [Жизненный цикл вкладки и Active-Only Polling](#4-жизненный-цикл-вкладки-и-active-only-polling)
5. [Стандарт тем оформления и адаптивность CSS](#5-стандарт-тем-оформления-и-адаптивность-css)
6. [Универсальное модальное окно ИИ (AIModalDialog)](#6-универсальное-модальное-окно-ии-aimodaldialog)
7. [Реестр вкладок (SSOT), меню и Карта сайта (Sitemap)](#7-реестр-вкладок-ssot-меню-и-карта-сайта-sitemap)
8. [Версионирование и Cache-Busting](#8-версионирование-и-cache-busting)
9. [Чек-лист проверки WebGUI](#9-чек-лист-проверки-webgui)

---

## 1. RFC 2119 Ключевые требования

- **MUST (ОБЯЗАТЕЛЬНО)**:
  - Все новые вкладки **MUST** располагаться строго в каталогах с шаблоном названия `tab_<tab_id>/` (например: `tab_about_system`, `tab_defender`, `tab_sitemap`, `tab_chat`).
  - При любых изменениях состава или функционала вкладок **MUST** актуализироваться интерактивная карта сайта `tab_sitemap` (`sitemap_data.json` через `generate_sitemap_data.py`).
  - Файл `index.html` вкладки **MUST NOT** содержать тегов `<script>` (только разметка).
  - Навигация **MUST** осуществляться исключительно через атрибут `data-tab="tab-xxx"`.
  - Любой периодический опрос API **MUST** регистрироваться через `window.registerTabPoller()`.
  - Все комментарии к коду, docstrings и документация **MUST** быть написаны на русском языке.
  - В шапке каждого изменяемого файла **MUST** обновляться временная метка `Updated: YYYY-MM-DD HH:MM:SS`.

- **MUST NOT (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)**:
  - **MUST NOT** использовать `setInterval(...)` для запросов телеметрии внутри вкладок (ведет к утечкам ресурсов и блокировке UI при скрытой вкладке).
  - **MUST NOT** использовать `data-bs-target`, `data-bs-toggle="tab"` или инлайн-обработчики `onclick="..."` для переключения вкладок.
  - **MUST NOT** хардкодить цвета, фоны, рамки и статусы (`style="color:...", style="background:..."`, HEX `#facc15`, `#12151a`, RGB/RGBA, классы `bg-black`, `bg-dark`, `text-white`). Всё оформление — ТОЛЬКО через механизм тем (`var(--...)`) и стандартные классы дизайн-системы (`ui-badge`, `ui-card` и др.).
  - **MUST NOT** оставлять необработанные ошибки API без информирования пользователя (`window.toast`).

---

## 2. Архитектура Shell и Вкладок (Tabs)

Веб-интерфейс AI Windows Admin построен по модели компонуемых оболочек (Shells) с динамической ленивой загрузкой вкладок (Lazy Load):

```
apps/windows/api/webgui/
├── core/
│   └── tab-registry.js          # Единый реестр вкладок экосистемы (SSOT)
├── js/
│   ├── tab-core.js              # Ядро переключения вкладок и управления поллингом
│   ├── theme-engine.js          # Управление палитрами и переключением тем
│   ├── i18n.js                  # Интернационализация интерфейса
│   └── toast.js                 # Централизованные всплывающие уведомления
├── ai_modal_dialog/             # Универсальное окно ИИ-инспекции и WikiLLM
├── tab_sitemap/                 # Интерактивная карта сайта (реестр всех вкладок)
├── templates/tab_template/      # Эталонный шаблон новой вкладки
└── tab_<tab_id>/                # Модуль конкретной вкладки (строгий шаблон tab_<tab_id>)
    ├── index.html               # Чистая разметка вкладки
    ├── main.js                  # Контроллер вкладки: init<Name>Tab, deactivate<Name>Tab
    └── README.md                # Документация модуля
```

---

## 3. Навигация и контракт атрибутов

### 3.1 Кнопки и триггеры переключения
Переключение вкладок выполняется глобальным диспетчером `tab-core.js`. Единственным разрешенным триггером является атрибут `data-tab`:

```html
<!-- ✅ ПРАВИЛЬНО -->
<button type="button" class="btn btn-outline-primary" data-tab="tab-system-inspector">
  <i class="bi bi-graph-up"></i> Инспектор
</button>

<!-- ❌ ЗАПРЕЩЕНО -->
<button type="button" data-bs-target="#tab-system-inspector" data-bs-toggle="tab">...</button>
<button type="button" onclick="switchTab('tab-system-inspector')">...</button>
<a href="#tab-system-inspector">...</a>
```

### 3.2 Контейнеры вкладок
- Панель вкладки **MUST** иметь атрибуты: `id="tab-<name>"` и класс `class="tab-pane fade"`.
- Контейнер всех панелей: `<div id="mainTabContent" class="tab-content">`.

---

## 4. Жизненный цикл вкладки и Active-Only Polling

### 4.1 Принцип Active-Only
Опрос бэкенда **MUST** выполняться **ТОЛЬКО** в момент, когда вкладка активна на экране и окно браузера находится в фокусе. При переключении на другую вкладку или сворачивании окна таймеры **MUST** автоматически останавливаться.

### 4.2 Соглашение об экспорте функций контроллера
В `main.js` вкладки **MUST** быть определены и экспортированы в объект `window` функции жизненного цикла:

```javascript
/**
 * Инициализация вкладки (вызывается при первом открытии и активации).
 */
export async function initMyFeatureTab() {
  bindEvents();
  await fetchData();

  // Регистрация опросника через tab-core
  window.registerTabPoller('tab-my-feature', async () => {
    await fetchData(true);
  }, 3000, { immediate: false });
}
window.initMyFeatureTab = initMyFeatureTab;

/**
 * Опциональная деактивация вкладки (вызывается при уходе с вкладки).
 */
export function deactivateMyFeatureTab() {
  // Освобождение локальных подписок / холстов графиков
}
window.deactivateMyFeatureTab = deactivateMyFeatureTab;
```

---

## 5. Стандарт тем оформления и адаптивность CSS

Интерфейс поддерживает динамическую смену тем: `Light`, `NightView`, `Dark`, `Brick`, `Terminal`.

### 5.1 Семантические классы Bootstrap 5
Разметка **MUST** использовать адаптивные классы вместо фиксированных цветов:
- Фон: `bg-body`, `bg-body-tertiary`, `bg-body-secondary`.
- Текст: `text-body`, `text-body-secondary`, `text-muted`.
- Границы: `border`, `border-subtle`, `border-primary-subtle`.
- Бейджи: `bg-primary-subtle text-primary border border-primary-subtle`.

### 5.2 CSS-переменные
Для кастомных стилей **MUST** использоваться переменные активной темы:
```css
/* ✅ ПРАВИЛЬНО */
.my-card {
  background: var(--surface-1, #1e293b);
  color: var(--text-color, #f8fafc);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

/* ❌ ЗАПРЕЩЕНО */
.my-card {
  background-color: #12151a; /* Жесткий хардкод сломает светлую тему! */
  color: #fff;
}
```

### 5.3 Унифицированные статусные бейджи (`ui-badge`) и запрет инлайнового хардкода
Для отображения любых статусов, предупреждений, режимов и метаданных **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** использовать инлайновые стили оформления (`style="color: #...; background: rgba(...);"`).
Используются строго семантические классы дизайн-системы, автоматически привязанные к токенам активной темы (`--status-*-*`):

- **Предупреждения / Внимание:** `<span class="ui-badge ui-badge-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>Предупреждение</span>`
- **Успех / Оптимально:** `<span class="ui-badge ui-badge-success"><i class="bi bi-check-circle-fill me-1"></i>Оптимально</span>`
- **Ошибки / Отключения:** `<span class="ui-badge ui-badge-danger"><i class="bi bi-x-circle-fill me-1"></i>Отключен</span>`
- **Информация / Частоты / Наработка:** `<span class="ui-badge ui-badge-info">3200 MHz</span>`
- **Нейтральные атрибуты / Метаданные:** `<span class="ui-badge ui-badge-neutral">NTFS</span>`
- **Длинные статусные тексты:** Добавляется класс `text-wrap` (`<span class="ui-badge ui-badge-warning text-wrap text-start">...</span>`).

Все цвета (`--status-warning-bg`, `--status-warning-text`, `--status-warning-border`, `--surface-2` и др.) автоматически адаптируются под выбранную тему (Light / NightView, Brick, Dark, Terminal).


---

## 6. Универсальное модальное окно ИИ (AIModalDialog)

Любая таблица, карточка или реестр системных сущностей Windows (процессы, службы, установленный софт, сетевые порты, диски, сессии питания, события) **MUST** быть интегрирована с универсальным ИИ-ассистентом:

### 6.1 Разметка интерактивной строки таблицы
```html
<tr class="interactive-table-row" data-id="winword.exe" style="cursor: pointer;">
  <td>...</td>
  <td class="text-end no-modal-trigger">
    <!-- Кнопки действий внутри строки не должны вызывать модалку -->
    <button type="button" class="btn btn-sm btn-outline-danger">Удалить</button>
  </td>
</tr>
```

### 6.2 Вызов `window.AIModalDialog.show()`
```javascript
function openItemAiModal(item) {
  const modal = window.AIModalDialog || window.AITableModal;
  if (!modal) return;

  modal.show({
    title: item.name,
    subtitle: `PID: ${item.pid} | Служба: ${item.service_name || 'N/A'}`,
    icon: '⚙️',
    tableType: 'process', // 'process'|'service'|'software'|'task'|'network'|'registry'|'user'|'disk'|'generic'
    badges: [
      { text: item.status, class: item.status === 'Running' ? 'badge bg-success' : 'badge bg-secondary' }
    ],
    metadata: [
      { label: 'Исполняемый файл', value: item.path, isCode: true, fullWidth: true },
      { label: 'Потребление RAM', value: `${item.memory_mb} MB` }
    ],
    rawTitle: 'Телеметрия процесса',
    rawContent: JSON.stringify(item, null, 2),
    autoRun: false, // Быстрый L1 кэш WikiLLM без траты токенов
    actions: [
      {
        label: 'Перезапустить',
        icon: 'bi-arrow-repeat',
        class: 'btn-outline-warning',
        onClick: (opts) => restartService(item.id)
      }
    ]
  });
}
```

### 6.3 Стандарт Drill-down: Иконка дрели СЛЕВА от строки таблицы
Если в таблице предусмотрен углубленный анализ или переход к детальному инспектору сущности (Drill-down / Deep Dive):
- **Запрет текстовых кнопок справа:** Текстовые кнопки наподобие `🔬 Deep Dive` в правой части таблицы запрещены.
- **Стандарт размещения:** Иконка дрели размещается **строго СЛЕВА от строки** (в первой колонке `<th>` и `<td>`).
- **Иконка:** Используется изображение `/html/assets/red_drill.png`.
- **Изоляция клика:** Ячейка или кнопка помечается классом `no-modal-trigger`, а обработчик клика вызывает `e.stopPropagation()`, чтобы отделять переход к детальному представлению от открытия модального окна `AIModalDialog`.

```html
<!-- Заголовок таблицы -->
<thead>
  <tr>
    <th style="width: 36px; text-align: center;" title="Drill-down: Детальный анализ"></th>
    <th>PID</th>
    <th>Имя процесса</th>
    ...
  </tr>
</thead>

<!-- Строка данных -->
<tr class="interactive-table-row" data-id="...">
  <td class="text-center no-modal-trigger" style="width: 36px;">
    <button type="button" class="btn-drilldown-proc" title="Drill-down: Глубокий анализ процесса">
      <img src="/html/assets/red_drill.png?v=YYYYMMDD_vN" alt="Drill-down">
    </button>
  </td>
  <td class="font-monospace">...</td>
  ...
</tr>
```

---

## 7. Реестр вкладок (SSOT), меню и Карта сайта (Sitemap)

Каждая новая или измененная вкладка **MUST** быть зарегистрирована в единой цепочке реестров:

1. **`apps/windows/api/webgui/apps/modules/tabs-config.js`** (`APP_TAB_DEFS`):
```javascript
{
  id: 'my_feature',
  tab: 'my-feature',
  tabId: 'tab-my-feature',
  html: '/html/tab_my_feature/index.html?v=YYYYMMDD_v1',
  js: '/html/tab_my_feature/main.js?v=YYYYMMDD_v1'
}
```

2. **`apps/windows/api/webgui/core/tab-registry.js`** (`TAB_DEFINITIONS`):
```javascript
{
  id: 'my_feature',
  label: 'Моя Функция',
  icon: 'bi-stars',
  tab: 'my-feature',
  tabId: 'tab-my-feature',
  html: '/html/tab_my_feature/index.html?v=YYYYMMDD_v1',
  js: '/html/tab_my_feature/main.js?v=YYYYMMDD_v1'
}
```

3. **`apps/windows/api/webgui/config_menues/tc_menu_config.json`**:
```json
{
  "id": "my_feature",
  "label": "Моя Функция",
  "icon": "bi-stars",
  "tab": "tab-my-feature",
  "order": 20,
  "visible": true
}
```

4. **Актуализация карты сайта (`tab_sitemap`)**:
- Добавить описание и список функций в `apps/windows/api/webgui/tab_sitemap/generate_sitemap_data.py`.
- Выполнить генерацию: `python apps/windows/api/webgui/tab_sitemap/generate_sitemap_data.py`.
- Проверить обновление `apps/windows/api/webgui/tab_sitemap/sitemap_data.json`.

---

## 8. Версионирование и Cache-Busting

Для гарантированного обновления скриптов и стилей в браузерах пользователей все URL ресурсов **MUST** содержать параметр версии вида:
```text
?v=YYYYMMDD_vN
```
При внесении любых изменений во фронтенд номер ревизии `_vN` или дата **MUST** инкрементироваться.

---

## 9. Чек-лист проверки WebGUI

Перед сдачей задачи и коммитом проверьте:
- [ ] Вкладка изолирована строго в `tab_<tab_id>/` (шаблон `tab_<tab_id>`) и содержит `index.html`, `main.js`, `README.md`.
- [ ] В `index.html` отсутствуют теги `<script>`.
- [ ] Кнопки переключения используют только `data-tab="tab-<tab_id>"`.
- [ ] Фоновый опрос зарегистрирован через `window.registerTabPoller` (без прямых вызовов `setInterval`).
- [ ] **Никакого хардкода в стилях:** Проверено полное отсутствие HEX/RGB/RGBA в атрибутах `style="..."` и CSS-селекторах. Все цвета, фоны, рамки и статусы подключены строго через механизм тем (`var(--...)` и `ui-badge-*`).
- [ ] Интерактивные строки таблицы вызывают `window.AIModalDialog.show({...})`.
- [ ] Кнопка Drill-down (при наличии детального анализа сущности) оформлена иконкой дрели (`/html/assets/red_drill.png`) и размещена строго **СЛЕВА** от строки.
- [ ] Вкладка добавлена в `tabs-config.js`, `core/tab-registry.js` и `config_menues/tc_menu_config.json`.
- [ ] **Карта сайта `tab_sitemap` актуализирована:** обновлен `sitemap_data.json` через запуск `generate_sitemap_data.py`.
- [ ] В шапке всех изменяемых файлов проставлена актуальная дата `Updated: YYYY-MM-DD HH:MM:SS`.
- [ ] Все комментарии к коду и документация составлены на **русском языке**.
- [ ] Версия ассетов обновлена (`?v=YYYYMMDD_vN`).
