# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetryInventoryReaderMixin
# =============================================================================
# Description:
#   Миксин чтения инвентаря оборудования, телеметрических выборок, событий приложений и устройств.
#   Вынесено при декомпозиции TelemetryReader (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.reader_inventory import TelemetryInventoryReaderMixin
#
#     class TelemetryReader(TelemetryInventoryReaderMixin): ...
#
# File: reader_inventory.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин чтения инвентаря оборудования, телеметрических выборок, событий приложений и устройств."""

import json
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


class TelemetryInventoryReaderMixin:
    """Миксин чтения инвентаря оборудования, телеметрических выборок, событий приложений и устройств."""

    def get_app_polls(self, app: Optional[str] = None, metric_name: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает историю опросов приложений."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if app and metric_name:
                cursor.execute('SELECT * FROM app_polls WHERE app = ? AND metric_name = ? ORDER BY id DESC LIMIT ?', (app, metric_name, limit))
            elif app:
                cursor.execute('SELECT * FROM app_polls WHERE app = ? ORDER BY id DESC LIMIT ?', (app, limit))
            else:
                cursor.execute('SELECT * FROM app_polls ORDER BY id DESC LIMIT ?', (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_app_events(self, app: Optional[str] = None, event_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает события приложений."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if app and event_type:
                cursor.execute('SELECT * FROM app_events WHERE app = ? AND event_type = ? ORDER BY id DESC LIMIT ?', (app, event_type, limit))
            elif app:
                cursor.execute('SELECT * FROM app_events WHERE app = ? ORDER BY id DESC LIMIT ?', (app, limit))
            else:
                cursor.execute('SELECT * FROM app_events ORDER BY id DESC LIMIT ?', (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_app_param_changes(self, app: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает изменения параметров приложений."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if app:
                cursor.execute('SELECT * FROM app_param_changes WHERE app = ? ORDER BY id DESC LIMIT ?', (app, limit))
            else:
                cursor.execute('SELECT * FROM app_param_changes ORDER BY id DESC LIMIT ?', (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_custom_records(self, source_file: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает кастомные записи логов."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if source_file:
                cursor.execute('SELECT * FROM custom_records WHERE source_file = ? ORDER BY id DESC LIMIT ?', (source_file, limit))
            else:
                cursor.execute('SELECT * FROM custom_records ORDER BY id DESC LIMIT ?', (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_device_events(self, event_type: Optional[str] = None, device_instance_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает события устройств."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if event_type and device_instance_id:
                cursor.execute('SELECT * FROM device_events WHERE event_type = ? AND device_instance_id = ? ORDER BY id DESC LIMIT ?', (event_type, device_instance_id, limit))
            elif event_type:
                cursor.execute('SELECT * FROM device_events WHERE event_type = ? ORDER BY id DESC LIMIT ?', (event_type, limit))
            elif device_instance_id:
                cursor.execute('SELECT * FROM device_events WHERE device_instance_id = ? ORDER BY id DESC LIMIT ?', (device_instance_id, limit))
            else:
                cursor.execute('SELECT * FROM device_events ORDER BY id DESC LIMIT ?', (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_device_install_date(self, device_instance_id: str) -> Optional[str]:
        """Возвращает дату установки устройства из таблицы device_inventory."""
        norm_id = str(device_instance_id).strip().upper()
        if not norm_id:
            return None
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT install_date FROM device_inventory WHERE UPPER(device_instance_id) = ?', (norm_id,))
            row = cursor.fetchone()
            return str(row[0]) if (row and row[0]) else None

    def get_w64_events(self, event_type: Optional[str] = None, provider: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Извлекает системные события W64/ETW."""
        query = 'SELECT raw_json FROM w64_events WHERE 1=1'
        params: List[Any] = []
        if event_type:
            query += ' AND event_type = ?'
            params.append(event_type)
        if provider:
            query += ' AND provider = ?'
            params.append(provider)
        query += ' ORDER BY created_at DESC LIMIT ?'
        params.append(max(1, limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            results = []
            for row in cursor.fetchall():
                try:
                    results.append(json.loads(row[0]))
                except Exception:
                    continue
            return results

    def get_disk_inventory(self, disk_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные физических дисков из таблицы disk_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if disk_id is not None:
                cursor.execute('SELECT * FROM disk_inventory WHERE disk_id = ? ORDER BY disk_id ASC', (disk_id,))
            else:
                cursor.execute('SELECT * FROM disk_inventory ORDER BY disk_id ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_volume_inventory(self) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные логических томов из таблицы volume_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM volume_inventory ORDER BY drive_letter ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_disk_health_history(
        self,
        disk_id: Optional[int] = None,
        serial_number: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей здоровья и износа накопителей."""
        conditions = []
        params: List[Any] = []

        if disk_id is not None:
            conditions.append('disk_id = ?')
            params.append(disk_id)
        if serial_number is not None:
            conditions.append('serial_number = ?')
            params.append(serial_number)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM disk_health_snapshots {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_disk_performance_samples(
        self,
        disk_name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей производительности дисков (IOPS, MB/s)."""
        conditions = []
        params: List[Any] = []

        if disk_name is not None:
            conditions.append('disk_name = ?')
            params.append(disk_name)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM disk_performance_samples {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_disk_io_events(
        self,
        pid: Optional[int] = None,
        disk_id: Optional[int] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает события прямого ввода-вывода процессов."""
        conditions = []
        params: List[Any] = []

        if pid is not None:
            conditions.append('pid = ?')
            params.append(pid)
        if disk_id is not None:
            conditions.append('disk_id = ?')
            params.append(disk_id)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM disk_io_events {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_cpu_inventory(self, processor_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные процессоров из таблицы cpu_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if processor_id is not None:
                cursor.execute('SELECT * FROM cpu_inventory WHERE processor_id = ? ORDER BY processor_id ASC', (processor_id,))
            else:
                cursor.execute('SELECT * FROM cpu_inventory ORDER BY processor_id ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_ram_module_inventory(self) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные физических планок памяти из таблицы ram_module_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM ram_module_inventory ORDER BY slot_id ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_gpu_inventory(self, gpu_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные графических ускорителей из таблицы gpu_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if gpu_id is not None:
                cursor.execute('SELECT * FROM gpu_inventory WHERE gpu_id = ? ORDER BY gpu_id ASC', (gpu_id,))
            else:
                cursor.execute('SELECT * FROM gpu_inventory ORDER BY gpu_id ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_network_adapter_inventory(self) -> List[Dict[str, Any]]:
        """Извлекает паспортные данные сетевых интерфейсов из таблицы network_adapter_inventory."""
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM network_adapter_inventory ORDER BY adapter_id ASC')
            return [dict(row) for row in cursor.fetchall()]

    def get_cpu_telemetry_samples(
        self,
        processor_id: Optional[int] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей нагрузки и температур процессоров."""
        conditions = []
        params: List[Any] = []

        if processor_id is not None:
            conditions.append('processor_id = ?')
            params.append(processor_id)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM cpu_telemetry_samples {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_ram_telemetry_samples(
        self,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей использования оперативной памяти."""
        conditions = []
        params: List[Any] = []

        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM ram_telemetry_samples {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_gpu_telemetry_samples(
        self,
        gpu_id: Optional[int] = None,
        name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей нагрузки, памяти и температур GPU."""
        conditions = []
        params: List[Any] = []

        if gpu_id is not None:
            conditions.append('gpu_id = ?')
            params.append(gpu_id)
        if name is not None:
            conditions.append('name = ?')
            params.append(name)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM gpu_telemetry_samples {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_network_adapter_samples(
        self,
        adapter_name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлекает историю показателей сетевой активности адаптеров."""
        conditions = []
        params: List[Any] = []

        if adapter_name is not None:
            conditions.append('adapter_name = ?')
            params.append(adapter_name)
        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM network_adapter_samples {where_clause} ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
