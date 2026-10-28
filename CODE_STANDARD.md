# 📜 CODE_STANDARD.md — Стандарт оформления и написания кода (v2.2)

## 1. Основные стандарты
* **Python**: Python 3.12+, Pydantic v2, `from __future__ import annotations`.
* **Frontend**: Чистый Vanilla JS ES6+ без внешних тяжелых фреймворков.
* **Именование**:
  * Модули и папки: `snake_case` (например, `tab_software_scanner`, `ai_modal_dialog`).
  * CSS классы: `kebab-case` (`.ui-card`, `.ai-modal-overlay`).
  * JS классы/модули: `PascalCase` (`AIModalDialog`, `I18nManager`, `ThemeManager`).

## 2. Безопасность и асинхронность
* Блокирующие вызовы Windows API обворачиваются в `asyncio.to_thread()`.
* Все fetch-запросы на фронтенде снабжаются `AbortController` для моментальной отмены при переключении контекста.
