# Подпакет `chat`

Код чат-роутера, вынесенный из монолитного `router_chat.py` (этап 4 оптимизации).

| Модуль | Назначение |
|---|---|
| `models.py` | Pydantic-модели запросов |
| `helpers.py` | Выбор и нормализация модели/провайдера, очистка истории, `get_chat_model` |
| `endpoints_models.py` | Эндпойнты моделей, провайдеров, инструкций, здоровья |
| `endpoints_sessions.py` | Сохранение в RAG, сессии чата |
| `endpoints_chat.py` | Потоковый эндпойнт чата |

`router_chat.py` создаёт `router`, `init_router(chat_model, narrator_model, plugins)` вызывает функции `register_*`; реэкспортируется `get_chat_model`.
