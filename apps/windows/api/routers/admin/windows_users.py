# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - windows_users
# =============================================================================
# Description:
#   Эндпойнты управления пользователями Windows.
#   Вынесено из router_admin.py (этап 4 оптимизации).
#
# File: windows_users.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.admin
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:00:00
# =============================================================================

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Request
from pydantic import BaseModel

from apps.windows.api.auth import require_admin_user
from .routers import windows_users_router


# ============================================================================
# Windows User Management Endpoints
# ============================================================================


class WindowsUserCreateRequest(BaseModel):
    username: str
    password: str
    fullname: Optional[str] = None
    description: Optional[str] = None

class WindowsUserActionRequest(BaseModel):
    username: str

class WindowsUserPasswordRequest(BaseModel):
    username: str
    new_password: str

class WindowsGroupActionRequest(BaseModel):
    username: str
    group_name: str


@windows_users_router.get('')
async def get_windows_users(request: Request) -> Dict[str, Any]:
    """Получение списка локальных пользователей Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    users = manager.get_windows_users()
    return {'status': 'ok', 'users': users, 'count': len(users)}


@windows_users_router.get('/groups')
async def get_windows_groups(request: Request) -> Dict[str, Any]:
    """Получение списка локальных групп Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    groups = manager.get_windows_groups()
    return {'status': 'ok', 'groups': groups, 'count': len(groups)}


@windows_users_router.get('/groups/{group_name}/members')
async def get_group_members(group_name: str, request: Request) -> Dict[str, Any]:
    """Получение членов группы Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    members = manager.get_group_members(group_name)
    return {'status': 'ok', 'group': group_name, 'members': members, 'count': len(members)}


@windows_users_router.post('')
async def create_windows_user(data: WindowsUserCreateRequest, request: Request) -> Dict[str, Any]:
    """Создание нового локального пользователя Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.create_windows_user(
        username=data.username,
        password=data.password,
        fullname=data.fullname,
        description=data.description
    )
    return result


@windows_users_router.delete('')
async def delete_windows_user(data: WindowsUserActionRequest, request: Request) -> Dict[str, Any]:
    """Удаление локального пользователя Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.delete_windows_user(data.username)
    return result


@windows_users_router.post('/enable')
async def enable_windows_user(data: WindowsUserActionRequest, request: Request) -> Dict[str, Any]:
    """Включение пользователя Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.enable_windows_user(data.username)
    return result


@windows_users_router.post('/disable')
async def disable_windows_user(data: WindowsUserActionRequest, request: Request) -> Dict[str, Any]:
    """Отключение пользователя Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.disable_windows_user(data.username)
    return result


@windows_users_router.post('/password')
async def reset_windows_user_password(data: WindowsUserPasswordRequest, request: Request) -> Dict[str, Any]:
    """Сброс пароля пользователя Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.reset_windows_user_password(data.username, data.new_password)
    return result


@windows_users_router.post('/add-to-group')
async def add_user_to_group(data: WindowsGroupActionRequest, request: Request) -> Dict[str, Any]:
    """Добавление пользователя в группу Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.add_user_to_group(data.username, data.group_name)
    return result


@windows_users_router.post('/remove-from-group')
async def remove_user_from_group(data: WindowsGroupActionRequest, request: Request) -> Dict[str, Any]:
    """Удаление пользователя из группы Windows."""
    require_admin_user(request)
    from apps.ai_windows_admin_admin.src import WindowsUserManager
    manager = WindowsUserManager()
    result = manager.remove_user_from_group(data.username, data.group_name)
    return result
