# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetryInventoryWriterMixin
# =============================================================================
# Description:
#   Миксин записи инвентаря оборудования (CPU, RAM, GPU, диски, сеть) и телеметрических выборок.
#   Вынесено при декомпозиции TelemetryWriter (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.writer_inventory import TelemetryInventoryWriterMixin
#
#     class TelemetryWriter(TelemetryInventoryWriterMixin): ...
#
# File: writer_inventory.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин записи инвентаря оборудования (CPU, RAM, GPU, диски, сеть) и телеметрических выборок."""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional


try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class TelemetryInventoryWriterMixin:
    """Миксин записи инвентаря оборудования (CPU, RAM, GPU, диски, сеть) и телеметрических выборок."""

    def upsert_device_inventory(
        self,
        cursor: sqlite3.Cursor,
        device_instance_id: str,
        friendly_name: Optional[str] = None,
        device_class: Optional[str] = None,
        install_date: Optional[str] = None,
    ) -> int:
        """Вставка или обновление записи в таблице device_inventory."""
        now_dt = datetime.now(timezone.utc)
        now_epoch = now_dt.timestamp()
        norm_id = str(device_instance_id).strip().upper()
        date_val = install_date or now_dt.strftime('%d.%m.%Y %H:%M')
        cursor.execute('''
            INSERT INTO device_inventory (
                device_instance_id, friendly_name, device_class, install_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_instance_id) DO UPDATE SET
                friendly_name = COALESCE(excluded.friendly_name, device_inventory.friendly_name),
                device_class = COALESCE(excluded.device_class, device_inventory.device_class),
                updated_at = excluded.updated_at
        ''', (norm_id, friendly_name or '', device_class or '', date_val, now_epoch, now_epoch))
        return cursor.lastrowid or 0

    def upsert_disk_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта физического накопителя (disk_inventory)."""
        d = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = d.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        serial = str(d.get('serial_number') or f"DISK_{d.get('disk_id', 0)}").strip()

        cursor.execute('''
            INSERT INTO disk_inventory (
                disk_id, device_path, serial_number, vendor, product,
                revision, bus_type, media_type, size_bytes, size_gb,
                sector_size, removable, partition_style, gpt_guid,
                partitions_json, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(serial_number) DO UPDATE SET
                disk_id = excluded.disk_id,
                device_path = excluded.device_path,
                vendor = excluded.vendor,
                product = excluded.product,
                revision = excluded.revision,
                bus_type = excluded.bus_type,
                media_type = excluded.media_type,
                size_bytes = excluded.size_bytes,
                size_gb = excluded.size_gb,
                sector_size = excluded.sector_size,
                removable = excluded.removable,
                partition_style = excluded.partition_style,
                gpt_guid = excluded.gpt_guid,
                partitions_json = excluded.partitions_json,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            int(d.get('disk_id', 0)),
            d.get('device_path') or f"\\\\.\\PhysicalDrive{d.get('disk_id', 0)}",
            serial,
            d.get('vendor', ''),
            d.get('product') or d.get('name', ''),
            d.get('revision', ''),
            d.get('bus_type', 'Unknown'),
            d.get('media_type', 'SSD'),
            int(d.get('size_bytes', 0)),
            float(d.get('size_gb', 0.0)),
            int(d.get('sector_size', 512)),
            int(bool(d.get('removable', False))),
            d.get('partition_style', 'GPT'),
            d.get('gpt_guid', ''),
            json.dumps(d.get('partitions', []), ensure_ascii=False, default=str),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def upsert_volume_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта логического тома (volume_inventory)."""
        v = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = v.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        guid = str(v.get('volume_guid') or v.get('volume_id') or v.get('drive_letter', 'UNKNOWN')).strip()

        cursor.execute('''
            INSERT INTO volume_inventory (
                volume_guid, drive_letter, mount_point, label, filesystem,
                filesystem_flags, cluster_size_bytes, sector_size_bytes,
                total_bytes, total_gb, disk_id, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(volume_guid) DO UPDATE SET
                drive_letter = excluded.drive_letter,
                mount_point = excluded.mount_point,
                label = excluded.label,
                filesystem = excluded.filesystem,
                filesystem_flags = excluded.filesystem_flags,
                cluster_size_bytes = excluded.cluster_size_bytes,
                sector_size_bytes = excluded.sector_size_bytes,
                total_bytes = excluded.total_bytes,
                total_gb = excluded.total_gb,
                disk_id = excluded.disk_id,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            guid,
            v.get('drive_letter', ''),
            v.get('mount_point', ''),
            v.get('label', ''),
            v.get('filesystem', 'NTFS'),
            int(v.get('filesystem_flags', 0) or 0),
            int(v.get('cluster_size_bytes', 4096) or 4096),
            int(v.get('sector_size_bytes', 512) or 512),
            int(v.get('total_bytes', 0) or 0),
            float(v.get('total_gb', 0.0) or 0.0),
            v.get('disk_id'),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def insert_disk_health_snapshot(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка снимка здоровья / SMART / TBW накопителя (disk_health_snapshots)."""
        h = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = h.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(h.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO disk_health_snapshots (
                timestamp, created_at, disk_id, serial_number, model, bus_type,
                temperature_c, wear_percent, available_spare, tbw_written_tb,
                tbw_read_tb, power_on_hours, power_cycles, unsafe_shutdowns,
                media_errors, error_log_entries, health_status, raw_smart_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            int(h.get('disk_id', 0)),
            h.get('serial_number'),
            h.get('model', ''),
            h.get('bus_type', 'Unknown'),
            h.get('temperature_c'),
            h.get('wear_percentage') or h.get('wear_percent'),
            h.get('available_spare_percent') or h.get('available_spare'),
            h.get('tbw_written_tb') or h.get('lifetime_write_tb'),
            h.get('tbw_read_tb') or h.get('lifetime_read_tb'),
            h.get('power_on_hours'),
            h.get('power_cycles'),
            h.get('unsafe_shutdowns'),
            h.get('media_errors'),
            h.get('error_log_entries'),
            h.get('health_status', 'Healthy'),
            json.dumps(h, ensure_ascii=False, default=str),
        ))
        return cursor.lastrowid or 0

    def insert_disk_performance_sample(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка сэмпла производительности диска (disk_performance_samples)."""
        p = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = p.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(p.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO disk_performance_samples (
                timestamp, created_at, disk_name, read_bytes_sec, write_bytes_sec,
                read_iops, write_iops, read_time_ms, write_time_ms, percent_disk_time, queue_length
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            p.get('disk_name') or f"PhysicalDrive{p.get('disk_id', 0)}",
            float(p.get('read_bytes_sec', 0.0) or 0.0),
            float(p.get('write_bytes_sec', 0.0) or 0.0),
            float(p.get('read_iops', 0.0) or 0.0),
            float(p.get('write_iops', 0.0) or 0.0),
            float(p.get('read_time_ms', 0.0) or p.get('avg_read_latency_ms', 0.0) or 0.0),
            float(p.get('write_time_ms', 0.0) or p.get('avg_write_latency_ms', 0.0) or 0.0),
            float(p.get('percent_disk_time', 0.0) or p.get('disk_time_percent', 0.0) or 0.0),
            float(p.get('queue_length', 0.0) or 0.0),
        ))
        return cursor.lastrowid or 0

    def insert_disk_io_event(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка события ввода-вывода (disk_io_events)."""
        ev = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = ev.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(ev.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO disk_io_events (
                timestamp, created_at, pid, process_name, disk_id,
                operation, bytes_count, duration_ms, offset, file_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            int(ev.get('pid', 0)),
            ev.get('process_name', ''),
            int(ev.get('disk_id', 0)),
            ev.get('operation', 'READ'),
            int(ev.get('bytes_count', 0)),
            ev.get('duration_ms'),
            ev.get('offset'),
            ev.get('file_path'),
        ))
        return cursor.lastrowid or 0

    def upsert_cpu_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта физического процессора (cpu_inventory)."""
        c = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = c.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        name = str(c.get('name') or f"CPU_{c.get('processor_id', 0)}").strip()

        cursor.execute('''
            INSERT INTO cpu_inventory (
                processor_id, name, vendor, architecture, physical_cores, logical_cores,
                base_frequency_mhz, max_frequency_mhz, l2_cache_kb, l3_cache_kb,
                socket, features_json, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                processor_id = excluded.processor_id,
                vendor = excluded.vendor,
                architecture = excluded.architecture,
                physical_cores = excluded.physical_cores,
                logical_cores = excluded.logical_cores,
                base_frequency_mhz = excluded.base_frequency_mhz,
                max_frequency_mhz = excluded.max_frequency_mhz,
                l2_cache_kb = excluded.l2_cache_kb,
                l3_cache_kb = excluded.l3_cache_kb,
                socket = excluded.socket,
                features_json = excluded.features_json,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            int(c.get('processor_id', 0)),
            name,
            c.get('vendor', ''),
            c.get('architecture', 'x86_64'),
            int(c.get('physical_cores', 1) or 1),
            int(c.get('logical_cores', 1) or 1),
            float(c.get('base_frequency_mhz', 0.0) or 0.0),
            float(c.get('max_frequency_mhz', 0.0) or 0.0),
            c.get('l2_cache_kb'),
            c.get('l3_cache_kb'),
            c.get('socket', ''),
            json.dumps(c.get('features', []), ensure_ascii=False, default=str),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def upsert_ram_module_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта планки оперативной памяти (ram_module_inventory)."""
        r = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = r.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        serial = str(r.get('serial_number') or f"RAM_{r.get('bank_label', '')}_{r.get('slot_id', 0)}").strip()

        cursor.execute('''
            INSERT INTO ram_module_inventory (
                slot_id, bank_label, device_locator, serial_number, part_number,
                manufacturer, capacity_bytes, capacity_gb, speed_mhz, memory_type,
                form_factor, configured_voltage, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(serial_number) DO UPDATE SET
                slot_id = excluded.slot_id,
                bank_label = excluded.bank_label,
                device_locator = excluded.device_locator,
                part_number = excluded.part_number,
                manufacturer = excluded.manufacturer,
                capacity_bytes = excluded.capacity_bytes,
                capacity_gb = excluded.capacity_gb,
                speed_mhz = excluded.speed_mhz,
                memory_type = excluded.memory_type,
                form_factor = excluded.form_factor,
                configured_voltage = excluded.configured_voltage,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            int(r.get('slot_id', 0)),
            r.get('bank_label', 'DIMM'),
            r.get('device_locator', ''),
            serial,
            r.get('part_number', ''),
            r.get('manufacturer', ''),
            int(r.get('capacity_bytes', 0) or 0),
            float(r.get('capacity_gb', 0.0) or 0.0),
            int(r.get('speed_mhz', 0) or 0),
            r.get('memory_type', 'DDR4'),
            r.get('form_factor', 'DIMM'),
            r.get('configured_voltage'),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def upsert_gpu_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта графического ускорителя (gpu_inventory)."""
        g = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = g.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        pci_id = str(g.get('pci_device_id') or g.get('pci_bus_id') or f"GPU_{g.get('gpu_id', 0)}_{g.get('name', '')}").strip()

        cursor.execute('''
            INSERT INTO gpu_inventory (
                gpu_id, pci_device_id, name, vendor, driver_version, driver_date,
                vram_bytes, vram_gb, pci_bus_id, bios_version, cuda_cores,
                directml_supported, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pci_device_id) DO UPDATE SET
                gpu_id = excluded.gpu_id,
                name = excluded.name,
                vendor = excluded.vendor,
                driver_version = excluded.driver_version,
                driver_date = excluded.driver_date,
                vram_bytes = excluded.vram_bytes,
                vram_gb = excluded.vram_gb,
                pci_bus_id = excluded.pci_bus_id,
                bios_version = excluded.bios_version,
                cuda_cores = excluded.cuda_cores,
                directml_supported = excluded.directml_supported,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            int(g.get('gpu_id', 0)),
            pci_id,
            g.get('name', 'Graphics Adapter'),
            g.get('vendor', ''),
            g.get('driver_version', ''),
            g.get('driver_date', ''),
            int(g.get('vram_bytes', 0) or 0),
            float(g.get('vram_gb', 0.0) or (g.get('memory_total_mb', 0.0) / 1024.0 if g.get('memory_total_mb') else 0.0)),
            g.get('pci_bus_id', ''),
            g.get('bios_version', ''),
            g.get('cuda_cores'),
            int(bool(g.get('directml_supported', True))),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def upsert_network_adapter_inventory(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка или обновление паспорта сетевого адаптера (network_adapter_inventory)."""
        n = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = n.get('timestamp') or now_dt.isoformat()
        now_epoch = now_dt.timestamp()
        guid = str(n.get('adapter_guid') or n.get('mac_address') or n.get('name', 'UNKNOWN')).strip()

        cursor.execute('''
            INSERT INTO network_adapter_inventory (
                adapter_id, adapter_guid, name, interface_name, mac_address,
                adapter_type, is_physical, is_wireless, max_speed_mbps,
                driver_name, driver_version, first_seen, last_seen, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(adapter_guid) DO UPDATE SET
                adapter_id = excluded.adapter_id,
                name = excluded.name,
                interface_name = excluded.interface_name,
                mac_address = excluded.mac_address,
                adapter_type = excluded.adapter_type,
                is_physical = excluded.is_physical,
                is_wireless = excluded.is_wireless,
                max_speed_mbps = excluded.max_speed_mbps,
                driver_name = excluded.driver_name,
                driver_version = excluded.driver_version,
                last_seen = excluded.last_seen,
                updated_at = excluded.updated_at
        ''', (
            int(n.get('adapter_id', 0)),
            guid,
            n.get('name', 'Network Adapter'),
            n.get('interface_name', ''),
            n.get('mac_address', ''),
            n.get('adapter_type', 'Ethernet'),
            int(bool(n.get('is_physical', True))),
            int(bool(n.get('is_wireless', False))),
            int(n.get('max_speed_mbps', 0) or 0),
            n.get('driver_name', ''),
            n.get('driver_version', ''),
            ts_str,
            ts_str,
            now_epoch,
        ))
        return cursor.lastrowid or 0

    def insert_cpu_telemetry_sample(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка снимка метрик нагрузки и температур процессора (cpu_telemetry_samples)."""
        c = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = c.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(c.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO cpu_telemetry_samples (
                timestamp, created_at, processor_id, total_percent, user_percent,
                kernel_percent, frequency_mhz, temperature_c, package_power_w,
                core_utilization_json, core_temperatures_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            int(c.get('processor_id', 0)),
            float(c.get('total_percent', 0.0) or 0.0),
            float(c.get('user_percent', 0.0) or 0.0),
            float(c.get('kernel_percent', 0.0) or 0.0),
            float(c.get('frequency_mhz', 0.0) or 0.0),
            c.get('temperature_c') or c.get('temperature_celsius'),
            c.get('package_power_w'),
            json.dumps(c.get('core_utilization') or c.get('per_core_percent', []), ensure_ascii=False, default=str),
            json.dumps(c.get('core_temperatures', []), ensure_ascii=False, default=str),
        ))
        return cursor.lastrowid or 0

    def insert_ram_telemetry_sample(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка снимка метрик использования оперативной памяти (ram_telemetry_samples)."""
        r = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = r.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(r.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO ram_telemetry_samples (
                timestamp, created_at, total_bytes, total_gb, used_bytes, used_gb,
                available_bytes, available_gb, percent_used, swap_total_gb,
                swap_used_gb, swap_percent, pool_paged_mb, pool_nonpaged_mb
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            int(r.get('total_bytes', 0) or 0),
            float(r.get('total_gb', 0.0) or 0.0),
            int(r.get('used_bytes', 0) or 0),
            float(r.get('used_gb', 0.0) or 0.0),
            int(r.get('available_bytes', 0) or 0),
            float(r.get('available_gb', 0.0) or 0.0),
            float(r.get('percent_used', 0.0) or r.get('percent', 0.0) or 0.0),
            float(r.get('swap_total_gb', 0.0) or 0.0),
            float(r.get('swap_used_gb', 0.0) or 0.0),
            float(r.get('swap_percent', 0.0) or 0.0),
            r.get('pool_paged_mb'),
            r.get('pool_nonpaged_mb'),
        ))
        return cursor.lastrowid or 0

    def insert_gpu_telemetry_sample(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка снимка метрик GPU (gpu_telemetry_samples)."""
        g = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = g.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(g.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO gpu_telemetry_samples (
                timestamp, created_at, gpu_id, name, load_percent, memory_used_mb,
                memory_total_mb, memory_percent, temperature_gpu_c, temperature_memory_c,
                fan_speed_pct, power_draw_w, clock_graphics_mhz, clock_memory_mhz
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            int(g.get('gpu_id', 0) or g.get('index', 0)),
            g.get('name', 'GPU'),
            g.get('load_percent') or g.get('utilization_gpu_pct'),
            float(g.get('memory_used_mb', 0.0) or (g.get('memory_used_gb', 0.0) * 1024.0 if g.get('memory_used_gb') else 0.0)),
            float(g.get('memory_total_mb', 0.0) or (g.get('memory_total_gb', 0.0) * 1024.0 if g.get('memory_total_gb') else 0.0)),
            g.get('memory_percent') or g.get('utilization_memory_pct'),
            g.get('temperature_gpu_c') or g.get('temperature_celsius'),
            g.get('temperature_memory_c'),
            g.get('fan_speed_pct'),
            g.get('power_draw_w'),
            g.get('clock_graphics_mhz'),
            g.get('clock_memory_mhz'),
        ))
        return cursor.lastrowid or 0

    def insert_network_adapter_sample(self, cursor: sqlite3.Cursor, data: Any) -> int:
        """Вставка снимка метрик сетевого адаптера (network_adapter_samples)."""
        n = data if isinstance(data, dict) else (data.model_dump() if hasattr(data, 'model_dump') else vars(data))
        now_dt = datetime.now(timezone.utc)
        ts_str = n.get('timestamp') or now_dt.isoformat()
        try:
            created_at = float(n.get('created_at') or datetime.fromisoformat(ts_str).timestamp())
        except Exception:
            created_at = now_dt.timestamp()

        cursor.execute('''
            INSERT INTO network_adapter_samples (
                timestamp, created_at, adapter_name, bytes_recv_sec, bytes_sent_sec,
                packets_recv_sec, packets_sent_sec, errors_in_sec, errors_out_sec,
                link_speed_mbps, is_connected
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            ts_str,
            created_at,
            n.get('adapter_name') or n.get('name', 'Network Adapter'),
            float(n.get('bytes_recv_sec', 0.0) or n.get('bytes_recv_per_sec', 0.0) or 0.0),
            float(n.get('bytes_sent_sec', 0.0) or n.get('bytes_sent_per_sec', 0.0) or 0.0),
            float(n.get('packets_recv_sec', 0.0) or 0.0),
            float(n.get('packets_sent_sec', 0.0) or 0.0),
            float(n.get('errors_in_sec', 0.0) or 0.0),
            float(n.get('errors_out_sec', 0.0) or 0.0),
            int(n.get('link_speed_mbps', 0) or n.get('speed_mbps', 0) or 0),
            int(bool(n.get('is_connected', True) if n.get('is_connected') is not None else n.get('is_up', True))),
        ))
        return cursor.lastrowid or 0
