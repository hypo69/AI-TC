# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetryInventoryStorageMixin
# =============================================================================
# Description:
#   Миксин фасада хранилища: инвентаризация и выборки дисков, томов, CPU, RAM, GPU и сетевых адаптеров.
#   Вынесено при декомпозиции TelemetryStorage (этап 4 ТЗ оптимизации).
#   Атрибуты хоста: _reader, _writer, _buffer, _maintenance, _aggregator, _cm.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.storage_inventory import TelemetryInventoryStorageMixin
#
#     class TelemetryStorage(TelemetryInventoryStorageMixin): ...
#
# File: storage_inventory.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин фасада хранилища: инвентаризация и выборки дисков, томов, CPU, RAM, GPU и сетевых адаптеров."""

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


class TelemetryInventoryStorageMixin:
    """Миксин фасада хранилища: инвентаризация и выборки дисков, томов, CPU, RAM, GPU и сетевых адаптеров."""

    def save_disk_inventory(self, disk_data: Any) -> None:
        """Сохранить или обновить паспорт физического накопителя."""
        rec = {'type': 'disk_inventory', 'data': disk_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_volume_inventory(self, volume_data: Any) -> None:
        """Сохранить или обновить паспорт логического тома."""
        rec = {'type': 'volume_inventory', 'data': volume_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_disk_health_snapshot(self, health_data: Any) -> None:
        """Сохранить снимок здоровья / SMART / TBW накопителя."""
        rec = {'type': 'disk_health', 'data': health_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_disk_performance_sample(self, perf_data: Any) -> None:
        """Сохранить сэмпл производительности диска."""
        rec = {'type': 'disk_performance', 'data': perf_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_disk_io_event(self, io_event_data: Any) -> None:
        """Сохранить событие прямого ввода-вывода."""
        rec = {'type': 'disk_io_event', 'data': io_event_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def get_disk_inventory(self, disk_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные физических дисков."""
        return self._reader.get_disk_inventory(disk_id=disk_id)

    def get_volume_inventory(self) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные логических томов."""
        return self._reader.get_volume_inventory()

    def get_disk_health_history(
        self,
        disk_id: Optional[int] = None,
        serial_number: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь историю здоровья и SMART/TBW накопителей."""
        return self._reader.get_disk_health_history(disk_id=disk_id, serial_number=serial_number, limit=limit, since_epoch=since_epoch)

    def get_disk_performance_samples(
        self,
        disk_name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь сэмплы производительности дисков."""
        return self._reader.get_disk_performance_samples(disk_name=disk_name, limit=limit, since_epoch=since_epoch)

    def get_disk_io_events(
        self,
        pid: Optional[int] = None,
        disk_id: Optional[int] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь события ввода-вывода процессов."""
        return self._reader.get_disk_io_events(pid=pid, disk_id=disk_id, limit=limit, since_epoch=since_epoch)

    def save_cpu_inventory(self, cpu_data: Any) -> None:
        """Сохранить или обновить паспорт процессора."""
        rec = {'type': 'cpu_inventory', 'data': cpu_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_cpu_telemetry_sample(self, sample_data: Any) -> None:
        """Сохранить снимок телеметрии процессора."""
        rec = {'type': 'cpu_telemetry', 'data': sample_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def get_cpu_inventory(self, processor_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные процессоров."""
        return self._reader.get_cpu_inventory(processor_id=processor_id)

    def get_cpu_telemetry_samples(
        self,
        processor_id: Optional[int] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь историю метрик процессора."""
        return self._reader.get_cpu_telemetry_samples(processor_id=processor_id, limit=limit, since_epoch=since_epoch)

    def save_ram_module_inventory(self, module_data: Any) -> None:
        """Сохранить или обновить паспорт планки оперативной памяти."""
        rec = {'type': 'ram_module_inventory', 'data': module_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_ram_telemetry_sample(self, sample_data: Any) -> None:
        """Сохранить снимок телеметрии оперативной памяти."""
        rec = {'type': 'ram_telemetry', 'data': sample_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def get_ram_module_inventory(self) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные физических планок оперативной памяти."""
        return self._reader.get_ram_module_inventory()

    def get_ram_telemetry_samples(
        self,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь историю метрик оперативной памяти."""
        return self._reader.get_ram_telemetry_samples(limit=limit, since_epoch=since_epoch)

    def save_gpu_inventory(self, gpu_data: Any) -> None:
        """Сохранить или обновить паспорт графического ускорителя."""
        rec = {'type': 'gpu_inventory', 'data': gpu_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_gpu_telemetry_sample(self, sample_data: Any) -> None:
        """Сохранить снимок телеметрии графического ускорителя."""
        rec = {'type': 'gpu_telemetry', 'data': sample_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def get_gpu_inventory(self, gpu_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные GPU."""
        return self._reader.get_gpu_inventory(gpu_id=gpu_id)

    def get_gpu_telemetry_samples(
        self,
        gpu_id: Optional[int] = None,
        name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь историю метрик GPU."""
        return self._reader.get_gpu_telemetry_samples(gpu_id=gpu_id, name=name, limit=limit, since_epoch=since_epoch)

    def save_network_adapter_inventory(self, adapter_data: Any) -> None:
        """Сохранить или обновить паспорт сетевого адаптера."""
        rec = {'type': 'network_adapter_inventory', 'data': adapter_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def save_network_adapter_sample(self, sample_data: Any) -> None:
        """Сохранить сэмпл показателей сетевого адаптера."""
        rec = {'type': 'network_adapter_sample', 'data': sample_data}
        if self._buffer.buffer_mode == 'direct':
            self._writer.batch_insert_records([rec])
            return
        self._buffer.enqueue(rec)

    def get_network_adapter_inventory(self) -> List[Dict[str, Any]]:
        """Извлечь паспортные данные сетевых адаптеров."""
        return self._reader.get_network_adapter_inventory()

    def get_network_adapter_samples(
        self,
        adapter_name: Optional[str] = None,
        limit: int = 100,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь сэмплы показателей сетевых адаптеров."""
        return self._reader.get_network_adapter_samples(adapter_name=adapter_name, limit=limit, since_epoch=since_epoch)
