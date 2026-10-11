# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - Schema (create_inventory_tables)
# =============================================================================
# Description:
#   Таблицы инвентаря оборудования и телеметрических выборок.
#   Вынесено из schema.py при декомпозиции init_database_schema (этап 4 ТЗ оптимизации).
#   Порядок создания таблиц сохраняется вызовом из init_database_schema.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.schema_inventory import create_inventory_tables
#
#     create_inventory_tables(conn.cursor())
#
# File: schema_inventory.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 12:00:00
# =============================================================================

from __future__ import annotations

"""Таблицы инвентаря оборудования и телеметрических выборок."""

import sqlite3


def create_inventory_tables(cursor: sqlite3.Cursor) -> None:
    """Таблицы инвентаря оборудования и телеметрических выборок.

    Args:
        cursor: Курсор активного соединения SQLite.
    """
    # 33. Паспорт процессоров (cpu_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cpu_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            processor_id INTEGER NOT NULL,
            name TEXT UNIQUE NOT NULL,
            vendor TEXT,
            architecture TEXT,
            physical_cores INTEGER,
            logical_cores INTEGER,
            base_frequency_mhz REAL,
            max_frequency_mhz REAL,
            l2_cache_kb INTEGER,
            l3_cache_kb INTEGER,
            socket TEXT,
            features_json TEXT,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 34. Паспорт планок памяти (ram_module_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ram_module_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_id INTEGER NOT NULL,
            bank_label TEXT NOT NULL,
            device_locator TEXT,
            serial_number TEXT UNIQUE,
            part_number TEXT,
            manufacturer TEXT,
            capacity_bytes INTEGER,
            capacity_gb REAL,
            speed_mhz INTEGER,
            memory_type TEXT,
            form_factor TEXT,
            configured_voltage REAL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 35. Паспорт графических ускорителей (gpu_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gpu_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gpu_id INTEGER NOT NULL,
            pci_device_id TEXT UNIQUE,
            name TEXT NOT NULL,
            vendor TEXT,
            driver_version TEXT,
            driver_date TEXT,
            vram_bytes INTEGER,
            vram_gb REAL,
            pci_bus_id TEXT,
            bios_version TEXT,
            cuda_cores INTEGER,
            directml_supported INTEGER DEFAULT 1,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 36. Паспорт сетевых интерфейсов (network_adapter_inventory)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS network_adapter_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adapter_id INTEGER NOT NULL,
            adapter_guid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            interface_name TEXT,
            mac_address TEXT,
            adapter_type TEXT,
            is_physical INTEGER DEFAULT 1,
            is_wireless INTEGER DEFAULT 0,
            max_speed_mbps INTEGER,
            driver_name TEXT,
            driver_version TEXT,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
    ''')

    # 37. Сэмплы телеметрии процессора (cpu_telemetry_samples)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cpu_telemetry_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            processor_id INTEGER DEFAULT 0,
            total_percent REAL,
            user_percent REAL,
            kernel_percent REAL,
            frequency_mhz REAL,
            temperature_c REAL,
            package_power_w REAL,
            core_utilization_json TEXT,
            core_temperatures_json TEXT
        );
    ''')

    # 38. Сэмплы телеметрии оперативной памяти (ram_telemetry_samples)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ram_telemetry_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            total_bytes INTEGER,
            total_gb REAL,
            used_bytes INTEGER,
            used_gb REAL,
            available_bytes INTEGER,
            available_gb REAL,
            percent_used REAL,
            swap_total_gb REAL,
            swap_used_gb REAL,
            swap_percent REAL,
            pool_paged_mb REAL,
            pool_nonpaged_mb REAL
        );
    ''')

    # 39. Сэмплы телеметрии GPU (gpu_telemetry_samples)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gpu_telemetry_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            gpu_id INTEGER DEFAULT 0,
            name TEXT NOT NULL,
            load_percent REAL,
            memory_used_mb REAL,
            memory_total_mb REAL,
            memory_percent REAL,
            temperature_gpu_c REAL,
            temperature_memory_c REAL,
            fan_speed_pct REAL,
            power_draw_w REAL,
            clock_graphics_mhz REAL,
            clock_memory_mhz REAL
        );
    ''')

    # 40. Сэмплы сетевых интерфейсов (network_adapter_samples)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS network_adapter_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            created_at REAL NOT NULL,
            adapter_name TEXT NOT NULL,
            bytes_recv_sec REAL,
            bytes_sent_sec REAL,
            packets_recv_sec REAL,
            packets_sent_sec REAL,
            errors_in_sec REAL,
            errors_out_sec REAL,
            link_speed_mbps INTEGER,
            is_connected INTEGER DEFAULT 1
        );
    ''')
