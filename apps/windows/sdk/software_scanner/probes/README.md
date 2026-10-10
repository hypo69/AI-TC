# Зонды сбора данных (Software Scanner Probes)

Пакет специализированных зондов глубокого сканирования следов программного обеспечения.

## Состав зондов
- `registry_probe.py` — Сбор установленных программ из Uninstall, App Paths и автозагрузки (Run/RunOnce).
- `filesystem_probe.py` — Обход файловых каталогов установки и профилей пользователей с ограничением глубины и контролем нагрузки.
- `services_probe.py` — Опрос служб Windows (SCM) с проверкой существования исполняемых файлов на диске.
- `tasks_probe.py` — Опрос задач планировщика Windows Task Scheduler.
- `packages_probe.py` — Опрос AppX / Microsoft Store, Scoop и Chocolatey.
- `execution_evidence.py` — Сбор артефактов запусков: UserAssist (ROT13), Prefetch (`*.pf`) и Recent Items.
