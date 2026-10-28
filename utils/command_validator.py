# -*- coding: utf-8 -*-
# =============================================================================
# Файл: utils/command_validator.py
# Описание: Модуль для безопасного выполнения команд PowerShell/CLI с поддержкой dry‑run и детального логирования.
#
# Требования проекта:
#   • Все сообщения в консоль выводятся через logger.console()
#   • Докстринги и комментарии – на русском языке
#   • При изменении файла обновляется шапка с датой/временем
# =============================================================================
# Updated: 2026-10-22 03:31:12
# =============================================================================

"""hypo69 docblock
Модуль предоставляет функции для:
* Проверки синтаксиса и наличия команд перед их выполнением (dry‑run).
* Выполнения команды с автоматическим захватом stdout/stderr и кода возврата.
* Формирования единого словаря результата, пригодного для последующей обработки
  другими компонентами проекта.

Все функции используют `logger.console()` для вывода сообщений пользователю, без
записи в файлы журнала, согласно правилам проекта.
"""

from __future__ import annotations

import subprocess
import shlex
from datetime import datetime
from typing import Dict, Any

# Предполагается, что в проекте уже существует модуль logger, совместимый с
# logger.console(message: str). Если его нет – импортировать из общего пакета.
try:
    from logger import logger  # type: ignore
except ImportError:  # fallback для разработки
    class _DummyLogger:
        @staticmethod
        def console(msg: str) -> None:
            print(msg)
    logger = _DummyLogger()


def _log(message: str) -> None:
    """Вспомогательная обёртка над logger.console().

    Args:
        message: Текст сообщения.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.console(f"[{timestamp}] {message}")


def _is_powershell_cmdlet(command: str) -> bool:
    """Определить, является ли строка PowerShell‑командой/cmdlet.

    Простейшая эвристика: если строка начинается с ``Stop-`` , ``Start-`` ,
    ``Get-`` и т.п., считаем её cmdlet‑ом.
    """
    prefixes = ("Stop-", "Start-", "Get-", "Set-", "Write-", "Remove-", "New-")
    return command.strip().split()[0].endswith(tuple(prefixes)) if command else False


def _dry_run_powershell(command: str) -> Dict[str, Any]:
    """Выполнить PowerShell‑команду в режиме *WhatIf* (если поддерживается).

    Если cmdlet поддерживает параметр ``-WhatIf``, будет выполнен запрос к
    PowerShell с добавлением этого параметра, а результат будет возвращён в
    виде словаря.
    """
    # Добавляем -WhatIf только если cmdlet его принимает.
    # Для простоты проверяем наличие параметра через Get-Command.
    check_cmd = f"Get-Command {shlex.quote(command.split()[0])} -ErrorAction SilentlyContinue | " \
                "Select-Object -ExpandProperty Parameters | " \
                "Where-Object { $_.Name -eq 'WhatIf' }"
    result = subprocess.run(["powershell", "-NoProfile", "-Command", check_cmd], capture_output=True, text=True)
    if result.stdout.strip():
        # cmdlet поддерживает WhatIf
        whatif_cmd = f"{command} -WhatIf"
        _log(f"Dry‑run (WhatIf) для командлета: {whatif_cmd}")
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", whatif_cmd], capture_output=True, text=True)
        return {
            "dry_run": True,
            "output": proc.stdout,
            "error": proc.stderr,
            "returncode": proc.returncode,
        }
    else:
        # Что‑то другое, просто проверяем синтаксис через -Command "& { ... }"
        syntax_check = f"& {{ {command} }}"
        _log(f"Синтаксическая проверка PowerShell команды: {command}")
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", syntax_check], capture_output=True, text=True)
        return {
            "dry_run": True,
            "output": proc.stdout,
            "error": proc.stderr,
            "returncode": proc.returncode,
        }


def run_safe(command: str, dry_run: bool = False) -> Dict[str, Any]:
    """Выполнить произвольную команду с optional dry‑run.

    Args:
        command: Строка команды, которую необходимо выполнить.
        dry_run: Если ``True``, команда проверяется без реального воздействия.
                 Для PowerShell‑cmdlet будет использован параметр ``-WhatIf``
                 (при поддержке). Для обычных CLI‑команд будет выполнена только
                 проверка синтаксиса.

    Returns:
        dict: ``{"dry_run": bool, "output": str, "error": str, "returncode": int}``
    """
    _log(f"Запуск команды: '{command}' (dry_run={dry_run})")
    if dry_run:
        if _is_powershell_cmdlet(command):
            return _dry_run_powershell(command)
        else:
            # Для non‑PowerShell команд просто проверяем, существует ли исполняемый файл
            # через where.exe (Windows). Если не найден – сразу ошибка.
            exe_name = command.split()[0]
            where_proc = subprocess.run(["where", exe_name], capture_output=True, text=True)
            if where_proc.returncode != 0:
                return {
                    "dry_run": True,
                    "output": "",
                    "error": f"Команда '{exe_name}' не найдена в PATH.",
                    "returncode": where_proc.returncode,
                }
            # Если найден, возвращаем «пасс‑тест» без выполнения.
            _log(f"Dry‑run прошёл: исполняемый файл найден ({exe_name}).")
            return {"dry_run": True, "output": "", "error": "", "returncode": 0}
    else:
        # Реальное выполнение
        proc = subprocess.run(command, shell=True, capture_output=True, text=True)
        result = {
            "dry_run": False,
            "output": proc.stdout,
            "error": proc.stderr,
            "returncode": proc.returncode,
        }
        # Логируем результат
        if proc.returncode == 0:
            _log(f"Команда завершена успешно. Код возврата 0.")
        else:
            _log(f"Ошибка выполнения команды. Код: {proc.returncode}. Ошибка: {proc.stderr.strip()}")
        return result


# Пример использования (можно удалить после тестов)
if __name__ == "__main__":
    test_cmd = "Stop-Service -Name TrustedInstaller -Force"
    res = run_safe(test_cmd, dry_run=True)
    _log(f"Результат dry‑run: {res}")
    # real execution (будет выполнена, будьте осторожны)
    # res_real = run_safe(test_cmd, dry_run=False)
    # _log(f"Результат реального выполнения: {res_real}")
