# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Writer
# =============================================================================
# Description:
#   Класс TelemetryWriter для сериализации и записи телеметрии в SQLite.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.writer import TelemetryWriter
#
#     writer = TelemetryWriter(connection_manager)
#     saved = writer.batch_insert_records(records)
#
# File: writer.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 18:26:00
# =============================================================================

from __future__ import annotations

"""Класс TelemetryWriter для сериализации, подготовки строк и транзакционной записи в SQLite."""

import json
from datetime import datetime, timezone
from typing import (
    Any,
    Dict,
    List,
    Optional,
)

from .connection import TelemetryConnectionManager
from .writer_snapshots import TelemetrySnapshotWriterMixin
from .writer_inventory import TelemetryInventoryWriterMixin
from .writer_audits import TelemetryAuditWriterMixin
from .delta_tracker import DeltaStateTracker

try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class TelemetryWriter(TelemetrySnapshotWriterMixin, TelemetryInventoryWriterMixin, TelemetryAuditWriterMixin):
    """Выполняет пакетную и прямую вставку записей телеметрии в базу данных SQLite."""

    def __init__(self, connection_manager: TelemetryConnectionManager) -> None:
        """Инициализирует писатель телеметрии.

        Args:
            connection_manager: Менеджер соединений SQLite.
        """
        self._cm = connection_manager
        self._delta_tracker = DeltaStateTracker()

    @property
    def delta_tracker(self) -> DeltaStateTracker:
        """Возвращает трекер дельт."""
        return self._delta_tracker

    def batch_insert_records(self, records: List[Dict[str, Any]]) -> int:
        """Выполняет пакетную вставку разнородных записей в SQLite в единой транзакции.

        Args:
            records: Список словарей записей.

        Returns:
            int: Общее число сохраненных записей.
        """
        if not records or self._cm.read_only:
            return 0

        saved_total = 0
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            sensor_poll_rows: List[tuple] = []
            sensor_agg_rows: List[tuple] = []

            for item in records:
                rec_type = item.get('type')

                if rec_type == 'snapshot':
                    self.insert_snapshot_row(cursor, item)
                    saved_total += 1

                elif rec_type == 'sensor_poll':
                    sensor_poll_rows.append(self.prepare_sensor_poll_row(item.get('data', {}), item.get('timestamp')))

                elif rec_type == 'sensor_polls_batch':
                    ts = item.get('timestamp')
                    for s in item.get('data', []):
                        sensor_poll_rows.append(self.prepare_sensor_poll_row(s, ts))

                elif rec_type == 'sensor_aggregates_batch':
                    for a in item.get('data', []):
                        sensor_agg_rows.append((
                            a.get('sensor_id', ''),
                            a.get('period_start', ''),
                            a.get('period_end', ''),
                            a.get('avg', None),
                            a.get('min', None),
                            a.get('max', None),
                            a.get('count', 0),
                            json.dumps(a, ensure_ascii=False, default=str),
                        ))

                elif rec_type == 'hardware_archive':
                    self.insert_hardware_archive_row(cursor, item.get('data', {}))
                    saved_total += 1

                elif rec_type == 'startup_archive':
                    self.insert_startup_archive_row(cursor, item.get('data', {}))
                    saved_total += 1

                elif rec_type == 'event':
                    ts_str = item.get('timestamp') or datetime.now(timezone.utc).isoformat()
                    try:
                        now_epoch = datetime.fromisoformat(ts_str).timestamp()
                    except Exception:
                        now_epoch = datetime.now(timezone.utc).timestamp()
                    details_str = json.dumps(item.get('details', {}), ensure_ascii=False, default=str)
                    cursor.execute('''
                        INSERT INTO telemetry_events (
                            timestamp, created_at, event_type, severity, event_details, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    ''', (ts_str, now_epoch, item.get('event_type', ''), item.get('severity', 'info'), details_str, details_str))
                    saved_total += 1

                elif rec_type == 'disk_inventory':
                    self.upsert_disk_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type == 'volume_inventory':
                    self.upsert_volume_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type == 'disk_health':
                    self.insert_disk_health_snapshot(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type == 'disk_performance':
                    self.insert_disk_performance_sample(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type == 'disk_io_event':
                    self.insert_disk_io_event(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('cpu_inventory', 'cpu_inv'):
                    self.upsert_cpu_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('ram_module_inventory', 'ram_inventory', 'ram_module'):
                    self.upsert_ram_module_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('gpu_inventory', 'gpu_inv'):
                    self.upsert_gpu_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('network_adapter_inventory', 'net_inventory', 'net_adapter_inv'):
                    self.upsert_network_adapter_inventory(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('cpu_telemetry', 'cpu_sample'):
                    self.insert_cpu_telemetry_sample(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('ram_telemetry', 'ram_sample'):
                    self.insert_ram_telemetry_sample(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('gpu_telemetry', 'gpu_sample'):
                    self.insert_gpu_telemetry_sample(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type in ('network_adapter_sample', 'network_sample', 'net_sample'):
                    self.insert_network_adapter_sample(cursor, item.get('data') or item)
                    saved_total += 1

                elif rec_type == 'app_poll':
                    cursor.execute('''
                        INSERT INTO app_polls (
                            timestamp, created_at, app, poll_type, metric_name, value, unit, status, details, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_app_poll_row(item.get('data') or item))
                    saved_total += 1

                elif rec_type == 'app_polls_batch':
                    rows = [self.prepare_app_poll_row(p) for p in item.get('data', [])]
                    if rows:
                        cursor.executemany('''
                            INSERT INTO app_polls (
                                timestamp, created_at, app, poll_type, metric_name, value, unit, status, details, raw_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', rows)
                        saved_total += len(rows)

                elif rec_type == 'app_event':
                    cursor.execute('''
                        INSERT INTO app_events (
                            timestamp, created_at, app, event_type, status, details, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_app_event_row(item.get('data') or item))
                    saved_total += 1

                elif rec_type == 'app_events_batch':
                    rows = [self.prepare_app_event_row(ev) for ev in item.get('data', [])]
                    if rows:
                        cursor.executemany('''
                            INSERT INTO app_events (
                                timestamp, created_at, app, event_type, status, details, raw_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', rows)
                        saved_total += len(rows)

                elif rec_type == 'app_param_change':
                    cursor.execute('''
                        INSERT INTO app_param_changes (
                            timestamp, created_at, app, param_name, old_value, new_value, status, user, details, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_app_param_row(item.get('data') or item))
                    saved_total += 1

                elif rec_type == 'app_param_changes_batch':
                    rows = [self.prepare_app_param_row(pc) for pc in item.get('data', [])]
                    if rows:
                        cursor.executemany('''
                            INSERT INTO app_param_changes (
                                timestamp, created_at, app, param_name, old_value, new_value, status, user, details, raw_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', rows)
                        saved_total += len(rows)

                elif rec_type == 'custom_record':
                    ts_str = item.get('timestamp') or datetime.now(timezone.utc).isoformat()
                    try:
                        now_epoch = datetime.fromisoformat(ts_str).timestamp()
                    except Exception:
                        now_epoch = datetime.now(timezone.utc).timestamp()
                    payload_str = json.dumps(item.get('payload', {}), ensure_ascii=False, default=str)
                    cursor.execute('''
                        INSERT INTO custom_records (timestamp, created_at, source_file, payload_json)
                        VALUES (?, ?, ?, ?)
                    ''', (ts_str, now_epoch, item.get('source_file', ''), payload_str))
                    saved_total += 1

                elif rec_type == 'device_event':
                    cursor.execute('''
                        INSERT INTO device_events (
                            timestamp, created_at, event_type, device_instance_id,
                            friendly_name, device_class, category, has_problem,
                            problem_code, status_code, manufacturer,
                            flapping_count, uptime_seconds, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_device_event_row(item.get('data', {}), item.get('timestamp')))
                    saved_total += 1

                elif rec_type == 'w64_event':
                    cursor.execute('''
                        INSERT INTO w64_events (
                            event_id, timestamp, created_at, event_type, path, pid, name, provider, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_w64_event_row(item.get('data', {}), item.get('provider', 'w64_collector')))
                    saved_total += 1

                elif rec_type == 'process_provenance_event':
                    cursor.execute('''
                        INSERT INTO process_provenance_events (
                            event_id, timestamp, created_at, event_type, process_guid, parent_guid,
                            pid, ppid, name, executable_path, command_line, user, sid, session_id,
                            integrity_level, elevation, parent_name, parent_cmdline,
                            ancestor_chain, launch_reason, source, details_json, raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', self.prepare_process_provenance_row(item.get('data', {})))
                    saved_total += 1

                elif rec_type == 'process_provenance_events_batch':
                    rows = [self.prepare_process_provenance_row(ev) for ev in item.get('data', [])]
                    if rows:
                        cursor.executemany('''
                            INSERT INTO process_provenance_events (
                                event_id, timestamp, created_at, event_type, process_guid, parent_guid,
                                pid, ppid, name, executable_path, command_line, user, sid, session_id,
                                integrity_level, elevation, parent_name, parent_cmdline,
                                ancestor_chain, launch_reason, source, details_json, raw_json
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', rows)
                        saved_total += len(rows)

                elif rec_type == 'incident':
                    inc_data = item.get('data', {})
                    now_dt = datetime.now(timezone.utc)
                    ts_str = inc_data.get('timestamp') or item.get('timestamp') or now_dt.isoformat()
                    try:
                        now_epoch = datetime.fromisoformat(ts_str).timestamp()
                    except Exception:
                        now_epoch = now_dt.timestamp()
                    inc_id = inc_data.get('incident_id') or f"INC-{int(now_epoch)}"
                    cursor.execute('''
                        INSERT OR REPLACE INTO incidents (
                            incident_id, timestamp, created_at, trigger_type, severity, title,
                            description, trigger_metrics_json, suspect_processes_json,
                            related_events_json, metrics_summary_json, raw_window_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        inc_id, ts_str, now_epoch,
                        inc_data.get('trigger_type', ''),
                        inc_data.get('severity', 'warning'),
                        inc_data.get('title', ''),
                        inc_data.get('description', ''),
                        json.dumps(inc_data.get('trigger_metrics', {}), ensure_ascii=False, default=str),
                        json.dumps(inc_data.get('suspect_processes', []), ensure_ascii=False, default=str),
                        json.dumps(inc_data.get('related_events', []), ensure_ascii=False, default=str),
                        json.dumps(inc_data.get('metrics_summary', {}), ensure_ascii=False, default=str),
                        json.dumps(inc_data.get('raw_window', []), ensure_ascii=False, default=str),
                    ))
                    saved_total += 1

                elif rec_type == 'system_rollup':
                    r_data = item.get('data', {})
                    p_start = r_data.get('period_start', '')
                    p_end = r_data.get('period_end', '')
                    try:
                        p_start_epoch = datetime.fromisoformat(p_start).timestamp()
                    except Exception:
                        p_start_epoch = 0.0
                    try:
                        p_end_epoch = datetime.fromisoformat(p_end).timestamp()
                    except Exception:
                        p_end_epoch = 0.0
                    cursor.execute('''
                        INSERT INTO telemetry_rollups (
                            period_start, period_end, period_start_epoch, period_end_epoch,
                            duration_seconds, sample_count, tier,
                            cpu_avg, cpu_min, cpu_max, cpu_p95,
                            ram_avg_gb, ram_min_gb, ram_max_gb, ram_percent_avg, ram_percent_max,
                            disk_read_avg_mbs, disk_read_max_mbs, disk_read_total_mb,
                            disk_write_avg_mbs, disk_write_max_mbs, disk_write_total_mb,
                            network_rx_avg_mbs, network_rx_max_mbs, network_rx_total_mb,
                            network_tx_avg_mbs, network_tx_max_mbs, network_tx_total_mb,
                            raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        p_start, p_end, p_start_epoch, p_end_epoch,
                        float(r_data.get('duration_seconds', 0.0) or 0.0),
                        int(r_data.get('sample_count', 0) or 0),
                        str(r_data.get('tier', '1m')),
                        r_data.get('cpu_avg'), r_data.get('cpu_min'), r_data.get('cpu_max'), r_data.get('cpu_p95'),
                        r_data.get('ram_avg_gb'), r_data.get('ram_min_gb'), r_data.get('ram_max_gb'),
                        r_data.get('ram_percent_avg'), r_data.get('ram_percent_max'),
                        r_data.get('disk_read_avg_mbs'), r_data.get('disk_read_max_mbs'), r_data.get('disk_read_total_mb'),
                        r_data.get('disk_write_avg_mbs'), r_data.get('disk_write_max_mbs'), r_data.get('disk_write_total_mb'),
                        r_data.get('network_rx_avg_mbs'), r_data.get('network_rx_max_mbs'), r_data.get('network_rx_total_mb'),
                        r_data.get('network_tx_avg_mbs'), r_data.get('network_tx_max_mbs'), r_data.get('network_tx_total_mb'),
                        json.dumps(r_data, ensure_ascii=False, default=str),
                    ))
                    saved_total += 1

                elif rec_type == 'reboot_session':
                    s_data = item.get('data', {})
                    now_dt = datetime.now(timezone.utc)
                    boot_time = s_data.get('boot_time') or now_dt.isoformat()
                    try:
                        now_epoch = datetime.fromisoformat(boot_time).timestamp()
                    except Exception:
                        now_epoch = now_dt.timestamp()
                    cursor.execute('''
                        INSERT OR REPLACE INTO reboot_history (
                            boot_id, boot_time, previous_boot_time, uptime_seconds, uptime_human,
                            shutdown_type, likely_class, conclusion, initiating_process, initiating_user,
                            shutdown_action, reason_text, reason_code, bugcheck_code, bugcheck_params_json,
                            power_button_timestamp, windows_update_kb, service_installed, evidence_json,
                            events_chain_json, raw_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        s_data.get('boot_id') or f"boot_{int(now_epoch)}",
                        boot_time,
                        s_data.get('previous_boot_time'),
                        float(s_data.get('uptime_seconds', 0.0) or 0.0),
                        s_data.get('uptime_human'),
                        s_data.get('shutdown_type', 'unknown'),
                        s_data.get('likely_class'),
                        s_data.get('conclusion'),
                        s_data.get('initiating_process'),
                        s_data.get('initiating_user'),
                        s_data.get('shutdown_action'),
                        s_data.get('reason_text'),
                        s_data.get('reason_code'),
                        s_data.get('bugcheck_code'),
                        json.dumps(s_data.get('bugcheck_params', {}), ensure_ascii=False, default=str),
                        s_data.get('power_button_timestamp'),
                        s_data.get('windows_update_kb'),
                        s_data.get('service_installed'),
                        json.dumps(s_data.get('evidence', {}), ensure_ascii=False, default=str),
                        json.dumps(s_data.get('events_chain', []), ensure_ascii=False, default=str),
                        json.dumps(s_data, ensure_ascii=False, default=str),
                        now_epoch,
                    ))
                    saved_total += 1

                elif rec_type == 'extended_audit':
                    audit_data = item.get('data', {})
                    now_dt = datetime.now(timezone.utc)
                    ts_str = item.get('timestamp') or audit_data.get('timestamp') or now_dt.isoformat()
                    try:
                        now_epoch = datetime.fromisoformat(ts_str).timestamp()
                    except Exception:
                        now_epoch = now_dt.timestamp()

                    def _get_f(obj: Any, key: str, default: Any = None) -> Any:
                        if isinstance(obj, dict):
                            return obj.get(key, default)
                        return getattr(obj, key, default)

                    def_obj = _get_f(audit_data, 'defender', {})
                    startup_obj = _get_f(audit_data, 'startup', {})
                    vss_obj = _get_f(audit_data, 'vss', {})
                    users_obj = _get_f(audit_data, 'users', {})

                    cursor.execute('''
                        INSERT INTO system_extended_audits (
                            timestamp, created_at, hostname,
                            defender_cfa_enabled, defender_asr_count, defender_exclusions_count, defender_threats_count,
                            startup_entries_count, vss_snapshots_count, users_total_count, users_admin_count,
                            raw_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        ts_str, now_epoch, _get_f(audit_data, 'hostname', ''),
                        int(bool(_get_f(def_obj, 'cfa_enabled', False))),
                        int(_get_f(def_obj, 'asr_rules_count', 0) or 0),
                        int(_get_f(def_obj, 'exclusions_count', len(_get_f(def_obj, 'path_exclusions', []) or [])) or 0),
                        int(_get_f(def_obj, 'active_threats_count', 0) or 0),
                        int(_get_f(startup_obj, 'total_entries', len(_get_f(startup_obj, 'entries', []) or [])) or 0),
                        int(_get_f(vss_obj, 'total_snapshots_count', len(_get_f(vss_obj, 'snapshots', []) or [])) or 0),
                        int(_get_f(users_obj, 'total_users_count', len(_get_f(users_obj, 'users', []) or [])) or 0),
                        int(len(_get_f(users_obj, 'admin_usernames', []) or []) or _get_f(users_obj, 'users_admin_count', 0) or 0),
                        json.dumps(audit_data, ensure_ascii=False, default=str),
                    ))
                    saved_total += 1

            if sensor_poll_rows:
                cursor.executemany('''
                    INSERT INTO sensor_polls (
                        sensor_id, timestamp, created_at, hardware_name, hardware_type,
                        sensor_category, sensor_name, unit, value, provider, provider_priority, raw_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(sensor_id, timestamp) DO UPDATE SET
                        created_at = excluded.created_at,
                        hardware_name = excluded.hardware_name,
                        hardware_type = excluded.hardware_type,
                        sensor_category = excluded.sensor_category,
                        sensor_name = excluded.sensor_name,
                        unit = excluded.unit,
                        value = excluded.value,
                        provider = excluded.provider,
                        provider_priority = excluded.provider_priority,
                        raw_json = excluded.raw_json
                ''', sensor_poll_rows)
                saved_total += len(sensor_poll_rows)

            if sensor_agg_rows:
                cursor.executemany('''
                    INSERT INTO sensor_aggregates_hourly (
                        sensor_id, period_start, period_end, avg_value, min_value, max_value, count, raw_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', sensor_agg_rows)
                saved_total += len(sensor_agg_rows)

            conn.commit()
        return saved_total

    def prepare_sensor_poll_row(self, s: Dict[str, Any], timestamp: Optional[str] = None) -> tuple:
        """Подготавливает кортеж для вставки в sensor_polls."""
        now_dt = datetime.now(timezone.utc)
        ts_str = timestamp or s.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        sid = str(s.get('id') or s.get('sensor_id') or '')
        s_name = s.get('sensor_name') or s.get('name') or (f'Sensor #{sid}' if sid else 'Sensor')
        cat = s.get('sensor_category') or s.get('category') or 'General'
        
        # Определение типа оборудования с fallback
        hw_type = s.get('hardware_type')
        if not hw_type:
            sid_l = sid.lower()
            cat_l = cat.lower()
            if 'disk' in sid_l or 'storage' in sid_l or 'storage' in cat_l:
                hw_type = 'storage'
            elif 'gpu' in sid_l or 'vram' in sid_l or 'graphics' in sid_l:
                hw_type = 'gpu'
            elif 'ram' in sid_l or 'memory' in sid_l:
                hw_type = 'memory'
            elif 'net' in sid_l or 'nic' in sid_l or 'network' in cat_l:
                hw_type = 'network'
            else:
                hw_type = 'cpu'

        hw_name = s.get('hardware_name') or ('Storage' if hw_type == 'storage' else 'System')
        unit = s.get('unit', '')
        raw_val = s.get('value', s.get('value_num', 0.0))
        try:
            val_float = round(float(raw_val), 2)
        except (ValueError, TypeError):
            val_float = 0.0

        provider_raw = s.get('_provider') or s.get('provider') or 'CIM_SYSTEM'
        if hasattr(provider_raw, 'name'):
            provider_str = provider_raw.name
            provider_priority = provider_raw.value
        elif isinstance(provider_raw, str):
            provider_str = provider_raw.upper()
            try:
                from ..sensor_registry import SensorProvider
                provider_priority = SensorProvider[provider_raw.upper()].value
            except (KeyError, ImportError):
                provider_priority = 30
        else:
            provider_str = 'CIM_SYSTEM'
            provider_priority = 30

        raw_json_str = s.get('raw_json')
        if not raw_json_str:
            try:
                raw_json_str = json.dumps(s, ensure_ascii=False, default=str)
            except Exception:
                raw_json_str = None

        return (sid, ts_str, now_epoch, hw_name, hw_type, cat, s_name, unit, val_float, provider_str, provider_priority, raw_json_str)

    def prepare_app_poll_row(self, p: Dict[str, Any]) -> tuple:
        now_dt = datetime.now(timezone.utc)
        ts_str = p.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        app = p.get('app', 'unknown')
        poll_type = p.get('poll_type', 'poll')
        metric_name = p.get('metric_name', 'metric')
        val = p.get('value')
        try:
            val_num = float(val) if val is not None and not isinstance(val, (dict, list)) else None
        except (ValueError, TypeError):
            val_num = None
        unit = p.get('unit', '')
        status = p.get('status', 'OK')
        details = p.get('details', '')
        details_str = json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else str(details or '')
        raw_json = json.dumps({'app': app, 'poll_type': poll_type, 'metric_name': metric_name, 'value': val, 'unit': unit, 'status': status, 'details': details}, ensure_ascii=False)
        return (ts_str, now_epoch, app, poll_type, metric_name, val_num, unit, status, details_str, raw_json)

    def prepare_app_event_row(self, ev: Dict[str, Any]) -> tuple:
        now_dt = datetime.now(timezone.utc)
        ts_str = ev.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        app = ev.get('app', 'unknown')
        event_type = ev.get('event_type', 'event')
        status = ev.get('status', 'OK')
        details = ev.get('details', '')
        details_str = json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else str(details or '')
        raw_json = json.dumps({'app': app, 'event_type': event_type, 'status': status, 'details': details}, ensure_ascii=False)
        return (ts_str, now_epoch, app, event_type, status, details_str, raw_json)

    def prepare_app_param_row(self, pc: Dict[str, Any]) -> tuple:
        now_dt = datetime.now(timezone.utc)
        ts_str = pc.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        app = pc.get('app', 'unknown')
        param_name = pc.get('param_name', 'param')
        old_val = pc.get('old_value')
        new_val = pc.get('new_value')
        old_str = json.dumps(old_val, ensure_ascii=False) if isinstance(old_val, (dict, list)) else str(old_val or '')
        new_str = json.dumps(new_val, ensure_ascii=False) if isinstance(new_val, (dict, list)) else str(new_val or '')
        status = pc.get('status', 'SUCCESS')
        user = pc.get('user', 'system')
        details = pc.get('details', '')
        details_str = json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else str(details or '')
        raw_json = json.dumps({'app': app, 'param_name': param_name, 'old_value': old_val, 'new_value': new_val, 'status': status, 'user': user, 'details': details}, ensure_ascii=False)
        return (ts_str, now_epoch, app, param_name, old_str, new_str, status, user, details_str, raw_json)

    def prepare_device_event_row(self, event: Dict[str, Any], timestamp: Optional[str] = None) -> tuple:
        now_dt = datetime.now(timezone.utc)
        ts_str = timestamp or event.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        raw_json = json.dumps(event, ensure_ascii=False, default=str)
        return (
            ts_str, now_epoch, event.get('event_type', ''), event.get('device_instance_id', ''),
            event.get('friendly_name', ''), event.get('device_class', ''), event.get('category', ''),
            int(bool(event.get('has_problem', False))), event.get('problem_code', 0),
            event.get('status_code', 0), event.get('manufacturer', ''),
            event.get('flapping_count_in_window', 0), event.get('uptime_seconds', 0.0), raw_json,
        )

    def prepare_w64_event_row(self, event_data: Dict[str, Any], provider: str = 'w64_collector') -> tuple:
        now_dt = datetime.now(timezone.utc)
        ts_str = event_data.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()
        event_id = str(event_data.get('event_id') or f'evt_{int(now_epoch)}')
        event_type = str(event_data.get('event_type', 'unknown'))
        path_val = event_data.get('path')
        pid_val = event_data.get('pid')
        if pid_val is not None:
            try:
                pid_val = int(pid_val)
            except (ValueError, TypeError):
                pid_val = None
        name_val = event_data.get('name')
        raw_json = json.dumps(event_data, ensure_ascii=False, default=str)
        return (event_id, ts_str, now_epoch, event_type, path_val, pid_val, name_val, provider, raw_json)

    def prepare_process_provenance_row(self, p: Any) -> tuple:
        """Подготавливает кортеж для вставки в process_provenance_events."""
        p_dict = p if isinstance(p, dict) else (p.model_dump() if hasattr(p, 'model_dump') else (vars(p) if hasattr(p, '__dict__') else p))
        now_dt = datetime.now(timezone.utc)
        ts_str = p_dict.get('timestamp') or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()

        pid = int(p_dict.get('pid') or 0)
        event_id = p_dict.get('event_id') or f"pp_{int(now_epoch * 1000)}_{pid}"
        event_type = p_dict.get('event_type') or 'ProcessCreated'
        ppid = int(p_dict['ppid']) if p_dict.get('ppid') is not None else None
        name = p_dict.get('name') or 'unknown'
        exe_path = p_dict.get('executable_path') or p_dict.get('executable')
        cmdline = p_dict.get('command_line') or p_dict.get('cmdline')
        user = p_dict.get('user') or p_dict.get('username')
        sid = p_dict.get('sid')
        session_id = int(p_dict['session_id']) if p_dict.get('session_id') is not None else None
        integrity = p_dict.get('integrity_level')
        elevation = int(bool(p_dict.get('elevation', False)))
        parent_name = p_dict.get('parent_name')
        parent_cmdline = p_dict.get('parent_cmdline')
        ancestor_chain = p_dict.get('ancestor_chain') or p_dict.get('ancestor_chain_str')
        if isinstance(ancestor_chain, list):
            ancestor_chain = ' -> '.join(ancestor_chain)
        launch_reason = p_dict.get('launch_reason') or p_dict.get('why_was_it_created')
        source = p_dict.get('source') or 'system'
        creation_time = p_dict.get('creation_time') or ts_str
        process_guid = p_dict.get('process_guid') or f"proc_{pid}_{creation_time}"
        parent_guid = p_dict.get('parent_guid')
        details = p_dict.get('details') or p_dict.get('details_json')
        details_json = json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else (str(details) if details else None)
        raw_json = json.dumps(p_dict, ensure_ascii=False, default=str)

        return (
            event_id, ts_str, now_epoch, event_type, process_guid, parent_guid,
            pid, ppid, name, exe_path, cmdline, user, sid, session_id,
            integrity, elevation, parent_name, parent_cmdline,
            ancestor_chain, launch_reason, source, details_json, raw_json
        )


















    # =========================================================================
    # Подсистемы рефакторинга: Data-First SQLite Writers
    # =========================================================================






















