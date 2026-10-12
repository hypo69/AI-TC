# Подпакет `tc`

Код роутера Test Computer, вынесенный из монолитного `router_tc.py` (этап 4 оптимизации).

| Модуль | Назначение |
|---|---|
| `state.py` | Ленивые синглтоны: хранилище, коллектор, диагност, контроллер сэмплирования |
| `models.py` | Pydantic-модели |
| `helpers.py` | Конфиг, модель/провайдер, авторизация |
| `endpoints_ai.py` | Инструкция, модель и провайдер AI-агента |
| `endpoints_system.py` | Состояние системы |
| `endpoints_telemetry.py` | Телеметрия, сэмплирование, God Mode |

`router_tc.py:init_router()` создаёт роутер и вызывает функции `register_*`; реэкспортируются `get_collector`, `get_diagnostician`.
