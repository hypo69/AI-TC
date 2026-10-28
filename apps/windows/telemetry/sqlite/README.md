# Пакет `apps.windows.telemetry.sqlite`

**Updated:** 2026-10-14 02:15:00

Хранилище системной телеметрии на SQLite (`telemetry.db`): фасад `TelemetryStorage`, подсистемы записи (`writer*.py`), чтения (`reader*.py`), схемы (`schema*.py`), буферизации, агрегации и обслуживания.

## Принцип Change-Only (только дельты)

В БД пишутся только **изменения** относительно прошлых значений.

| Данные | Механизм | Что пишется |
|---|---|---|
| Службы, правила и профили брандмауэра | `DeltaInventory` (`delta_inventory.py`) → `inventory_state` + `inventory_changes` | только `added` / `removed` / `modified` с датой обнаружения (`detected_at`); в `inventory_state` хранятся `first_seen`, `last_changed`, `removed_at` |
| Аудит оборудования, снимки автозапуска | `insert_hardware_archive_row` / `insert_startup_archive_row` | новый снимок пишется только при `changes_count > 0` (или если базового снимка ещё нет); сами изменения — в `startup_changes` |
| Системные снимки (`system_snapshots`) | `DeltaStateTracker` (`delta_tracker.py`) | неизменившиеся поля = `NULL`, восстановление — LOCF; состояние трекера восстанавливается из БД при старте (`ensure_seeded`), поэтому рестарт не перезаписывает статику; `raw_json` (без `top_processes`) пишется только при изменении статических полей (не из `VOLATILE_FIELDS`) |
| Очистка (`maintenance.py`) | `_locf_anchor_ids` | строки с последним известным значением статических полей не удаляются по сроку давности |

### Пример

```python
from apps.windows.telemetry.sqlite import TelemetryStorage

storage = TelemetryStorage.get_instance()
storage.save_services_snapshot('poll-1', services)        # 0 — если ничего не изменилось
changes = storage.get_inventory_changes('services', limit=20)
# [{'entity_key': 'Spooler', 'change_type': 'removed', 'detected_at': '2026-10-14T...', 'old': {...}, 'new': None}, ...]
```

## Тесты

```powershell
pytest apps/windows/telemetry/tests/test_delta_inventory.py
```
