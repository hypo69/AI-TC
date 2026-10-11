# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema
# =============================================================================
# Description:
#   Схема таблиц, индексов и миграций SQLite базы данных системной телеметрии.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema import init_database_schema
#
#     init_database_schema(connection)
#
# File: schema.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Схема таблиц, индексов и процедур миграции базы данных телеметрии SQLite."""

import sqlite3
from typing import Set

from .schema_core import create_core_tables
from .schema_storage import create_storage_tables
from .schema_inventory import create_inventory_tables
from .schema_audits import create_audit_tables
from .schema_security import create_security_process_tables

try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


def init_database_schema(conn: sqlite3.Connection) -> None:
    """Инициализирует таблицы, индексы и выполняет миграции для базы данных телеметрии.

    Args:
        conn: Активное подключение к базе данных SQLite.
    """
    cursor = conn.cursor()

    create_core_tables(cursor)
    create_storage_tables(cursor)
    create_inventory_tables(cursor)
    create_audit_tables(cursor)
    create_security_process_tables(cursor)

    # Индексы для ускорения выборок
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_def_path ON process_definition(executable_path);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_inst_pid_start ON process_instance(pid, start_time);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_inst_status ON process_instance(status);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_inst_parent ON process_instance(parent_instance_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_inst_name ON process_instance(name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_sample_inst_time ON process_sample(instance_id, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_sample_time ON process_sample(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_fe_inst_time ON process_file_events(instance_id, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON system_snapshots(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_startup_archives_created_at ON startup_audit_archives(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_startup_archives_archive_id ON startup_audit_archives(archive_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_startup_changes_created_at ON startup_changes(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_startup_changes_archive_id ON startup_changes(archive_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON system_snapshots(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_snapshots_created_host ON system_snapshots(created_at, hostname);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sensor_polls_sensor_time ON sensor_polls(sensor_id, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sensor_polls_category ON sensor_polls(sensor_category, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_processes_snapshot_id ON process_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_processes_name_pid ON process_snapshots(name, pid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_snap_snapshot_cpu ON process_snapshots(snapshot_id, cpu_percent DESC);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_aggregates_sensor_time ON sensor_aggregates_hourly(sensor_id, period_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_rollups_daily_date ON process_rollups_daily(date, name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_rollups_tier_start_end ON telemetry_rollups(tier, period_start_epoch, period_end_epoch);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_hardware_audits_archive_id ON hardware_audits(archive_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reboot_history_boot_time ON reboot_history(boot_time);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_trigger ON incidents(trigger_type);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_sev_time ON incidents(severity, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_prov_guid ON process_provenance_events(process_guid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_prov_created_at ON process_provenance_events(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_prov_name_pid ON process_provenance_events(name, pid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_events_created_at ON device_events(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_inventory_dev_id ON device_inventory(device_instance_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_w64_events_created_at ON w64_events(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_process_outliers_created_at ON process_outliers(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_extended_audits_created_at ON system_extended_audits(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_time ON telemetry_hourly(bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_sensor ON telemetry_hourly(sensor_id, bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_daily_time ON telemetry_daily(bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_daily_sensor ON telemetry_daily(sensor_id, bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_weekly_time ON telemetry_weekly(bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_weekly_sensor ON telemetry_weekly(sensor_id, bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_monthly_time ON telemetry_monthly(bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_monthly_sensor ON telemetry_monthly(sensor_id, bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_yearly_time ON telemetry_yearly(bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_yearly_sensor ON telemetry_yearly(sensor_id, bucket_start);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telemetry_spikes_time ON telemetry_spikes(created_at, sensor_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_io_pid_time ON disk_io_events(pid, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_io_disk_time ON disk_io_events(disk_id, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_health_disk_time ON disk_health_snapshots(disk_id, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_health_serial_time ON disk_health_snapshots(serial_number, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_inv_serial ON disk_inventory(serial_number);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_volume_inv_guid ON volume_inventory(volume_guid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_disk_perf_name_time ON disk_performance_samples(disk_name, created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cpu_inv_name ON cpu_inventory(name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ram_mod_serial ON ram_module_inventory(serial_number);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_gpu_inv_pci ON gpu_inventory(pci_device_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_net_inv_guid ON network_adapter_inventory(adapter_guid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cpu_samples_time ON cpu_telemetry_samples(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ram_samples_time ON ram_telemetry_samples(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_gpu_samples_time ON gpu_telemetry_samples(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_net_samples_time ON network_adapter_samples(created_at);')

    # Индексы для новых подсистем
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evt_chan_snap_id ON event_log_channel_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evt_chan_name ON event_log_channel_snapshots(channel_name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evt_entries_snap_id ON event_log_entries_cache(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evt_entries_chan_lvl ON event_log_entries_cache(channel, level);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_evt_intel_chan ON event_log_intelligence_profiles(channel);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_fw_prof_snapshot ON firewall_profile_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_fw_rule_snapshot ON firewall_rule_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_fw_rule_name ON firewall_rule_snapshots(rule_name);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_services_snap_id ON services_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_services_name ON services_snapshots(service_name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_services_state ON services_snapshots(state);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_svc_changes_ts ON service_change_events(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_svc_changes_name ON service_change_events(service_name);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_throttling_snapshot_id ON cpu_throttling_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_throttling_timestamp ON cpu_throttling_snapshots(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_thermal_zone_snapshot ON thermal_zone_snapshots(snapshot_id);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_forensics_snapshot_id ON forensics_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_forensics_timestamp ON forensics_snapshots(timestamp);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_leak_snapshot_id ON process_leak_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_leak_timestamp ON process_leak_snapshots(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_leak_item_snapshot ON process_leak_items(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_leak_item_pid ON process_leak_items(pid);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_defender_snapshot_id ON defender_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_defender_timestamp ON defender_snapshots(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_defender_exclusions_snap ON defender_exclusions(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_defender_asr_snap ON defender_asr_rules(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_defender_threats_snap ON defender_threats(snapshot_id);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_net_snapshot_id ON process_network_snapshots(snapshot_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_net_pid ON process_network_snapshots(pid);')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sw_storage_app ON software_storage_locations(app_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sw_config_app ON software_config_files(app_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sw_net_app_ts ON software_network_snapshots(timestamp, app_id);')

    # Индексы для подсистемы безопасности Security Event Log
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_event_id ON security_events(event_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_timestamp ON security_events(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_created_at ON security_events(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_user ON security_events(subject_user);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_target_user ON security_events(target_user);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_process ON security_events(process_name);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_pid ON security_events(process_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_security_record_id ON security_events(event_record_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sec_raw_record_id ON security_events_raw(event_record_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sec_raw_created_at ON security_events_raw(created_at);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sec_bm_channel ON security_collector_bookmarks(channel);')

    # Индексы для подсистемы событий питания и сессий
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_events_eid ON power_events(event_id);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_events_ts ON power_events(timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_events_type ON power_events(event_type);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_events_user ON power_events(user);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_events_proc ON power_events(process);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_sessions_boot_time ON power_sessions(boot_time);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_sessions_shutdown_type ON power_sessions(shutdown_type);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_sessions_clean ON power_sessions(clean_shutdown, unexpected_shutdown);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_power_sessions_initiator ON power_sessions(initiator);')

    _run_migrations(cursor)

    # Индексы для Per-PID Telemetry Engine и отслеживания файлов
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_pid_time ON process_pid_snapshots(pid, timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_proc_name_time ON process_pid_snapshots(process_name, timestamp);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_file_events_pid ON process_file_events(pid);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_file_events_dir ON process_file_events(target_directory, timestamp);')

    conn.commit()


def _run_migrations(cursor: sqlite3.Cursor) -> None:
    """Выполняет безопасные миграции добавления новых колонок в существующие таблицы."""
    # Миграция: telemetry_events
    try:
        cursor.execute("PRAGMA table_info(telemetry_events)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'severity' not in columns:
            cursor.execute("ALTER TABLE telemetry_events ADD COLUMN severity TEXT DEFAULT 'info'")
        if 'event_details' not in columns:
            cursor.execute("ALTER TABLE telemetry_events ADD COLUMN event_details TEXT")
        if 'raw_json' not in columns:
            cursor.execute("ALTER TABLE telemetry_events ADD COLUMN raw_json TEXT")
    except Exception as exc:
        logger.warning(f'Миграция telemetry_events: {exc}')

    # Миграция: system_snapshots
    try:
        cursor.execute("PRAGMA table_info(system_snapshots)")
        snap_cols = {row[1] for row in cursor.fetchall()}
        expected_snap_cols = {
            'hostname': 'TEXT',
            'username': 'TEXT',
            'uptime_seconds': 'REAL',
            'os_name': 'TEXT',
            'os_build': 'TEXT',
            'os_install_date': 'TEXT',
            'system_language': 'TEXT',
            'os_install_language': 'TEXT',
            'user_locale': 'TEXT',
            'system_locale': 'TEXT',
            'timezone': 'TEXT',
            'codepage': 'TEXT',
            'input_languages_json': 'TEXT',
            'disks_json': 'TEXT',
            'physical_disks_json': 'TEXT',
            'monitors_json': 'TEXT',
            'updates_json': 'TEXT',
            'office_json': 'TEXT',
            'onedrive_json': 'TEXT',
            'battery_json': 'TEXT',
            'ram_sticks_json': 'TEXT',
            'listening_ports_json': 'TEXT',
            'alerts_json': 'TEXT',
            'cpu_total_percent': 'REAL',
            'cpu_frequency_mhz': 'REAL',
            'memory_total_gb': 'REAL',
            'memory_used_gb': 'REAL',
            'memory_percent': 'REAL',
            'swap_percent': 'REAL',
            'gpu_load_percent': 'REAL',
            'gpu_temp_c': 'REAL',
            'disk_read_bytes_sec': 'REAL',
            'disk_write_bytes_sec': 'REAL',
            'disk_read_count_sec': 'REAL',
            'disk_write_count_sec': 'REAL',
            'network_sent_bytes_sec': 'REAL',
            'network_recv_bytes_sec': 'REAL',
            'hardware_audit': 'TEXT',
            'raw_json': 'TEXT',
        }
        for col_name, col_type in expected_snap_cols.items():
            if col_name not in snap_cols:
                cursor.execute(f"ALTER TABLE system_snapshots ADD COLUMN {col_name} {col_type}")
    except Exception as exc:
        logger.warning(f'Миграция system_snapshots: {exc}')

    # Миграция: process_snapshots
    try:
        cursor.execute("PRAGMA table_info(process_snapshots)")
        proc_cols = {row[1] for row in cursor.fetchall()}
        new_proc_columns = {
            'num_handles': 'INTEGER DEFAULT 0',
            'read_bytes_sec': 'REAL',
            'write_bytes_sec': 'REAL',
            'integrity_level': 'TEXT',
            'elevation': 'INTEGER DEFAULT 0',
            'ppid': 'INTEGER',
            'parent_name': 'TEXT',
            'executable': 'TEXT',
            'cmdline': 'TEXT',
            'sid': 'TEXT',
            'session_id': 'INTEGER',
            'creation_time': 'TEXT',
            'process_guid': 'TEXT',
            'ancestor_chain': 'TEXT',
            'launch_reason': 'TEXT',
        }
        for col_name, col_def in new_proc_columns.items():
            if col_name not in proc_cols:
                cursor.execute(f"ALTER TABLE process_snapshots ADD COLUMN {col_name} {col_def}")
    except Exception as exc:
        logger.warning(f'Миграция process_snapshots: {exc}')

    # Миграция: process_file_events
    try:
        cursor.execute("PRAGMA table_info(process_file_events)")
        fe_cols = {row[1] for row in cursor.fetchall()}
        if fe_cols:
            # Безопасное переименование устаревших имен колонок при их наличии
            legacy_renames = [
                ('id', 'event_id'),
                ('action', 'action_type'),
                ('target_folder', 'target_directory'),
                ('bytes_count', 'bytes_affected'),
            ]
            for old_col, new_col in legacy_renames:
                if old_col in fe_cols and new_col not in fe_cols:
                    cursor.execute(f"ALTER TABLE process_file_events RENAME COLUMN {old_col} TO {new_col}")
                    fe_cols.remove(old_col)
                    fe_cols.add(new_col)

            target_fe_columns = {
                'pid': "INTEGER NOT NULL DEFAULT 0",
                'process_name': "TEXT NOT NULL DEFAULT ''",
                'action_type': "TEXT NOT NULL DEFAULT ''",
                'target_directory': "TEXT NOT NULL DEFAULT ''",
                'file_path': "TEXT NOT NULL DEFAULT ''",
                'bytes_affected': "INTEGER DEFAULT 0",
                'instance_id': "INTEGER",
                'timestamp': "TEXT NOT NULL DEFAULT (datetime('now'))",
                'created_at': "REAL DEFAULT 0.0",
            }
            for col_name, col_def in target_fe_columns.items():
                if col_name not in fe_cols:
                    cursor.execute(f"ALTER TABLE process_file_events ADD COLUMN {col_name} {col_def}")
    except Exception as exc:
        logger.warning(f'Миграция process_file_events: {exc}')


