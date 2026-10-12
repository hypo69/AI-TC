# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - helpers
# =============================================================================
# Description:
#   Вспомогательные функции панели «О системе».
#   Вынесено из router_about_system.py (этап 4 оптимизации).
#
# File: helpers.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.about_system
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:20:00
# =============================================================================

from __future__ import annotations

import json
import os
import platform
from typing import Any, Dict


from logger import logger
from apps.windows.telemetry.sqlite import TelemetryStorage


def get_windows_workgroup() -> str:
    """Возвращает текущее имя рабочей группы (Workgroup) или домена Windows."""
    if os.name == 'nt':
        try:
            import ctypes
            from ctypes import wintypes
            netapi32 = ctypes.windll.netapi32
            lp_buf = wintypes.LPWSTR()
            join_stat = wintypes.DWORD()
            if netapi32.NetGetJoinInformation(None, ctypes.byref(lp_buf), ctypes.byref(join_stat)) == 0:
                name = lp_buf.value
                netapi32.NetApiBufferFree(lp_buf)
                if name:
                    return name
        except Exception as exc:
            logger.debug(f"[router_about_system] Ошибка получения рабочей группы через NetGetJoinInformation: {exc}")
    return "WORKGROUP"


def _format_uptime_human(seconds: float) -> str:
    """Форматирует секунды аптайма в человекочитаемую строку."""
    sec = int(max(0.0, seconds))
    hours = sec // 3600
    minutes = (sec % 3600) // 60
    return f"{hours}h {minutes}m"


def _get_latest_snapshot_dict(storage: TelemetryStorage) -> Dict[str, Any]:
    """Извлекает и десериализует последний снимок из таблицы system_snapshots."""
    snapshots = storage.get_snapshots(limit=1)
    if not snapshots:
        return {}

    snap_row = dict(snapshots[0])
    raw_json_str = snap_row.get("raw_json")
    if raw_json_str:
        try:
            return json.loads(raw_json_str)
        except Exception as err:
            logger.debug(f"[router_about_system] Ошибка парсинга raw_json снимка: {err}")

    disks_str = snap_row.get("disks_json")
    if disks_str and isinstance(disks_str, str):
        try:
            snap_row["disks"] = json.loads(disks_str)
        except Exception as err:
            logger.debug(f"[router_about_system] Ошибка парсинга disks_json снимка: {err}")

    return snap_row


def _get_cpu_brand_name() -> str:
    """Получение коммерческого названия процессора (Brand Name) из реестра Windows или WMI."""
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as key:
                val, _ = winreg.QueryValueEx(key, "ProcessorNameString")
                if val and val.strip():
                    return val.strip()
        except Exception:
            pass
    model = platform.processor() or ""
    if not model or "Intel64" in model or "AMD64" in model:
        return "Intel Core Processor" if "Intel" in model else "AMD Processor"
    return model
