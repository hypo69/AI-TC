---
name: webgui-sitemap-maintainer
description: Инженерный навык и регламент обязательной актуализации интерактивной карты сайта (tab_sitemap) и реестров вкладок при любых изменениях веб-интерфейса в apps/windows/api/webgui.
---

# Навык: Актуализация карты сайта и реестра вкладок WebGUI (`webgui-sitemap-maintainer`)

## 📌 Назначение
Данный навык предписывает обязательный протокол действий для агента при добавлении, переименовании, модификации или удалении любых вкладок и разделов интерфейса в каталоге `apps/windows/api/webgui/`.

---

## 🚨 Главное правило именования каталогов вкладок
> [!IMPORTANT]
> **Шаблон имени каталога вкладки:**
> Все директории вкладок в `apps/windows/api/webgui/` **ОБЯЗАТЕЛЬНО** должны именоваться строго по шаблону:
> `tab_<tab_id>` (например: `tab_about_system`, `tab_defender`, `tab_sitemap`, `tab_chat`).
> Любые другие форматы (включая устаревший `<name>_tab` или имена без префикса `tab_`) **СТРОГО ЗАПРЕЩЕНЫ**.

---

## 🔄 Протокол актуализации при любых изменениях WebGUI

При любом создании новой вкладки, изменении функционала существующей или редактировании конфигурации меню, агент **ОБЯЗАН** выполнить следующий 6-шаговый протокол:

### Шаг 1. Создание каталога вкладки по шаблону `tab_<tab_id>`
В каталоге `apps/windows/api/webgui/tab_<tab_id>/` размещаются:
- `index.html` — разметка вкладки (без тегов `<script>`, семантические CSS-переменные, без хардкода стилей).
- `main.js` — модуль логики с экспортом функций жизненного цикла: `init<Name>Tab()` и `deactivate<Name>Tab()`.
- `README.md` — документация на русском языке с описанием назначения и контрактов API.

### Шаг 2. Регистрация в `tabs-config.js`
В файле `apps/windows/api/webgui/apps/modules/tabs-config.js` добавить запись в массив `APP_TAB_DEFS`:
```javascript
{
  id: '<tab_id>',
  tab: '<url_slug>',
  tabId: 'tab-<tab_id>',
  html: '/html/tab_<tab_id>/index.html?v=YYYYMMDD_v1',
  js: '/html/tab_<tab_id>/main.js?v=YYYYMMDD_v1'
}
```

### Шаг 3. Регистрация в `tab-registry.js`
В файле `apps/windows/api/webgui/core/tab-registry.js` добавить запись в `TAB_DEFINITIONS`:
```javascript
{
  id: '<tab_id>',
  label: '<Читаемое название>',
  icon: 'bi-<icon-name>',
  tab: '<url_slug>',
  tabId: 'tab-<tab_id>',
  html: '/html/tab_<tab_id>/index.html?v=YYYYMMDD_v1',
  js: '/html/tab_<tab_id>/main.js?v=YYYYMMDD_v1'
}
```

### Шаг 4. Регистрация в конфигурациях меню
В файле `apps/windows/api/webgui/config_menues/tc_menu_config.json`:
- Добавить в `topButtons` (если вкладка приоритетная) или в `sidebarItems`.
- Указать поля: `id`, `label`, `icon`, `tab` (`tab-<tab_id>`), `order`, `visible` (`true` или `false`).

### Шаг 5. Добавление DOM-контейнера в оболочки
В файле `apps/windows/api/webgui/apps/index.html` (и `index.html` при необходимости) добавить контейнер:
```html
<div id="tab-<tab_id>" class="tab-pane fade"></div>
```

### Шаг 6. Актуализация карты сайта (`tab_sitemap`)
В файле `apps/windows/api/webgui/tab_sitemap/generate_sitemap_data.py`:
1. Добавить или обновить блок метаданных вкладки в списке `_TABS_METADATA`:
   ```python
   {
       "id": "<tab_id>",
       "tabId": "tab-<tab_id>",
       "title": "<Читаемое русское название>",
       "icon": "bi-<icon-name>",
       "category": "<system|security|storage|software|ai|network|admin>",
       "categoryTitle": "<Русское название категории>",
       "description": "<Подробное описание назначения вкладки на русском языке>",
       "features": [
           "<Ключевая функция 1>",
           "<Ключевая функция 2>",
           "<Ключевая функция 3>"
       ],
       "defaultVisible": True  # или False
   }
   ```
2. Выполнить команду синхронизации:
   ```powershell
   python apps/windows/api/webgui/tab_sitemap/generate_sitemap_data.py
   ```
   Скрипт перезапишет `apps/windows/api/webgui/tab_sitemap/sitemap_data.json`, сделав новую вкладку доступной в интерактивном каталоге и поиске.

---

## 🔍 Проверка активности вкладок
Активность вкладок на карте сайта вычисляется **динамически** из `tc_menu_config.json`:
- Если вкладка присутствует в секции `topButtons` и `visible !== false` -> статус: **Активна (Верхняя панель)**.
- Если присутствует в `sidebarItems` и `visible !== false` -> статус: **Активна (Боковое меню)**.
- Если `visible === false` -> статус: **Скрыта в меню**.
- Если отсутствует в конфигурации меню -> статус: **Служебная / Скрыта**.
