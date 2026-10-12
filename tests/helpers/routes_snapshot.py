# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - Route Snapshot Helper
# =============================================================================
# Description:
#   Снимок маршрутов всех APIRouter из модулей apps.windows.api.routers.router_*.
#   Используется для проверки неизменности REST API при декомпозиции роутеров.
#
# File: routes_snapshot.py
# Project: ai-windows-admin
# Package: tests.helpers
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 05:50:00
# =============================================================================

from __future__ import annotations

import importlib
import pkgutil
from collections import Counter

from fastapi import APIRouter

import apps.windows.api.routers as routers_pkg


def collect_routes(module_prefix: str) -> list[str]:
    """Собирает отсортированный список «METHOD путь» по всем APIRouter модулей с префиксом имени.

    Args:
        module_prefix: Префикс имени модуля внутри пакета роутеров (например, ``router_admin``).

    Returns:
        list[str]: Строки вида ``GET /api/admin/users`` (с учётом кратности).
    """
    seen: set[int] = set()
    out: Counter[str] = Counter()
    for info in pkgutil.iter_modules(routers_pkg.__path__):
        if not info.name.startswith(module_prefix):
            continue
        mod = importlib.import_module(f'{routers_pkg.__name__}.{info.name}')
        candidates = list(vars(mod).values())
        if not any(isinstance(o, APIRouter) for o in candidates) and hasattr(mod, 'init_router'):
            candidates.append(mod.init_router())
        for obj in candidates:
            if isinstance(obj, APIRouter) and id(obj) not in seen:
                seen.add(id(obj))
                for route in obj.routes:
                    for method in sorted(getattr(route, 'methods', None) or ()):
                        if method != 'HEAD':
                            out[f'{method} {route.path}'] += 1
    return sorted(out.elements())
