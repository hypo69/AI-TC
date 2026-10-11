# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetryAuditWriterMixin
# =============================================================================
# Description:
#   Миксин записи аудитов и событий безопасности: журналы, брандмауэр, службы, Defender, ПО, питание, утечки процессов.
#   Вынесено при декомпозиции TelemetryWriter (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.writer_audits import TelemetryAuditWriterMixin
#
#     class TelemetryWriter(TelemetryAuditWriterMixin): ...
#
# File: writer_audits.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин записи аудитов и событий безопасности: журналы, брандмауэр, службы, Defender, ПО, питание, утечки процессов."""

import json
import time
from datetime import datetime, timezone
from typing import (
    Any,
    Dict,
    List,
    Optional,
)


try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class TelemetryAuditWriterMixin:
    """Миксин записи аудитов и событий безопасности: журналы, брандмауэр, службы, Defender, ПО, питание, утечки процессов."""

    def save_event_log_snapshot(
        self,
        snapshot_id: str,
        channels: List[Any],
        entries: List[Any],
        intelligence_profiles: Optional[List[Any]] = None,
    ) -> int:
        """Сохранение снимка каналов, кэша событий и профилей интеллекта логов."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for ch in channels:
                d = ch if isinstance(ch, dict) else (ch.model_dump() if hasattr(ch, 'model_dump') else vars(ch))
                cursor.execute('''
                    INSERT INTO event_log_channel_snapshots (
                        snapshot_id, timestamp, channel_name, display_name, description,
                        record_count, size_bytes, channel_type, is_enabled, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, ts_str, d.get('name') or d.get('channel_name', ''),
                    d.get('display_name'), d.get('description'),
                    int(d.get('record_count', 0) or 0), int(d.get('size_bytes', 0) or 0),
                    d.get('channel_type', 'Admin'), int(bool(d.get('enabled', True) if d.get('enabled') is not None else d.get('is_enabled', True))),
                    created_at,
                ))

            for ev in entries:
                d = ev if isinstance(ev, dict) else (ev.model_dump() if hasattr(ev, 'model_dump') else vars(ev))
                cursor.execute('''
                    INSERT INTO event_log_entries_cache (
                        snapshot_id, timestamp, channel, event_id, level, provider_name,
                        time_created, message, raw_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, ts_str, d.get('channel', 'System'),
                    int(d.get('event_id', 0) or 0), d.get('level', 'Information'),
                    d.get('provider_name') or d.get('provider') or d.get('source', ''),
                    d.get('time_created') or d.get('timestamp', ts_str),
                    d.get('message', ''), json.dumps(d, ensure_ascii=False) if isinstance(d, dict) else None,
                    created_at,
                ))

            if intelligence_profiles:
                for prof in intelligence_profiles:
                    p = prof if isinstance(prof, dict) else (prof.model_dump() if hasattr(prof, 'model_dump') else vars(prof))
                    prof_data = p.get('profile') if isinstance(p.get('profile'), dict) else p
                    cursor.execute('''
                        INSERT INTO event_log_intelligence_profiles (
                            snapshot_id, timestamp, channel, total_analyzed, unique_patterns_count,
                            critical_incidents_json, top_clusters_json, bursts_json, decision_gate_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id, ts_str, p.get('channel', 'System'),
                        int(p.get('total_analyzed', 0) or prof_data.get('total_events', 0) or 0),
                        int(p.get('unique_patterns_count', 0) or prof_data.get('unique_templates_count', 0) or 0),
                        json.dumps(p.get('critical_incidents') or p.get('anomalies') or prof_data.get('critical_incidents', []), ensure_ascii=False),
                        json.dumps(p.get('top_clusters') or p.get('top_patterns') or prof_data.get('top_patterns', []), ensure_ascii=False),
                        json.dumps(p.get('bursts') or prof_data.get('bursts', []), ensure_ascii=False),
                        json.dumps(p.get('decision') or p.get('decision_gate') or {
                            'strategy': p.get('strategy'),
                            'strategy_rationale': p.get('strategy_rationale'),
                            'recommended_llm_action': p.get('recommended_llm_action'),
                        }, ensure_ascii=False),
                        created_at,
                    ))

            conn.commit()
            return len(channels) + len(entries)

    def save_firewall_snapshot(self, snapshot_id: str, profiles: Any, rules: List[Any]) -> int:
        """Сохранение снимка профилей и правил брандмауэра Windows."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        p = profiles if isinstance(profiles, dict) else (profiles.model_dump() if hasattr(profiles, 'model_dump') else vars(profiles))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO firewall_profile_snapshots (
                    snapshot_id, timestamp, domain_enabled, private_enabled, public_enabled,
                    domain_default_inbound, private_default_inbound, public_default_inbound,
                    stealth_mode_enabled, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                snapshot_id, ts_str,
                int(bool(p.get('domain_enabled', True))),
                int(bool(p.get('private_enabled', True))),
                int(bool(p.get('public_enabled', True))),
                p.get('domain_default_inbound', 'Block'),
                p.get('private_default_inbound', 'Block'),
                p.get('public_default_inbound', 'Block'),
                int(bool(p.get('stealth_mode_enabled', True))),
                created_at,
            ))

            for r in rules:
                d = r if isinstance(r, dict) else (r.model_dump() if hasattr(r, 'model_dump') else vars(r))
                cursor.execute('''
                    INSERT INTO firewall_rule_snapshots (
                        snapshot_id, rule_name, display_name, direction, action, enabled,
                        protocol, local_port, remote_port, program_path, profile_mask, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, d.get('name') or d.get('rule_name', ''),
                    d.get('display_name') or d.get('name', ''),
                    d.get('direction', 'Inbound'),
                    d.get('action', 'Allow'),
                    int(bool(d.get('enabled', True))),
                    d.get('protocol', 'Any'),
                    str(d.get('local_port', '') or ''),
                    str(d.get('remote_port', '') or ''),
                    d.get('program_path') or d.get('program', ''),
                    int(d.get('profile_mask', 0) or 0),
                    created_at,
                ))

            conn.commit()
            return len(rules) + 1

    def update_firewall_rule_state(self, rule_name: str, enabled: bool) -> bool:
        """Атомарное обновление состояния правила брандмауэра в базе данных."""
        if self._cm.read_only:
            return False
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE firewall_rule_snapshots SET enabled = ? WHERE rule_name = ?',
                (int(bool(enabled)), rule_name)
            )
            conn.commit()
            return cursor.rowcount > 0

    def save_services_snapshot(self, snapshot_id: str, services: List[Any]) -> int:
        """Сохранение снимка состояния служб Windows."""
        if self._cm.read_only or not services:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for s in services:
                d = s if isinstance(s, dict) else (s.model_dump() if hasattr(s, 'model_dump') else vars(s))
                cursor.execute('''
                    INSERT INTO services_snapshots (
                        snapshot_id, timestamp, service_name, display_name, state,
                        state_code, start_type, pid, binary_path, account, is_orphaned, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, ts_str,
                    d.get('name') or d.get('service_name', ''),
                    d.get('display_name'),
                    d.get('state') or d.get('status', 'STOPPED'),
                    int(d.get('state_code', 0) or 0),
                    d.get('start_type') or d.get('startup_type', 'Manual'),
                    int(d.get('pid', 0) or 0) if d.get('pid') else None,
                    d.get('binary_path') or d.get('binpath', ''),
                    d.get('account') or d.get('user_account', ''),
                    int(bool(d.get('is_orphaned', False))),
                    created_at,
                ))
            conn.commit()
            return len(services)

    def record_service_change(
        self,
        service_name: str,
        display_name: str,
        action: str,
        old_state: Optional[str] = None,
        new_state: Optional[str] = None,
        performed_by: str = 'SYSTEM',
        details: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Фиксация события изменения состояния службы."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO service_change_events (
                    timestamp, service_name, display_name, action, old_state,
                    new_state, performed_by, details_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                ts_str, service_name, display_name, action, old_state,
                new_state, performed_by,
                json.dumps(details, ensure_ascii=False) if details else None,
                created_at,
            ))
            conn.commit()
            return cursor.lastrowid or 0

    def save_throttling_snapshot(
        self,
        snapshot_id: str,
        throttling_data: Any,
        thermal_zones: Optional[List[Any]] = None,
    ) -> int:
        """Сохранение снимка троттлинга процессора и ACPI термических зон."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        t = throttling_data if isinstance(throttling_data, dict) else (throttling_data.model_dump() if hasattr(throttling_data, 'model_dump') else vars(throttling_data))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO cpu_throttling_snapshots (
                    snapshot_id, timestamp, prochot_active, pl1_limit_watts, pl2_limit_watts,
                    current_power_watts, max_core_temp_c, package_temp_c, dpc_latency_us,
                    isr_latency_us, throttling_reasons_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                snapshot_id, ts_str,
                int(bool(t.get('prochot_active', False))),
                float(t.get('pl1_limit_watts', 0.0) or 0.0) if t.get('pl1_limit_watts') is not None else None,
                float(t.get('pl2_limit_watts', 0.0) or 0.0) if t.get('pl2_limit_watts') is not None else None,
                float(t.get('current_power_watts', 0.0) or 0.0) if t.get('current_power_watts') is not None else None,
                float(t.get('max_core_temp_c', 0.0) or 0.0) if t.get('max_core_temp_c') is not None else None,
                float(t.get('package_temp_c', 0.0) or 0.0) if t.get('package_temp_c') is not None else None,
                int(t.get('dpc_latency_us', 0) or 0),
                int(t.get('isr_latency_us', 0) or 0),
                json.dumps(t.get('throttling_reasons') or t.get('reasons', []), ensure_ascii=False),
                created_at,
            ))

            if thermal_zones:
                for z in thermal_zones:
                    zd = z if isinstance(z, dict) else (z.model_dump() if hasattr(z, 'model_dump') else vars(z))
                    cursor.execute('''
                        INSERT INTO thermal_zone_snapshots (
                            snapshot_id, timestamp, zone_name, temperature_c,
                            critical_limit_c, throttling_limit_c, sensor_provider, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id, ts_str,
                        zd.get('zone_name') or zd.get('name', 'ThermalZone'),
                        float(zd.get('temperature_c', 0.0) or 0.0),
                        float(zd.get('critical_limit_c', 100.0) or 100.0) if zd.get('critical_limit_c') is not None else None,
                        float(zd.get('throttling_limit_c', 90.0) or 90.0) if zd.get('throttling_limit_c') is not None else None,
                        zd.get('sensor_provider', 'ACPI'),
                        created_at,
                    ))

            conn.commit()
            return 1 + (len(thermal_zones) if thermal_zones else 0)

    def save_forensics_snapshot(self, snapshot_id: str, forensics_data: Any) -> int:
        """Сохранение снимка поведенческой форензики."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        f = forensics_data if isinstance(forensics_data, dict) else (forensics_data.model_dump() if hasattr(forensics_data, 'model_dump') else vars(forensics_data))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO forensics_snapshots (
                    snapshot_id, timestamp, foreground_window_title, foreground_process_name,
                    foreground_pid, user_idle_seconds, camera_active_apps_json,
                    microphone_active_apps_json, userassist_top_apps_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                snapshot_id, ts_str,
                f.get('foreground_window_title') or f.get('active_window_title', ''),
                f.get('foreground_process_name') or f.get('active_process_name', ''),
                int(f.get('foreground_pid', 0) or f.get('active_pid', 0) or 0),
                int(f.get('user_idle_seconds', 0) or f.get('idle_seconds', 0) or 0),
                json.dumps(f.get('camera_active_apps') or f.get('camera_apps', []), ensure_ascii=False),
                json.dumps(f.get('microphone_active_apps') or f.get('microphone_apps', []), ensure_ascii=False),
                json.dumps(f.get('userassist_top_apps') or f.get('userassist_apps', []), ensure_ascii=False),
                created_at,
            ))
            conn.commit()
            return cursor.lastrowid or 0

    def save_process_leak_snapshot(
        self,
        snapshot_id: str,
        total_processes: Any,
        suspicious_count: int = 0,
        leak_items: Optional[List[Any]] = None,
    ) -> int:
        """Сохранение снимка аудита утечек ресурсов процессов."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        # Если передан объект/словарь отчета
        if hasattr(total_processes, 'model_dump') or (isinstance(total_processes, dict) and 'total_processes' in total_processes):
            rep_dict = total_processes.model_dump() if hasattr(total_processes, 'model_dump') else total_processes
            tot_proc = int(rep_dict.get('total_processes', 0))
            susp_cnt = int(rep_dict.get('suspicious_count', 0))
            items_list = rep_dict.get('all_processes') or rep_dict.get('top_handle_hogs') or []
        else:
            tot_proc = int(total_processes or 0)
            susp_cnt = int(suspicious_count or 0)
            items_list = leak_items or []

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO process_leak_snapshots (
                    snapshot_id, timestamp, total_processes, suspicious_count, created_at
                ) VALUES (?, ?, ?, ?, ?)
            ''', (
                snapshot_id, ts_str, tot_proc, susp_cnt, created_at
            ))

            for it in items_list:
                d = it if isinstance(it, dict) else (it.model_dump() if hasattr(it, 'model_dump') else vars(it))
                cursor.execute('''
                    INSERT INTO process_leak_items (
                        snapshot_id, pid, name, handles_count, gdi_objects, user_objects,
                        page_faults, working_set_mb, leak_risk_score, leak_risk_reasons_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id,
                    int(d.get('pid', 0) or 0),
                    d.get('name') or d.get('process_name', ''),
                    int(d.get('handles_count', 0) or d.get('num_handles', 0) or 0),
                    int(d.get('gdi_objects', 0) or 0),
                    int(d.get('user_objects', 0) or 0),
                    int(d.get('page_faults', 0) or 0),
                    float(d.get('working_set_mb', 0.0) or d.get('memory_mb', 0.0) or 0.0),
                    d.get('leak_risk_score', 'LOW'),
                    json.dumps(d.get('leak_risk_reasons') or d.get('reasons', []), ensure_ascii=False),
                    created_at,
                ))

            conn.commit()
            return len(leak_items) + 1

    def save_defender_snapshot(
        self,
        snapshot_id: str,
        defender_status: Any,
        exclusions: Optional[List[Any]] = None,
        asr_rules: Optional[List[Any]] = None,
        threats: Optional[List[Any]] = None,
    ) -> int:
        """Сохранение снимка состояния Защитника Windows, исключений, ASR и угроз."""
        if self._cm.read_only:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        s = defender_status if isinstance(defender_status, dict) else (defender_status.model_dump() if hasattr(defender_status, 'model_dump') else vars(defender_status))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO defender_snapshots (
                    snapshot_id, timestamp, real_time_protection_enabled, cloud_protection_enabled,
                    behavior_monitoring_enabled, tamper_protection_enabled, pua_protection_enabled,
                    antivirus_enabled, antispyware_enabled, engine_version, av_signature_version,
                    last_quick_scan_datetime, last_full_scan_datetime, security_score,
                    cfa_state, raw_status_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                snapshot_id, ts_str,
                int(bool(s.get('real_time_protection_enabled', True))),
                int(bool(s.get('cloud_protection_enabled', True))),
                int(bool(s.get('behavior_monitoring_enabled', True))),
                int(bool(s.get('tamper_protection_enabled', True))),
                int(bool(s.get('pua_protection_enabled', True))),
                int(bool(s.get('antivirus_enabled', True))),
                int(bool(s.get('antispyware_enabled', True))),
                s.get('engine_version', ''),
                s.get('av_signature_version') or s.get('signature_version', ''),
                s.get('last_quick_scan_datetime'),
                s.get('last_full_scan_datetime'),
                int(s.get('security_score', 100) or 100),
                int(s.get('cfa_state', 0) or 0),
                json.dumps(s, ensure_ascii=False) if isinstance(s, dict) else None,
                created_at,
            ))

            if exclusions:
                for exc in exclusions:
                    d = exc if isinstance(exc, dict) else (exc.model_dump() if hasattr(exc, 'model_dump') else vars(exc))
                    cursor.execute('''
                        INSERT INTO defender_exclusions (
                            snapshot_id, exclusion_type, exclusion_value, risk_level, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id,
                        d.get('type') or d.get('exclusion_type', 'path'),
                        d.get('value') or d.get('exclusion_value', ''),
                        d.get('risk_level', 'SAFE'),
                        created_at,
                    ))

            if asr_rules:
                for asr in asr_rules:
                    d = asr if isinstance(asr, dict) else (asr.model_dump() if hasattr(asr, 'model_dump') else vars(asr))
                    cursor.execute('''
                        INSERT INTO defender_asr_rules (
                            snapshot_id, rule_guid, rule_name, rule_action, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id,
                        d.get('guid') or d.get('rule_guid', ''),
                        d.get('name') or d.get('rule_name', ''),
                        d.get('action') or d.get('rule_action', 'Block'),
                        created_at,
                    ))

            if threats:
                for th in threats:
                    d = th if isinstance(th, dict) else (th.model_dump() if hasattr(th, 'model_dump') else vars(th))
                    cursor.execute('''
                        INSERT INTO defender_threats (
                            snapshot_id, threat_id, threat_name, severity, category, resources_json, detection_time, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id,
                        d.get('threat_id') or d.get('id', ''),
                        d.get('threat_name') or d.get('name', ''),
                        d.get('severity', 'High'),
                        d.get('category', 'Trojan'),
                        json.dumps(d.get('resources', []), ensure_ascii=False),
                        d.get('detection_time'),
                        created_at,
                    ))

            conn.commit()
            return 1 + (len(exclusions) if exclusions else 0)

    def save_process_network_snapshot(self, snapshot_id: str, network_items: List[Any]) -> int:
        """Сохранение снимка сетевой активности процессов."""
        if self._cm.read_only or not network_items:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()
        created_at = now_dt.timestamp()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for it in network_items:
                d = it if isinstance(it, dict) else (it.model_dump() if hasattr(it, 'model_dump') else vars(it))
                cursor.execute('''
                    INSERT INTO process_network_snapshots (
                        snapshot_id, timestamp, pid, process_name, local_address,
                        remote_address, protocol, status, service_type, sent_kb,
                        recv_kb, read_speed_kbs, write_speed_kbs, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, ts_str,
                    int(d.get('pid', 0) or 0),
                    d.get('process_name') or d.get('name', ''),
                    d.get('local_address', ''),
                    d.get('remote_address', ''),
                    d.get('protocol', 'TCP'),
                    d.get('status', 'ESTABLISHED'),
                    d.get('service_type', 'Internet'),
                    float(d.get('sent_kb', 0.0) or 0.0),
                    float(d.get('recv_kb', 0.0) or 0.0),
                    float(d.get('read_speed_kbs', 0.0) or 0.0),
                    float(d.get('write_speed_kbs', 0.0) or 0.0),
                    created_at,
                ))
            conn.commit()
            return len(network_items)

    def save_software_inventory(
        self,
        apps: List[Any],
        storage_locations: Optional[List[Any]] = None,
        config_files: Optional[List[Any]] = None,
        ai_research: Optional[List[Any]] = None,
    ) -> int:
        """Сохранение инвентаря установленного ПО, мест хранения, конфигов и AI-аналитики."""
        if self._cm.read_only or not apps:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for app in apps:
                d = app if isinstance(app, dict) else (app.model_dump() if hasattr(app, 'model_dump') else vars(app))
                app_id = d.get('app_id') or d.get('id') or d.get('name', '')
                cursor.execute('''
                    INSERT OR REPLACE INTO software_inventory (
                        app_id, display_name, version, publisher, install_date,
                        install_location, architecture, is_system_component, first_seen, last_scanned_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT first_seen FROM software_inventory WHERE app_id = ?), ?), ?)
                ''', (
                    app_id,
                    d.get('display_name') or d.get('name', app_id),
                    d.get('version', ''),
                    d.get('publisher', ''),
                    d.get('install_date', ''),
                    d.get('install_location') or d.get('path', ''),
                    d.get('architecture', 'x64'),
                    int(bool(d.get('is_system_component', False))),
                    app_id, ts_str, ts_str,
                ))

            if storage_locations:
                for loc in storage_locations:
                    d = loc if isinstance(loc, dict) else (loc.model_dump() if hasattr(loc, 'model_dump') else vars(loc))
                    cursor.execute('''
                        INSERT INTO software_storage_locations (
                            app_id, category, path, size_bytes, file_count, last_updated
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        d.get('app_id', ''),
                        d.get('category', 'data'),
                        d.get('path', ''),
                        int(d.get('size_bytes', 0) or 0),
                        int(d.get('file_count', 0) or 0),
                        ts_str,
                    ))

            if config_files:
                for cf in config_files:
                    d = cf if isinstance(cf, dict) else (cf.model_dump() if hasattr(cf, 'model_dump') else vars(cf))
                    cursor.execute('''
                        INSERT INTO software_config_files (
                            app_id, file_path, format, size_bytes, snippet
                        ) VALUES (?, ?, ?, ?, ?)
                    ''', (
                        d.get('app_id', ''),
                        d.get('file_path') or d.get('path', ''),
                        d.get('format', 'json'),
                        int(d.get('size_bytes', 0) or 0),
                        d.get('snippet', ''),
                    ))

            if ai_research:
                for ai in ai_research:
                    d = ai if isinstance(ai, dict) else (ai.model_dump() if hasattr(ai, 'model_dump') else vars(ai))
                    app_id = d.get('app_id', '')
                    cursor.execute('''
                        INSERT OR REPLACE INTO software_ai_research (
                            app_id, summary, config_purpose_explanation, data_storage_explanation,
                            network_activity_explanation, confirmed_facts_json, inferred_facts_json,
                            confidence_level, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        app_id,
                        d.get('summary', ''),
                        d.get('config_purpose_explanation', ''),
                        d.get('data_storage_explanation', ''),
                        d.get('network_activity_explanation', ''),
                        json.dumps(d.get('confirmed_facts', []), ensure_ascii=False),
                        json.dumps(d.get('inferred_facts', []), ensure_ascii=False),
                        float(d.get('confidence_level', 0.0) or 0.0),
                        ts_str,
                    ))

            conn.commit()
            return len(apps)

    def save_software_network_snapshots(self, snapshot_id: str, net_items: List[Any]) -> int:
        """Сохранение снимков сетевой активности ПО."""
        if self._cm.read_only or not net_items:
            return 0
        now_dt = datetime.now(timezone.utc)
        ts_str = now_dt.isoformat()

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for it in net_items:
                d = it if isinstance(it, dict) else (it.model_dump() if hasattr(it, 'model_dump') else vars(it))
                cursor.execute('''
                    INSERT INTO software_network_snapshots (
                        snapshot_id, timestamp, app_id, pid, local_address,
                        remote_address, protocol, domain_name, sent_kb, recv_kb
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    snapshot_id, ts_str,
                    d.get('app_id', ''),
                    int(d.get('pid', 0) or 0),
                    d.get('local_address', ''),
                    d.get('remote_address', ''),
                    d.get('protocol', 'TCP'),
                    d.get('domain_name', ''),
                    float(d.get('sent_kb', 0.0) or 0.0),
                    float(d.get('recv_kb', 0.0) or 0.0),
                ))
            conn.commit()
            return len(net_items)

    def save_security_events(
        self,
        events: List[Any],
        save_raw: bool = False,
        raw_events: Optional[List[Any]] = None,
    ) -> int:
        """Сохраняет список нормализованных событий журнала безопасности в SQLite.

        Args:
            events: Список объектов SecurityEventItem или словарей.
            save_raw: Сохранять ли параллельно сырые XML события в security_events_raw.
            raw_events: Список объектов SecurityEventRaw или словарей.

        Returns:
            int: Количество сохраненных событий.
        """
        if self._cm.read_only or not events:
            return 0

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for ev in events:
                d = ev if isinstance(ev, dict) else (ev.model_dump() if hasattr(ev, 'model_dump') else vars(ev))
                ed_json = json.dumps(d.get('event_data', {}), ensure_ascii=False) if d.get('event_data') else None

                cursor.execute('''
                    INSERT INTO security_events (
                        event_record_id, event_id, timestamp, created_at, computer,
                        channel, level, subject_user, subject_domain, subject_sid,
                        target_user, target_domain, target_sid, process_id,
                        process_name, parent_process_id, parent_process_name,
                        command_line, logon_id, logon_type, elevated_token,
                        source_ip, source_port, object_name, status_code,
                        message, event_data_json, ingested_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    int(d.get('event_record_id', 0) or 0),
                    int(d.get('event_id', 0) or 0),
                    str(d.get('timestamp', '')),
                    float(d.get('created_at', time.time()) or time.time()),
                    str(d.get('computer', '')),
                    str(d.get('channel', 'Security')),
                    str(d.get('level', 'Information')),
                    str(d.get('subject_user', '')),
                    str(d.get('subject_domain', '')),
                    str(d.get('subject_sid', '')),
                    str(d.get('target_user', '')),
                    str(d.get('target_domain', '')),
                    str(d.get('target_sid', '')),
                    int(d.get('process_id', 0) or 0),
                    str(d.get('process_name', '')),
                    int(d.get('parent_process_id', 0) or 0),
                    str(d.get('parent_process_name', '')),
                    str(d.get('command_line', '')),
                    str(d.get('logon_id', '')),
                    d.get('logon_type'),
                    d.get('elevated_token'),
                    str(d.get('source_ip', '')),
                    d.get('source_port'),
                    str(d.get('object_name', '')),
                    str(d.get('status_code', '')),
                    str(d.get('message', '')),
                    ed_json,
                    str(d.get('ingested_at', datetime.now(timezone.utc).isoformat())),
                ))

            if save_raw and raw_events:
                for raw in raw_events:
                    rd = raw if isinstance(raw, dict) else (raw.model_dump() if hasattr(raw, 'model_dump') else vars(raw))
                    cursor.execute('''
                        INSERT INTO security_events_raw (
                            event_record_id, event_id, timestamp, created_at,
                            channel, raw_xml, ingested_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        int(rd.get('event_record_id', 0) or 0),
                        int(rd.get('event_id', 0) or 0),
                        str(rd.get('timestamp', '')),
                        float(rd.get('created_at', time.time()) or time.time()),
                        str(rd.get('channel', 'Security')),
                        str(rd.get('raw_xml', '')),
                        str(rd.get('ingested_at', datetime.now(timezone.utc).isoformat())),
                    ))

            conn.commit()
            return len(events)

    def save_security_bookmark(
        self,
        channel: str,
        last_record_id: int,
        bookmark_xml: Optional[str] = None,
        last_timestamp: str = '',
    ) -> None:
        """Сохраняет или обновляет состояние закладки инкрементального сбора в SQLite.

        Args:
            channel: Имя канала событий (например, 'Security').
            last_record_id: Последний обработанный EventRecordID.
            bookmark_xml: XML-представление закладки WevtAPI.
            last_timestamp: Временная метка последнего обработанного события.
        """
        if self._cm.read_only:
            return

        now_epoch = time.time()
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO security_collector_bookmarks (
                    channel, last_record_id, bookmark_xml, last_timestamp, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(channel) DO UPDATE SET
                    last_record_id = excluded.last_record_id,
                    bookmark_xml = CASE WHEN excluded.bookmark_xml IS NOT NULL THEN excluded.bookmark_xml ELSE security_collector_bookmarks.bookmark_xml END,
                    last_timestamp = excluded.last_timestamp,
                    updated_at = excluded.updated_at
            ''', (
                channel,
                int(last_record_id or 0),
                bookmark_xml,
                last_timestamp,
                now_epoch,
            ))
            conn.commit()

    def save_power_events(self, events: List[Any]) -> int:
        """Сохраняет пакет сырых/нормализованных событий питания в таблицу power_events.

        Args:
            events: Список объектов PowerEventRecord или словарей.

        Returns:
            int: Количество сохраненных записей.
        """
        if not events or self._cm.read_only:
            return 0

        now_epoch = time.time()
        saved = 0
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for ev in events:
                if hasattr(ev, 'model_dump'):
                    d = ev.model_dump()
                elif isinstance(ev, dict):
                    d = ev
                else:
                    continue

                eid = int(d.get('event_id', 0))
                provider = str(d.get('provider') or '')
                channel = str(d.get('channel') or 'System')
                ts = str(d.get('timestamp') or '')
                c_at = float(d.get('created_at') or now_epoch)
                event_type = str(d.get('event_type') or 'event')
                shutdown_type = d.get('shutdown_type')
                user = d.get('user')
                domain = d.get('domain')
                process = d.get('process')
                pid = d.get('process_id')
                reason = d.get('reason')
                reason_code = d.get('reason_code')
                comment = d.get('comment')
                unexpected = 1 if d.get('unexpected') else 0
                bugcheck_code = d.get('bugcheck_code')
                bugcheck_params = d.get('bugcheck_params_json')
                if isinstance(bugcheck_params, (dict, list)):
                    bugcheck_params = json.dumps(bugcheck_params, ensure_ascii=False)
                boot_id = d.get('boot_id')
                details_json = d.get('details_json')
                if isinstance(details_json, (dict, list)):
                    details_json = json.dumps(details_json, ensure_ascii=False)
                raw_xml = d.get('raw_xml')

                cursor.execute('''
                    INSERT INTO power_events (
                        event_id, provider, channel, timestamp, created_at,
                        event_type, shutdown_type, user, domain, process,
                        process_id, reason, reason_code, comment, unexpected,
                        bugcheck_code, bugcheck_params_json, boot_id, details_json, raw_xml
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(event_id, timestamp, provider) DO UPDATE SET
                        event_type = excluded.event_type,
                        shutdown_type = excluded.shutdown_type,
                        user = excluded.user,
                        domain = excluded.domain,
                        process = excluded.process,
                        process_id = excluded.process_id,
                        reason = excluded.reason,
                        reason_code = excluded.reason_code,
                        comment = excluded.comment,
                        unexpected = excluded.unexpected,
                        bugcheck_code = excluded.bugcheck_code,
                        bugcheck_params_json = excluded.bugcheck_params_json,
                        boot_id = excluded.boot_id,
                        details_json = excluded.details_json,
                        raw_xml = excluded.raw_xml
                ''', (
                    eid, provider, channel, ts, c_at,
                    event_type, shutdown_type, user, domain, process,
                    pid, reason, reason_code, comment, unexpected,
                    bugcheck_code, bugcheck_params, boot_id, details_json, raw_xml
                ))
                saved += 1

            conn.commit()
        return saved

    def save_power_sessions(self, sessions: List[Any]) -> int:
        """Сохраняет пакет реконструированных сессий питания в таблицу power_sessions.

        Args:
            sessions: Список объектов PowerSessionRecord или словарей.

        Returns:
            int: Количество сохраненных/обновленных сессий.
        """
        if not sessions or self._cm.read_only:
            return 0

        now_epoch = time.time()
        saved = 0
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            for s in sessions:
                if hasattr(s, 'model_dump'):
                    d = s.model_dump()
                elif isinstance(s, dict):
                    d = s
                else:
                    continue

                session_id = str(d.get('session_id') or '')
                if not session_id:
                    continue

                boot_time = str(d.get('boot_time') or '')
                boot_ts = float(d.get('boot_timestamp') or 0.0)
                shutdown_time = d.get('shutdown_time')
                shutdown_ts = float(d.get('shutdown_timestamp') or 0.0) if d.get('shutdown_timestamp') is not None else None
                uptime_sec = float(d.get('uptime_seconds') or 0.0)
                uptime_human = str(d.get('uptime_human') or '')
                shutdown_type = str(d.get('shutdown_type') or 'Active')
                initiator = d.get('initiator')
                process = d.get('process')
                reason = d.get('reason')
                reason_code = d.get('reason_code')
                comment = d.get('comment')
                clean = 1 if d.get('clean_shutdown', True) else 0
                unexpected = 1 if d.get('unexpected_shutdown', False) else 0
                bugcheck = d.get('bugcheck')
                boot_eid = int(d.get('boot_event_id', 12))
                shutdown_eid = int(d.get('shutdown_event_id')) if d.get('shutdown_event_id') is not None else None

                initiator_chain = d.get('initiator_chain') or []
                if isinstance(initiator_chain, list):
                    chain_json = json.dumps(initiator_chain, ensure_ascii=False)
                else:
                    chain_json = str(initiator_chain)

                events = d.get('events') or []
                if isinstance(events, (list, dict)):
                    events_json = json.dumps(events, ensure_ascii=False)
                else:
                    events_json = str(events)

                c_at = float(d.get('created_at') or now_epoch)

                cursor.execute('''
                    INSERT INTO power_sessions (
                        session_id, boot_time, boot_timestamp, shutdown_time, shutdown_timestamp,
                        uptime_seconds, uptime_human, shutdown_type, initiator, process,
                        reason, reason_code, comment, clean_shutdown, unexpected_shutdown,
                        bugcheck, boot_event_id, shutdown_event_id, initiator_chain_json,
                        events_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        boot_time = excluded.boot_time,
                        boot_timestamp = excluded.boot_timestamp,
                        shutdown_time = excluded.shutdown_time,
                        shutdown_timestamp = excluded.shutdown_timestamp,
                        uptime_seconds = excluded.uptime_seconds,
                        uptime_human = excluded.uptime_human,
                        shutdown_type = excluded.shutdown_type,
                        initiator = excluded.initiator,
                        process = excluded.process,
                        reason = excluded.reason,
                        reason_code = excluded.reason_code,
                        comment = excluded.comment,
                        clean_shutdown = excluded.clean_shutdown,
                        unexpected_shutdown = excluded.unexpected_shutdown,
                        bugcheck = excluded.bugcheck,
                        boot_event_id = excluded.boot_event_id,
                        shutdown_event_id = excluded.shutdown_event_id,
                        initiator_chain_json = excluded.initiator_chain_json,
                        events_json = excluded.events_json,
                        created_at = excluded.created_at
                ''', (
                    session_id, boot_time, boot_ts, shutdown_time, shutdown_ts,
                    uptime_sec, uptime_human, shutdown_type, initiator, process,
                    reason, reason_code, comment, clean, unexpected,
                    bugcheck, boot_eid, shutdown_eid, chain_json,
                    events_json, c_at
                ))
                saved += 1

            conn.commit()
        return saved
