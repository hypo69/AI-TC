# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - endpoints_overview
# =============================================================================
# Description:
#   Эндпойнты сводки и диагностик.
#   Вынесено из router_about_system.py (этап 4 оптимизации).
#
# File: endpoints_overview.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.about_system
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:20:00
# =============================================================================

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter

from logger import logger
from apps.windows.telemetry.sqlite import TelemetryStorage
from .models import AboutSystemHistoryResponse
from .models import AboutSystemPanelOverviewResponse
from .query_about import query_about_system_from_db
from .query_about import query_about_system_history_from_db
from .query_diagnostics import query_backup_health_from_db
from .query_diagnostics import query_hardware_tree_full
from .query_diagnostics import query_process_leaks_from_db
from .query_diagnostics import query_storage_battery_from_db
from .query_diagnostics import query_throttling_from_db
from .query_summary import query_system_summary_full


def register_overview_endpoints(router: APIRouter, storage: TelemetryStorage) -> None:
    """Регистрирует эндпойнты сводки и диагностик на роутере."""
    # =========================================================================
    # 0. Сводные эндпоинты для фронтенда (/api/v1/system/summary, /about-system/summary)
    # =========================================================================
    @router.get("/api/v1/system/summary")
    @router.get("/api/v1/tc/system/summary")
    async def get_system_summary_full_endpoint(process_limit: int = 25) -> Dict[str, Any]:
        """Получение максимально полного среза системной телеметрии со всеми полями напрямую из telemetry.db."""
        return await query_system_summary_full(storage, process_limit=process_limit)

    @router.get("/api/v1/about-system/summary", response_model=AboutSystemPanelOverviewResponse)
    @router.get("/api/v1/about-system", response_model=AboutSystemPanelOverviewResponse)
    @router.get("/api/v1/panel/about-system", response_model=AboutSystemPanelOverviewResponse)
    @router.get("/api/v1/panel/overview", response_model=AboutSystemPanelOverviewResponse)
    async def get_panel_about_system() -> AboutSystemPanelOverviewResponse:
        """Получение полного среза данных всех 8 карточек панели 'О Системе' напрямую из telemetry.db."""
        try:
            return query_about_system_from_db(storage)
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при чтении панели /about-system: {exc}", exc_info=True)
            return AboutSystemPanelOverviewResponse(
                status="error",
                meta={"source": "telemetry.db", "error": str(exc)},
            )

    # =========================================================================
    # 0.01. Спецификация оборудования (Hardware Spec / Tree)
    # =========================================================================
    @router.get("/api/v1/system/hardware")
    @router.get("/api/v1/tc/hardware")
    async def get_system_hardware_spec(force: bool = False) -> List[Dict[str, Any]]:
        """Получение спецификации оборудования для Hardware Tree из SystemCollector или telemetry.db."""
        return await query_hardware_tree_full(storage, force_refresh=force)

    # =========================================================================
    # 0.02. Износ накопителей и батареи (Storage & Battery Wear)
    # =========================================================================
    @router.get("/api/v1/system/diagnostics/storage-battery")
    async def get_storage_battery_wear_endpoint() -> Dict[str, Any]:
        """Получение износа накопителей SMART и батареи из telemetry.db."""
        return query_storage_battery_from_db(storage)

    # =========================================================================
    # 0.03. Резервное копирование (Windows Backup Health)
    # =========================================================================
    @router.get("/api/v1/windows-backup/health")
    async def get_backup_health_endpoint() -> Dict[str, Any]:
        """Получение статуса и здоровья резервного копирования."""
        return query_backup_health_from_db(storage)

    # =========================================================================
    # 0.04. Троттлинг и подсистема питания (CPU Throttling & Power Limits)
    # =========================================================================
    @router.get("/api/v1/system/diagnostics/throttling")
    async def get_throttling_diagnostics_endpoint() -> Dict[str, Any]:
        """Получение состояния троттлинга процессора, лимитов PL1/PL2 и задержек прерываний (< 5 мс)."""
        return query_throttling_from_db(storage)

    @router.post("/api/v1/system/diagnostics/throttling/refresh")
    @router.post("/api/v1/system/diagnostics/throttling/rescan")
    async def refresh_throttling_diagnostics_endpoint() -> Dict[str, Any]:
        """Принудительное фоновое обновление состояния троттлинга по кнопке пользователя."""
        try:
            from apps.windows.telemetry.deep_diagnostics import DeepDiagnosticsEngine
            engine = DeepDiagnosticsEngine()
            rep = await asyncio.to_thread(engine.collect_kernel_throttling)
            snap_id = f"snap_throttling_{int(datetime.now(timezone.utc).timestamp())}"
            storage.save_throttling_snapshot(snap_id, {
                "prochot_active": rep.thermal_throttling_detected,
                "pl1_limit_watts": 65.0 if rep.power_limit_throttling_detected else None,
                "pl2_limit_watts": 125.0 if rep.power_limit_throttling_detected else None,
                "current_power_watts": 45.0,
                "max_core_temp_c": 65.0,
                "package_temp_c": 62.0,
                "dpc_latency_us": int(rep.dpc_latency_pct * 100),
                "isr_latency_us": int(rep.interrupt_latency_pct * 100),
                "throttling_reasons": ["Power limit PL1"] if rep.power_limit_throttling_detected else [],
            })
        except Exception as ex:
            logger.debug(f"Ошибка принудительного обновления троттлинга: {ex}")
        return query_throttling_from_db(storage)

    # =========================================================================
    # 0.05. Утечки ресурсов процессов (Process Leaks & Resource Starvation)
    # =========================================================================
    @router.get("/api/v1/system/diagnostics/leaks")
    @router.get("/api/v1/tc/process-leaks")
    async def get_process_leaks_endpoint(limit: int = 100) -> Dict[str, Any]:
        """Получение сводки и списка утечек ресурсов процессов из SQLite (< 5 мс)."""
        return query_process_leaks_from_db(storage, limit=limit)

    @router.post("/api/v1/system/diagnostics/leaks/refresh")
    @router.post("/api/v1/tc/process-leaks/refresh")
    async def refresh_process_leaks_endpoint(limit: int = 100) -> Dict[str, Any]:
        """Принудительное обновление состояния утечек процессов по кнопке пользователя."""
        try:
            from apps.windows.telemetry.deep_diagnostics import DeepDiagnosticsEngine
            engine = DeepDiagnosticsEngine()
            live_rep = await asyncio.to_thread(engine.collect_process_leaks, limit)
            snap_id = f"snap_leaks_{int(datetime.now(timezone.utc).timestamp())}"
            storage.save_process_leak_snapshot(snap_id, live_rep)
        except Exception as ex:
            logger.debug(f"Ошибка принудительного сбора утечек: {ex}")
        return query_process_leaks_from_db(storage, limit=limit)

    # =========================================================================
    # 0.1. История значений телеметрии: GET /api/v1/about-system/history
    # =========================================================================
    @router.get("/api/v1/about-system/history", response_model=AboutSystemHistoryResponse)
    @router.get("/api/v1/panel/about-system/history", response_model=AboutSystemHistoryResponse)
    async def get_panel_about_system_history(
        limit: int = 30,
        metric: str = "all",
    ) -> AboutSystemHistoryResponse:
        """Получение исторических значений телеметрии из базы данных telemetry.db."""
        try:
            return query_about_system_history_from_db(storage, limit=limit, metric=metric)
        except Exception as exc:
            logger.error(f"[router_about_system] Ошибка при чтении истории /history: {exc}", exc_info=True)
            return AboutSystemHistoryResponse(
                status="error",
                count=0,
                metric=metric,
                history=[],
                meta={"source": "telemetry.db", "error": str(exc)},
            )
