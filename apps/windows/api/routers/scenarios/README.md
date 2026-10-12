# Подпакет `scenarios`

Код сценариев Test Computer, вынесенный из монолитного `router_scenarios.py` (этап 4 оптимизации).

| Модуль | Назначение |
|---|---|
| `models.py` | Pydantic-модели |
| `catalog.py` | Каталог доступных сценариев (`AVAILABLE_SCENARIOS`) |
| `runners_basic.py` | Быстрая проверка, аудит логов |
| `runners_system.py` | Инспектор системы, администрирование, сеть, AI-провайдеры |
| `runners_update.py` | Safe Update Guard |
| `assistant.py` | AI-ассистент, динамические навыки, бенчмарк диска |
| `endpoints.py` | Фабрика роутера `init_router()` |

Точка входа — `../router_scenarios.py` (реэкспорт `init_router`, `ScenarioRunRequest`).
