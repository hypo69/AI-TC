# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - endpoints_system
# =============================================================================
# Description:
#   Эндпойнты изменения параметров системы.
#   Вынесено из router_about_system.py (этап 4 оптимизации).
#
# File: endpoints_system.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.about_system
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:20:00
# =============================================================================

from __future__ import annotations

import asyncio
import json
import os
import platform
import re
import subprocess
from typing import List

from fastapi import APIRouter

from logger import logger
from apps.windows.telemetry.sqlite import TelemetryStorage
from .helpers import get_windows_workgroup
from .models import ChangeWorkgroupRequest
from .models import ChangeWorkgroupResponse
from .models import LocaleOption
from .models import RegionalOptionsResponse
from .models import RenameComputerRequest
from .models import RenameComputerResponse
from .models import SetLocaleRequest
from .models import SetLocaleResponse
from .models import SetTimezoneRequest
from .models import SetTimezoneResponse
from .models import TimezoneOption
from .models import UpdateUserProfileRequest
from .models import UpdateUserProfileResponse


def register_system_action_endpoints(router: APIRouter, storage: TelemetryStorage) -> None:
    """Регистрирует эндпойнты изменения имени, рабочей группы, региона и профиля."""
    # =========================================================================
    # 9. Переименование компьютера: POST /api/v1/system/rename-computer
    # =========================================================================
    @router.post("/api/v1/system/rename-computer", response_model=RenameComputerResponse)
    async def rename_computer_endpoint(req: RenameComputerRequest) -> RenameComputerResponse:
        """Переименование компьютера в Windows через команду Rename-Computer."""
        old_name = platform.node() or "Host"
        clean_name = req.new_name.strip()

        # Валидация NetBIOS имени хоста
        if not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,13}[a-zA-Z0-9])?$", clean_name):
            return RenameComputerResponse(
                status="error",
                old_name=old_name,
                new_name=clean_name,
                message="Недопустимый формат имени. Разрешены буквы (A-Z), цифры (0-9) и дефис (-), длина от 1 до 15 символов.",
                restart_scheduled=False,
            )

        if clean_name.lower() == old_name.lower():
            return RenameComputerResponse(
                status="ok",
                old_name=old_name,
                new_name=clean_name,
                message="Имя совпадает с текущим. Изменения не требуются.",
                restart_scheduled=False,
            )

        try:
            cmd = f"Rename-Computer -NewName '{clean_name}' -Force"
            proc = await asyncio.create_subprocess_exec(
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace").strip() or stdout.decode("utf-8", errors="replace").strip()
                logger.warning(f"[router_about_system] Ошибка Rename-Computer: {err_text}")
                return RenameComputerResponse(
                    status="error",
                    old_name=old_name,
                    new_name=clean_name,
                    message=f"Ошибка переименования: {err_text}. Возможно, требуются права администратора.",
                    restart_scheduled=False,
                )

            msg = f"Имя компьютера успешно изменено на '{clean_name}'. Изменения вступят в силу после перезагрузки."
            if req.restart:
                await asyncio.create_subprocess_exec("shutdown.exe", "/r", "/t", "5", "/c", "AI-Windows-Admin: Перезагрузка для применения нового имени хоста.")
                msg += " Перезагрузка системы запланирована через 5 секунд."

            return RenameComputerResponse(
                status="ok",
                old_name=old_name,
                new_name=clean_name,
                message=msg,
                restart_scheduled=req.restart,
            )
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при переименовании компьютера: {exc}", exc_info=True)
            return RenameComputerResponse(
                status="error",
                old_name=old_name,
                new_name=clean_name,
                message=f"Внутренняя ошибка: {exc}",
                restart_scheduled=False,
            )

    # =========================================================================
    # 10. Изменение рабочей группы: POST /api/v1/system/change-workgroup
    # =========================================================================
    @router.post("/api/v1/system/change-workgroup", response_model=ChangeWorkgroupResponse)
    async def change_workgroup_endpoint(req: ChangeWorkgroupRequest) -> ChangeWorkgroupResponse:
        """Изменение рабочей группы в Windows через команду Add-Computer."""
        old_wg = get_windows_workgroup()
        clean_wg = req.new_workgroup.strip().upper()

        # Валидация NetBIOS имени рабочей группы
        if not re.match(r"^[a-zA-Z0-9_\-]{1,15}$", clean_wg):
            return ChangeWorkgroupResponse(
                status="error",
                old_workgroup=old_wg,
                new_workgroup=clean_wg,
                message="Недопустимый формат имени рабочей группы. Разрешены буквы (A-Z), цифры (0-9), дефис (-) и подчеркивание (_), длина от 1 до 15 символов.",
                restart_scheduled=False,
            )

        if clean_wg.lower() == old_wg.lower():
            return ChangeWorkgroupResponse(
                status="ok",
                old_workgroup=old_wg,
                new_workgroup=clean_wg,
                message="Имя рабочей группы совпадает с текущим. Изменения не требуются.",
                restart_scheduled=False,
            )

        try:
            cmd = f"Add-Computer -WorkGroupName '{clean_wg}' -Force"
            proc = await asyncio.create_subprocess_exec(
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace").strip() or stdout.decode("utf-8", errors="replace").strip()
                logger.warning(f"[router_about_system] Ошибка Add-Computer: {err_text}")
                return ChangeWorkgroupResponse(
                    status="error",
                    old_workgroup=old_wg,
                    new_workgroup=clean_wg,
                    message=f"Ошибка смены рабочей группы: {err_text}. Возможно, требуются права администратора.",
                    restart_scheduled=False,
                )

            msg = f"Рабочая группа успешно изменена на '{clean_wg}'. Изменения вступят в силу после перезагрузки."
            if req.restart:
                await asyncio.create_subprocess_exec("shutdown.exe", "/r", "/t", "5", "/c", "AI-Windows-Admin: Перезагрузка для применения новой рабочей группы.")
                msg += " Перезагрузка системы запланирована через 5 секунд."

            return ChangeWorkgroupResponse(
                status="ok",
                old_workgroup=old_wg,
                new_workgroup=clean_wg,
                message=msg,
                restart_scheduled=req.restart,
            )
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при смене рабочей группы: {exc}", exc_info=True)
            return ChangeWorkgroupResponse(
                status="error",
                old_workgroup=old_wg,
                new_workgroup=clean_wg,
                message=f"Внутренняя ошибка: {exc}",
                restart_scheduled=False,
            )

    # =========================================================================
    # 11. Получение региональных настроек: GET /api/v1/system/regional-options
    # =========================================================================
    @router.get("/api/v1/system/regional-options", response_model=RegionalOptionsResponse)
    async def get_regional_options_endpoint() -> RegionalOptionsResponse:
        """Получение текущих региональных параметров, списка часовых поясов и локалей."""
        def _fetch_options() -> RegionalOptionsResponse:
            current_tz_id = ""
            current_tz_name = ""
            current_sys_loc = "ru-RU"
            current_usr_loc = "ru-RU"
            username = os.environ.get("USERNAME", "User")
            user_fullname = ""
            user_desc = ""
            codepage = "UTF-8 (65001)"

            # Текущая таймзона
            try:
                proc = subprocess.run(["tzutil", "/g"], capture_output=True, text=True, timeout=2)
                if proc.returncode == 0 and proc.stdout.strip():
                    current_tz_id = proc.stdout.strip()
            except Exception as e:
                logger.debug(f"[router_about_system] Ошибка tzutil /g: {e}")

            # Список таймзон
            tz_list: List[TimezoneOption] = []
            try:
                ps_cmd = "[System.TimeZoneInfo]::GetSystemTimeZones() | Select-Object Id, DisplayName, @{N='Offset';E={$_.BaseUtcOffset.TotalMinutes}} | ConvertTo-Json -Compress"
                p = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps_cmd], capture_output=True, text=True, timeout=5)
                if p.returncode == 0 and p.stdout.strip():
                    data = json.loads(p.stdout.strip())
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get("Id"):
                                tz_list.append(TimezoneOption(
                                    id=str(item["Id"]),
                                    display_name=str(item.get("DisplayName", item["Id"])),
                                    offset_minutes=int(item.get("Offset") or 0)
                                ))
            except Exception as e:
                logger.debug(f"[router_about_system] Ошибка получения TimeZones: {e}")

            # Fallback для таймзон если список пуст
            if not tz_list:
                default_tzs = [
                    ("Dateline Standard Time", "(UTC-12:00) International Date Line West", -720),
                    ("Hawaiian Standard Time", "(UTC-10:00) Hawaii", -600),
                    ("Pacific Standard Time", "(UTC-08:00) Pacific Time (US & Canada)", -480),
                    ("Mountain Standard Time", "(UTC-07:00) Mountain Time (US & Canada)", -420),
                    ("Central Standard Time", "(UTC-06:00) Central Time (US & Canada)", -360),
                    ("Eastern Standard Time", "(UTC-05:00) Eastern Time (US & Canada)", -300),
                    ("UTC", "(UTC) Coordinated Universal Time", 0),
                    ("GMT Standard Time", "(UTC+00:00) Dublin, Edinburgh, Lisbon, London", 0),
                    ("W. Europe Standard Time", "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna", 60),
                    ("Israel Standard Time", "(UTC+02:00) Jerusalem", 120),
                    ("FLE Standard Time", "(UTC+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius", 120),
                    ("Russian Standard Time", "(UTC+03:00) Moscow, St. Petersburg", 180),
                    ("Arabic Standard Time", "(UTC+03:00) Baghdad, Riyadh", 180),
                    ("Arabian Standard Time", "(UTC+04:00) Abu Dhabi, Muscat", 240),
                    ("Ekaterinburg Standard Time", "(UTC+05:00) Ekaterinburg", 300),
                    ("India Standard Time", "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi", 330),
                    ("Omsk Standard Time", "(UTC+06:00) Omsk", 360),
                    ("SE Asia Standard Time", "(UTC+07:00) Bangkok, Hanoi, Jakarta", 420),
                    ("China Standard Time", "(UTC+08:00) Beijing, Chongqing, Hong Kong", 480),
                    ("Tokyo Standard Time", "(UTC+09:00) Osaka, Sapporo, Tokyo", 540),
                    ("AUS Eastern Standard Time", "(UTC+10:00) Canberra, Melbourne, Sydney", 600),
                    ("Vladivostok Standard Time", "(UTC+10:00) Vladivostok", 600),
                    ("New Zealand Standard Time", "(UTC+12:00) Auckland, Wellington", 720),
                ]
                for tid, tname, toff in default_tzs:
                    tz_list.append(TimezoneOption(id=tid, display_name=tname, offset_minutes=toff))

            if current_tz_id:
                for t in tz_list:
                    if t.id.lower() == current_tz_id.lower():
                        current_tz_name = t.display_name
                        break
                if not current_tz_name:
                    current_tz_name = current_tz_id

            # Локали
            try:
                p_loc = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "(Get-WinSystemLocale).Name; (Get-Culture).Name"], capture_output=True, text=True, timeout=3)
                if p_loc.returncode == 0:
                    lines = [l.strip() for l in p_loc.stdout.splitlines() if l.strip()]
                    if len(lines) >= 1:
                        current_sys_loc = lines[0]
                    if len(lines) >= 2:
                        current_usr_loc = lines[1]
            except Exception as e:
                logger.debug(f"[router_about_system] Ошибка получения локалей: {e}")

            # Пользователь
            try:
                p_usr = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", f"Get-LocalUser -Name '{username}' | Select-Object FullName, Description | ConvertTo-Json -Compress"], capture_output=True, text=True, timeout=3)
                if p_usr.returncode == 0 and p_usr.stdout.strip():
                    u_data = json.loads(p_usr.stdout.strip())
                    if isinstance(u_data, dict):
                        user_fullname = u_data.get("FullName") or ""
                        user_desc = u_data.get("Description") or ""
            except Exception as e:
                logger.debug(f"[router_about_system] Ошибка Get-LocalUser: {e}")

            curated_locales = [
                LocaleOption(code="ru-RU", name="Русский (Россия) [ru-RU]"),
                LocaleOption(code="en-US", name="English (United States) [en-US]"),
                LocaleOption(code="en-GB", name="English (United Kingdom) [en-GB]"),
                LocaleOption(code="he-IL", name="עברית (ישראל) [he-IL]"),
                LocaleOption(code="de-DE", name="Deutsch (Deutschland) [de-DE]"),
                LocaleOption(code="fr-FR", name="Français (France) [fr-FR]"),
                LocaleOption(code="es-ES", name="Español (España) [es-ES]"),
                LocaleOption(code="it-IT", name="Italiano (Italia) [it-IT]"),
                LocaleOption(code="zh-CN", name="中文 (简体, 中国) [zh-CN]"),
                LocaleOption(code="ja-JP", name="日本語 (日本) [ja-JP]"),
                LocaleOption(code="tr-TR", name="Türkçe (Türkiye) [tr-TR]"),
                LocaleOption(code="uk-UA", name="Українська (Україна) [uk-UA]"),
                LocaleOption(code="pl-PL", name="Polski (Polska) [pl-PL]"),
                LocaleOption(code="pt-BR", name="Português (Brasil) [pt-BR]"),
            ]

            return RegionalOptionsResponse(
                status="ok",
                current_timezone=current_tz_id,
                current_timezone_name=current_tz_name,
                current_system_locale=current_sys_loc,
                current_user_locale=current_usr_loc,
                current_username=username,
                current_user_fullname=user_fullname,
                current_user_description=user_desc,
                current_codepage=codepage,
                timezones=tz_list,
                locales=curated_locales,
            )

        return await asyncio.to_thread(_fetch_options)

    # =========================================================================
    # 12. Установка часового пояса: POST /api/v1/system/set-timezone
    # =========================================================================
    @router.post("/api/v1/system/set-timezone", response_model=SetTimezoneResponse)
    async def set_timezone_endpoint(req: SetTimezoneRequest) -> SetTimezoneResponse:
        """Изменение часового пояса Windows через tzutil /s."""
        tz_id = req.timezone_id.strip()
        if not re.match(r"^[a-zA-Z0-9_\-\.\s\(\)\+]+$", tz_id):
            return SetTimezoneResponse(
                status="error",
                old_timezone="",
                new_timezone=tz_id,
                message="Недопустимый идентификатор часового пояса.",
            )

        old_tz = ""
        try:
            p_old = await asyncio.create_subprocess_exec("tzutil.exe", "/g", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout_old, _ = await p_old.communicate()
            old_tz = stdout_old.decode("utf-8", errors="replace").strip()
        except Exception:
            pass

        try:
            proc = await asyncio.create_subprocess_exec(
                "tzutil.exe",
                "/s",
                tz_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace").strip() or stdout.decode("utf-8", errors="replace").strip()
                logger.warning(f"[router_about_system] Ошибка tzutil /s: {err_text}")
                return SetTimezoneResponse(
                    status="error",
                    old_timezone=old_tz,
                    new_timezone=tz_id,
                    message=f"Не удалось изменить часовой пояс: {err_text}. Требуются права администратора.",
                )

            return SetTimezoneResponse(
                status="ok",
                old_timezone=old_tz,
                new_timezone=tz_id,
                message=f"Часовой пояс успешно изменен на '{tz_id}'.",
            )
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при установке часового пояса: {exc}", exc_info=True)
            return SetTimezoneResponse(
                status="error",
                old_timezone=old_tz,
                new_timezone=tz_id,
                message=f"Внутренняя ошибка: {exc}",
            )

    # =========================================================================
    # 13. Установка системной локали: POST /api/v1/system/set-locale
    # =========================================================================
    @router.post("/api/v1/system/set-locale", response_model=SetLocaleResponse)
    async def set_locale_endpoint(req: SetLocaleRequest) -> SetLocaleResponse:
        """Изменение системной локали Windows через Set-WinSystemLocale."""
        loc = req.system_locale.strip()
        if not re.match(r"^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$", loc):
            return SetLocaleResponse(
                status="error",
                system_locale=loc,
                message="Некорректный формат языкового тега локали (например: ru-RU, en-US).",
                restart_required=False,
            )

        try:
            cmd = f"Set-WinSystemLocale -SystemLocale '{loc}'"
            if req.user_locale and re.match(r"^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$", req.user_locale.strip()):
                u_loc = req.user_locale.strip()
                cmd += f"; Set-Culture '{u_loc}'"

            proc = await asyncio.create_subprocess_exec(
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace").strip() or stdout.decode("utf-8", errors="replace").strip()
                logger.warning(f"[router_about_system] Ошибка Set-WinSystemLocale: {err_text}")
                return SetLocaleResponse(
                    status="error",
                    system_locale=loc,
                    message=f"Не удалось изменить локаль: {err_text}. Требуются права администратора.",
                    restart_required=False,
                )

            return SetLocaleResponse(
                status="ok",
                system_locale=loc,
                message=f"Системная локаль успешно изменена на '{loc}'. Изменения вступят в силу после перезагрузки.",
                restart_required=True,
            )
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при установке локали: {exc}", exc_info=True)
            return SetLocaleResponse(
                status="error",
                system_locale=loc,
                message=f"Внутренняя ошибка: {exc}",
                restart_required=False,
            )

    # =========================================================================
    # 14. Обновление профиля пользователя: POST /api/v1/system/update-user-profile
    # =========================================================================
    @router.post("/api/v1/system/update-user-profile", response_model=UpdateUserProfileResponse)
    async def update_user_profile_endpoint(req: UpdateUserProfileRequest) -> UpdateUserProfileResponse:
        """Обновление описания и полного имени локального пользователя через Set-LocalUser."""
        target_user = req.username.strip() or os.environ.get("USERNAME", "User")
        if not re.match(r"^[a-zA-Z0-9_\-\.]{1,64}$", target_user):
            return UpdateUserProfileResponse(
                status="error",
                username=target_user,
                message="Недопустимое имя пользователя.",
            )

        ps_args = []
        if req.full_name is not None:
            clean_fn = req.full_name.replace("'", "''")
            ps_args.append(f"-FullName '{clean_fn}'")
        if req.description is not None:
            clean_desc = req.description.replace("'", "''")
            ps_args.append(f"-Description '{clean_desc}'")

        if not ps_args:
            return UpdateUserProfileResponse(
                status="ok",
                username=target_user,
                message="Параметры для изменения не указаны.",
            )

        try:
            cmd = f"Set-LocalUser -Name '{target_user}' " + " ".join(ps_args)
            proc = await asyncio.create_subprocess_exec(
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_text = stderr.decode("utf-8", errors="replace").strip() or stdout.decode("utf-8", errors="replace").strip()
                logger.warning(f"[router_about_system] Ошибка Set-LocalUser: {err_text}")
                return UpdateUserProfileResponse(
                    status="error",
                    username=target_user,
                    message=f"Не удалось обновить профиль пользователя: {err_text}. Требуются права администратора.",
                )

            return UpdateUserProfileResponse(
                status="ok",
                username=target_user,
                message=f"Профиль пользователя '{target_user}' успешно обновлен.",
            )
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при обновлении профиля пользователя: {exc}", exc_info=True)
            return UpdateUserProfileResponse(
                status="error",
                username=target_user,
                message=f"Внутренняя ошибка: {exc}",
            )
