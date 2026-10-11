# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema (create_audit_tables)
# =============================================================================
# Description:
#   Таблицы аудитов: автозагрузка, журналы, брандмауэр, службы, Defender, ПО.
#   Вынесено из schema.py при декомпозиции init_database_schema (этап 4 ТЗ оптимизации).
#   Порядок создания таблиц сохраняется вызовом из init_database_schema.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema_audits import create_audit_tables
#
#     create_audit_tables(conn.cursor())
#
# File: schema_audits.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Таблицы аудитов: автозагрузка, журналы, брандмауэр, службы, Defender, ПО."""

import sqlite3


def create_audit_tables(cursor: sqlite3.Cursor) -> None:
    """Таблицы аудитов: автозагрузка, журналы, брандмауэр, службы, Defender, ПО.

    Args:
        cursor: Курсор активного соединения SQLite.
    """
    # 41. Архивные снимки автозапуска Windows (startup_audit_archives)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS startup_audit_archives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            archive_id TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            total_entries INTEGER DEFAULT 0,
            active_entries INTEGER DEFAULT 0,
            disabled_entries INTEGER DEFAULT 0,
            broken_entries INTEGER DEFAULT 0,
            health_score INTEGER DEFAULT 100,
            changes_count INTEGER DEFAULT 0,
            raw_json TEXT
        );
    ''')

    # 42. Отличия и изменения в автозапуске между снимками (startup_changes)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS startup_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            archive_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            change_type TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            previous_value TEXT,
            current_value TEXT
        );
    ''')

    # 43. Снимки каналов журналов событий (event_log_channel_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS event_log_channel_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            channel_name TEXT NOT NULL,
            display_name TEXT,
            description TEXT,
            record_count INTEGER DEFAULT 0,
            size_bytes INTEGER DEFAULT 0,
            channel_type TEXT DEFAULT 'Admin',
            is_enabled INTEGER DEFAULT 1,
            created_at REAL NOT NULL
        );
    ''')

    # 44. Кеш записей журналов событий (event_log_entries_cache)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS event_log_entries_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            channel TEXT NOT NULL,
            event_id INTEGER DEFAULT 0,
            level TEXT DEFAULT 'Information',
            provider_name TEXT,
            time_created TEXT,
            message TEXT,
            raw_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 45. Скомпилированные профили Log Intelligence (event_log_intelligence_profiles)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS event_log_intelligence_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            channel TEXT NOT NULL,
            total_analyzed INTEGER DEFAULT 0,
            unique_patterns_count INTEGER DEFAULT 0,
            critical_incidents_json TEXT,
            top_clusters_json TEXT,
            bursts_json TEXT,
            decision_gate_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 46. Профили брандмауэра (firewall_profile_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS firewall_profile_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            domain_enabled INTEGER NOT NULL,
            private_enabled INTEGER NOT NULL,
            public_enabled INTEGER NOT NULL,
            domain_default_inbound TEXT,
            private_default_inbound TEXT,
            public_default_inbound TEXT,
            stealth_mode_enabled INTEGER DEFAULT 1,
            created_at REAL NOT NULL
        );
    ''')

    # 47. Правила брандмауэра (firewall_rule_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS firewall_rule_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            rule_name TEXT NOT NULL,
            display_name TEXT,
            direction TEXT NOT NULL,
            action TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            protocol TEXT,
            local_port TEXT,
            remote_port TEXT,
            program_path TEXT,
            profile_mask INTEGER,
            created_at REAL NOT NULL
        );
    ''')

    # 48. Снимки состояния служб Windows (services_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS services_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            service_name TEXT NOT NULL,
            display_name TEXT,
            state TEXT NOT NULL,
            state_code INTEGER,
            start_type TEXT,
            pid INTEGER,
            binary_path TEXT,
            account TEXT,
            is_orphaned INTEGER DEFAULT 0,
            created_at REAL NOT NULL
        );
    ''')

    # 49. События изменений служб (service_change_events)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS service_change_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            service_name TEXT NOT NULL,
            display_name TEXT,
            action TEXT NOT NULL,
            old_state TEXT,
            new_state TEXT,
            performed_by TEXT DEFAULT 'SYSTEM',
            details_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 50. Снимки троттлинга и электропитания CPU (cpu_throttling_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cpu_throttling_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            prochot_active BOOLEAN NOT NULL DEFAULT 0,
            pl1_limit_watts REAL,
            pl2_limit_watts REAL,
            current_power_watts REAL,
            max_core_temp_c REAL,
            package_temp_c REAL,
            dpc_latency_us INTEGER DEFAULT 0,
            isr_latency_us INTEGER DEFAULT 0,
            throttling_reasons_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 51. Снимки температурных зон (thermal_zone_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS thermal_zone_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            zone_name TEXT NOT NULL,
            temperature_c REAL NOT NULL,
            critical_limit_c REAL,
            throttling_limit_c REAL,
            sensor_provider TEXT NOT NULL,
            created_at REAL NOT NULL
        );
    ''')

    # 52. Снимки поведенческой форензики (forensics_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS forensics_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            foreground_window_title TEXT,
            foreground_process_name TEXT,
            foreground_pid INTEGER,
            user_idle_seconds INTEGER DEFAULT 0,
            camera_active_apps_json TEXT,
            microphone_active_apps_json TEXT,
            userassist_top_apps_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 53. Сводные снимки утечек ресурсов (process_leak_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_leak_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL UNIQUE,
            timestamp DATETIME NOT NULL,
            total_processes INTEGER NOT NULL,
            suspicious_count INTEGER NOT NULL,
            created_at REAL NOT NULL
        );
    ''')

    # 54. Детализация процессов с утечками (process_leak_items)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_leak_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            pid INTEGER NOT NULL,
            name TEXT NOT NULL,
            handles_count INTEGER NOT NULL,
            gdi_objects INTEGER NOT NULL,
            user_objects INTEGER NOT NULL,
            page_faults INTEGER NOT NULL,
            working_set_mb REAL NOT NULL,
            leak_risk_score TEXT NOT NULL,
            leak_risk_reasons_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 55. Снимки защитника Defender (defender_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defender_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            real_time_protection_enabled INTEGER NOT NULL,
            cloud_protection_enabled INTEGER NOT NULL,
            behavior_monitoring_enabled INTEGER NOT NULL,
            tamper_protection_enabled INTEGER NOT NULL,
            pua_protection_enabled INTEGER NOT NULL,
            antivirus_enabled INTEGER NOT NULL,
            antispyware_enabled INTEGER NOT NULL,
            engine_version TEXT,
            av_signature_version TEXT,
            last_quick_scan_datetime DATETIME,
            last_full_scan_datetime DATETIME,
            security_score INTEGER DEFAULT 100,
            cfa_state INTEGER DEFAULT 0,
            raw_status_json TEXT,
            created_at REAL NOT NULL
        );
    ''')

    # 56. Исключения защитника (defender_exclusions)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defender_exclusions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            exclusion_type TEXT NOT NULL,
            exclusion_value TEXT NOT NULL,
            risk_level TEXT DEFAULT 'SAFE',
            created_at REAL NOT NULL
        );
    ''')

    # 57. Правила ASR (defender_asr_rules)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defender_asr_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            rule_guid TEXT NOT NULL,
            rule_name TEXT NOT NULL,
            rule_action TEXT NOT NULL,
            created_at REAL NOT NULL
        );
    ''')

    # 58. Обнаруженные угрозы (defender_threats)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defender_threats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            threat_id TEXT,
            threat_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            category TEXT,
            resources_json TEXT,
            detection_time DATETIME,
            created_at REAL NOT NULL
        );
    ''')

    # 59. Снимки сетевых сокетов процессов (process_network_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS process_network_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            pid INTEGER NOT NULL,
            process_name TEXT NOT NULL,
            local_address TEXT,
            remote_address TEXT,
            protocol TEXT,
            status TEXT,
            service_type TEXT,
            sent_kb REAL DEFAULT 0.0,
            recv_kb REAL DEFAULT 0.0,
            read_speed_kbs REAL DEFAULT 0.0,
            write_speed_kbs REAL DEFAULT 0.0,
            created_at REAL NOT NULL
        );
    ''')

    # 60. Инвентарь установленного ПО (software_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_inventory (
            app_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            version TEXT,
            publisher TEXT,
            install_date TEXT,
            install_location TEXT,
            architecture TEXT,
            is_system_component INTEGER DEFAULT 0,
            first_seen DATETIME NOT NULL,
            last_scanned_at DATETIME NOT NULL
        );
    ''')

    # 61. Категоризированные места хранения ПО (software_storage_locations)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_storage_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id TEXT NOT NULL,
            category TEXT NOT NULL,
            path TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            file_count INTEGER DEFAULT 0,
            last_updated DATETIME NOT NULL,
            FOREIGN KEY (app_id) REFERENCES software_inventory(app_id) ON DELETE CASCADE
        );
    ''')

    # 62. Файлы конфигурации ПО (software_config_files)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_config_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            format TEXT,
            size_bytes INTEGER DEFAULT 0,
            snippet TEXT,
            FOREIGN KEY (app_id) REFERENCES software_inventory(app_id) ON DELETE CASCADE
        );
    ''')

    # 63. Сетевые снимки ПО (software_network_snapshots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_network_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            app_id TEXT NOT NULL,
            pid INTEGER NOT NULL,
            local_address TEXT,
            remote_address TEXT,
            protocol TEXT,
            domain_name TEXT,
            sent_kb REAL DEFAULT 0.0,
            recv_kb REAL DEFAULT 0.0,
            FOREIGN KEY (app_id) REFERENCES software_inventory(app_id) ON DELETE CASCADE
        );
    ''')

    # 64. Анализ ПО с помощью ИИ (software_ai_research)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_ai_research (
            app_id TEXT PRIMARY KEY,
            summary TEXT,
            config_purpose_explanation TEXT,
            data_storage_explanation TEXT,
            network_activity_explanation TEXT,
            confirmed_facts_json TEXT,
            inferred_facts_json TEXT,
            confidence_level REAL DEFAULT 0.0,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (app_id) REFERENCES software_inventory(app_id) ON DELETE CASCADE
        );
    ''')
