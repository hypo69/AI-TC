# Вкладка Защитника и Брандмауэра Windows (Defender & Firewall Security Center)

Комплексный центр безопасности операционной системы Windows для мониторинга антивирусной защиты Microsoft Defender, аудита правил Attack Surface Reduction (ASR), защиты от программ-вымогателей (Controlled Folder Access), инспекции цепочек процессов и управления Брандмауэром Windows (Firewall).

---

## 📋 Основные возможности

1. **Защитник Windows (Microsoft Defender)**:
   - Мониторинг ключевых эшелонов: Real-time Protection, Cloud Protection (MAPS), Behavior Monitor, IOAV, AMSI Script Scanning, Tamper Protection, PUA Protection, Network Protection.
   - Статус системных служб и процессов (`MsMpEng.exe`, `NisSrv.exe`, `SecurityHealthService.exe`).
   - Правила Attack Surface Reduction (ASR) с классификацией (Block, Audit, Warn, Disabled).
   - Защита папок от шифровальщиков (Controlled Folder Access / CFA), управление доверенными приложениями.
   - Аудит исключений с эвристической оценкой рисков.
   - Журнал обнаружения угроз и карантина.
   - Инспекция связей процессов и индикаторы Fileless-атак.
   - Журнал событий `Microsoft-Windows-Windows Defender/Operational` с парсингом структурированных свойств.
   - ИИ-диагностика (Security Posture Score) с практическими рекомендациями по усилению защиты.
   - Фоновые задачи: быстрое и полное сканирование, обновление сигнатур.

2. **Брандмауэр Windows (Windows Firewall)**:
   - Мониторинг сетевых профилей (Доменный, Частный, Публичный).
   - Инспекция и фильтрация активных правил netsh advfirewall.
   - Включение, отключение правил и сброс настроек брандмауэра по умолчанию.

---

## 🏛 Модульная архитектура (ES6 Modules)

```
tab_defender_firewall/
├── common/
│   └── ui_utils.js              # Экранирование HTML, fetchJSON, система всплывающих алертов
├── panel_overview/
│   └── panel.js                 # Общий статус антивируса, эшелоны защиты, службы Defender
├── panel_asr_cfa/
│   └── panel.js                 # Правила ASR, списки CFA, добавление/удаление доверенных приложений
├── panel_threats_events/
│   └── panel.js                 # Аудит исключений, журнал угроз, цепочки процессов, журнал событий
├── panel_diag_tasks/
│   └── panel.js                 # ИИ-диагностика Security Posture, опрос фоновых задач сканирования
├── panel_firewall/
│   └── panel.js                 # Диспетчер Брандмауэра: профили, правила, переключение состояний
├── index.html                   # Разметка интерфейса и модальных окон
├── main.js                      # Компактный модуль-оркестратор (<= 500 строк)
└── README.md                    # Документация модуля
```

---

**Updated**: 2026-10-17 01:30:00  
**Package**: windows/api/webgui/tab_defender_firewall  
**Author**: hypo69  
