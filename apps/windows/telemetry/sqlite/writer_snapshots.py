# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetrySnapshotWriterMixin
# =============================================================================
# Description:
#   Миксин записи снапшотов системы и процессов, архивов оборудования и автозагрузки, событий файлов.
#   Вынесено при декомпозиции TelemetryWriter (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.writer_snapshots import TelemetrySnapshotWriterMixin
#
#     class TelemetryWriter(TelemetrySnapshotWriterMixin): ...
#
# File: writer_snapshots.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Класс TelemetryWriter для сериализации, подготовки строк и транзакционной записи в SQLite."""

import json
import sqlite3
import time
from datetime import datetime, timezone
from typing import (
    Any,
    Dict,
    List,
    Union,
)

from ..models import HardwareArchiveEntry, StartupArchiveEntry, SystemSnapshot

try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class TelemetrySnapshotWriterMixin:
    """Миксин записи снапшотов системы и процессов, архивов оборудования и автозагрузки, событий файлов."""

    def insert_snapshot_row(self, cursor: sqlite3.Cursor, item: Dict[str, Any]) -> int:
        """Вставляет строку снимка и процессы в базу данных со всеми расширенными параметрами."""
        snap_data = item.get('data', {})
        top_n = item.get('top_n', 20)
        snapshot = snap_data if isinstance(snap_data, SystemSnapshot) else None

        if snapshot:
            hostname = snapshot.hostname
            username = snapshot.username or ''
            uptime = snapshot.uptime_seconds
            os_name = snapshot.os_name or 'Windows'
            os_build = str(snapshot.os_build or '')
            os_install_date = str(snapshot.os_install_date or '')
            system_lang = str(snapshot.system_language or '')
            os_install_lang = str(snapshot.os_install_language or '')
            user_locale = str(snapshot.user_locale or '')
            sys_locale = str(snapshot.system_locale or '')
            timezone_val = str(snapshot.timezone or '')
            codepage_val = str(snapshot.codepage or '')
            input_langs = snapshot.input_languages or []
            input_langs_json = json.dumps(input_langs, ensure_ascii=False) if input_langs else None

            cpu_pct = snapshot.cpu.total_percent if snapshot.cpu else 0.0
            cpu_freq = snapshot.cpu.frequency_mhz if snapshot.cpu else 0.0
            mem_tot = snapshot.memory.total_gb if snapshot.memory else 0.0
            mem_used = snapshot.memory.used_gb if snapshot.memory else 0.0
            mem_pct = snapshot.memory.percent if snapshot.memory else 0.0
            swap_pct = snapshot.memory.swap_percent if snapshot.memory else 0.0
            disk_rb = snapshot.disk_io.read_bytes_per_sec if snapshot.disk_io else 0.0
            disk_wb = snapshot.disk_io.write_bytes_per_sec if snapshot.disk_io else 0.0
            disk_rc = snapshot.disk_io.read_count_per_sec if snapshot.disk_io else 0.0
            disk_wc = snapshot.disk_io.write_count_per_sec if snapshot.disk_io else 0.0
            net_sent = sum(getattr(i, 'bytes_sent_sec', 0.0) or 0.0 for i in (snapshot.network or []))
            net_recv = sum(getattr(i, 'bytes_recv_sec', 0.0) or 0.0 for i in (snapshot.network or []))
            gpu_load = 0.0
            gpu_temp = 0.0
            if snapshot.gpus:
                gpu = snapshot.gpus[0]
                gpu_load = getattr(gpu, 'load_percent', None) or getattr(gpu, 'utilization_gpu_pct', 0.0) or 0.0
                gpu_temp = getattr(gpu, 'temperature_celsius', None) or getattr(gpu, 'temperature_gpu_c', 0.0) or 0.0
            raw_procs = snapshot.top_processes or []

            disks_list = [d if isinstance(d, dict) else (d.model_dump() if hasattr(d, 'model_dump') else (vars(d) if hasattr(d, '__dict__') else d)) for d in (snapshot.disks or [])]
            disks_json = json.dumps(disks_list, ensure_ascii=False, default=str) if disks_list else None
            phys_disks_list = [d if isinstance(d, dict) else (d.model_dump() if hasattr(d, 'model_dump') else (vars(d) if hasattr(d, '__dict__') else d)) for d in (snapshot.physical_disks or [])]
            physical_disks_json = json.dumps(phys_disks_list, ensure_ascii=False, default=str) if phys_disks_list else None

            monitors_list = [m if isinstance(m, dict) else (m.model_dump() if hasattr(m, 'model_dump') else (vars(m) if hasattr(m, '__dict__') else m)) for m in (snapshot.monitors or [])]
            monitors_json = json.dumps(monitors_list, ensure_ascii=False, default=str) if monitors_list else None

            updates_obj = snapshot.updates.model_dump() if hasattr(snapshot.updates, 'model_dump') else (snapshot.updates if isinstance(snapshot.updates, dict) else (vars(snapshot.updates) if hasattr(snapshot.updates, '__dict__') else None))
            updates_json = json.dumps(updates_obj, ensure_ascii=False, default=str) if updates_obj else None

            office_obj = snapshot.office.model_dump() if hasattr(snapshot.office, 'model_dump') else (snapshot.office if isinstance(snapshot.office, dict) else (vars(snapshot.office) if hasattr(snapshot.office, '__dict__') else None))
            office_json = json.dumps(office_obj, ensure_ascii=False, default=str) if office_obj else None

            onedrive_obj = snapshot.onedrive.model_dump() if hasattr(snapshot.onedrive, 'model_dump') else (snapshot.onedrive if isinstance(snapshot.onedrive, dict) else (vars(snapshot.onedrive) if hasattr(snapshot.onedrive, '__dict__') else None))
            onedrive_json = json.dumps(onedrive_obj, ensure_ascii=False, default=str) if onedrive_obj else None

            battery_obj = snapshot.battery.model_dump() if hasattr(snapshot.battery, 'model_dump') else (snapshot.battery if isinstance(snapshot.battery, dict) else (vars(snapshot.battery) if hasattr(snapshot.battery, '__dict__') else None))
            battery_json = json.dumps(battery_obj, ensure_ascii=False, default=str) if battery_obj else None

            ram_sticks_list = [r if isinstance(r, dict) else (r.model_dump() if hasattr(r, 'model_dump') else (vars(r) if hasattr(r, '__dict__') else r)) for r in (snapshot.ram_sticks or [])]
            ram_sticks_json = json.dumps(ram_sticks_list, ensure_ascii=False, default=str) if ram_sticks_list else None

            ports_list = [p if isinstance(p, dict) else (p.model_dump() if hasattr(p, 'model_dump') else (vars(p) if hasattr(p, '__dict__') else p)) for p in (snapshot.listening_ports or [])]
            listening_ports_json = json.dumps(ports_list, ensure_ascii=False, default=str) if ports_list else None

            alerts_list = [a if isinstance(a, dict) else (a.model_dump() if hasattr(a, 'model_dump') else (vars(a) if hasattr(a, '__dict__') else a)) for a in (snapshot.alerts or [])]
            alerts_json = json.dumps(alerts_list, ensure_ascii=False, default=str) if alerts_list else None

            ts_str = snapshot.timestamp
            hw_audit = getattr(snapshot, 'hardware_audit', None)
            raw_full_dict = snapshot.model_dump() if hasattr(snapshot, 'model_dump') else (vars(snapshot) if hasattr(snapshot, '__dict__') else snapshot)
            raw_json_str = json.dumps(raw_full_dict, ensure_ascii=False, default=str)
        else:
            hostname = snap_data.get('hostname')
            username = snap_data.get('username') or ''
            uptime = snap_data.get('uptime_seconds')
            os_name = snap_data.get('os_name') or 'Windows'
            os_build = str(snap_data.get('os_build') or '')
            os_install_date = str(snap_data.get('os_install_date') or '')
            system_lang = str(snap_data.get('system_language') or '')
            os_install_lang = str(snap_data.get('os_install_language') or '')
            user_locale = str(snap_data.get('user_locale') or '')
            sys_locale = str(snap_data.get('system_locale') or '')
            timezone_val = str(snap_data.get('timezone') or '')
            codepage_val = str(snap_data.get('codepage') or '')
            input_langs = snap_data.get('input_languages', [])
            input_langs_json = json.dumps(input_langs, ensure_ascii=False) if input_langs else None

            disks_val = snap_data.get('disks', [])
            disks_list = [d if isinstance(d, dict) else (d.model_dump() if hasattr(d, 'model_dump') else (vars(d) if hasattr(d, '__dict__') else d)) for d in disks_val] if isinstance(disks_val, list) else []
            disks_json = json.dumps(disks_list, ensure_ascii=False, default=str) if disks_list else None
            phys_disks_val = snap_data.get('physical_disks', [])
            phys_disks_list = [d if isinstance(d, dict) else (d.model_dump() if hasattr(d, 'model_dump') else (vars(d) if hasattr(d, '__dict__') else d)) for d in phys_disks_val] if isinstance(phys_disks_val, list) else []
            physical_disks_json = json.dumps(phys_disks_list, ensure_ascii=False, default=str) if phys_disks_list else None

            mon_val = snap_data.get('monitors', [])
            monitors_json = json.dumps(mon_val, ensure_ascii=False, default=str) if mon_val else None

            upd_val = snap_data.get('updates')
            updates_json = json.dumps(upd_val, ensure_ascii=False, default=str) if upd_val else None

            off_val = snap_data.get('office')
            office_json = json.dumps(off_val, ensure_ascii=False, default=str) if off_val else None

            od_val = snap_data.get('onedrive')
            onedrive_json = json.dumps(od_val, ensure_ascii=False, default=str) if od_val else None

            bat_val = snap_data.get('battery')
            battery_json = json.dumps(bat_val, ensure_ascii=False, default=str) if bat_val else None

            ram_val = snap_data.get('ram_sticks', [])
            ram_sticks_json = json.dumps(ram_val, ensure_ascii=False, default=str) if ram_val else None

            ports_val = snap_data.get('listening_ports', [])
            listening_ports_json = json.dumps(ports_val, ensure_ascii=False, default=str) if ports_val else None

            alerts_val = snap_data.get('alerts', [])
            alerts_json = json.dumps(alerts_val, ensure_ascii=False, default=str) if alerts_val else None

            cpu_obj = snap_data.get('cpu', {})
            cpu_pct = cpu_obj.get('total_percent', 0.0) if isinstance(cpu_obj, dict) else getattr(cpu_obj, 'total_percent', 0.0)
            cpu_freq = cpu_obj.get('frequency_mhz', 0.0) if isinstance(cpu_obj, dict) else getattr(cpu_obj, 'frequency_mhz', 0.0)
            mem_obj = snap_data.get('memory', {})
            mem_tot = mem_obj.get('total_gb', 0.0) if isinstance(mem_obj, dict) else getattr(mem_obj, 'total_gb', 0.0)
            mem_used = mem_obj.get('used_gb', 0.0) if isinstance(mem_obj, dict) else getattr(mem_obj, 'used_gb', 0.0)
            mem_pct = mem_obj.get('percent', 0.0) if isinstance(mem_obj, dict) else getattr(mem_obj, 'percent', 0.0)
            swap_pct = mem_obj.get('swap_percent', 0.0) if isinstance(mem_obj, dict) else getattr(mem_obj, 'swap_percent', 0.0)
            disk_obj = snap_data.get('disk_io', {})
            disk_rb = disk_obj.get('read_bytes_per_sec', 0.0) if isinstance(disk_obj, dict) else getattr(disk_obj, 'read_bytes_per_sec', 0.0)
            disk_wb = disk_obj.get('write_bytes_per_sec', 0.0) if isinstance(disk_obj, dict) else getattr(disk_obj, 'write_bytes_per_sec', 0.0)
            disk_rc = disk_obj.get('read_count_per_sec', 0.0) if isinstance(disk_obj, dict) else getattr(disk_obj, 'read_count_per_sec', 0.0)
            disk_wc = disk_obj.get('write_count_per_sec', 0.0) if isinstance(disk_obj, dict) else getattr(disk_obj, 'write_count_per_sec', 0.0)
            net_list = snap_data.get('network', [])
            net_sent = sum((n.get('bytes_sent_sec', 0.0) if isinstance(n, dict) else getattr(n, 'bytes_sent_sec', 0.0)) or 0.0 for n in net_list)
            net_recv = sum((n.get('bytes_recv_sec', 0.0) if isinstance(n, dict) else getattr(n, 'bytes_recv_sec', 0.0)) or 0.0 for n in net_list)
            gpus = snap_data.get('gpus', [])
            gpu_load = 0.0
            gpu_temp = 0.0
            if gpus:
                g0 = gpus[0]
                gpu_load = (g0.get('load_percent', 0.0) if isinstance(g0, dict) else getattr(g0, 'load_percent', 0.0)) or 0.0
                gpu_temp = (g0.get('temperature_celsius', 0.0) if isinstance(g0, dict) else getattr(g0, 'temperature_celsius', 0.0)) or 0.0
            raw_procs = snap_data.get('top_processes', [])
            ts_str = snap_data.get('timestamp')
            hw_audit = snap_data.get('hardware_audit')
            raw_json_str = json.dumps(snap_data, ensure_ascii=False, default=str)

        now_dt = datetime.now(timezone.utc)
        ts_str = ts_str or now_dt.isoformat()
        try:
            now_epoch = datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()

        hardware_audit_json = json.dumps(hw_audit or {}, ensure_ascii=False, default=str) if hw_audit else None

        # Формируем полный словарь полей перед фильтрацией дельт
        raw_fields = {
            'timestamp': ts_str,
            'created_at': now_epoch,
            'hostname': hostname,
            'username': username,
            'uptime_seconds': uptime,
            'os_name': os_name,
            'os_build': os_build,
            'os_install_date': os_install_date,
            'system_language': system_lang,
            'os_install_language': os_install_lang,
            'user_locale': user_locale,
            'system_locale': sys_locale,
            'timezone': timezone_val,
            'codepage': codepage_val,
            'input_languages_json': input_langs_json,
            'disks_json': disks_json,
            'physical_disks_json': physical_disks_json,
            'monitors_json': monitors_json,
            'updates_json': updates_json,
            'office_json': office_json,
            'onedrive_json': onedrive_json,
            'battery_json': battery_json,
            'ram_sticks_json': ram_sticks_json,
            'listening_ports_json': listening_ports_json,
            'alerts_json': alerts_json,
            'cpu_total_percent': cpu_pct,
            'cpu_frequency_mhz': cpu_freq,
            'memory_total_gb': mem_tot,
            'memory_used_gb': mem_used,
            'memory_percent': mem_pct,
            'swap_percent': swap_pct,
            'gpu_load_percent': gpu_load,
            'gpu_temp_c': gpu_temp,
            'disk_read_bytes_sec': disk_rb,
            'disk_write_bytes_sec': disk_wb,
            'disk_read_count_sec': disk_rc,
            'disk_write_count_sec': disk_wc,
            'network_sent_bytes_sec': net_sent,
            'network_recv_bytes_sec': net_recv,
            'hardware_audit': hardware_audit_json,
        }

        # Фильтруем неизменившиеся поля через DeltaStateTracker
        delta_fields, has_changes = self._delta_tracker.filter_snapshot_delta(raw_fields)

        # raw_json сохраняем только при наличии изменений
        stored_raw_json = raw_json_str if has_changes else None

        cursor.execute('''
            INSERT INTO system_snapshots (
                timestamp, created_at, hostname, username, uptime_seconds, os_name, os_build, os_install_date,
                system_language, os_install_language, user_locale, system_locale, timezone, codepage,
                input_languages_json, disks_json, physical_disks_json, monitors_json, updates_json, office_json,
                onedrive_json, battery_json, ram_sticks_json, listening_ports_json, alerts_json,
                cpu_total_percent, cpu_frequency_mhz, memory_total_gb, memory_used_gb,
                memory_percent, swap_percent, gpu_load_percent, gpu_temp_c,
                disk_read_bytes_sec, disk_write_bytes_sec, disk_read_count_sec,
                disk_write_count_sec, network_sent_bytes_sec, network_recv_bytes_sec, hardware_audit, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            delta_fields.get('timestamp'), delta_fields.get('created_at'),
            delta_fields.get('hostname'), delta_fields.get('username'), delta_fields.get('uptime_seconds'),
            delta_fields.get('os_name'), delta_fields.get('os_build'), delta_fields.get('os_install_date'),
            delta_fields.get('system_language'), delta_fields.get('os_install_language'),
            delta_fields.get('user_locale'), delta_fields.get('system_locale'),
            delta_fields.get('timezone'), delta_fields.get('codepage'),
            delta_fields.get('input_languages_json'), delta_fields.get('disks_json'),
            delta_fields.get('physical_disks_json'), delta_fields.get('monitors_json'),
            delta_fields.get('updates_json'), delta_fields.get('office_json'),
            delta_fields.get('onedrive_json'), delta_fields.get('battery_json'),
            delta_fields.get('ram_sticks_json'), delta_fields.get('listening_ports_json'),
            delta_fields.get('alerts_json'),
            delta_fields.get('cpu_total_percent'), delta_fields.get('cpu_frequency_mhz'),
            delta_fields.get('memory_total_gb'), delta_fields.get('memory_used_gb'),
            delta_fields.get('memory_percent'), delta_fields.get('swap_percent'),
            delta_fields.get('gpu_load_percent'), delta_fields.get('gpu_temp_c'),
            delta_fields.get('disk_read_bytes_sec'), delta_fields.get('disk_write_bytes_sec'),
            delta_fields.get('disk_read_count_sec'), delta_fields.get('disk_write_count_sec'),
            delta_fields.get('network_sent_bytes_sec'), delta_fields.get('network_recv_bytes_sec'),
            delta_fields.get('hardware_audit'), stored_raw_json
        ))
        snapshot_id = cursor.lastrowid or 0

        processes = raw_procs if top_n is None or top_n <= 0 else raw_procs[:top_n]
        proc_rows = []
        pid_snapshot_rows = []
        for p in processes:
            p_dict = p if isinstance(p, dict) else (p.model_dump() if hasattr(p, 'model_dump') else (vars(p) if hasattr(p, '__dict__') else p))
            proc_rows.append((
                snapshot_id, ts_str, p_dict.get('pid', 0), p_dict.get('name', 'unknown'),
                p_dict.get('status', ''), float(p_dict.get('cpu_percent', 0.0) or 0.0),
                float(p_dict.get('memory_mb', 0.0) or 0.0), float(p_dict.get('memory_percent', 0.0) or 0.0),
                int(p_dict.get('num_threads', 0) or 0), int(p_dict.get('num_handles', 0) or 0),
                str(p_dict.get('username', '') or ''), float(p_dict.get('read_bytes_sec', 0.0) or 0.0),
                float(p_dict.get('write_bytes_sec', 0.0) or 0.0), p_dict.get('integrity_level', None),
                int(bool(p_dict.get('elevation', False))), p_dict.get('ppid', None),
                p_dict.get('parent_name', None), p_dict.get('executable_path', p_dict.get('executable', None)),
                p_dict.get('cmdline', p_dict.get('command_line', None)), p_dict.get('sid', None),
                p_dict.get('session_id', None), p_dict.get('creation_time', None),
                p_dict.get('process_guid', None), p_dict.get('ancestor_chain', None),
                p_dict.get('launch_reason', None),
            ))

            # Снимок канонического Per-PID Telemetry Engine
            mem_mb = float(p_dict.get('memory_mb', 0.0) or 0.0)
            ws_bytes = int(p_dict.get('working_set_bytes') or (mem_mb * 1024 * 1024))
            pid_snapshot_rows.append((
                int(p_dict.get('pid', 0)),
                str(p_dict.get('name', p_dict.get('process_name', 'unknown'))),
                p_dict.get('executable_path', p_dict.get('executable', None)),
                float(p_dict.get('cpu_percent', 0.0) or 0.0),
                int(p_dict.get('user_time_ms', 0) or 0),
                int(p_dict.get('kernel_time_ms', 0) or 0),
                int(p_dict.get('num_threads', p_dict.get('thread_count', 1)) or 1),
                ws_bytes,
                int(p_dict.get('private_bytes', 0) or 0),
                int(p_dict.get('page_faults_count', p_dict.get('page_faults', 0)) or 0),
                int(p_dict.get('gpu_vram_bytes', 0) or 0),
                float(p_dict.get('gpu_utilization', 0.0) or 0.0),
                int(p_dict.get('read_bytes_total', p_dict.get('read_bytes_sec', 0)) or 0),
                int(p_dict.get('write_bytes_total', p_dict.get('write_bytes_sec', 0)) or 0),
                int(p_dict.get('read_ops_total', 0) or 0),
                int(p_dict.get('write_ops_total', 0) or 0),
                int(p_dict.get('net_bytes_sent_total', 0) or 0),
                int(p_dict.get('net_bytes_recv_total', 0) or 0),
                int(p_dict.get('num_handles', p_dict.get('handle_count', 0)) or 0),
                int(p_dict.get('gdi_objects', 0) or 0),
                int(p_dict.get('user_objects', 0) or 0),
                ts_str
            ))

        if proc_rows:
            cursor.executemany('''
                INSERT INTO process_snapshots (
                    snapshot_id, timestamp, pid, name, status, cpu_percent,
                    memory_mb, memory_percent, num_threads, num_handles,
                    username, read_bytes_sec, write_bytes_sec, integrity_level, elevation,
                    ppid, parent_name, executable, cmdline, sid, session_id,
                    creation_time, process_guid, ancestor_chain, launch_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', proc_rows)

        if pid_snapshot_rows:
            cursor.executemany('''
                INSERT INTO process_pid_snapshots (
                    pid, process_name, executable_path,
                    cpu_percent, user_time_ms, kernel_time_ms, thread_count,
                    working_set_bytes, private_bytes, page_faults_count,
                    gpu_vram_bytes, gpu_utilization,
                    read_bytes_total, write_bytes_total, read_ops_total, write_ops_total,
                    net_bytes_sent_total, net_bytes_recv_total,
                    handle_count, gdi_objects, user_objects, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', pid_snapshot_rows)

        # Синхронизация нормализованных таблиц оборудования и метрик
        try:
            # 1. CPU
            cpu_data = getattr(snapshot, 'cpu', None) or (snap_data.get('cpu') if isinstance(snap_data, dict) else getattr(snap_data, 'cpu', None))
            if cpu_data:
                c_dict = cpu_data if isinstance(cpu_data, dict) else (cpu_data.model_dump() if hasattr(cpu_data, 'model_dump') else vars(cpu_data))
                if c_dict.get('model') or c_dict.get('name'):
                    self.upsert_cpu_inventory(cursor, {
                        'processor_id': 0,
                        'name': c_dict.get('model') or c_dict.get('name', 'CPU'),
                        'architecture': c_dict.get('architecture', 'x86_64'),
                        'physical_cores': c_dict.get('physical_cores', 1),
                        'logical_cores': c_dict.get('logical_cores', 1),
                        'base_frequency_mhz': c_dict.get('frequency_mhz', 0.0),
                    })
                self.insert_cpu_telemetry_sample(cursor, {
                    'timestamp': ts_str,
                    'created_at': now_epoch,
                    'processor_id': 0,
                    'total_percent': cpu_pct,
                    'frequency_mhz': cpu_freq,
                    'temperature_c': c_dict.get('temperature_celsius') or c_dict.get('temperature_c'),
                    'core_utilization': c_dict.get('per_core_percent', []),
                })

            # 2. RAM
            mem_data = getattr(snapshot, 'memory', None) or (snap_data.get('memory') if isinstance(snap_data, dict) else getattr(snap_data, 'memory', None))
            if mem_data:
                m_dict = mem_data if isinstance(mem_data, dict) else (mem_data.model_dump() if hasattr(mem_data, 'model_dump') else vars(mem_data))
                self.insert_ram_telemetry_sample(cursor, {
                    'timestamp': ts_str,
                    'created_at': now_epoch,
                    'total_gb': mem_tot,
                    'used_gb': mem_used,
                    'available_gb': m_dict.get('available_gb', max(0.0, mem_tot - mem_used)),
                    'percent_used': mem_pct,
                    'swap_total_gb': m_dict.get('swap_total_gb', 0.0),
                    'swap_used_gb': m_dict.get('swap_used_gb', 0.0),
                    'swap_percent': swap_pct,
                })

            # 3. RAM Sticks (SPD)
            sticks = getattr(snapshot, 'ram_sticks', None) or (snap_data.get('ram_sticks') if isinstance(snap_data, dict) else getattr(snap_data, 'ram_sticks', None)) or []
            for s in sticks:
                self.upsert_ram_module_inventory(cursor, s)

            # 4. GPUs
            gpus_list = getattr(snapshot, 'gpus', None) or (snap_data.get('gpus') if isinstance(snap_data, dict) else getattr(snap_data, 'gpus', None)) or []
            for g_idx, g_item in enumerate(gpus_list):
                g_dict = g_item if isinstance(g_item, dict) else (g_item.model_dump() if hasattr(g_item, 'model_dump') else vars(g_item))
                g_name = g_dict.get('name', f'GPU {g_idx}')
                name_l = g_name.lower()
                if 'nvidia' in name_l or 'geforce' in name_l or g_dict.get('has_cuda'):
                    vendor = 'NVIDIA'
                elif 'amd' in name_l or 'radeon' in name_l:
                    vendor = 'AMD'
                elif 'intel' in name_l or 'arc' in name_l or 'uhd' in name_l or 'hd graphics' in name_l:
                    vendor = 'Intel'
                else:
                    vendor = g_dict.get('vendor') or 'Generic'

                mem_total_gb = float(g_dict.get('memory_total_gb') or 0.0)
                mem_used_gb = float(g_dict.get('memory_used_gb') or 0.0)
                mem_pct = round((mem_used_gb / mem_total_gb) * 100.0, 1) if mem_total_gb > 0 else 0.0
                gpu_type_str = g_dict.get('gpu_type') or ('Discrete' if vendor in ('NVIDIA', 'AMD') else 'Integrated')
                pci_bus = 'PCIe x16' if gpu_type_str == 'Discrete' else 'Integrated / System Bus'

                self.upsert_gpu_inventory(cursor, {
                    'gpu_id': g_idx,
                    'name': g_name,
                    'vendor': vendor,
                    'vram_gb': mem_total_gb,
                    'vram_bytes': int(mem_total_gb * (1024**3)),
                    'driver_version': g_dict.get('driver_version', ''),
                    'pci_bus_id': pci_bus,
                    'cuda_cores': g_dict.get('cuda_cores'),
                    'directml_supported': bool(g_dict.get('has_directml', True)),
                })
                self.insert_gpu_telemetry_sample(cursor, {
                    'timestamp': ts_str,
                    'created_at': now_epoch,
                    'gpu_id': g_idx,
                    'name': g_name,
                    'load_percent': g_dict.get('load_percent'),
                    'memory_used_mb': mem_used_gb * 1024.0,
                    'memory_total_mb': mem_total_gb * 1024.0,
                    'memory_percent': mem_pct,
                    'temperature_gpu_c': g_dict.get('temperature_celsius') or g_dict.get('temperature_gpu_c'),
                    'power_draw_w': g_dict.get('power_draw_w'),
                })

            # 5. Network
            net_items = getattr(snapshot, 'network', None) or (snap_data.get('network') if isinstance(snap_data, dict) else getattr(snap_data, 'network', None)) or []
            for n_idx, n_item in enumerate(net_items):
                n_dict = n_item if isinstance(n_item, dict) else (n_item.model_dump() if hasattr(n_item, 'model_dump') else vars(n_item))
                self.upsert_network_adapter_inventory(cursor, {
                    'adapter_id': n_idx,
                    'adapter_guid': n_dict.get('name', f'Adapter_{n_idx}'),
                    'name': n_dict.get('name', f'Adapter {n_idx}'),
                    'max_speed_mbps': n_dict.get('speed_mbps', 0),
                })
                self.insert_network_adapter_sample(cursor, {
                    'timestamp': ts_str,
                    'created_at': now_epoch,
                    'adapter_name': n_dict.get('name', f'Adapter {n_idx}'),
                    'bytes_recv_sec': n_dict.get('bytes_recv_per_sec') or n_dict.get('bytes_recv_sec', 0.0),
                    'bytes_sent_sec': n_dict.get('bytes_sent_per_sec') or n_dict.get('bytes_sent_sec', 0.0),
                    'link_speed_mbps': n_dict.get('speed_mbps', 0),
                    'is_connected': bool(n_dict.get('is_up', True)),
                })
        except Exception as norm_err:
            logger.debug(f'Предупреждение синхронизации нормализованных таблиц оборудования: {norm_err}')

        return snapshot_id

    def insert_process_pid_snapshots(self, snapshots: List[Union[Dict[str, Any], Any]]) -> int:
        """Пакетная вставка снимков ресурсов процессов по PID в process_pid_snapshots."""
        if not snapshots:
            return 0
        now_ts = datetime.now(timezone.utc).isoformat()
        rows = []
        for s in snapshots:
            d = s if isinstance(s, dict) else (s.model_dump() if hasattr(s, 'model_dump') else vars(s))
            mem_mb = float(d.get('memory_mb', 0.0) or 0.0)
            ws_bytes = int(d.get('working_set_bytes') or (mem_mb * 1024 * 1024))
            rows.append((
                int(d.get('pid', 0)),
                str(d.get('process_name', d.get('name', 'unknown'))),
                d.get('executable_path', d.get('executable', None)),
                float(d.get('cpu_percent', 0.0) or 0.0),
                int(d.get('user_time_ms', 0) or 0),
                int(d.get('kernel_time_ms', 0) or 0),
                int(d.get('thread_count', d.get('num_threads', 1)) or 1),
                ws_bytes,
                int(d.get('private_bytes', 0) or 0),
                int(d.get('page_faults_count', d.get('page_faults', 0)) or 0),
                int(d.get('gpu_vram_bytes', 0) or 0),
                float(d.get('gpu_utilization', 0.0) or 0.0),
                int(d.get('read_bytes_total', d.get('read_bytes_sec', 0)) or 0),
                int(d.get('write_bytes_total', d.get('write_bytes_sec', 0)) or 0),
                int(d.get('read_ops_total', 0) or 0),
                int(d.get('write_ops_total', 0) or 0),
                int(d.get('net_bytes_sent_total', 0) or 0),
                int(d.get('net_bytes_recv_total', 0) or 0),
                int(d.get('handle_count', d.get('num_handles', 0)) or 0),
                int(d.get('gdi_objects', 0) or 0),
                int(d.get('user_objects', 0) or 0),
                d.get('timestamp') or now_ts
            ))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT INTO process_pid_snapshots (
                    pid, process_name, executable_path,
                    cpu_percent, user_time_ms, kernel_time_ms, thread_count,
                    working_set_bytes, private_bytes, page_faults_count,
                    gpu_vram_bytes, gpu_utilization,
                    read_bytes_total, write_bytes_total, read_ops_total, write_ops_total,
                    net_bytes_sent_total, net_bytes_recv_total,
                    handle_count, gdi_objects, user_objects, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', rows)
            conn.commit()
        return len(rows)

    def insert_process_file_events(self, events: List[Union[Dict[str, Any], Any]]) -> int:
        """Пакетная вставка событий файловой активности в process_file_events."""
        if not events:
            return 0
        now_ts = datetime.now(timezone.utc).isoformat()
        now_epoch = time.time()
        rows = []
        for ev in events:
            d = ev if isinstance(ev, dict) else (ev.model_dump() if hasattr(ev, 'model_dump') else vars(ev))
            rows.append((
                int(d.get('pid', 0)),
                str(d.get('process_name', d.get('name', ''))),
                str(d.get('action_type', d.get('action', 'MODIFY'))),
                str(d.get('target_directory', d.get('target_folder', ''))),
                str(d.get('file_path', '')),
                int(d.get('bytes_affected', d.get('bytes_count', 0)) or 0),
                d.get('instance_id', None),
                str(d.get('timestamp') or now_ts),
                float(d.get('created_at') or now_epoch)
            ))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany('''
                INSERT INTO process_file_events (
                    pid, process_name, action_type, target_directory,
                    file_path, bytes_affected, instance_id, timestamp, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', rows)
            conn.commit()
        return len(rows)

    def insert_hardware_archive_row(self, cursor: sqlite3.Cursor, data: Any) -> int:
        now_dt = datetime.now(timezone.utc)
        if isinstance(data, HardwareArchiveEntry):
            raw_json = data.model_dump_json()
            report = data.report
            prob_count = report.problem_devices_count if report else 0
            outdated_count = report.outdated_drivers_count if report else 0
            archive_id = data.archive_id
            timestamp = data.timestamp
            devices_count = data.devices_count
            changes_count = data.changes_count
        else:
            raw_json = json.dumps(data, ensure_ascii=False, default=str)
            report = data.get('report', {})
            prob_count = report.get('problem_devices_count', 0) if isinstance(report, dict) else getattr(report, 'problem_devices_count', 0)
            outdated_count = report.get('outdated_drivers_count', 0) if isinstance(report, dict) else getattr(report, 'outdated_drivers_count', 0)
            archive_id = data.get('archive_id', f'arch_{int(now_dt.timestamp())}')
            timestamp = data.get('timestamp', now_dt.isoformat())
            devices_count = data.get('devices_count', 0)
            changes_count = data.get('changes_count', 0)

        try:
            now_epoch = datetime.fromisoformat(timestamp).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()

        cursor.execute('''
            INSERT OR REPLACE INTO hardware_audits (
                archive_id, timestamp, created_at, devices_count,
                problem_devices_count, outdated_drivers_count, changes_count, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (archive_id, timestamp, now_epoch, devices_count, prob_count, outdated_count, changes_count, raw_json))
        return cursor.lastrowid or 0

    def insert_startup_archive_row(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Сохранение снимка аудита автозапуска и зафиксированных изменений в БД."""
        now_dt = datetime.now(timezone.utc)
        if isinstance(data, StartupArchiveEntry):
            raw_json = data.model_dump_json()
            archive_id = data.archive_id
            timestamp = data.timestamp
            total_entries = data.total_entries
            health_score = data.health_score
            changes_count = data.changes_count
            report = data.report
            changes = data.changes
            if hasattr(report, 'summary') and report.summary:
                active_entries = report.summary.active_entries
                disabled_entries = report.summary.disabled_entries
                broken_entries = report.summary.broken_entries
            else:
                active_entries = 0
                disabled_entries = 0
                broken_entries = 0
        else:
            raw_json = json.dumps(data, ensure_ascii=False, default=str)
            archive_id = data.get('archive_id', f'startup_{int(now_dt.timestamp())}')
            timestamp = data.get('timestamp', now_dt.isoformat())
            total_entries = data.get('total_entries', 0)
            health_score = data.get('health_score', 100)
            changes_count = data.get('changes_count', 0)
            report = data.get('report', {})
            summary = report.get('summary', {}) if isinstance(report, dict) else getattr(report, 'summary', None)
            if isinstance(summary, dict):
                active_entries = summary.get('active_entries', 0)
                disabled_entries = summary.get('disabled_entries', 0)
                broken_entries = summary.get('broken_entries', 0)
            else:
                active_entries = getattr(summary, 'active_entries', 0) if summary else 0
                disabled_entries = getattr(summary, 'disabled_entries', 0) if summary else 0
                broken_entries = getattr(summary, 'broken_entries', 0) if summary else 0
            changes = data.get('changes', [])

        try:
            now_epoch = datetime.fromisoformat(timestamp).timestamp()
        except Exception:
            now_epoch = now_dt.timestamp()

        cursor.execute('''
            INSERT OR REPLACE INTO startup_audit_archives (
                archive_id, timestamp, created_at, total_entries,
                active_entries, disabled_entries, broken_entries,
                health_score, changes_count, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            archive_id, timestamp, now_epoch, total_entries,
            active_entries, disabled_entries, broken_entries,
            health_score, changes_count, raw_json
        ))

        if changes:
            for ch in changes:
                ch_dict = ch.model_dump(mode='json') if hasattr(ch, 'model_dump') else ch
                cursor.execute('''
                    INSERT INTO startup_changes (
                        archive_id, timestamp, created_at, change_type,
                        entry_id, name, description, previous_value, current_value
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    archive_id,
                    ch_dict.get('timestamp', timestamp),
                    now_epoch,
                    ch_dict.get('change_type', 'modified'),
                    ch_dict.get('entry_id', ''),
                    ch_dict.get('name', ''),
                    ch_dict.get('description', ''),
                    json.dumps(ch_dict.get('previous_value'), ensure_ascii=False) if ch_dict.get('previous_value') is not None else None,
                    json.dumps(ch_dict.get('current_value'), ensure_ascii=False) if ch_dict.get('current_value') is not None else None,
                ))

        return cursor.lastrowid or 0
