<!-- Updated: 2026-10-10 23:08:00 -->
# Базовая линия производительности (этап 0 ТЗ оптимизации)

Дата замера: 2026-10-10. Среда: Windows, Python 3.14, коммит `bb13321`.

## Метрики

| Метрика | Значение |
|---|---|
| Импорт `apps.windows.api.server` (wall-clock, процесс целиком) | ≈ 2,4–2,9 с |
| Из них `apps.windows.sdk.client` (кумулятивно, `-X importtime`) | ≈ 2,2 с |
| `apps.windows.telemetry` (тянется через `sdk.native` → `win32_ffi.wevtapi`) | ≈ 0,9 с |
| `src.utils.printer` → `pandas` | ≈ 0,6 с (pandas ≈ 0,36 с) |
| `SystemCollector.get_snapshot(force_live=True)`, холодный запуск | 21,6 с |
| То же, повторные запуски | 8,5–8,8 с |
| Диагностика хранилища (PowerShell, внутри снапшота) | 6,4 с из ~8,5 с |
| Запусков подпроцессов за один «тёплый» снапшот | 5 |

## Подпроцессы за один снапшот (повторные запуски)

| Вызов | Раз за запуск |
|---|---|
| `Get-CimInstance Win32_PerfFormattedData...` | 2 |
| `nvidia-smi --query-gpu` | 1 |
| `Get-CimInstance Win32_VideoController` | 1 |
| `Get-CimInstance Win32_PnPEntity` | 1 |

## Узкие места внутри диагностики хранилища (кумулятивное время)

| Этап | Время, с |
|---|---|
| WMI SMART (`MSStorageDriver_FailurePredictData`) | ≈ 1,2 |
| SMART/надёжность (`Get-StorageReliabilityCounter`) | ≈ 1,9 |
| Счётчики `Get-Counter PhysicalDisk` | ≈ 1,4 |
| Журналы `Get-WinEvent` | ≈ 0,3 |

## Выводы для следующих этапов

1. Главный резерв — снапшот: хранилище (6,4 с) нужно кэшировать с TTL и убрать из «живого» пути, а `Win32_PerfFormattedData`, `VideoController`, `PnPEntity` — заменить на `psutil`/кэш (этап 3).
2. Холодный старт 21,6 с против 8,6 с — первичная инициализация (PowerShell/WMI, аппаратное дерево) подлежит ленивой загрузке.
3. Импорт: убрать зависимость `sdk.native` от пакета `telemetry` (≈ 0,9 с) и лениво импортировать `pandas` в `src.utils`.

## Воспроизведение

- Тесты точки входа: `py -m pytest tests/test_tc_launcher.py`.
- Импорт: `py -X importtime -c "import apps.windows.api.server"`.
- Снапшот: замер `SystemCollector().get_snapshot(force_live=True)` с подсчётом `subprocess.Popen`.
