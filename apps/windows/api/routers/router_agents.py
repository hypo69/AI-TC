# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - Router Agents
# =============================================================================
# Description:
#   Предоставляет базовые эндпойнты для управления агентами: список агентов,
#   их инструменты и провайдеры.
#
# Usage Examples:
#   Python API:
#     from apps.windows.api.routers.router_agents import init_router
#
#   service = init_router()
#
# File: router_agents.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-20 22:45:00
# =============================================================================

from __future__ import annotations

from fastapi import APIRouter, Depends
from logger import logger

# Поскольку реального реестра агентов в проекте нет, возвращаем статичные примеры.
# При необходимости здесь можно импортировать реальный сервис реестра.


def _get_agents() -> list[dict]:
    """Возвращает список доступных агентов (заглушка)."""
    # Пример структуры агента
    return [
        {"id": "agent-1", "name": "ChatAgent", "description": "Общий чат‑агент"},
        {"id": "agent-2", "name": "CodeAgent", "description": "Помощник по коду"},
    ]


def _get_tools() -> list[dict]:
    """Возвращает список инструментов, доступных агентам (заглушка)."""
    return [
        {"name": "search_web", "description": "Поиск в интернете"},
        {"name": "run_command", "description": "Запуск системных команд"},
    ]


def _get_providers() -> list[dict]:
    """Возвращает список провайдеров LLM (заглушка)."""
    return [
        {"id": "openai", "model": "gpt-4o-mini"},
        {"id": "gemini", "model": "gemini-1.5-pro"},
    ]


def init_router() -> APIRouter:
    """Инициализирует роутер ``/api/agents``.

    Returns:
        APIRouter: Роутер с эндпойнтами ``/api/agents``, ``/api/agents/tools``
        и ``/api/agents/providers``.
    """
    router = APIRouter(prefix="/api/agents", tags=["agents"])

    @router.get("/", summary="Получить список агентов")
    async def list_agents():
        logger.console("Запрос списка агентов")
        return {"agents": _get_agents()}

    @router.get("/tools", summary="Получить список инструментов агентов")
    async def list_tools():
        logger.console("Запрос списка инструментов агентов")
        return {"tools": _get_tools()}

    @router.get("/providers", summary="Получить список провайдеров LLM")
    async def list_providers():
        logger.console("Запрос списка провайдеров LLM")
        return {"providers": _get_providers()}

    return router

__all__ = ["init_router"]
