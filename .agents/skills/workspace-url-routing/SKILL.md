---
name: workspace-url-routing
description: Регламент и инструментарий маршрутизации рабочих пространств через URL формата #tab-workspace#panel-files#workspace=<id> в веб-интерфейсе AI Assistant.
description_i18n:
  en: Standard and tools for workspace routing via URL format #tab-workspace#panel-files#workspace=<id> in AI Assistant WebGUI.
  ru: Регламент и инструментарий маршрутизации рабочих пространств через URL формата #tab-workspace#panel-files#workspace=<id> в веб-интерфейсе AI Assistant.
---

<!--
=============================================================================
Process Name: Agent Skill - Workspace URL Routing
=============================================================================
Description:
  Инженерный навык и регламент маршрутизации веб-интерфейса AI Assistant.
  Фиксирует стандарт привязки активного рабочего пространства к URL в формате:
  http://localhost:8002/#tab-workspace#panel-files#workspace=<workspace_id>

File: SKILL.md
Package: .agents/skills/workspace-url-routing
Author: hypo69
Copyright: © 2026 hypo69
Updated: 2026-10-22 14:45:00
=============================================================================
-->

# 🧭 Навык: Маршрутизация рабочих пространств через URL (Workspace URL Routing)

Этот навык определяет единый стандарт формирования, разбора и синхронизации URL веб-интерфейса **AI Assistant** (`apps/ai_assistant/api/webgui`), связывающий активную вкладку, панель файлов/документов и выбранное рабочее пространство.

---

## 🎯 Канонический стандарт URL

При выборе или переключении рабочего пространства URL в адресной строке браузера **ОБЯЗАТЕЛЬНО** приводится к виду:

```text
http://localhost:8002/#tab-workspace#panel-files#workspace=<workspace_id>
```

### Анатомия компонентов URL:

| Сегмент | Значение | Описание |
|---|---|---|
| `http://localhost:8002/` | Хост и Порт | Порт сервера AI Assistant (дефолтный: 8002) |
| `#tab-workspace` | Идентификатор вкладки (`tabId`) | Активирует экран управления рабочими областями и базой знаний |
| `#panel-files` | Идентификатор панели (`panelId`) | Активирует панель управления файлами/документами (`panel-documents` / `panel-files`) |
| `#workspace=<id>` | Параметр рабочего пространства | Указывает идентификатор активного рабочего пространства (например `workspace=demo`) |

---

## 🚀 Сценарии работы и жизненный цикл

### 1. Переключение рабочего пространства пользователем
Когда пользователь выбирает рабочее пространство (через верхний дропдаун, боковое меню или селектор на вкладке):
1. **Формирование URL:**
   ```javascript
   const targetHash = `#tab-workspace#panel-files#workspace=${encodeURIComponent(workspaceId)}`;
   history.pushState(null, null, targetHash);
   ```
2. **Активация вкладки:** вызывается `window.switchTab('tab-workspace')`.
3. **Фокус на документы:** страница плавно скроллится к карточке `#panel-documents` (`panel-files`).
4. **Синхронизация селекторов:** обновляется верхний выпадающий список `updateTopWorkspaceDropdown(wsId)` и селектор `#ws-selector`.

### 2. Открытие страницы по прямой ссылке
При загрузке страницы с готовым URL вида `http://localhost:8002/#tab-workspace#panel-files#workspace=demo`:
1. Оркестратор `main.js` парсит сегменты хэша:
   ```javascript
   const parts = location.hash.replace(/^#/, '').split('#');
   const tabId = parts[0] || 'tab-workspace';
   const panelId = parts.find(p => p.startsWith('panel-')) || 'panel-files';
   const wsPart = parts.find(p => p.startsWith('workspace='));
   const wsId = wsPart ? decodeURIComponent(wsPart.split('=')[1]) : null;
   ```
2. Активируется вкладка `tab-workspace`.
3. Панель `panel-files` активируется и загружает список файлов и Git-историю выбранного пространства.
4. Выбранное рабочее пространство устанавливается как активное.

### 3. Реакция на изменение истории браузера (`hashchange`)
Слушатель события `hashchange` в `main.js` повторно считывает параметр `workspace=<id>` и мгновенно переключает рабочее пространство без перезагрузки всей страницы.

---

## 💻 Эталонные функции (JavaScript)

```javascript
/**
 * Формирует канонический URL для рабочего пространства.
 * @param {string} workspaceId 
 * @param {string} [panelId='panel-files'] 
 * @param {string} [tabId='tab-workspace'] 
 * @returns {string}
 */
export function buildWorkspaceUrl(workspaceId, panelId = 'panel-files', tabId = 'tab-workspace') {
  if (!workspaceId) return `#${tabId}#${panelId}`;
  return `#${tabId}#${panelId}#workspace=${encodeURIComponent(workspaceId)}`;
}

/**
 * Разбирает URL hash на составляющие компоненты.
 * @param {string} [hash] 
 * @returns {{ tabId: string, panelId: string|null, workspaceId: string|null }}
 */
export function parseWorkspaceUrl(hash = null) {
  const raw = (hash !== null ? hash : (typeof location !== 'undefined' ? location.hash : '')) || '';
  const clean = raw.replace(/^#/, '');
  const parts = clean.split('#');

  const tabId = parts[0] || 'tab-workspace';
  let panelId = null;
  let workspaceId = null;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('workspace=')) {
      workspaceId = decodeURIComponent(part.slice(10));
    } else if (part.startsWith('panel-')) {
      panelId = part;
    } else if (!workspaceId && !part.includes('=')) {
      // Поддержка обратной совместимости со старым форматом #tab-workspace#<id>
      workspaceId = decodeURIComponent(part);
    }
  }

  return {
    tabId,
    panelId: panelId || 'panel-files',
    workspaceId,
  };
}
```

---

## ✅ Чек-лист проверки соответствия навыку

- [ ] URL при выборе любого пространства имеет вид `#tab-workspace#panel-files#workspace=<id>`.
- [ ] Переход по прямой ссылке с `workspace=demo` корректно активирует пространство `demo`.
- [ ] Сохраняется плавный переход и скролл к панели документов/файлов `#panel-documents`.
- [ ] Кнопки в боковом меню и верхнем выпадающем списке подсвечивают активное пространство.
- [ ] Обратная совместимость: если пользователь переходит по ссылке со старым форматом `#tab-workspace#demo`, пространство всё равно успешно определяется.
- [ ] В шапке изменяемых файлов обновлено время `Updated: YYYY-MM-DD HH:MM:SS`.
- [ ] Все комментарии и документация написаны строго на русском языке.
