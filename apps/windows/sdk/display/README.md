# 🖥️ Windows Display SDK (`apps.windows.sdk.display`)

## 📋 Обзор модуля

Пакет **`apps.windows.sdk.display`** реализует низкоуровневое управление мониторами, экранной геометрией и ориентацией дисплеев Windows через документированные Win32 User32 FFI API (`EnumDisplayDevicesW`, `EnumDisplaySettingsW`, `ChangeDisplaySettingsExW`).

## 🎛️ Возможности

1. **Обнаружение мониторов (`list_displays`)**:
   - Перечисление видеоадаптеров и подключенных к рабочему столу дисплеев.
   - Идентификация основного дисплея (`is_primary`), разрешения, частоты обновления (Гц).
2. **Ориентация экранов (`MONITOR.ROTATE`)**:
   - `landscape` (Альбомная, 0°)
   - `portrait` (Портретная, 90°)
   - `landscape_flipped` (Альбомная перевёрнутая, 180°)
   - `portrait_flipped` (Портретная перевёрнутая, 270°)
3. **Безопасность и автоматический откат (SafeOps Rollback)**:
   - Автоматический запуск таймера подтверждения (по умолчанию 15 секунд).
   - Если пользователь не подтвердил читаемость режима или произошел сбой — фоновый поток автоматически возвращает исходную ориентацию экрана (`confirm_rotation`, `rollback_rotation`).

## 💡 Пример использования в Python

```python
from apps.windows.sdk.display import DisplayConfigManager, DisplayOrientation

mgr = DisplayConfigManager()
displays = mgr.list_displays()

if displays:
    # Повернуть основной монитор в портретный режим с авто-откатом через 15с
    res = mgr.rotate_display(displays[0].id, DisplayOrientation.PORTRAIT, timeout_seconds=15)
    if res.success:
        print(f"Экран повернут: {res.actual_orientation}")
        # Подтверждение
        mgr.confirm_rotation(displays[0].id)
```
