# 🐚 Windows Shell SDK (`apps.windows.sdk.shell`)

## 📋 Обзор модуля

Пакет **`apps.windows.sdk.shell`** реализует управление параметрами оболочки Windows (Windows Explorer, Taskbar) с поддержкой тонких различий между Windows 10 и Windows 11.

## 🎛️ Возможности

1. **Положение панели задач (`TASKBAR.SET_POSITION`)**:
   - Чтение и запись байта 12 в бинарном блобе `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3\Settings`.
   - Поддерживаемые позиции: `bottom` (снизу), `top` (сверху), `left` (слева), `right` (справа).
   - В Windows 11 позиции сверху и по бокам имеют статус `version_dependent`, так как заблокированы проводником новой сборки.
2. **Выравнивание значков (`TASKBAR.SET_ALIGNMENT`)**:
   - `TaskbarAl` в `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` (0 — слева / `left`, 1 — по центру / `center`).
   - Активно в Windows 11; на Windows 10 имеет статус `unsupported` (значки всегда слева).
3. **Автоматическое скрытие панели задач (`TASKBAR.SET_AUTOHIDE`)**:
   - Shell API `SHAppBarMessage(ABM_SETSTATE, ABS_AUTOHIDE)` с синхронизацией в `StuckRects3`.

## 💡 Пример использования в Python

```python
from apps.windows.sdk.shell import TaskbarConfigManager

mgr = TaskbarConfigManager()
state = mgr.get_current_state()
print(f"Позиция: {state['position']}, Выравнивание: {state['alignment_label']}")

# Установить выравнивание по центру
mgr.set_alignment("center")
```
