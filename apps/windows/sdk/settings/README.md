# 🎛️ Windows Settings SDK (`apps.windows.sdk.settings`)

## 📋 Обзор модуля

Пакет **`apps.windows.sdk.settings`** предоставляет единый декларативный каталог системных параметров Windows Control Catalog, механизм определения совместимости для конкретной версии ОС (`SettingsResolver`) и модуль проверки фактических результатов (`SettingsVerification`).

## 🎛️ Компоненты пакета

1. **`catalog.py` (Windows Control Catalog)**:
   - Декларативное описание системных параметров: ID, категория, бэкенд, область действия, допустимые значения, уровень риска, человекочитаемое описание.
2. **`resolver.py` (Settings Resolver)**:
   - Интеллектуальный анализ сборки Windows (`sys.getwindowsversion().build`).
   - Возврат понятных статусов совместимости: `supported`, `version_dependent`, `unsupported`.
3. **`verification.py` (Settings Verification)**:
   - Считывание фактического текущего значения из Win32 API и реестра.
   - Сверка ожидаемого и реального состояния после выполнения команды.

## 💡 Пример использования в Python

```python
from apps.windows.sdk.settings import SettingsResolver, SettingsVerification

resolver = SettingsResolver()
info = resolver.resolve("TASKBAR.SET_POSITION")
print(f"Статус: {info.status}, Причина: {info.reason}")

verifier = SettingsVerification()
state = verifier.get_current_state("TASKBAR.SET_ALIGNMENT")
print(f"Текущее выравнивание: {state}")
```
