# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema (create_core_tables)
# =============================================================================
# Description:
#   Основные таблицы: снапшоты системы, процессы, события, сенсоры, роллапы.
#   Вынесено из schema.py при декомпозиции init_database_schema (этап 4 ТЗ оптимизации).
#   Порядок создания таблиц сохраняется вызовом из init_database_schema.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema_core import create_core_tables
#
#     create_core_tables(conn.cursor())
#
# File: schema_core.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Основные таблицы: снапшоты системы, процессы, события, сенсоры, роллапы."""

import sqlite3


def create_core_tables(cursor: sqlite3.Cursor) -> None:
    """Основные таблицы: снапшоты системы, процессы, события, сенсоры, роллапы.

    Args:
        cursor: Курсор активного соединения SQLite.
    """
    # 1. Системные снимки (основная таблица метрик)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            hostname TEXT,
            username TEXT,
            uptime_seconds REAL,
            os_name TEXT,
            os_build TEXT,
            os_install_date TEXT,
            system_language TEXT,
            os_install_language TEXT,
            user_locale TEXT,
            system_locale TEXT,
            timezone TEXT,
            codepage TEXT,
            input_languages_json TEXT,
            disks_json TEXT,
            physical_disks_json TEXT,
            monitors_json TEXT,
            updates_json TEXT,
            office_json TEXT,
            onedrive_json TEXT,
            battery_json TEXT,
            ram_sticks_json TEXT,
            listening_ports_json TEXT,
            alerts_json TEXT,
            cpu_total_percent REAL,
            cpu_frequency_mhz REAL,
            memory_total_gb REAL,
            memory_used_gb REAL,
            memory_percent REAL,
            swap_percent REAL,
            gpu_load_percent REAL,
            gpu_temp_c REAL,
            disk_read_bytes_sec REAL,
            disk_write_bytes_sec REAL,
            disk_read_count_sec REAL,
            disk_write_count_sec REAL,
            network_sent_bytes_sec REAL,
            network_recv_bytes_sec REAL,
            hardware_audit TEXT,
            raw_json TEXT
        );
    ''')

    # 2. Сенсоры (аппаратные датчики)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            hardware_name TEXT,
            hardware_type TEXT,
            sensor_category TEXT,
            sensor_name TEXT,
            unit TEXT,
            value REAL,
            provider TEXT,
            provider_priority INTEGER DEFAULT 30,
            raw_json TEXT,
            UNIQUE(sensor_id, timestamp)
        );
    ''')

    # 3. Снимки процессов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            pid INTEGER NOT NULL,
            name TEXT NOT NULL,
            status TEXT,
            cpu_percent REAL,
            memory_mb REAL,
            memory_percent REAL,
            num_threads INTEGER,
            num_handles INTEGER DEFAULT 0,
            username TEXT,
            read_bytes_sec REAL,
            write_bytes_sec REAL,
            integrity_level TEXT,
            elevation INTEGER DEFAULT 0,
            ppid INTEGER,
            parent_name TEXT,
            executable TEXT,
            cmdline TEXT,
            sid TEXT,
            session_id INTEGER,
            creation_time TEXT,
            process_guid TEXT,
            ancestor_chain TEXT,
            launch_reason TEXT,
            FOREIGN KEY (snapshot_id) REFERENCES system_snapshots(id) ON DELETE CASCADE
        );
    ''')

    # 4. Происхождение и жизненный цикл процессов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_provenance_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            event_type TEXT NOT NULL,
            pid INTEGER NOT NULL,
            ppid INTEGER,
            process_guid TEXT NOT NULL,
            parent_guid TEXT,
            name TEXT NOT NULL,
            executable_path TEXT,
            command_line TEXT,
            user TEXT,
            sid TEXT,
            session_id INTEGER,
            integrity_level TEXT,
            elevation INTEGER,
            parent_name TEXT,
            parent_cmdline TEXT,
            ancestor_chain TEXT,
            launch_reason TEXT,
            source TEXT DEFAULT 'system',
            details_json TEXT,
            raw_json TEXT
        );
    ''')

    # 5. Почасовые агрегаты сенсоров
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_aggregates_hourly (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            avg_value REAL,
            min_value REAL,
            max_value REAL,
            count INTEGER,
            raw_json TEXT
        );
    ''')

    # 6. Двухминутные агрегаты процессов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_rollups_2min (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            period_start_epoch REAL,
            period_end_epoch REAL,
            name TEXT NOT NULL,
            pid INTEGER,
            username TEXT,
            sample_count INTEGER NOT NULL,
            avg_cpu_percent REAL NOT NULL,
            max_cpu_percent REAL NOT NULL,
            min_cpu_percent REAL,
            avg_memory_mb REAL NOT NULL,
            max_memory_mb REAL NOT NULL,
            min_memory_mb REAL,
            avg_num_threads REAL,
            outliers_count INTEGER DEFAULT 0
        );
    ''')

    # 7. Суточные агрегаты процессов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_rollups_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            name TEXT NOT NULL,
            sample_count INTEGER NOT NULL,
            avg_cpu_percent REAL NOT NULL,
            max_cpu_percent REAL NOT NULL,
            avg_memory_mb REAL NOT NULL,
            max_memory_mb REAL NOT NULL,
            outliers_count INTEGER DEFAULT 0,
            last_seen TEXT
        );
    ''')

    # 8. Бакеты сжатия временных рядов телеметрии
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_rollups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            period_start_epoch REAL NOT NULL,
            period_end_epoch REAL NOT NULL,
            duration_seconds REAL NOT NULL,
            sample_count INTEGER NOT NULL,
            tier TEXT NOT NULL,
            cpu_avg REAL,
            cpu_min REAL,
            cpu_max REAL,
            cpu_p95 REAL,
            ram_avg_gb REAL,
            ram_min_gb REAL,
            ram_max_gb REAL,
            ram_percent_avg REAL,
            ram_percent_max REAL,
            disk_read_avg_mbs REAL,
            disk_read_max_mbs REAL,
            disk_read_total_mb REAL,
            disk_write_avg_mbs REAL,
            disk_write_max_mbs REAL,
            disk_write_total_mb REAL,
            network_rx_avg_mbs REAL,
            network_rx_max_mbs REAL,
            network_rx_total_mb REAL,
            network_tx_avg_mbs REAL,
            network_tx_max_mbs REAL,
            network_tx_total_mb REAL,
            raw_json TEXT
        );
    ''')
