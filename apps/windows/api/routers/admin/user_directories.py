# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - User Directories
# =============================================================================
# Description:
#   Эндпойнты управления персональными хранилищами пользователей платформы.
#   Предоставляет сводку, дерево файлов, предпросмотр, скачивание и очистку.
#
# File: user_directories.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.admin
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-14 04:00:00
# =============================================================================

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from apps.windows.api.auth import require_admin_user
from src.user_manager import user_manager
from .routers import router


class OrphanedCleanRequest(BaseModel):
    dirs: Optional[List[str]] = None


@router.get('/user-directories/summary')
async def get_user_directories_summary(request: Request) -> Dict[str, Any]:
    """Возвращает общую сводку файловых хранилищ пользователей."""
    require_admin_user(request)
    summary = user_manager.get_storage_summary()
    return {
        'status': 'ok',
        'summary': summary,
    }


@router.get('/user-directories/users')
async def get_user_directories_users(request: Request) -> Dict[str, Any]:
    """Возвращает список пользователей с детальной статистикой дисковых квот."""
    require_admin_user(request)
    users = user_manager.get_all_users()
    result: List[Dict[str, Any]] = []

    for u in users:
        uid = u['id']
        stats = user_manager.get_user_storage_stats(uid)
        result.append({
            'id': uid,
            'name': u.get('name') or f'User #{uid}',
            'email': u.get('email') or '',
            'role': u.get('role') or 'user',
            'is_admin': u.get('is_admin', 0),
            'files_count': stats['files_count'],
            'size_bytes': stats['size_bytes'],
            'size_formatted': stats['size_formatted'],
            'quota_bytes': stats['quota_bytes'],
            'quota_formatted': stats['quota_formatted'],
            'quota_percent': stats['quota_percent'],
        })

    return {
        'status': 'ok',
        'users': result,
    }


@router.get('/user-directories/orphaned')
async def get_user_directories_orphaned(request: Request) -> Dict[str, Any]:
    """Возвращает список осиротевших каталогов в data/users/."""
    require_admin_user(request)
    orphaned = user_manager.get_orphaned_user_directories()
    total_size = sum(item['size_bytes'] for item in orphaned)
    total_files = sum(item['files_count'] for item in orphaned)
    from src.user_manager import _format_bytes

    return {
        'status': 'ok',
        'total': len(orphaned),
        'total_size_bytes': total_size,
        'total_size_formatted': _format_bytes(total_size),
        'total_files': total_files,
        'orphaned_dirs': orphaned,
    }


@router.post('/user-directories/orphaned/clean')
async def clean_user_directories_orphaned(
    request: Request,
    payload: Optional[OrphanedCleanRequest] = None,
) -> Dict[str, Any]:
    """Удаляет осиротевшие каталоги из хранилища."""
    require_admin_user(request)
    target_dirs = payload.dirs if payload and payload.dirs is not None else None
    result = user_manager.cleanup_orphaned_user_directories(dir_names=target_dirs)
    return result


@router.get('/user-directories/users/{user_id}/tree')
async def get_user_directory_tree(
    user_id: int,
    request: Request,
    subfolder: str = Query('', description='Фильтр подпапки (files, rag, profile, temp)'),
    q: str = Query('', description='Поисковый запрос'),
    extension: str = Query('', description='Фильтр по расширению файла'),
) -> Dict[str, Any]:
    """Возвращает файловое дерево выбранного пользователя."""
    require_admin_user(request)
    user = user_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f'Пользователь #{user_id} не найден')

    tree = user_manager.get_user_directory_tree(
        user_id=user_id,
        subfolder=subfolder,
        query=q,
        extension=extension,
    )
    return tree


@router.get('/user-directories/users/{user_id}/file/preview')
async def get_user_file_preview(
    user_id: int,
    path: str,
    request: Request,
) -> Dict[str, Any]:
    """Возвращает содержимое файла для предпросмотра."""
    require_admin_user(request)
    preview = user_manager.get_file_preview(user_id=user_id, relative_path=path)
    if preview.get('status') == 'error':
        raise HTTPException(status_code=404, detail=preview.get('message', 'Файл не найден'))
    return preview


@router.get('/user-directories/users/{user_id}/file/download')
async def download_user_file(
    user_id: int,
    path: str,
    request: Request,
) -> FileResponse:
    """Скачивание файла из хранилища пользователя."""
    require_admin_user(request)
    target = user_manager.resolve_safe_user_file_path(user_id, path)
    if not target or not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail='Файл не найден')

    return FileResponse(
        path=target,
        filename=target.name,
        media_type='application/octet-stream',
    )


@router.delete('/user-directories/users/{user_id}/file')
async def delete_user_file(
    user_id: int,
    path: str,
    request: Request,
) -> Dict[str, Any]:
    """Удаляет файл или директорию из хранилища пользователя."""
    require_admin_user(request)
    success = user_manager.delete_user_file(user_id=user_id, relative_path=path)
    if not success:
        raise HTTPException(status_code=400, detail=f'Не удалось удалить "{path}"')

    return {
        'status': 'ok',
        'message': f'Файл "{path}" успешно удален',
    }
