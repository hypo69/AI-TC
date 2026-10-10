# Deep Software Scanner (Глубокий сканер следов ПО)

Модуль глубокого анализа и инвентаризации установленного, неиспользуемого (dormant), портативного и удаленного программного обеспечения в операционной системе Windows.

## 📌 Возможности
1. **Многоуровневый сбор следов (Evidence Probes):**
   - `registry_probe.py`: 32/64-бит ключи `Uninstall`, `App Paths`, `Run/RunOnce`.
   - `filesystem_probe.py`: Безопасный рекурсивный обход `Program Files`, `AppData`, `ProgramData`, корней других дисков (`D:\`, `E:\`), парсинг `.lnk`-ярлыков, защита от зацикливания symlink/junction.
   - `services_probe.py`: Системные службы Windows (SCM) с проверкой реального наличия бинарных файлов на диске.
   - `tasks_probe.py`: Задачи планировщика Windows Task Scheduler.
   - `packages_probe.py`: Пакеты AppX / Microsoft Store, Scoop, Chocolatey.
   - `execution_evidence.py`: Артефакты запусков (UserAssist ROT13, Prefetch `*.pf`, Recent Items).
2. **Анализ метаданных PE-файлов:**
   - `metadata_extractor.py`: Извлечение `CompanyName`, `ProductName`, `FileVersion`, `FileDescription`, `OriginalFilename`, расчет SHA-256.
3. **Детектор сирот и остатков (Orphan Detection):**
   - `orphan_detector.py`: Выявление битых служб, задач планировщика и записей деинсталлятора, ссылающихся на несуществующие пути.
4. **Корреляция и классификация активности:**
   - `correlator.py`: Сведение сотен следов в единые карточки ПО с расчетом дней без запусков и классификацией:
     - `Active` (< 60 дней)
     - `Dormant` (> 90 дней или без подтвержденных запусков)
     - `Orphan` (остатки)
     - `Portable` / `Store App`

## 🚀 Быстрый старт (Python API)
```python
from apps.windows.sdk.software_scanner import DeepSoftwareScanner, ScanMode, ReportFormatter

scanner = DeepSoftwareScanner()

# Режимы: ScanMode.QUICK, ScanMode.DEEP, ScanMode.FORENSIC, ScanMode.ORPHANS, ScanMode.TARGETED
report = scanner.run_scan(mode=ScanMode.DEEP)

# Экспорт в Markdown
print(ReportFormatter.format_summary_markdown(report))

# Экспорт в JSON
json_output = ReportFormatter.to_json(report)
```

## 🌐 REST API Маршруты (FastAPI)
- `POST /api/windows/software-scanner/scan` — Запуск сканирования по требованию.
- `GET /api/windows/software-scanner/latest-report` — Получение последнего отчета.
- `GET /api/windows/software-scanner/dormant?min_days=90` — Список спящих программ.
- `GET /api/windows/software-scanner/orphans` — Список обнаруженных остатков и битых служб.
