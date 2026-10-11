# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema (create_storage_tables)
# =============================================================================
# Description:
#   Таблицы хранилищ, инцидентов, дисков и агрегатов телеметрии.
#   Вынесено из schema.py при декомпозиции init_database_schema (этап 4 ТЗ оптимизации).
#   Порядок создания таблиц сохраняется вызовом из init_database_schema.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema_storage import create_storage_tables
#
#     create_storage_tables(conn.cursor())
#
# File: schema_storage.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Таблицы хранилищ, инцидентов, дисков и агрегатов телеметрии."""

import sqlite3


def create_storage_tables(cursor: sqlite3.Cursor) -> None:
    """Таблицы хранилищ, инцидентов, дисков и агрегатов телеметрии.

    Args:
        cursor: Курсор активного соединения SQLite.
    """
    # 9. Аудит оборудования
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS hardware_audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            archive_id TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            devices_count INTEGER DEFAULT 0,
            problem_devices_count INTEGER DEFAULT 0,
            outdated_drivers_count INTEGER DEFAULT 0,
            changes_count INTEGER DEFAULT 0,
            raw_json TEXT
        );
    ''')

    # 10. История перезагрузок
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reboot_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boot_id TEXT UNIQUE NOT NULL,
            boot_time TEXT NOT NULL,
            previous_boot_time TEXT,
            uptime_seconds REAL,
            uptime_human TEXT,
            shutdown_type TEXT NOT NULL,
            likely_class TEXT,
            conclusion TEXT,
            initiating_process TEXT,
            initiating_user TEXT,
            shutdown_action TEXT,
            reason_text TEXT,
            reason_code INTEGER,
            bugcheck_code TEXT,
            bugcheck_params_json TEXT,
            power_button_timestamp TEXT,
            windows_update_kb TEXT,
            service_installed TEXT,
            evidence_json TEXT,
            events_chain_json TEXT,
            raw_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 11. Инциденты аномалий
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            trigger_type TEXT NOT NULL,
            severity TEXT DEFAULT 'warning',
            title TEXT NOT NULL,
            description TEXT,
            trigger_metrics_json TEXT,
            suspect_processes_json TEXT,
            related_events_json TEXT,
            metrics_summary_json TEXT,
            raw_window_json TEXT
        );
    ''')

    # 12. События телеметрии
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            event_type TEXT NOT NULL,
            severity TEXT DEFAULT 'info',
            event_details TEXT,
            raw_json TEXT
        );
    ''')

    # 13. Опросы приложений
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            app TEXT NOT NULL,
            poll_type TEXT,
            metric_name TEXT,
            value REAL,
            unit TEXT,
            status TEXT,
            details TEXT,
            raw_json TEXT
        );
    ''')

    # 14. События приложений
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            app TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT,
            message TEXT,
            details TEXT,
            raw_json TEXT
        );
    ''')

    # 15. Изменения параметров приложений
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_param_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            app TEXT NOT NULL,
            param_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            status TEXT,
            user TEXT,
            details TEXT,
            raw_json TEXT
        );
    ''')

    # 16. Пользовательские записи
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            source_file TEXT,
            payload_json TEXT
        );
    ''')

    # 17. События устройств (PnP / Device Events)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            event_type TEXT NOT NULL,
            device_instance_id TEXT,
            friendly_name TEXT,
            device_class TEXT,
            category TEXT,
            has_problem INTEGER DEFAULT 0,
            problem_code INTEGER DEFAULT 0,
            status_code INTEGER DEFAULT 0,
            manufacturer TEXT,
            flapping_count INTEGER DEFAULT 0,
            uptime_seconds REAL DEFAULT 0.0,
            raw_json TEXT
        );
    ''')

    # 18. Инвентарь устройств
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_instance_id TEXT UNIQUE NOT NULL,
            friendly_name TEXT,
            device_class TEXT,
            install_date TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 19. Системные события W64/ETW
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS w64_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            event_type TEXT,
            path TEXT,
            pid INTEGER,
            name TEXT,
            provider TEXT,
            raw_json TEXT
        );
    ''')

    # 20. Аномальные процессы
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_outliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            pid INTEGER,
            name TEXT,
            status TEXT,
            cpu_percent REAL,
            memory_mb REAL,
            memory_percent REAL,
            num_threads INTEGER,
            username TEXT,
            details TEXT
        );
    ''')

    # 21. Расширенный системный аудит
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_extended_audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            hostname TEXT,
            defender_cfa_enabled INTEGER DEFAULT 0,
            defender_asr_count INTEGER DEFAULT 0,
            defender_exclusions_count INTEGER DEFAULT 0,
            defender_threats_count INTEGER DEFAULT 0,
            startup_entries_count INTEGER DEFAULT 0,
            vss_snapshots_count INTEGER DEFAULT 0,
            users_total_count INTEGER DEFAULT 0,
            users_admin_count INTEGER DEFAULT 0,
            raw_json TEXT
        );
    ''')

    # 22. Почасовые агрегаты сенсоров (telemetry_hourly)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_hourly (
            sensor_id TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            bucket_end INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            value_min REAL,
            value_max REAL,
            value_avg REAL,
            value_sum REAL,
            value_sum_sq REAL,
            value_stddev REAL,
            value_first REAL,
            value_last REAL,
            PRIMARY KEY (sensor_id, bucket_start)
        );
    ''')

    # 23. Суточные агрегаты сенсоров (telemetry_daily)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_daily (
            sensor_id TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            bucket_end INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            value_min REAL,
            value_max REAL,
            value_avg REAL,
            value_sum REAL,
            value_sum_sq REAL,
            value_stddev REAL,
            value_first REAL,
            value_last REAL,
            PRIMARY KEY (sensor_id, bucket_start)
        );
    ''')

    # 24. Недельные агрегаты сенсоров (telemetry_weekly)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_weekly (
            sensor_id TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            bucket_end INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            value_min REAL,
            value_max REAL,
            value_avg REAL,
            value_sum REAL,
            value_sum_sq REAL,
            value_stddev REAL,
            value_first REAL,
            value_last REAL,
            PRIMARY KEY (sensor_id, bucket_start)
        );
    ''')

    # 25. Месячные агрегаты сенсоров (telemetry_monthly)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_monthly (
            sensor_id TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            bucket_end INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            value_min REAL,
            value_max REAL,
            value_avg REAL,
            value_sum REAL,
            value_sum_sq REAL,
            value_stddev REAL,
            value_first REAL,
            value_last REAL,
            PRIMARY KEY (sensor_id, bucket_start)
        );
    ''')

    # 26. Годовые агрегаты сенсоров (telemetry_yearly)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_yearly (
            sensor_id TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            bucket_end INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            value_min REAL,
            value_max REAL,
            value_avg REAL,
            value_sum REAL,
            value_sum_sq REAL,
            value_stddev REAL,
            value_first REAL,
            value_last REAL,
            PRIMARY KEY (sensor_id, bucket_start)
        );
    ''')

    # 27. Фиксация аномальных всплесков сенсоров (telemetry_spikes)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_spikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            value REAL NOT NULL,
            spike_type TEXT DEFAULT 'high',
            baseline_avg REAL,
            baseline_stddev REAL,
            details TEXT,
            raw_json TEXT
        );
    ''')

    # 28. События прямого ввода-вывода (disk_io_events / ETW / Process I/O)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS disk_io_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            pid INTEGER NOT NULL,
            process_name TEXT NOT NULL,
            disk_id INTEGER NOT NULL,
            operation TEXT NOT NULL,
            bytes_count INTEGER NOT NULL,
            duration_ms REAL,
            offset INTEGER,
            file_path TEXT
        );
    ''')

    # 29. Снимки здоровья и износа накопителей (disk_health_snapshots / NVMe SMART / TBW)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS disk_health_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            disk_id INTEGER NOT NULL,
            serial_number TEXT,
            model TEXT,
            bus_type TEXT,
            temperature_c REAL,
            wear_percent REAL,
            available_spare REAL,
            tbw_written_tb REAL,
            tbw_read_tb REAL,
            power_on_hours INTEGER,
            power_cycles INTEGER,
            unsafe_shutdowns INTEGER,
            media_errors INTEGER,
            error_log_entries INTEGER,
            health_status TEXT DEFAULT 'Healthy',
            raw_smart_json TEXT
        );
    ''')

    # 30. Паспорт и конфигурация физических накопителей (disk_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS disk_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            disk_id INTEGER NOT NULL,
            device_path TEXT NOT NULL,
            serial_number TEXT UNIQUE,
            vendor TEXT,
            product TEXT,
            revision TEXT,
            bus_type TEXT,
            media_type TEXT,
            size_bytes INTEGER,
            size_gb REAL,
            sector_size INTEGER,
            removable INTEGER DEFAULT 0,
            partition_style TEXT,
            gpt_guid TEXT,
            partitions_json TEXT,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 31. Паспорт логических томов (volume_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS volume_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            volume_guid TEXT UNIQUE NOT NULL,
            drive_letter TEXT,
            mount_point TEXT,
            label TEXT,
            filesystem TEXT,
            filesystem_flags INTEGER,
            cluster_size_bytes INTEGER,
            sector_size_bytes INTEGER,
            total_bytes INTEGER,
            total_gb REAL,
            disk_id INTEGER,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 32. Сэмплы производительности дисков (disk_performance_samples)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS disk_performance_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            disk_name TEXT NOT NULL,
            read_bytes_sec REAL,
            write_bytes_sec REAL,
            read_iops REAL,
            write_iops REAL,
            read_time_ms REAL,
            write_time_ms REAL,
            percent_disk_time REAL,
            queue_length REAL
        );
    ''')
