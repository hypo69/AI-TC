# Стандарт маршрутизации рабочих пространств (Workspace URL Routing)

<!--
=============================================================================
Process Name: Engineering Standard - Workspace URL Routing
=============================================================================
Description:
  Инженерный стандарт формирования и обработки URL рабочих пространств в WebGUI:
  http://localhost:8002/#tab-workspace#panel-files#workspace=<workspace_id>

File: WORKSPACE_ROUTING.md
Package: .ai/instructions/standards
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-22 14:45:00
=============================================================================
-->

## 1. Назначение и контекст
Настоящий стандарт регламентирует структуру URL-адресов для модуля **AI Assistant** (`apps/ai_assistant/api/webgui`).
Стандарт гарантирует предсказуемую навигацию между изолированными рабочими областями (Workspaces), панелями документов и фактов, а также поддержку закладок и переходов по истории браузера (Back/Forward).

---

## 2. Канонический формат URL

При выборе рабочего пространства URL в адресной строке **ОБЯЗАН** принимать вид:

```text
http://localhost:8002/#tab-workspace#panel-files#workspace=<workspace_id>
```

### 2.1 Спецификация сегментов:
1. **`#tab-workspace`** — базовый идентификатор вкладки (`tabId`). Определяет загрузку ресурсов модуля `tab_workspace`.
2. **`#panel-files`** — идентификатор активной панели управления файлами и коммитами (`panelId`). Является каноническим алиасом для `#panel-documents`.
3. **`#workspace=<workspace_id>`** — строковый ключ выбранного пространства (например: `workspace=demo` или `workspace=default`).

---

## 3. Требования к клиентскому коду

1. **Единая функция сборки URL:** Все компоненты навигации (верхний дропдаун `top_workspace_dropdown.js`, боковое меню `index.html`, инлайн-селектор `panel.js`) обязаны использовать единый формат:
   ```javascript
   #tab-workspace#panel-files#workspace=${encodeURIComponent(wsId)}
   ```
2. **Бесшовный переход:** При клике на рабочее пространство интерфейс обязан:
   - Обновить адресную строку через `history.pushState` / `history.replaceState`.
   - Активировать вкладку `tab-workspace` через `switchTab('tab-workspace')`.
   - Плавно перевести экран к разделу файлов/документов (`#panel-documents`).
   - Синхронизировать активное состояние во всех элементах интерфейса (селектор, меню, шапка).
3. **Fail-Safe & Обратная совместимость:** Парсер хэша обязан поддерживать как новый трёхсегментный формат, так и старый двухсегментный `#tab-workspace#<id>`.
4. **Active-Only:** Запросы к API для загрузки документов и фактов выполняются исключительно для активного рабочего пространства и активной панели.

---

## 4. Связанные документы и навыки
- Навык: [`.agents/skills/workspace-url-routing/SKILL.md`](.agents/skills/workspace-url-routing/SKILL.md)
- Стандарт WebGUI: [`.ai/instructions/standards/WEBGUI.md`](.ai/instructions/standards/WEBGUI.md)
- Главный индекс: [`GEMINI.md`](GEMINI.md)
