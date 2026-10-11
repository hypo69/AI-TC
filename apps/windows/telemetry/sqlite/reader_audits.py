# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetryAuditReaderMixin
# =============================================================================
# Description:
#   Миксин чтения аудитов: перезагрузки, архивы оборудования и автозагрузки, журналы, брандмауэр, службы, Defender, ПО.
#   Вынесено при декомпозиции TelemetryReader (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.reader_audits import TelemetryAuditReaderMixin
#
#     class TelemetryReader(TelemetryAuditReaderMixin): ...
#
# File: reader_audits.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин чтения аудитов: перезагрузки, архивы оборудования и автозагрузки, журналы, брандмауэр, службы, Defender, ПО."""

import json
import sqlite3
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


class TelemetryAuditReaderMixin:
    """Миксин чтения аудитов: перезагрузки, архивы оборудования и автозагрузки, журналы, брандмауэр, службы, Defender, ПО."""

    def get_reboot_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Извлекает историю сессий перезагрузок."""
        results: List[Dict[str, Any]] = []
        try:
            with self._cm.lock, self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM reboot_history ORDER BY boot_time DESC, created_at DESC LIMIT ?', (limit,))
                for row in cursor.fetchall():
                    item = dict(row)
                    for f in ('bugcheck_params_json', 'evidence_json', 'events_chain_json', 'raw_json'):
                        if item.get(f):
                            try:
                                item[f.replace('_json', '')] = json.loads(item[f])
                            except Exception:
                                pass
                    results.append(item)
        except Exception as ex:
            logger.error(f'Ошибка извлечения истории перезагрузок: {ex}')
        return results

    def get_latest_reboot_session(self) -> Optional[Dict[str, Any]]:
        """Возвращает самую последнюю запись сессии перезагрузки."""
        history = self.get_reboot_history(limit=1)
        return history[0] if history else None

    def get_extended_audits(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Возвращает историю расширенных системных аудитов."""
        results: List[Dict[str, Any]] = []
        try:
            with self._cm.lock, self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM system_extended_audits ORDER BY created_at DESC LIMIT ?', (limit,))
                for row in cursor.fetchall():
                    item = dict(row)
                    if item.get('raw_json'):
                        try:
                            item['data'] = json.loads(item['raw_json'])
                        except Exception:
                            pass
                    results.append(item)
        except Exception as ex:
            logger.error(f'Ошибка извлечения расширенных аудитов: {ex}')
        return results

    def get_latest_extended_audit(self) -> Optional[Dict[str, Any]]:
        """Возвращает последний расширенный системный аудит."""
        audits = self.get_extended_audits(limit=1)
        return audits[0] if audits else None

    def get_hardware_audits(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Возвращает историю аудитов аппаратного обеспечения из таблицы hardware_audits."""
        results: List[Dict[str, Any]] = []
        try:
            with self._cm.lock, self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM hardware_audits ORDER BY created_at DESC LIMIT ?', (limit,))
                for row in cursor.fetchall():
                    item = dict(row)
                    if item.get('raw_json'):
                        try:
                            item['data'] = json.loads(item['raw_json'])
                        except Exception:
                            pass
                    results.append(item)
        except Exception as ex:
            logger.error(f'Ошибка извлечения аудитов оборудования: {ex}')
        return results

    def get_latest_hardware_audit(self) -> Optional[Dict[str, Any]]:
        """Возвращает самый последний сохраненный аудит аппаратного обеспечения."""
        audits = self.get_hardware_audits(limit=1)
        return audits[0] if audits else None

    def get_startup_archives(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Возвращает историю архивных снимков автозапуска из таблицы startup_audit_archives."""
        results: List[Dict[str, Any]] = []
        try:
            with self._cm.lock, self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM startup_audit_archives ORDER BY created_at DESC LIMIT ?', (limit,))
                for row in cursor.fetchall():
                    item = dict(row)
                    if item.get('raw_json'):
                        try:
                            item['data'] = json.loads(item['raw_json'])
                        except Exception:
                            pass
                    results.append(item)
        except Exception as ex:
            logger.error(f'Ошибка извлечения архивов автозапуска: {ex}')
        return results

    def get_latest_startup_archive(self) -> Optional[Dict[str, Any]]:
        """Возвращает самый последний сохраненный снимок автозапуска."""
        audits = self.get_startup_archives(limit=1)
        return audits[0] if audits else None

    def get_startup_changes(self, limit: int = 100, archive_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Возвращает историю зафиксированных отличий/изменений в автозапуске."""
        results: List[Dict[str, Any]] = []
        try:
            with self._cm.lock, self._cm.get_connection() as conn:
                cursor = conn.cursor()
                if archive_id:
                    cursor.execute(
                        'SELECT * FROM startup_changes WHERE archive_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
                        (archive_id, limit)
                    )
                else:
                    cursor.execute(
                        'SELECT * FROM startup_changes ORDER BY created_at DESC, id DESC LIMIT ?',
                        (limit,)
                    )
                for row in cursor.fetchall():
                    item = dict(row)
                    if item.get('previous_value'):
                        try:
                            item['previous_value'] = json.loads(item['previous_value'])
                        except Exception:
                            pass
                    if item.get('current_value'):
                        try:
                            item['current_value'] = json.loads(item['current_value'])
                        except Exception:
                            pass
                    results.append(item)
        except Exception as ex:
            logger.error(f'Ошибка извлечения изменений автозапуска: {ex}')
        return results

    def get_latest_event_log_channels(self) -> List[Dict[str, Any]]:
        """Извлечение последнего снимка каналов журналов событий."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT snapshot_id FROM event_log_channel_snapshots
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]
            cursor.execute('''
                SELECT channel_name AS name, is_enabled AS enabled, record_count,
                       size_bytes, channel_type, display_name, description
                FROM event_log_channel_snapshots
                WHERE snapshot_id = ?
                ORDER BY record_count DESC
            ''', (snap_id,))
            return [dict(r) for r in cursor.fetchall()]

    def get_event_log_entries(
        self,
        channel: str = 'System',
        level: str = '',
        limit: int = 50,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """Выборка записей журнала событий из кеша по каналу и уровню."""
        conditions = ['channel = ?']
        params: List[Any] = [channel]

        if level:
            conditions.append('LOWER(level) = LOWER(?)')
            params.append(level)

        if hours > 0:
            since_time = time.time() - (hours * 3600)
            conditions.append('created_at >= ?')
            params.append(since_time)

        where_clause = f"WHERE {' AND '.join(conditions)}"
        query = f'''
            SELECT channel, event_id, level, provider_name, time_created, message
            FROM event_log_entries_cache
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
        '''
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = [dict(r) for r in cursor.fetchall()]
            if not rows and hours > 0:
                # Fallback без фильтра по времени, если база была заполнена раньше
                params[-2] = 0.0
                cursor.execute(query, params)
                rows = [dict(r) for r in cursor.fetchall()]
            return rows

    def get_latest_event_log_intelligence_profile(self, channel: str = 'System') -> Optional[Dict[str, Any]]:
        """Извлечение последнего сохраненного профиля Log Intelligence."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM event_log_intelligence_profiles
                WHERE channel = ?
                ORDER BY id DESC LIMIT 1
            ''', (channel,))
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d['critical_incidents'] = json.loads(d['critical_incidents_json']) if d.get('critical_incidents_json') else []
            d['top_clusters'] = json.loads(d['top_clusters_json']) if d.get('top_clusters_json') else []
            d['bursts'] = json.loads(d['bursts_json']) if d.get('bursts_json') else []
            decision_gate = json.loads(d['decision_gate_json']) if d.get('decision_gate_json') else {}
            profile_data = {
                'total_events': d.get('total_analyzed', 0),
                'unique_templates_count': d.get('unique_patterns_count', 0),
                'critical_count': len(d['critical_incidents']),
                'health_score': 100 - min(100, len(d['critical_incidents']) * 10),
                'top_patterns': d['top_clusters'],
                'bursts': d['bursts'],
            }
            d['profile'] = profile_data
            d['decision'] = decision_gate
            return d

    def get_latest_event_log_report(self) -> Optional[Dict[str, Any]]:
        """Формирование сводного отчета о журналах и ошибках из базы данных."""
        channels = self.get_latest_event_log_channels()
        if not channels:
            return None
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT channel, event_id, level, provider_name, time_created, message
                FROM event_log_entries_cache
                WHERE LOWER(level) IN ('error', 'critical', 'warning')
                ORDER BY id DESC LIMIT 20
            ''')
            errors = [dict(r) for r in cursor.fetchall()]

            crit_count = sum(1 for e in errors if str(e.get('level', '')).lower() == 'critical')
            err_count = sum(1 for e in errors if str(e.get('level', '')).lower() == 'error')
            warn_count = sum(1 for e in errors if str(e.get('level', '')).lower() == 'warning')

            return {
                'total_channels': len(channels),
                'critical_events_24h': crit_count,
                'error_events_24h': err_count,
                'warning_events_24h': warn_count,
                'channels': channels,
                'recent_errors': errors,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }

    def get_latest_firewall_profiles(self) -> Optional[Dict[str, Any]]:
        """Извлечение состояния профилей брандмауэра Windows."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT domain_enabled, private_enabled, public_enabled,
                       domain_default_inbound, private_default_inbound, public_default_inbound,
                       stealth_mode_enabled, timestamp
                FROM firewall_profile_snapshots
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_latest_firewall_rules(self, direction: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        """Выборка правил фильтрации брандмауэра Windows из последнего снимка."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_id FROM firewall_rule_snapshots ORDER BY id DESC LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]

            conditions = ['snapshot_id = ?']
            params: List[Any] = [snap_id]
            if direction:
                conditions.append('LOWER(direction) = LOWER(?)')
                params.append(direction)

            where_clause = f"WHERE {' AND '.join(conditions)}"
            query = f'''
                SELECT rule_name AS name, display_name, direction, action, enabled,
                       protocol, local_port, remote_port, program_path, profile_mask
                FROM firewall_rule_snapshots
                {where_clause}
                ORDER BY id ASC
                LIMIT ?
            '''
            params.append(int(limit))
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_latest_services_list(self, status: Optional[str] = None, limit: int = 500) -> List[Dict[str, Any]]:
        """Извлечение списка служб Windows из последнего снимка."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_id FROM services_snapshots ORDER BY id DESC LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]

            conditions = ['snapshot_id = ?']
            params: List[Any] = [snap_id]
            if status:
                conditions.append('LOWER(state) = LOWER(?)')
                params.append(status)

            where_clause = f"WHERE {' AND '.join(conditions)}"
            query = f'''
                SELECT service_name AS name, display_name, state AS status,
                       start_type AS startup_type, pid, binary_path AS binpath,
                       account AS user_account, is_orphaned
                FROM services_snapshots
                {where_clause}
                ORDER BY service_name ASC
                LIMIT ?
            '''
            params.append(int(limit))
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_latest_services_report(self) -> Optional[Dict[str, Any]]:
        """Формирование сводного отчета о службах Windows."""
        services = self.get_latest_services_list(limit=1000)
        if not services:
            return None
        total = len(services)
        running = sum(1 for s in services if str(s.get('status', '')).upper() in ('RUNNING', '4', 'SERVICE_RUNNING'))
        stopped = sum(1 for s in services if str(s.get('status', '')).upper() in ('STOPPED', '1', 'SERVICE_STOPPED'))
        orphaned = sum(1 for s in services if s.get('is_orphaned'))

        return {
            'total_services': total,
            'running_services': running,
            'stopped_services': stopped,
            'orphaned_services': orphaned,
            'services': services,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    def get_service_change_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлечение истории изменений служб."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, service_name, display_name, action,
                       old_state, new_state, performed_by, details_json
                FROM service_change_events
                ORDER BY id DESC LIMIT ?
            ''', (int(limit),))
            rows = []
            for r in cursor.fetchall():
                d = dict(r)
                if d.get('details_json'):
                    d['details'] = json.loads(d['details_json'])
                rows.append(d)
            return rows

    def get_latest_throttling_snapshot(self) -> Optional[Dict[str, Any]]:
        """Извлечение последнего снимка троттлинга процессора и термических зон."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT snapshot_id, timestamp, prochot_active, pl1_limit_watts,
                       pl2_limit_watts, current_power_watts, max_core_temp_c,
                       package_temp_c, dpc_latency_us, isr_latency_us,
                       throttling_reasons_json
                FROM cpu_throttling_snapshots
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d['throttling_reasons'] = json.loads(d['throttling_reasons_json']) if d.get('throttling_reasons_json') else []

            snap_id = d['snapshot_id']
            cursor.execute('''
                SELECT zone_name, temperature_c, critical_limit_c, throttling_limit_c, sensor_provider
                FROM thermal_zone_snapshots
                WHERE snapshot_id = ?
            ''', (snap_id,))
            d['thermal_zones'] = [dict(z) for z in cursor.fetchall()]
            return d

    def get_latest_forensics_snapshot(self) -> Optional[Dict[str, Any]]:
        """Извлечение последнего снимка поведенческой форензики."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT foreground_window_title, foreground_process_name,
                       foreground_pid, user_idle_seconds, camera_active_apps_json,
                       microphone_active_apps_json, userassist_top_apps_json, timestamp
                FROM forensics_snapshots
                ORDER BY id DESC LIMIT 1
            ''', )
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d['camera_active_apps'] = json.loads(d['camera_active_apps_json']) if d.get('camera_active_apps_json') else []
            d['microphone_active_apps'] = json.loads(d['microphone_active_apps_json']) if d.get('microphone_active_apps_json') else []
            d['userassist_top_apps'] = json.loads(d['userassist_top_apps_json']) if d.get('userassist_top_apps_json') else []
            return d

    def get_forensics_history(self, limit: int = 50, hours: float = 24.0) -> List[Dict[str, Any]]:
        """Извлечение хронологической истории снимков форензики (переключение окон, активность)."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, snapshot_id, timestamp, foreground_window_title, foreground_process_name,
                       foreground_pid, user_idle_seconds, camera_active_apps_json,
                       microphone_active_apps_json, userassist_top_apps_json, created_at
                FROM forensics_snapshots
                ORDER BY id DESC
                LIMIT ?
            ''', (limit,))
            rows = cursor.fetchall()
            results = []
            for row in rows:
                d = dict(row)
                d['camera_active_apps'] = json.loads(d['camera_active_apps_json']) if d.get('camera_active_apps_json') else []
                d['microphone_active_apps'] = json.loads(d['microphone_active_apps_json']) if d.get('microphone_active_apps_json') else []
                d['userassist_top_apps'] = json.loads(d['userassist_top_apps_json']) if d.get('userassist_top_apps_json') else []
                results.append(d)
            return results

    def get_latest_process_leak_report(self, limit: int = 20) -> Optional[Dict[str, Any]]:
        """Извлечение последнего снимка утечек ресурсов процессов."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT snapshot_id, timestamp, total_processes, suspicious_count
                FROM process_leak_snapshots
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            if not row:
                return None
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]
            report = dict(row)

            cursor.execute('''
                SELECT pid, name, handles_count, gdi_objects, user_objects,
                       page_faults, working_set_mb, leak_risk_score, leak_risk_reasons_json
                FROM process_leak_items
                WHERE snapshot_id = ?
                ORDER BY handles_count DESC
                LIMIT ?
            ''', (snap_id, int(limit)))
            items = []
            for r in cursor.fetchall():
                d = dict(r)
                d['leak_risk_reasons'] = json.loads(d['leak_risk_reasons_json']) if d.get('leak_risk_reasons_json') else []
                items.append(d)
            report['all_processes'] = items
            report['top_handle_hogs'] = sorted(items, key=lambda x: x.get('handles_count', 0), reverse=True)[:10]
            report['top_gdi_hogs'] = sorted(items, key=lambda x: x.get('gdi_objects', 0), reverse=True)[:10]
            report['top_page_fault_hogs'] = sorted(items, key=lambda x: x.get('page_faults', 0), reverse=True)[:10]
            report['suspicious_processes'] = [x for x in items if x.get('leak_risk_score') != 'normal']
            return report

    def get_latest_defender_status(self) -> Optional[Dict[str, Any]]:
        """Извлечение статуса Защитника Windows."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM defender_snapshots
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            if d.get('raw_status_json'):
                try:
                    d.update(json.loads(d['raw_status_json']))
                except Exception:
                    pass
            return d

    def get_latest_defender_exclusions(self, limit: int = 200) -> List[Dict[str, Any]]:
        """Извлечение исключений антивируса Defender."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_id FROM defender_exclusions ORDER BY id DESC LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]
            cursor.execute('''
                SELECT exclusion_type, exclusion_value, risk_level
                FROM defender_exclusions
                WHERE snapshot_id = ?
                LIMIT ?
            ''', (snap_id, limit))
            items = []
            for r in cursor.fetchall():
                d = dict(r)
                d['type'] = d.get('exclusion_type', 'path')
                d['value'] = d.get('exclusion_value', '')
                items.append(d)
            return items

    def get_latest_defender_asr_rules(self) -> List[Dict[str, Any]]:
        """Извлечение правил ASR Защитника Windows."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_id FROM defender_asr_rules ORDER BY id DESC LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]
            cursor.execute('''
                SELECT rule_guid, rule_name, rule_action
                FROM defender_asr_rules
                WHERE snapshot_id = ?
            ''', (snap_id,))
            items = []
            for r in cursor.fetchall():
                d = dict(r)
                d['guid'] = d.get('rule_guid', '')
                d['name'] = d.get('rule_name', '')
                d['state'] = d.get('rule_action', 'not_configured')
                items.append(d)
            return items

    def get_latest_defender_threats(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Извлечение обнаруженных угроз Defender."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT threat_id, threat_name, severity, category, resources_json, detection_time
                FROM defender_threats
                ORDER BY id DESC LIMIT ?
            ''', (limit,))
            rows = []
            for r in cursor.fetchall():
                d = dict(r)
                d['resources'] = json.loads(d['resources_json']) if d.get('resources_json') else []
                d['status'] = d.get('status', 'Cleaned')
                d['initial_detection_time'] = d.get('detection_time')
                rows.append(d)
            return rows

    def get_latest_defender_diagnostics(self) -> Dict[str, Any]:
        """Сводная диагностика безопасности Defender."""
        status = self.get_latest_defender_status() or {}
        exclusions = self.get_latest_defender_exclusions()
        asr_rules = self.get_latest_defender_asr_rules()
        threats = self.get_latest_defender_threats()
        return {
            'status': status,
            'exclusions': exclusions,
            'asr_rules': asr_rules,
            'threats': threats,
            'total_exclusions': len(exclusions),
            'total_asr_rules': len(asr_rules),
            'active_threats_count': len(threats),
        }

    def get_latest_process_network_activity(
        self,
        limit: int = 100,
        only_internet: bool = True,
    ) -> List[Dict[str, Any]]:
        """Извлечение сетевой активности процессов из process_network_snapshots."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_id FROM process_network_snapshots ORDER BY id DESC LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return []
            snap_id = row['snapshot_id'] if isinstance(row, sqlite3.Row) else row[0]

            conditions = ['snapshot_id = ?']
            params: List[Any] = [snap_id]
            if only_internet:
                conditions.append("LOWER(service_type) = 'internet' OR remote_address != ''")

            where_clause = f"WHERE {' AND '.join(conditions)}"
            query = f'''
                SELECT pid, process_name, local_address, remote_address, protocol,
                       status, service_type, sent_kb, recv_kb, read_speed_kbs, write_speed_kbs
                FROM process_network_snapshots
                {where_clause}
                ORDER BY sent_kb + recv_kb DESC
                LIMIT ?
            '''
            params.append(int(limit))
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_software_inventory_from_db(self, limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
        """Извлечение инвентаря установленного ПО с агрегацией данных из SQLite."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT s.*,
                       (SELECT COUNT(*) FROM software_storage_locations l WHERE l.app_id = s.app_id) AS storage_locations_count,
                       (SELECT COALESCE(SUM(size_bytes), 0) FROM software_storage_locations l WHERE l.app_id = s.app_id) AS total_storage_bytes,
                       (SELECT summary FROM software_ai_research r WHERE r.app_id = s.app_id) AS ai_summary,
                       (SELECT confidence_level FROM software_ai_research r WHERE r.app_id = s.app_id) AS ai_confidence
                FROM software_inventory s
                ORDER BY s.display_name ASC
                LIMIT ? OFFSET ?
            ''', (int(limit), int(offset)))
            return [dict(r) for r in cursor.fetchall()]

    def get_software_app_details_from_db(self, app_id: str) -> Optional[Dict[str, Any]]:
        """Извлечение полной карточки установленной программы со всеми связанными данными."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM software_inventory WHERE app_id = ?', (app_id,))
            row = cursor.fetchone()
            if not row:
                return None
            app_data = dict(row)

            cursor.execute('SELECT category, path, size_bytes, file_count, last_updated FROM software_storage_locations WHERE app_id = ?', (app_id,))
            app_data['storage_locations'] = [dict(r) for r in cursor.fetchall()]

            cursor.execute('SELECT file_path, format, size_bytes, snippet FROM software_config_files WHERE app_id = ?', (app_id,))
            app_data['config_files'] = [dict(r) for r in cursor.fetchall()]

            cursor.execute('SELECT * FROM software_ai_research WHERE app_id = ?', (app_id,))
            ai_row = cursor.fetchone()
            if ai_row:
                ai_dict = dict(ai_row)
                ai_dict['confirmed_facts'] = json.loads(ai_dict['confirmed_facts_json']) if ai_dict.get('confirmed_facts_json') else []
                ai_dict['inferred_facts'] = json.loads(ai_dict['inferred_facts_json']) if ai_dict.get('inferred_facts_json') else []
                app_data['ai_research'] = ai_dict
            else:
                app_data['ai_research'] = None

            return app_data
