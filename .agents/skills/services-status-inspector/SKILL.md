---
name: services-status-inspector
description: Windows services inspection, lifecycle management, SCM state analysis, autostart audit, and troubleshooting based on apps/windows/sdk.
description_i18n:
  en: Windows services inspection, lifecycle management, SCM state analysis, autostart audit, and troubleshooting based on apps/windows/sdk.
  ru: Инспекция, аудит автозапуска, диагностика и управление жизненным циклом служб Windows (SCM) на базе apps/windows/sdk.
---

# ⚙️ Services Status Inspector (Windows Services SDK)

## 🎯 Назначение
Навык `services-status-inspector` обеспечивает полный цикл инспекции, мониторинга, аудита автозапуска и безопасного управления системными службами Windows через единый стек `apps/windows/sdk` (`WindowsSDK.modules.services`, `ServicesManager` и нативный C-FFI слой `apps.windows.sdk.native.scm`).

Навык используется для анализа текущего состояния служб, выявления сбойных или остановленных служб с автоматическим типом запуска, проверки учетных записей запуска, PID процессов служб и безопасного изменения состояния (Start/Stop/Restart/Configure).

---

## 🏗️ Архитектура и интеграция с SDK

Навык базируется на компонентах `apps/windows/sdk`:
- **`WindowsSDK.modules.services` / `ServicesManager`** (`apps/windows/sdk/modules/services_manager/core/manager.py`):
  Высокоуровневый менеджер служб со сверхбыстрым кэшированием снимков в SQLite (`telemetry.db` < 5 мс) и прямым опросом Service Control Manager.
- **`windows_sdk.native.scm` (`ServiceManagerFFI`)** (`apps/windows/sdk/native/scm.py`):
  Прямой низкоуровневый C-FFI доступ к Win32 API `advapi32.dll` (`OpenSCManagerW`, `OpenServiceW`, `QueryServiceStatusEx`, `EnumServicesStatusExW`, `ControlService`, `ChangeServiceConfigW`).
- **`ServicesCollector`** (`apps/windows/sdk/core/audits/services_collector.py`):
  Коллектор глубокого аудита служб, типов автозапуска и связей с процессами для телеметрии.

---

## 🚀 Основные возможности

1. **Экспресс-инспекция и аудит всех служб Windows**:
   - Получение списка всех зарегистрированных служб со статусами (`RUNNING`, `STOPPED`, `START_PENDING`, `STOP_PENDING`, `PAUSED`).
   - Анализ типов запуска (`Automatic`, `Manual`, `Disabled`, `Delayed-Auto`).
   - Идентификация PID процессов, связанных со службами, исполняемых файлов (`binary_path`) и учетных записей (`LocalSystem`, `LocalService`, `NetworkService`, пользовательские).
2. **Диагностика проблемных служб**:
   - Выявление остановленных служб с типом автозапуска `Automatic`.
   - Обнаружение «осиротевших» (orphaned) служб с отсутствующими бинарными файлами.
3. **Безопасное управление службами (SafeOps)**:
   - Запуск, остановка, перезапуск и изменение типа запуска.
   - Поддержка симуляции изменений (`dry_run=True`).
   - Обязательная фиксация всех операций в журнал аудита изменений `service_change_events`.
4. **Сверхбыстрый доступ через кэш SQLite**:
   - Снимки состояния служб кэшируются в `telemetry.db`, что обеспечивает мгновенный ответ (< 5 мс) без задержек Win32 IPC при частых запросах.

---

## 🛠️ Примеры использования

### 1. Использование через Python SDK
```python
from apps.windows.sdk import windows_sdk

# Получение менеджера служб
services_mgr = windows_sdk.modules.services

# 1. Получение сводного отчета по службам
report = services_mgr.generate_report()
print(f"Всего служб: {report.total_services}, Запущено: {report.running_services}, Остановлено: {report.stopped_services}")

# 2. Поиск остановленных служб с автозапуском
all_services = services_mgr.list_services()
stopped_auto = [
    s for s in all_services 
    if s.status == 'STOPPED' and 'auto' in s.start_type.lower()
]
for s in stopped_auto:
    print(f"Внимание: служба '{s.display_name}' ({s.name}) настроена на автозапуск, но остановлена")

# 3. Принудительное обновление снимка из SCM в SQLite
refreshed_report = services_mgr.refresh_and_save()
```

### 2. Запуск через CLI
```powershell
# Сводный отчет и полный список служб в формате JSON:
py -m apps.windows.sdk.modules.services_manager --json

# Интерактивный TUI дашборд состояния служб:
py -m apps.windows.sdk.modules.services_manager

# Запуск REST API сервера служб:
py -m apps.windows.sdk.modules.services_manager --mode server --port 8123 --host 127.0.0.1
```

### 3. Низкоуровневый C-FFI вызов через Native SCM
```python
from apps.windows.sdk import windows_sdk

# Прямое обращение к Win32 advapi32.dll
scm = windows_sdk.native.scm
status = scm.get_service_status("wuauserv")
print(f"Windows Update Status: {status}")
```

---

## 🛡️ Безопасность и SafeOps
- Любое изменение состояния критических системных служб требует явного подтверждения (`confirmed_by_user=True`).
- В режиме по умолчанию для проверки плана действий всегда рекомендуется запускать проверку с флагом `dry_run=True`.
- Все события переключения статусов служб автоматически протоколируются в базу данных телеметрии.
