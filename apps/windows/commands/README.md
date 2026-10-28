# ⚡ Windows Commands Plane (`apps.windows.commands`)

## 📋 Обзор модуля

Пакет **`apps.windows.commands`** реализует единый исполнитель команд управления системой Windows (`WindowsSettingsExecutor`) по универсальному контракту:
- `validate()` — проверка допустимости и ограничений сборки ОС через `SettingsResolver`.
- Снимок предыдущего состояния для надежного отката (`rollback`).
- `apply()` — передача вызова в целевой бэкенд (Win32 API, Registry, Shell API, PowerShell).
- `verify()` — сверка фактического состояния через `SettingsVerification`.

## 📑 Единый контракт команды

```json
// Запрос:
{
    "command": "MONITOR.ROTATE",
    "params": {
        "display_id": "\\\\.\\DISPLAY1",
        "orientation": "portrait"
    }
}

// Ответ:
{
    "success": true,
    "command": "MONITOR.ROTATE",
    "requested": { "orientation": "portrait" },
    "actual": { "orientation": "portrait" },
    "error": null,
    "rollback_supported": true
}
```

## 💡 Пример использования в Python

```python
from apps.windows.commands import WindowsSettingsExecutor

executor = WindowsSettingsExecutor()
result = executor.execute("TASKBAR.SET_ALIGNMENT", {"alignment": "center"})
if result.success:
    print(f"Команда выполнена: {result.actual}")

# Откат последнего действия:
executor.rollback("TASKBAR.SET_ALIGNMENT")
```
