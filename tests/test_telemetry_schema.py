# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - Telemetry SQLite Schema
# =============================================================================
# Description:
#   Тесты схемы SQLite телеметрии: идентичность эталону, снятому до декомпозиции
#   schema.py (этап 4 ТЗ оптимизации), и идемпотентность init_database_schema.
#
# File: test_telemetry_schema.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:50:00
# =============================================================================

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from apps.windows.telemetry.sqlite.schema import init_database_schema

BASELINE_PATH = Path(__file__).parent / 'api_baselines' / 'telemetry_schema.json'
QUERY = "SELECT type, name, tbl_name, COALESCE(sql, '') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"


def _dump(conn: sqlite3.Connection) -> list[dict[str, str]]:
    """Снимает описание всех объектов схемы."""
    return [{'type': t, 'name': n, 'tbl': tb, 'sql': s} for t, n, tb, s in conn.execute(QUERY).fetchall()]


def test_schema_matches_baseline() -> None:
    """Схема свежей БД совпадает с эталоном: те же таблицы, индексы и их DDL."""
    conn = sqlite3.connect(':memory:')
    init_database_schema(conn)
    baseline = json.loads(BASELINE_PATH.read_text(encoding='utf-8'))
    assert _dump(conn) == baseline


def test_schema_init_is_idempotent() -> None:
    """Повторная инициализация не меняет схему и не падает."""
    conn = sqlite3.connect(':memory:')
    init_database_schema(conn)
    first = _dump(conn)
    init_database_schema(conn)
    assert _dump(conn) == first
