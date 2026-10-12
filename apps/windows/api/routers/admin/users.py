# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - users
# =============================================================================
# Description:
#   Эндпойнты управления пользователями администрирования.
#   Вынесено из router_admin.py (этап 4 оптимизации).
#
# File: users.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.admin
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:00:00
# =============================================================================

from __future__ import annotations

from typing import (
    Any,
    Dict,
    List,
    Optional,
)

from fastapi import HTTPException, Request
from pydantic import BaseModel

from apps.windows.api.auth import require_admin_user
from .routers import router


# ============================================================================
# User Management Models and Endpoints
# ============================================================================

class AdminUserCreateRequest(BaseModel):
    email: str
    name: str
    password: str = ''
    role: str = 'user'
    is_admin: int = 0
    is_active: int = 1
    is_email_verified: int = 1

class AdminUserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_admin: Optional[int] = None
    is_active: Optional[int] = None
    is_email_verified: Optional[int] = None
    telegram_id: Optional[int] = None
    telegram_username: Optional[str] = None

class AdminUserPasswordRequest(BaseModel):
    password: str

@router.get('/users')
async def list_admin_users(
    request: Request,
    q: str = '',
    role: str = '',
    status: str = ''
) -> Dict[str, Any]:
    """Получение списка пользователей с фильтрацией, поиском и статистикой."""
    require_admin_user(request)
    from src.user_manager import user_manager
    all_users = user_manager.get_all_users(active_only=False)

    total_count = len(all_users)
    active_count = sum(1 for u in all_users if u.get('is_active', 0) == 1)
    admin_count = sum(1 for u in all_users if u.get('is_admin', 0) == 1 or u.get('role') == 'admin')
    tg_count = sum(1 for u in all_users if u.get('telegram_id'))

    filtered = []
    q_lower = q.lower().strip()

    for u in all_users:
        if q_lower:
            name_match = q_lower in str(u.get('name', '')).lower()
            email_match = q_lower in str(u.get('email', '')).lower()
            tg_match = q_lower in str(u.get('telegram_username', '')).lower() or q_lower in str(u.get('telegram_id', ''))
            if not (name_match or email_match or tg_match):
                continue

        if role and u.get('role') != role:
            continue

        if status == 'active' and u.get('is_active', 0) != 1:
            continue
        if status == 'inactive' and u.get('is_active', 0) == 1:
            continue

        sanitized = {k: v for k, v in u.items() if k != 'password_hash'}
        sanitized['has_password'] = bool(u.get('password_hash'))
        filtered.append(sanitized)

    return {
        'status': 'ok',
        'users': filtered,
        'stats': {
            'total': total_count,
            'active': active_count,
            'suspended': total_count - active_count,
            'admins': admin_count,
            'telegram': tg_count,
        }
    }

@router.post('/users')
async def create_admin_user(request: Request, data: AdminUserCreateRequest) -> Dict[str, Any]:
    """Создание нового пользователя администратором."""
    require_admin_user(request)
    email = data.email.strip().lower()
    name = data.name.strip()
    if not email:
        raise HTTPException(status_code=400, detail='Email обязателен')
    if not name:
        raise HTTPException(status_code=400, detail='Имя обязательно')

    from src.user_manager import user_manager
    if user_manager.user_exists(email):
        raise HTTPException(status_code=400, detail=f'Пользователь с email {email} уже существует')

    user_id = user_manager.create_user_admin(
        email=email,
        name=name,
        password=data.password,
        role=data.role,
        is_admin=data.is_admin,
        is_active=data.is_active,
        is_email_verified=data.is_email_verified
    )
    if not user_id:
        raise HTTPException(status_code=500, detail='Error создания пользователя')

    created = user_manager.get_user_by_id(user_id)
    sanitized = {k: v for k, v in created.items() if k != 'password_hash'}
    sanitized['has_password'] = bool(created.get('password_hash'))
    return {'status': 'ok', 'user': sanitized}

class OrphanedDirsCleanRequest(BaseModel):
    dirs: Optional[List[str]] = None

@router.get('/users/orphaned-dirs')
async def get_orphaned_user_dirs(request: Request) -> Dict[str, Any]:
    """Inspect and list orphaned user directories."""
    require_admin_user(request)
    from src.user_manager import user_manager
    orphaned = user_manager.get_orphaned_user_directories()
    total_size = sum(item["size_bytes"] for item in orphaned)
    total_files = sum(item["files_count"] for item in orphaned)
    return {
        "status": "ok",
        "total": len(orphaned),
        "total_size_bytes": total_size,
        "total_files": total_files,
        "orphaned_dirs": orphaned
    }

@router.post('/users/orphaned-dirs/clean')
async def clean_orphaned_user_dirs(
    request: Request,
    payload: Optional[OrphanedDirsCleanRequest] = None
) -> Dict[str, Any]:
    """Clean up specified or all orphaned user directories."""
    require_admin_user(request)
    from src.user_manager import user_manager
    dir_names = payload.dirs if payload and payload.dirs is not None else None
    result = user_manager.cleanup_orphaned_user_directories(dir_names=dir_names)
    return result

@router.get('/users/{user_id}')
async def get_admin_user_details(user_id: int, request: Request) -> Dict[str, Any]:
    """Получение детальной информации о пользователе и его настройках."""
    require_admin_user(request)
    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    settings = user_manager.get_user_settings(user_id)
    permissions = user_manager.get_user_permissions(user_id)
    storage_stats = user_manager.get_user_storage_stats(user_id)
    sanitized = {k: v for k, v in user.items() if k != 'password_hash'}
    sanitized['has_password'] = bool(user.get('password_hash'))

    return {
        'status': 'ok',
        'user': sanitized,
        'settings': settings,
        'permissions': permissions,
        'storage': storage_stats
    }

@router.put('/users/{user_id}')
@router.patch('/users/{user_id}')
async def update_admin_user(user_id: int, data: AdminUserUpdateRequest, request: Request) -> Dict[str, Any]:
    """Update данных пользователя (полное или частичное редактирование полей)."""
    require_admin_user(request)
    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    updates: Dict[str, Any] = {}
    if data.name is not None:
        updates['name'] = data.name.strip()
    if data.email is not None:
        email_clean = data.email.strip().lower()
        if not email_clean:
            raise HTTPException(status_code=400, detail='Email не может быть пустым')
        if email_clean != user.get('email'):
            existing = user_manager.get_user_by_email(email_clean)
            if existing and existing.get('id') != user_id:
                raise HTTPException(status_code=400, detail='Этот email уже занят другим пользователем')
            updates['email'] = email_clean
    if data.role is not None:
        updates['role'] = data.role
        if data.is_admin is None:
            updates['is_admin'] = 1 if data.role == 'admin' else 0
    if data.is_admin is not None:
        if user_id == 1 and data.is_admin == 0:
            raise HTTPException(status_code=400, detail='Нельзя снять права у главного администратора (ID 1)')
        updates['is_admin'] = data.is_admin
        if data.role is None:
            updates['role'] = 'admin' if data.is_admin == 1 else 'user'
    if data.is_active is not None:
        if user_id == 1 and data.is_active == 0:
            raise HTTPException(status_code=400, detail='Нельзя деактивировать главного администратора (ID 1)')
        updates['is_active'] = data.is_active
    if data.is_email_verified is not None:
        updates['is_email_verified'] = data.is_email_verified
    if data.telegram_id is not None:
        updates['telegram_id'] = data.telegram_id
    if data.telegram_username is not None:
        updates['telegram_username'] = data.telegram_username.strip().lstrip('@')

    if updates:
        success = user_manager.update_user(user_id, **updates)
        if not success:
            raise HTTPException(status_code=500, detail='Error обновления пользователя')

    updated = user_manager.get_user_by_id(user_id)
    sanitized = {k: v for k, v in updated.items() if k != 'password_hash'}
    sanitized['has_password'] = bool(updated.get('password_hash'))
    return {'status': 'ok', 'user': sanitized}

@router.post('/users/{user_id}/password')
async def set_admin_user_password(user_id: int, data: AdminUserPasswordRequest, request: Request) -> Dict[str, Any]:
    """Установка / сброс пароля пользователя администратором."""
    require_admin_user(request)
    new_password = data.password.strip()
    if not new_password:
        raise HTTPException(status_code=400, detail='Пароль не может быть пустым')

    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    success = user_manager.set_user_password(user_id, new_password)
    if not success:
        raise HTTPException(status_code=500, detail='Error установки пароля')

    return {'status': 'ok', 'message': 'Пароль successfully обновлён'}

@router.post('/users/{user_id}/toggle-active')
async def toggle_admin_user_active(user_id: int, request: Request) -> Dict[str, Any]:
    """Переключение активности пользователя (блокировка / разблокировка)."""
    require_admin_user(request)
    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    if user_id == 1 and user.get('is_active', 1) == 1:
        raise HTTPException(status_code=400, detail='Нельзя деактивировать главного администратора (ID 1)')

    new_status = 0 if user.get('is_active', 1) == 1 else 1
    success = user_manager.update_user(user_id, is_active=new_status)
    if not success:
        raise HTTPException(status_code=500, detail='Error изменения статуса')

    return {'status': 'ok', 'is_active': new_status}

@router.post('/users/{user_id}/toggle-role')
async def toggle_admin_user_role(user_id: int, request: Request) -> Dict[str, Any]:
    """Переключение роли пользователя (пользователь <-> администратор)."""
    require_admin_user(request)
    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    is_currently_admin = bool(user.get('is_admin', 0) or user.get('role') == 'admin')

    # Защита системного администратора ID 1 от снятия прав
    if user_id == 1 and is_currently_admin:
        raise HTTPException(status_code=400, detail='Нельзя снять права у главного администратора (ID 1)')

    if is_currently_admin:
        new_role = 'user'
        new_is_admin = 0
    else:
        new_role = 'admin'
        new_is_admin = 1

    success = user_manager.update_user(user_id, role=new_role, is_admin=new_is_admin)
    if not success:
        raise HTTPException(status_code=500, detail='Error изменения роли')

    return {'status': 'ok', 'role': new_role, 'is_admin': new_is_admin}

@router.delete('/users/{user_id}')
async def delete_admin_user(user_id: int, request: Request) -> Dict[str, Any]:
    """Удаление пользователя."""
    require_admin_user(request)
    from src.user_manager import user_manager
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='Пользователь не найден')

    if user_id == 1:
        raise HTTPException(status_code=400, detail='Нельзя удалить главного администратора (ID 1)')

    success = user_manager.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=500, detail='Error удаления пользователя')

    return {'status': 'ok', 'message': f'Пользователь ID {user_id} удалён'}
