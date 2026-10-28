---
name: hardware-production-date-agent
description: Specialized AI agent for detecting and decoding hardware manufacture date and production week by serial number, part number, and vendor telemetry.
description_i18n:
  en: Specialized AI agent for detecting and decoding hardware manufacture date and production week by serial number, part number, and vendor telemetry.
  ru: Специализированный AI-агент для определения даты и недели производства оборудования по серийному номеру (S/N), парт-номеру и сервисным данным вендора.
---

# 🤖 Hardware Production Date Agent (Агент даты производства оборудования)

## 🎯 Назначение
`hardware-production-date-agent` — специализированный интеллектуальный агент для идентификации точной даты производства (Manufacture Date / DOM), производственной недели и гарантийного статуса аппаратных узлов (материнские платы, видеокарты, накопители HDD/SSD, оперативная память RAM, мониторы, процессоры).

Определение даты производства по серийному номеру — нетривиальная задача, поскольку каждый вендор использует собственные проприетарные схемы кодирования, смещения символов, финансовые календари или закрытые сервисные порталы.

---

## 🏗️ Архитектура и уровни решения

Агент использует гибридный трехуровневый алгоритм:

1. **Мгновенные детерминированные декодеры (Rule-Based Engine, 0 мс)**:
   - **ASUS**: Анализ первых 2 символов серийника (1-й = код года, 2-й = месяц: 1-9, A, B, C).
   - **GIGABYTE**: Выделение префикса `SNyyww` (год и неделя выпуска).
   - **MSI**: Выделение масок `...ByyMM...` или `...Kyyww...` из серийного номера.
   - **DELL**: Расшифровка заводского PPID (`CN-0XXXXX-XXXXX-YMD-XXXX`, где Y=год, M=месяц в hex, D=день) или генерация ссылки на официальный Service Tag Support Portal.
   - **HP / Compaq**: 10-значный серийный номер (4-й символ — последняя цифра года, 5-6 — неделя).
   - **SAMSUNG**: 15-значные серийные номера SSD, памяти и дисплеев с кодами года (K=2018, M=2019, N=2020, R=2021, T=2022, W=2023, X=2024, Y=2025).
   - **SEAGATE**: Расчет по 4-5 значному Date Code (YYWD / YYWWD) с учетом фискального года Seagate (начало с июля).
   - **WESTERN DIGITAL (WD)**: Анализ заводских DOM-меток (Date of Manufacture) и SMART.
   - **EDID Displays**: Считывание аппаратных байтов 16 и 17 из фабричного ROM монитора (Week & Year of Manufacture).
   - **RAM Modules**: Извлечение даты выпуска модуля из JEDEC SPD EEPROM (`Win32_PhysicalMemory.ManufactureDate`).
   - **Intel CPU / SSD**: Декодирование номера партии Intel FPO (Batch).

2. **Интеллектуальный AI-исследователь (GoogleGenerativeAI)**:
   - Активируется для нестандартных, OEM-специфичных или редких серийных номеров.
   - Формулирует глубокий экспертный промпт с анализом архитектуры контрольных сумм, серийных масок и паттернов производителя.
   - Возвращает строгий JSON с датой (`production_date`), уровнем уверенности (`confidence`) и источником (`production_source`).

3. **Синхронизация и кэширование в `telemetry.db`**:
   - Найденная дата сохраняется в таблицу `hardware_components` SQLite (`production_date`, `production_date_source`, `production_date_status`), исключая повторные запросы.
   - Отображается в WebGUI панели `<!-- Full Hardware Specification Tree Panel (Hardware Tree) -->`.

---

## 🚀 Программный API

```python
from apps.windows.telemetry.production_date_agent import HardwareProductionDateAgent

agent = HardwareProductionDateAgent()

# 1. Мгновенное алгоритмическое декодирование:
res = agent.decode_serial(
    vendor="ASUS",
    model="PRIME B460M-A",
    serial_number="N8M0KC000000000",
)
print(res)
# {
#   'production_date': '2022-08',
#   'production_source': 'ASUS Serial Decoder (N8...)',
#   'confidence': 'high',
#   'details': "Символ 'N' = 2022 год, символ '8' = месяц 08."
# }

# 2. Асинхронное разрешение с AI-fallback:
full_res = await agent.resolve_production_date_async(
    vendor="Samsung",
    model="SSD 980 PRO 1TB",
    serial_number="S5GXNF0R123456",
    category="Physical Disk",
)
```

---

## 🌐 Web API Эндпоинты

- `POST /api/v1/about-system/hardware/query-production-date?component_key={key}`
- `GET /api/v1/about-system/hardware/query-production-date?component_key={key}`
- `GET /api/v1/about-system/hardware-enrichment-status` (возвращает статус обогащения и даты производства)

---

## 📊 Формат возвращаемых данных

```json
{
  "success": true,
  "component_key": "motherboard_sn_n8m0kc000000000",
  "production_date": "2022-08",
  "production_source": "ASUS Serial Decoder (N8...)",
  "confidence": "high",
  "details": "Символ 'N' = 2022 год, символ '8' = месяц 08."
}
```
