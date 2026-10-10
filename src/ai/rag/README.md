# Унифицированный стек знаний и RAG (Unified Knowledge & RAG Stack)

Пакет `src/ai/rag` объединяет передовые методы поиска и прогрессивного накопления знаний в единую архитектуру платформы **AI Windows Admin**.

---

## 🏛 Архитектурные компоненты

```
                             UnifiedKnowledgeHub
                                      │
          ┌─────────────────┬─────────┴─────────┬─────────────────┐
          ▼                 ▼                   ▼                 ▼
       WikiLLM           Text RAG           Pixel RAG          Log RAG
  (src/ai/wikillm)  (src/ai/rag/text_rag) (src/ai/rag/pixel) (src/ai/rag/log_rag)
          │                 │                   │                 │
    Exact L1 (O(1))    Эмбеддинги Gemini   Визуальные хэши    Адаптивные чанки
   Fingerprint L2       FAISS векторный        OCR текст       Кластеризация
    Semantic L3              поиск          UI-скриншоты        Связка с Event ID
   LLM Resolver L4     Документы и код      Диаграммы ОС        Анализ инцидентов
```

---

## 🔍 Согласованный конвейер разрешения (Harmonized Pipeline)

1. **L1 — Exact Match ($O(1)$ в SQLite)**: Мгновенное получение детерминированных фактов, кодов ошибок Win32/NTSTATUS, системных команд и AST-символов кода без расхода токенов.
2. **L2 — Fingerprint Match**: Сопоставление с динамическими шаблонами журналов и сообщений об ошибках со стёртыми переменными (GUID, PID, адреса).
3. **L3 — Hybrid Semantic Search**:
   - **WikiLLM FTS5**: Полнотекстовый поиск по морфологии симптомов и проверенным рекомендациям.
   - **Text RAG**: Поиск по семантическим векторным эмбеддингам Gemini и FAISS по документации и исходному коду.
   - **Log RAG**: Поиск по контекстным чанкам системных журналов Windows и профилированию инцидентов.
   - **Pixel RAG**: Сопоставление графических скриншотов окон ошибок и состояний UI.
4. **L4 — LLM Structured Synthesis**: Вызов Gemini с получением строго структурированного JSON, Pydantic-валидацией и автоматическим занесением факта в базу знаний WikiLLM для будущих мгновенных ответов.

---

## 🌐 Интеграция с WebGUI интерфейсом

1. **System Control Tab (`http://localhost:8001/tc#tab-system-control`)**:
   - Панель **«Semantic RAG Search in Logs»** использует `LogRAG` и `AdaptiveLogRAG` через эндпоинты `/api/v1/system_logs/rag/query` и `/api/v1/system_logs/rag/build`.
2. **RAG Tab (`rag_tab`)**:
   - Управление глобальными документами, AST-индексами кодовой базы и коллекциями Multi-RAG.
3. **Pixel RAG Tab (`pixelrag_tab`)**:
   - Индексация и визуальный поиск по скриншотам и окнам ошибок через `/api/rag/pixel/...`.
4. **AI Diagnostics Modal Dialog (`ai_modal_dialog`)**:
   - Мгновенное подтверждение и фиксация проверенных знаний в WikiLLM через `/api/windows/wikillm/approve`.

---

## 🚀 Примеры использования

```python
from src.ai.rag import UnifiedKnowledgeHub

hub = UnifiedKnowledgeHub()

# Разрешение кода ошибки или симптома
result = await hub.resolve_query("0x80070490")
print(result["source"])  # 'wikillm' или 'hybrid_rag'

# Полнотекстовый мульти-поиск
all_matches = hub.search_all("distributed com permission")
```
