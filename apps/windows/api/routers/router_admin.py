# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - Router Admin
# =============================================================================
# Description:
#   Provides administrative FastAPI endpoints for managing system prompts,
#
# Usage Examples:
#   CLI:
#     python -m apps.windows.api.routers.router_admin
#   Python API:
#     from apps.windows.api.routers.router_admin import SystemInstructionUpdate
#
#     service = SystemInstructionUpdate()
#
# File: router_admin.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 19:41:00
# =============================================================================

from __future__ import annotations

"""Агрегатор административных роутеров: эндпойнты вынесены в подпакет ``admin`` (регистрация — через импорт)."""

from fastapi import APIRouter

from .admin import (  # noqa: F401 - импорт регистрирует эндпойнты на общих роутерах
    apps,
    instructions,
    plugins,
    rag_search,
    schedulers,
    skills,
    users,
    windows_users,
)
from .admin.routers import plugins_router, router, router_apps, skills_router, windows_users_router  # noqa: F401


def init_router() -> APIRouter:
    """Возвращает основной административный роутер (/api/admin)."""
    return router


def init_apps_router() -> APIRouter:
    """Возвращает роутер публичного статуса и конфигурации приложений (/api/v1/apps)."""
    return router_apps


def init_skills_router() -> APIRouter:
    """Возвращает роутер навыков агента (/api/skills)."""
    return skills_router


def init_plugins_router() -> APIRouter:
    """Возвращает роутер пользовательских плагинов (/api/plugins)."""
    return plugins_router
