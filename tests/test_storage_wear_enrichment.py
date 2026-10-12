# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - Storage Wear & POH Enrichment
# =============================================================================
# Description:
#   Тесты гарантированного обогащения наработки (Power On Hours / Старт) и SMART-показателей
#   накопителей из базы данных SQLite, а также валидация роутера panel-about-disks-wear.
#
# File: test_storage_wear_enrichment.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-12 08:18:00
# =============================================================================

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from apps.windows.sdk.modules.storage_manager.core.windows_storage_sensor import (
    StorageDiskHealthInfo,
    _enrich_disks_from_telemetry_db,
)
from apps.windows.api.routers.router_panel import _resolve_panel_sql, PANEL_SQL_REGISTRY
from apps.windows.api.routers.about_system.query_diagnostics import query_storage_battery_from_db


def test_router_panel_disks_wear_registry():
    """Проверка регистрации panel-about-disks-wear, panel-system-inspector-storage и алиасов в PANEL_SQL_REGISTRY."""
    assert "panel-about-disks-wear" in PANEL_SQL_REGISTRY
    assert "panel-system-inspector-storage" in PANEL_SQL_REGISTRY
    assert "panel-about-system-4-iznos-nakopiteley-i-batarei" in PANEL_SQL_REGISTRY

    meta_wear = _resolve_panel_sql("panel-about-disks-wear")
    meta_storage = _resolve_panel_sql("panel-system-inspector-storage")
    assert meta_wear["table"] == "system_snapshots"
    assert meta_storage["table"] == "system_snapshots"
    assert meta_wear["sql"] == meta_storage["sql"]


def test_enrich_disks_from_telemetry_db_enrichment():
    """Проверка обогащения наработки диска из SQLite снапшота."""
    disk = StorageDiskHealthInfo(
        device_id="Disk0",
        friendly_name="TOSHIBA HDWD110",
        model="TOSHIBA HDWD110",
        serial_number="17H1BK1FS",
        bus_type="SATA",
        media_type="HDD",
        size_gb=931.5,
        power_on_hours=0,
        temperature_c=0.0,
    )

    mock_storage = MagicMock()
    mock_storage.connection.__enter__.return_value.cursor.return_value.fetchall.return_value = []
    mock_storage.get_latest_snapshot_full.return_value = {
        "physical_disks": [
            {
                "device_id": "Disk0",
                "model": "TOSHIBA HDWD110",
                "serial_number": "17H1BK1FS",
                "power_on_hours": 13890,
                "temperature_celsius": 39.0,
            }
        ]
    }

    with patch("apps.windows.telemetry.sqlite.TelemetryStorage.get_instance", return_value=mock_storage):
        _enrich_disks_from_telemetry_db([disk])

    assert disk.power_on_hours == 13890
    assert disk.temperature_c == 39.0


def test_query_storage_battery_from_db_poh_guarantee():
    """Проверка, что query_storage_battery_from_db извлекает данные дисков строго из SQLite и рассчитывает наработку."""
    mock_storage = MagicMock()
    mock_storage.get_latest_storage_data.return_value = {
        "physical_disks": [
            {
                "device_id": "Disk1",
                "model": "CT1000MX500SSD1",
                "serial_number": "2105E4F070F5",
                "power_on_hours": 10445,
                "temperature_celsius": 32.0,
                "size_gb": 931.5,
                "wear_percentage": 0.0,
                "health_status": "Healthy",
            }
        ],
        "partitions": [
            {
                "device": "D:",
                "fstype": "NTFS",
                "free_gb": 72.9,
                "total_gb": 931.5,
                "used_gb": 858.6,
            }
        ],
    }
    mock_storage.get_latest_snapshot_full.return_value = {
        "battery": {
            "has_battery": False,
        },
        "disk_io": {
            "read_bytes_per_sec": 1000,
            "write_bytes_per_sec": 500,
        },
    }

    result = query_storage_battery_from_db(mock_storage)

    assert result["status"] == "ok"
    assert len(result["disks_wear"]) == 1
    d = result["disks_wear"][0]
    assert d["device_id"] == "Disk 1"
    assert d["power_on_hours"] == 10445
    assert d["first_power_on"] is not None
    assert d["temperature_c"] == 32.0
    assert d["health_pct"] == 100
    assert "Healthy" in d["health_status"]
