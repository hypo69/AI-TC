# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Modules Regional - Models
# =============================================================================
# Description:
#   Типизированные модели данных модуля региональных параметров,
#   языковых пакетов Windows, часовых поясов и локалей.
#
# File: models.py
# Project: ai-windows-admin
# Package: apps.windows.sdk.modules.regional
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-16 20:35:00
# =============================================================================

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LanguagePackModel(BaseModel):
    """Модель описания языкового пакета Windows."""

    tag: str = Field(..., description="BCP-47 языковой тэг (например: ru-RU, he-IL, en-US)")
    name: str = Field(..., description="Название языка на русском языке")
    native_name: str = Field(..., description="Самоназвание языка (Native Name)")
    flag: str = Field(default="🌐", description="Флаг или пиктограмма языка")
    is_installed: bool = Field(default=False, description="Установлен ли физически MUI-пакет в системе")
    is_active: bool = Field(default=False, description="Присутствует ли язык в текущей раскладке пользователя")
    is_target: bool = Field(default=False, description="Является ли язык целевым приоритетным (Русский, Иврит, Английский)")


class TimezoneModel(BaseModel):
    """Модель часового пояса Windows."""

    id: str = Field(..., description="Идентификатор таймзоны Windows (например: Russian Standard Time)")
    display_name: str = Field(..., description="Человекочитаемое имя пояса с UTC-смещением")
    offset_minutes: int = Field(default=0, description="Смещение относительно UTC в минутах")


class LocaleModel(BaseModel):
    """Модель локали Windows."""

    code: str = Field(..., description="Код локали (например: ru-RU, en-US)")
    name: str = Field(..., description="Название локали")


class UserAccountModel(BaseModel):
    """Модель параметров текущего пользователя операционной системы."""

    username: str = Field(..., description="Логин учетной записи")
    full_name: str = Field(default="", description="Полное имя пользователя")
    first_name: str = Field(default="", description="Имя пользователя")
    last_name: str = Field(default="", description="Фамилия пользователя")
    description: str = Field(default="", description="Описание или должность пользователя")
    sid: str = Field(default="", description="Идентификатор безопасности (SID)")
    profile_dir: str = Field(default="", description="Путь к каталогу профиля")
    domain: str = Field(default="", description="Имя компьютера или домена")
    is_admin: bool = Field(default=False, description="Наличие административных полномочий")
    privilege: str = Field(default="Пользователь", description="Уровень привилегий")
    account_type: str = Field(default="Локальная учетная запись", description="Тип учетной записи")
    groups: List[str] = Field(default_factory=list, description="Список групп безопасности")
    last_logon: str = Field(default="", description="Дата и время последнего входа")
