# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin - Main WebGUI & API Entrypoint
# =============================================================================
# Description:
#   Главная точка входа в систему AI-Windows-Admin (WebGUI и FastAPI сервер).
#   Управляет конфигурацией, освобождением портов, запуском выделенных служб
#   и стартом веб-интерфейса через Uvicorn.
#
# Usage Examples:
#   CLI:
#     python main.py
#     python main.py --host 127.0.0.1 --port 8000
#     python main.py --no-browser
#
# File: main.py
# Project: ai-windows-admin
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-22 14:40:00
# =============================================================================

from __future__ import annotations
"""Главная точка входа для WebGUI и FastAPI сервера AI-Windows-Admin."""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

# 1. Настройка кодировки UTF-8 для Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"

# 2. Определение базовой директории приложения (с поддержкой PyInstaller _MEIPASS)
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
    EXE_DIR = Path(sys.executable).parent
    PROJECT_ROOT = EXE_DIR
else:
    PROJECT_ROOT = Path(__file__).resolve().parent
    BASE_DIR = PROJECT_ROOT
    EXE_DIR = PROJECT_ROOT

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ["AIBREADBOARD_DIR"] = str(EXE_DIR)
os.environ["ASSIST_DIR"] = str(EXE_DIR)
os.environ["ENABLE_OAUTH"] = "false"
os.environ["DISABLE_AUTH"] = "true"

try:
    from logger import logger
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    logger = logging.getLogger("main_server")


def free_port_if_occupied(port: int) -> None:
    """Освобождает указанный TCP порт, завершая конфликтные процессы.

    Args:
        port: Номер TCP порта для освобождения.
    """
    try:
        import psutil
        occupied_pids = set()
        for conn in psutil.net_connections(kind='inet'):
            if conn.laddr and conn.laddr.port == port and conn.pid:
                if conn.pid != os.getpid() and conn.pid != 0:
                    occupied_pids.add(conn.pid)

        for pid in occupied_pids:
            try:
                proc = psutil.Process(pid)
                proc_name = proc.name()
                proc.kill()
                logger.info(f"[OK] Освобожден порт {port} (завершен процесс {proc_name}, PID {pid})")
            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                logger.warning(f"[WARN] Не удалось завершить процесс PID {pid} на порту {port}: {e}")
    except Exception as e:
        logger.warning(f"[WARN] Проверка порта {port} через psutil не удалась: {e}")


def ensure_external_config(exe_dir: Path, base_dir: Path) -> Path:
    """Проверяет наличие внешнего config.json в директории с .exe и копирует при отсутствии.

    Args:
        exe_dir: Путь к исполняемой директории.
        base_dir: Базовая директория проекта.

    Returns:
        Path: Путь к целевому файлу конфигурации.
    """
    target_config = exe_dir / "config.json"
    if not target_config.is_file():
        source_candidates = [
            base_dir / "config.json",
            base_dir / "apps" / "windows" / "api" / "config.json",
            base_dir / "start_scenarios_config" / "tc.json",
        ]
        for src in source_candidates:
            if src.is_file():
                try:
                    shutil.copy2(src, target_config)
                    logger.info(f"[OK] Внешний файл конфигурации скопирован: {target_config} (из {src.name})")
                    return target_config
                except Exception as exc:
                    logger.warning(f"[WARN] Не удалось скопировать {src} -> {target_config}: {exc}")
    return target_config


def load_config(config_arg: Optional[str] = None) -> Tuple[Dict[str, Any], Path]:
    """Загружает конфигурационный файл config.json / tc.json.

    Args:
        config_arg: Пользовательский путь к файлу конфигурации.

    Returns:
        Tuple[Dict[str, Any], Path]: Словарь конфигурации и путь к файлу.
    """
    ensure_external_config(EXE_DIR, BASE_DIR)

    possible_paths = []
    if config_arg:
        possible_paths.append(Path(config_arg))
        possible_paths.append(EXE_DIR / config_arg)
        possible_paths.append(BASE_DIR / config_arg)

    possible_paths.extend([
        EXE_DIR / "config.json",
        EXE_DIR / "start_scenarios_config" / "tc.json",
        BASE_DIR / "config.json",
        BASE_DIR / "apps" / "windows" / "api" / "config.json",
        BASE_DIR / "start_scenarios_config" / "tc.json",
    ])

    config_file = None
    for p in possible_paths:
        if p.is_file():
            config_file = p
            break

    cfg: Dict[str, Any] = {}
    if config_file:
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            logger.info(f"[OK] Конфигурация загружена: {config_file}")
        except Exception as e:
            logger.error(f"[ERROR] Ошибка чтения конфигурации {config_file}: {e}")
    else:
        logger.warning("[WARN] Файл конфигурации config.json/tc.json не найден, используются значения по умолчанию")

    return cfg, (config_file or (EXE_DIR / "config.json"))


def setup_ai_environment(cfg: Dict[str, Any]) -> None:
    """Экспортирует AI-переменные окружения для Gemini и AGY.

    Args:
        cfg: Словарь системной конфигурации.
    """
    ai_cfg = cfg.get("ai", {})
    if ai_cfg.get("provider"):
        os.environ["AI_PROVIDER"] = str(ai_cfg["provider"])
    if ai_cfg.get("gemini", {}).get("model"):
        os.environ["AI_GEMINI_MODEL"] = str(ai_cfg["gemini"]["model"])
    if ai_cfg.get("gemini_cli", {}).get("model"):
        os.environ["AI_GEMINI_CLI_MODEL"] = str(ai_cfg["gemini_cli"]["model"])
    if ai_cfg.get("agy", {}).get("model"):
        os.environ["AI_AGY_MODEL"] = str(ai_cfg["agy"]["model"])
    if ai_cfg.get("agy", {}).get("effort"):
        os.environ["AI_AGY_EFFORT"] = str(ai_cfg["agy"]["effort"])


def launch_dedicated_apps(cfg: Dict[str, Any]) -> None:
    """Запускает выделенные подприложения из списка apps.enabled.

    Args:
        cfg: Словарь системной конфигурации.
    """
    apps_cfg = cfg.get("apps", {})
    enabled_apps = apps_cfg.get("enabled", [])
    disabled_apps = set(apps_cfg.get("disabled", []))
    launchers_dir = EXE_DIR / "launchers"

    for app_name in enabled_apps:
        if app_name in disabled_apps:
            continue

        app_cfg_paths = [
            EXE_DIR / "apps" / app_name / "config.json",
            EXE_DIR / "apps" / "windows" / app_name / "config.json",
            BASE_DIR / "apps" / app_name / "config.json",
            BASE_DIR / "apps" / "windows" / app_name / "config.json",
        ]
        app_cfg_file = next((p for p in app_cfg_paths if p.is_file()), None)
        if not app_cfg_file:
            continue

        try:
            with open(app_cfg_file, 'r', encoding='utf-8') as f:
                app_cfg = json.load(f)

            is_dedicated = (
                app_cfg.get("server", {}).get("dedicated") is True
                or app_cfg.get("server", {}).get("mode", "").lower() == "dedicated"
            )
            launcher = app_cfg.get("launcher")

            if is_dedicated and launcher:
                logger.info(f"Запуск dedicated-приложения: {app_name} ({launcher})...")
                launcher_path = launchers_dir / launcher
                if launcher_path.is_file():
                    subprocess.Popen(
                        [sys.executable, str(launcher_path), "--action", "start"],
                        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0,
                    )
        except Exception as e:
            logger.warning(f"[WARN] Ошибка запуска приложения {app_name}: {e}")


def parse_arguments() -> argparse.Namespace:
    """Парсит аргументы командной строки веб-сервера.

    Returns:
        argparse.Namespace: Распарсенные аргументы запуска.
    """
    parser = argparse.ArgumentParser(
        description="AI-Windows-Admin WebGUI & API Server Entrypoint",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('-H', '--host', '--address', dest='host', type=str, default=None, help='Хост веб-сервера (по умолчанию 127.0.0.1)')
    parser.add_argument('-P', '--port', dest='port', type=int, default=None, help='Порт веб-сервера (по умолчанию 8000)')
    parser.add_argument('-C', '--config', type=str, default=None, help='Путь к конфигурационному файлу config.json')
    parser.add_argument('--no-browser', dest='no_browser', action='store_true', help='Отключить автоматическое открытие браузера')
    return parser.parse_args()


def main() -> int:
    """Точка входа запуска WebGUI сервера AI-Windows-Admin.

    Returns:
        int: Код возврата процесса.
    """
    args = parse_arguments()
    cfg, config_path = load_config(args.config)

    server_cfg = cfg.get("server", {})
    host = args.host or server_cfg.get("host", "127.0.0.1")
    port = args.port or int(server_cfg.get("port", 8000))
    use_ssl = server_cfg.get("protocol", "").lower() == "https" or server_cfg.get("use_ssl") is True

    try:
        rel_config_path = str(config_path.relative_to(EXE_DIR))
    except Exception:
        rel_config_path = str(config_path)

    os.environ["CONFIG_FILE"] = rel_config_path
    os.environ["AIBREADBOARD_CONFIG"] = rel_config_path

    setup_ai_environment(cfg)
    free_port_if_occupied(port)
    launch_dedicated_apps(cfg)

    proto = "https" if use_ssl else "http"
    browser_host = "localhost" if host == "0.0.0.0" else host
    tc_url = f"{proto}://{browser_host}:{port}/tc"

    logger.info("=" * 60)
    logger.info(" AI-Windows-Admin (WebGUI Server Mode)")
    logger.info(f"  Хост: {host}")
    logger.info(f"  Порт: {port}")
    logger.info(f"  URL:  {tc_url}")
    logger.info("=" * 60)

    if not args.no_browser:
        try:
            webbrowser.open(tc_url)
        except Exception as e:
            logger.warning(f"Не удалось открыть браузер: {e}")

    import uvicorn
    from apps.windows.api.server import get_app

    app = get_app()
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
