# Вкладка «Внутренняя кухня» (App Internals)

## Описание
Вкладка **«Внутренняя кухня»** (`tab_app_internals`) представляет собой служебный хаб администрирования веб-интерфейса AI Windows Admin, координирующий 9 суб-панелей:
1. `telemetry`: Телеметрия (Telemetry Control & Config)
2. `models`: Модели и API (Models & Providers)
3. `logs`: Центр логов (Logs Center)
4. `etw`: Трассировка ETW (Performance Tracing)
5. `settings`: Параметры (Log Settings)
6. `wikillm-db`: БД WikiLLM (MariaDB / SQLite)
7. `instruments`: База инструментов (AI Instruments)
8. `wikillm-params`: Параметры WikiLLM (Model & RAG Settings)
9. `wikillm-editor`: Статьи WikiLLM (Knowledge Base Editor)

## Маршрутизация и навигация по URL
Переключение между суб-панелями в URL осуществляется в соответствии со стандартами проекта:
```text
http://localhost:8001/tc#tab-app-internals#<panel_id>
```

### Примеры маршрутов:
- `http://localhost:8001/tc#tab-app-internals#telemetry` — переключение на панель телеметрии
- `http://localhost:8001/tc#tab-app-internals#models` — переключение на панель моделей и API
- `http://localhost:8001/tc#tab-app-internals#logs` — переключение на системные журналы и логи
- `http://localhost:8001/tc#tab-app-internals#etw` — переключение на трассировку производительности ETW
- `http://localhost:8001/tc#tab-app-internals#settings` — переключение на системные настройки логирования
- `http://localhost:8001/tc#tab-app-internals#wikillm-db` — переключение на базу данных WikiLLM
- `http://localhost:8001/tc#tab-app-internals#instruments` — переключение на базу инструментов агента
- `http://localhost:8001/tc#tab-app-internals#wikillm-params` — переключение на параметры модели и RAG
- `http://localhost:8001/tc#tab-app-internals#wikillm-editor` — переключение на редактор статей базы знаний

Запуск через `tc.ps1`:
```powershell
.\tc.ps1 -Tab app-internals -Panel models
.\tc.ps1 -Tab app-internals -Panel instruments
.\tc.ps1 -Panel telemetry
```

## Архитектура модулей
Файлы декомпозированы по суб-панелям (`panel_*`) в соответствии со стандартами проекта (`GEMINI.md` § 4.4, лимит строк <= 500):

```
tab_app_internals/
├── index.html                           # Разметка вкладки и 9 изолированных суб-панелей с data-panel-id
├── main.js                              # Модульный клиентский оркестратор и слушатель hashchange
├── common/
│   └── ui_utils.js                      # URL hash парсер, нормализация panel_id, загрузка скриптов
├── panel_subtabs/
│   └── panel.js                         # Навигация, switchAppInternalsSubTab и ленивая подгрузка
├── panel_wikillm_db/
│   └── panel.js                         # Управление БД параметров WikiLLM (MariaDB/SQLite: knowledge.db)
├── panel_instruments_db/
│   └── panel.js                         # Управление изолированной БД инструментов агента (ai_instruments.db / Hostinger)
└── panel_wikillm_settings/
    └── panel.js                         # Параметры модели/RAG и инициализация редактора статей WikiLLM
```

## Программное API
- Точка входа: `window.initAppInternalsTab()`
- Переключение суб-панели: `window.switchAppInternalsSubTab(panelId, updateUrl = true)`
- Получение активной панели: `window.getActiveAppInternalsSubTabId()`
- Чтение панели из hash: `window.getAppInternalsPanelFromHash()`
- Обновление URL hash: `window.updateAppInternalsUrlWithPanel(panelId)`
- Режим скриптов: ES6-модули (`type="module"`).
