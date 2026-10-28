# 🤖 Hardware Production Date Agent

Специализированный агент и набор алгоритмических декодеров для определения даты и недели производства компьютерного оборудования по серийному номеру (Serial Number / S/N).

## Возможности
- Декодирование даты по алгоритмам вендоров: ASUS, GIGABYTE, MSI, Dell (PPID/Service Tag), HP, Samsung, Seagate, Western Digital, Intel, EDID, SPD RAM.
- Интеллектуальный AI-fallback для нестандартных форматов.
- Интеграция с базой SQLite `telemetry.db` и веб-интерфейсом `apps/windows/api/webgui` (вкладка `tab-about-system`, панель `Hardware Tree`).

Подробное руководство см. в [SKILL.md](SKILL.md).
