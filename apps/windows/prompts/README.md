# apps/windows/prompts

Updated: 2026-10-22 13:30:00

Хранилище шаблонов промптов и системных инструкций подсистемы `apps/windows`.

| Подкаталог | Назначение | Кто использует |
|---|---|---|
| `diagnostics/` | JSON-шаблоны промптов аудита таблиц и панелей (`<table_type>.json`, `<panel_id>.json`) | `apps/windows/api/diagnostics_prompt_manager.py` (`PROMPTS_DIR`) |
| `chat/` | Системная инструкция чата (`system_instruction.md`) и её версии (`versions/`) | `routers/chat`, `routers/admin/instructions.py`, `scripts/dev/bot_runner.py` |
| `tc/` | Системная инструкция ИИ-ассистента TC (`system_instruction.md`) | `routers/tc`, `apps/windows/api/server.py` |
| `narrator/` | Стиль диктора (`narrator_style.md`) и версии | `routers/admin/instructions.py` |

> [!NOTE]
> Подкаталоги создаются автоматически при первом сохранении. Путь вычисляется от расположения модулей, а не от текущего рабочего каталога.
