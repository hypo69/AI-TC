# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Software Scanner - FastAPI Router
# =============================================================================
# Description:
#   REST API маршруты для запуска глубокого сканирования установленного и спящего
#   ПО по требованию, получения отчетов, списка сирот и спящих программ.
#
# File: router.py
# Project: ai-windows-admin
# Package: apps.windows.sdk.software_scanner
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 19:54:00
# =============================================================================

from __future__ import annotations
"""FastAPI роутер подсистемы глубокого сканирования ПО."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from apps.windows.sdk.software_scanner.controller import DeepSoftwareScanner
from apps.windows.sdk.software_scanner.models import ScanMode, SoftwareStatus
from apps.windows.sdk.software_scanner.report import ReportFormatter

router = APIRouter(prefix="/software-scanner", tags=["software-scanner"])
scanner = DeepSoftwareScanner()
_last_report = None


class ScanRequest(BaseModel):
    """Параметры запроса на сканирование ПО."""
    mode: ScanMode = Field(default=ScanMode.DEEP, description="Режим сканирования")
    target_name: Optional[str] = Field(default=None, description="Имя программы для целевого поиска")


@router.post("/scan")
async def trigger_scan(req: ScanRequest) -> Dict[str, Any]:
    """Запуск глубокого сканирования программного обеспечения по требованию."""
    global _last_report
    report = scanner.run_scan(mode=req.mode, target_name=req.target_name)
    _last_report = report
    return ReportFormatter.to_dict(report)


@router.get("/latest-report")
async def get_latest_report() -> Dict[str, Any]:
    """Получение последнего сгенерированного отчета сканирования."""
    global _last_report
    if _last_report is None:
        _last_report = scanner.run_scan(mode=ScanMode.QUICK)
    return ReportFormatter.to_dict(_last_report)


@router.get("/dormant")
async def get_dormant_software(min_days: int = Query(90, ge=1)) -> Dict[str, Any]:
    """Получение списка давно не запускавшихся (спящих) программ."""
    global _last_report
    if _last_report is None:
        _last_report = scanner.run_scan(mode=ScanMode.DEEP)

    dormant = [
        card for card in _last_report.inventory
        if card.status in (SoftwareStatus.DORMANT, SoftwareStatus.NEVER_LAUNCHED)
        or (card.days_since_last_run is not None and card.days_since_last_run >= min_days)
    ]
    return {
        "count": len(dormant),
        "min_days_threshold": min_days,
        "items": [ReportFormatter.to_dict(c) if hasattr(c, "__dataclass_fields__") else c for c in dormant],
    }


@router.get("/orphans")
async def get_orphan_software() -> Dict[str, Any]:
    """Получение списка обнаруженных сирот, битых служб и остатков ПО."""
    global _last_report
    if _last_report is None:
        _last_report = scanner.run_scan(mode=ScanMode.ORPHANS)

    return {
        "orphan_count": len(_last_report.orphan_items),
        "items": [ReportFormatter.to_dict(it) if hasattr(it, "__dataclass_fields__") else it for it in _last_report.orphan_items],
    }


def init_router() -> APIRouter:
    """Инициализация и получение роутера глубокого сканирования ПО."""
    return router


__all__ = ["router", "init_router"]
