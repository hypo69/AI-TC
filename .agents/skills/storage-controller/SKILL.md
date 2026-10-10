---
name: storage-controller
description: Windows storage, physical disks, volumes, SMART telemetry, raw block I/O, sector cloning and drive management based on apps/windows/sdk.
description_i18n:
  en: Windows storage, physical disks, volumes, SMART telemetry, raw block I/O, sector cloning and drive management based on apps/windows/sdk.
  ru: Управление дисковой подсистемой Windows, физическими дисками, томами, SMART-телеметрией, прямым WinAPI I/O секторов и клонированием на базе apps/windows/sdk.
---

# 💾 Storage Controller (Windows Storage SDK)

## 🎯 Назначение
Навык `storage-controller` обеспечивает комплексный аудит, инвентаризацию и прямое управление дисковой подсистемой Windows через единый стек `apps/windows/sdk` (`WindowsSDK.modules.storage` и модуль `storage_manager`).

Навык заменяет разрозненные скрипты сканирования дисков на высокопроизводительную, безопасную архитектуру работы с физическими дисками (`PhysicalDrive`), логическими томами, SMART-телеметрией и прямым посекторным WinAPI I/O.

---

## 🏗️ Архитектура и интеграция с SDK

Навык базируется на компонентах `apps/windows/sdk`:
- **`WindowsSDK.modules.storage` / `StorageManager`** (`apps/windows/sdk/modules/storage_manager/core/manager.py`):
  Высокоуровневый фасад управления накопителями, разметкой и клонированием.
- **`WindowsRawDiskIO`** (`apps/windows/sdk/modules/storage_manager/core/raw_disk_io.py`):
  Низкоуровневые вызовы `kernel32.dll` (`CreateFileW`, `DeviceIoControl`) для прямого посекторного чтения/записи, инспекции геометрии диска, заголовков MBR/GPT и SMART NVMe/SATA.
- **`DiskCloneEngine`** (`apps/windows/sdk/modules/storage_manager/core/clone_engine.py`):
  Асинхронный блочный движок посекторного клонирования дисков и создания raw-образов (.img/.raw) с защитой SafeOps Dry-Run.
- **`StorageCollector`** (`apps/windows/sdk/core/audits/storage_collector.py`):
  Системный коллектор телеметрии дисков и файловых систем.

---

## 🚀 Основные возможности

1. **Инвентаризация физических дисков и логических томов**:
   - Получение списка всех подключенных дисков (`PhysicalDrive0..N`), интерфейсов (`NVMe`, `SATA`, `RAID`, `USB`), типов носителей (`SSD`, `HDD`) и стилей разметки (`GPT`, `MBR`).
   - Получение томов, букв дисков (`C:`, `D:`, ...), меток, файловых систем (`NTFS`, `ReFS`, `FAT32`), свободного и занятого пространства.
2. **Глубокая инспекция и SMART-телеметрия**:
   - Чтение геометрии (размер секторов, количество цилиндров/головок).
   - Инспекция таблицы разделов MBR/GPT.
   - Сбор показателей SMART: здоровье, температура, износ (`percentage_used`), объем записанных/прочитанных терабайт (TBW), счетчик небезопасных отключений.
3. **Прямое посекторное чтение и хеширование**:
   - Чтение произвольных LBA-секторов с формированием hex-дампов и base64-представлений.
   - Вычисление контрольных сумм SHA-256 диапазонов секторов.
4. **Посекторное клонирование и создание образов**:
   - Клонирование диск-в-диск в режимах `raw` и `smart`.
   - Создание raw-образов диска в файл и восстановление из образа.
   - Защита системного диска `PhysicalDrive0` от случайной перезаписи через SafeOps.

---

## 🛠️ Примеры использования

### 1. Использование через Python SDK
```python
from apps.windows.sdk import windows_sdk

# Получение физических дисков и томов
storage_mgr = windows_sdk.modules.storage
disks = storage_mgr.get_disks()
volumes = storage_mgr.get_volumes()

# Детальная инспекция диска (геометрия, разметка, SMART)
detailed_info = storage_mgr.get_disk_detailed(0)
print(f"Диск: {detailed_info.friendly_name}, SMART: {detailed_info.smart_status}, Температура: {detailed_info.smart_temperature_c}°C")

# Сводный отчет в формате StorageReport
report = storage_mgr.generate_report()
```

### 2. Запуск через CLI
```powershell
# Полная сводка по накопителям в формате JSON:
py -m apps.windows.sdk.modules.storage_manager --json

# Детальная инспекция физического диска (PhysicalDrive0):
py -m apps.windows.sdk.modules.storage_manager info 0

# Прямое чтение нулевого сектора (MBR / GPT header):
py -m apps.windows.sdk.modules.storage_manager read 0 --lba 0 --count 1

# Расчет SHA-256 хеша первых 2048 секторов диска:
py -m apps.windows.sdk.modules.storage_manager hash 0 --lba 0 --count 2048

# Интерактивный TUI дашборд состояния накопителей:
py -m apps.windows.sdk.modules.storage_manager
```

### 3. Запуск REST API сервера хранилища
```powershell
py -m apps.windows.sdk.modules.storage_manager server --port 8120 --host 127.0.0.1
```

---

## 🛡️ Безопасность и SafeOps
- Любые операции прямой записи на системный диск `PhysicalDrive0` по умолчанию блокируются.
- Для выполнения деструктивных операций клонирования/восстановления требуется явное указание подтверждения (`--confirm` или `confirmed_by_user=True`) либо запуск в режиме симуляции (`--dry-run`).
