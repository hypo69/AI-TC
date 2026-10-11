# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema (create_security_process_tables)
# =============================================================================
# Description:
#   Таблицы событий безопасности, питания и интеллекта процессов.
#   Вынесено из schema.py при декомпозиции init_database_schema (этап 4 ТЗ оптимизации).
#   Порядок создания таблиц сохраняется вызовом из init_database_schema.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema_security import create_security_process_tables
#
#     create_security_process_tables(conn.cursor())
#
# File: schema_security.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Таблицы событий безопасности, питания и интеллекта процессов."""

import sqlite3


def create_security_process_tables(cursor: sqlite3.Cursor) -> None:
    """Таблицы событий безопасности, питания и интеллекта процессов.

    Args:
        cursor: Курсор активного соединения SQLite.
    """
    # 65. Нормализованные события безопасности Windows (security_events)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS security_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_record_id INTEGER DEFAULT 0,
            event_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            computer TEXT,
            channel TEXT DEFAULT 'Security',
            level TEXT DEFAULT 'Information',
            subject_user TEXT,
            subject_domain TEXT,
            subject_sid TEXT,
            target_user TEXT,
            target_domain TEXT,
            target_sid TEXT,
            process_id INTEGER DEFAULT 0,
            process_name TEXT,
            parent_process_id INTEGER DEFAULT 0,
            parent_process_name TEXT,
            command_line TEXT,
            logon_id TEXT,
            logon_type INTEGER,
            elevated_token INTEGER,
            source_ip TEXT,
            source_port INTEGER,
            object_name TEXT,
            status_code TEXT,
            message TEXT,
            event_data_json TEXT,
            ingested_at TEXT NOT NULL
        );
    ''')

    # 66. Сырые события безопасности Windows (security_events_raw)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS security_events_raw (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_record_id INTEGER DEFAULT 0,
            event_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            channel TEXT DEFAULT 'Security',
            raw_xml TEXT NOT NULL,
            ingested_at TEXT NOT NULL
        );
    ''')

    # 67. Закладки инкрементального сбора событий (security_collector_bookmarks)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS security_collector_bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL UNIQUE,
            last_record_id INTEGER DEFAULT 0,
            bookmark_xml TEXT,
            last_timestamp TEXT,
            updated_at REAL NOT NULL
        );
    ''')

    # 68. События питания и жизненного цикла Windows (power_events)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS power_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            provider TEXT,
            channel TEXT DEFAULT 'System',
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            event_type TEXT NOT NULL,
            shutdown_type TEXT,
            user TEXT,
            domain TEXT,
            process TEXT,
            process_id INTEGER,
            reason TEXT,
            reason_code TEXT,
            comment TEXT,
            unexpected INTEGER DEFAULT 0,
            bugcheck_code TEXT,
            bugcheck_params_json TEXT,
            boot_id TEXT,
            details_json TEXT,
            raw_xml TEXT,
            UNIQUE(event_id, timestamp, provider) ON CONFLICT REPLACE
        );
    ''')

    # 69. Реконструированные сессии питания ОС (power_sessions)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS power_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            boot_time TEXT NOT NULL,
            boot_timestamp REAL,
            shutdown_time TEXT,
            shutdown_timestamp REAL,
            uptime_seconds REAL,
            uptime_human TEXT,
            shutdown_type TEXT DEFAULT 'Active',
            initiator TEXT,
            process TEXT,
            reason TEXT,
            reason_code TEXT,
            comment TEXT,
            clean_shutdown INTEGER DEFAULT 1,
            unexpected_shutdown INTEGER DEFAULT 0,
            bugcheck TEXT,
            boot_event_id INTEGER DEFAULT 12,
            shutdown_event_id INTEGER,
            initiator_chain_json TEXT,
            events_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 69.1. Разрывы и паузы телеметрии при сне (telemetry_gaps)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_gaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_utc TEXT NOT NULL,
            end_utc TEXT NOT NULL,
            gap_type TEXT NOT NULL,
            duration_seconds REAL NOT NULL,
            confidence TEXT NOT NULL,
            evidence_json TEXT,
            created_at REAL NOT NULL
        );
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_gaps_start ON telemetry_gaps(start_utc);')

    # 70. Паспорт программы (process_definition)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_definition (
            definition_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            executable_path TEXT NOT NULL UNIQUE,
            sha256 TEXT,
            company_name TEXT,
            file_description TEXT,
            icon_base64 TEXT,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL
        );
    ''')

    # 71. Единичный инстанс процесса (process_instance - Process Intelligence & PID Recycling Resolution)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_instance (
            instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            definition_id INTEGER NOT NULL,
            pid INTEGER NOT NULL,
            parent_instance_id INTEGER,
            name TEXT NOT NULL,
            executable_path TEXT NOT NULL,
            command_line TEXT,
            start_time TEXT NOT NULL,
            exit_time TEXT,
            exit_code INTEGER,
            session_id INTEGER DEFAULT 1,
            user_name TEXT,
            integrity_level TEXT,
            status TEXT NOT NULL DEFAULT 'RUNNING',
            UNIQUE (pid, start_time),
            FOREIGN KEY (parent_instance_id) REFERENCES process_instance(instance_id),
            FOREIGN KEY (definition_id) REFERENCES process_definition(definition_id)
        );
    ''')

    # 72. Срезы телеметрии во времени (process_sample)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_sample (
            sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            cpu_percent REAL DEFAULT 0.0,
            cpu_user_time REAL DEFAULT 0.0,
            cpu_kernel_time REAL DEFAULT 0.0,
            thread_count INTEGER DEFAULT 1,
            working_set_mb REAL DEFAULT 0.0,
            private_bytes_mb REAL DEFAULT 0.0,
            page_faults_sec REAL DEFAULT 0.0,
            gpu_load_percent REAL DEFAULT 0.0,
            gpu_vram_mb REAL DEFAULT 0.0,
            disk_read_bytes_sec REAL DEFAULT 0.0,
            disk_write_bytes_sec REAL DEFAULT 0.0,
            disk_iops REAL DEFAULT 0.0,
            handle_count INTEGER DEFAULT 0,
            gdi_objects INTEGER DEFAULT 0,
            user_objects INTEGER DEFAULT 0,
            sockets_count INTEGER DEFAULT 0,
            sockets_json TEXT,
            FOREIGN KEY (instance_id) REFERENCES process_instance(instance_id) ON DELETE CASCADE
        );
    ''')

    # 73. Лента файловых операций процесса (process_file_events)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_file_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pid INTEGER NOT NULL DEFAULT 0,
            process_name TEXT NOT NULL DEFAULT '',
            action_type TEXT NOT NULL DEFAULT '', -- 'CREATE', 'MODIFY', 'DELETE', 'RENAME'
            target_directory TEXT NOT NULL DEFAULT '',
            file_path TEXT NOT NULL,
            bytes_affected INTEGER DEFAULT 0,
            instance_id INTEGER,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            created_at REAL DEFAULT 0.0,
            FOREIGN KEY (instance_id) REFERENCES process_instance(instance_id) ON DELETE CASCADE
        );
    ''')

    # 74. Единая таблица снимков ресурсов и активности процессов по PID (Per-PID Telemetry Engine)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_pid_snapshots (
            snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pid INTEGER NOT NULL,
            process_name TEXT NOT NULL,
            executable_path TEXT,
            
            -- Процессор (CPU)
            cpu_percent REAL NOT NULL DEFAULT 0.0,
            user_time_ms INTEGER NOT NULL DEFAULT 0,
            kernel_time_ms INTEGER NOT NULL DEFAULT 0,
            thread_count INTEGER NOT NULL DEFAULT 1,
            
            -- Память (RAM)
            working_set_bytes INTEGER NOT NULL DEFAULT 0,
            private_bytes INTEGER NOT NULL DEFAULT 0,
            page_faults_count INTEGER DEFAULT 0,
            
            -- Графика (GPU)
            gpu_vram_bytes INTEGER DEFAULT 0,
            gpu_utilization REAL DEFAULT 0.0,
            
            -- Дисковый I/O
            read_bytes_total INTEGER DEFAULT 0,
            write_bytes_total INTEGER DEFAULT 0,
            read_ops_total INTEGER DEFAULT 0,
            write_ops_total INTEGER DEFAULT 0,
            
            -- Сетевой трафик
            net_bytes_sent_total INTEGER DEFAULT 0,
            net_bytes_recv_total INTEGER DEFAULT 0,
            
            -- Системные дескрипторы и GUI-ресурсы
            handle_count INTEGER DEFAULT 0,
            gdi_objects INTEGER DEFAULT 0,
            user_objects INTEGER DEFAULT 0,
            
            timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        );
    ''')
