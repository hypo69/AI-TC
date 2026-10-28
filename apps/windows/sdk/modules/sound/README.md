# Модуль управления звуком Windows (Sound Module)

## Назначение
Модуль предоставляет программный интерфейс (SDK) для считывания и настройки параметров звуковой подсистемы Windows:
- Регулировка мастер-громкости (Master Volume) и переключение Master Mute.
- Управление громкостью системных звуков Windows (System Sounds).
- Аудио-микшер процессов (громкость и mute отдельных запущенных приложений с аудио-потоками).
- Получение списка устройств вывода и ввода звука.
- Управление звуковой схемой и звуком запуска Windows (Boot Animation Sound).
- Воспроизведение тестовых сигналов и быстрый запуск системных утилит звука (`ms-settings:sound`, `sndvol.exe`, `mmsys.cpl`).

## Архитектура
- `models.py` — Pydantic DTO модели для устройств, аудиосессий, звуковых схем и запросов.
- `manager.py` — реализация `SoundManager` на базе низкоуровневых COM-интерфейсов Windows Core Audio (WASAPI: `IMMDeviceEnumerator`, `IAudioEndpointVolume`, `IAudioSessionManager2`, `IAudioSessionControl2`, `ISimpleAudioVolume`) и системного реестра Windows.

## Использование
```python
from apps.windows.sdk.modules.sound import SoundManager

mgr = SoundManager()
state = mgr.get_state()
print(f"Мастер: {state.master_volume}%, Системные звуки: {state.system_sounds_volume}%")

# Регулировка громкости
mgr.set_master_volume(60)
mgr.set_system_sounds_volume(80)
mgr.play_test_sound("asterisk")
```
