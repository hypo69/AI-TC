# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry - Hardware Tree Builder
# =============================================================================
# Description:
#   Построитель иерархического дерева компонентов (AIDA64-подобная спецификация)
#   на основе WMI/реестра и метрик SystemCollector. Вынесен из collector.py
#   при декомпозиции коллектора (этап 4 ТЗ оптимизации).
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.hardware_tree import HardwareTreeBuilder
#
#     builder = HardwareTreeBuilder(collector)
#     nodes = await builder.build(force=False)
#
# File: hardware_tree.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 04:50:00
# =============================================================================

from __future__ import annotations
"""Построитель дерева аппаратных компонентов."""

import os
import platform
import socket
from typing import TYPE_CHECKING, Any, Dict, List, Optional

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    psutil = None
    PSUTIL_AVAILABLE = False

from logger import logger
from .models import HardwareNode

if TYPE_CHECKING:
    from .collector import SystemCollector


class HardwareTreeBuilder:
    """Строит и кэширует дерево компонентов; метрики берёт у переданного SystemCollector."""

    def __init__(self, collector: SystemCollector) -> None:
        """Инициализирует построитель.

        Args:
            collector: Коллектор, предоставляющий метрики CPU, памяти, дисков, GPU и т.д.
        """
        self._collector = collector
        self._cached: Optional[List[HardwareNode]] = None

    async def build(self, force: bool = False) -> List[HardwareNode]:
        """Generate AIDA64-like hierarchical component specification tree (Async).

        Состояние оборудования сканируется 1 раз при запуске процесса или по отдельному запросу (force=True).

        Args:
            force: Принудительный повторный опрос оборудования.

        Returns:
            List[HardwareNode]: Hardware devices grouped by category.
        """
        if not force and self._cached is not None:
            return self._cached
        if os.name == 'nt':
            try:
                import pythoncom
                pythoncom.CoInitialize()
            except Exception as e:
                logger.debug(f'[HardwareTree] CoInitialize warning: {e}')
        nodes: List[HardwareNode] = []
        ident = self._collector.get_system_identity()
        system_props = {
            'Компьютер (Host)': ident.get('hostname', ''),
            'Пользователь': ident.get('username', ''),
            'Версия Windows': platform.version(),
            'Номер сборки': ident.get('os_build', ''),
            'Дата установки ОС': ident.get('os_install_date', ''),
            'Язык системы': ident.get('system_language', ''),
            'Язык установки (Оригинал)': ident.get('os_install_language', ''),
            'Локали': f"User: {ident.get('user_locale', '')} | Sys: {ident.get('system_locale', '')}",
            'Часовой пояс': ident.get('timezone', ''),
            'Кодировки': ident.get('codepage', ''),
            'Языки ввода': ', '.join(ident.get('input_languages', [])),
            'Архитектура': platform.machine(),
            'Среда Python': platform.python_version()
        }
        nodes.append(HardwareNode(category='System', name=f"{ident.get('hostname')} ({platform.system()} {platform.release()})", properties=system_props))
        cpu = await self._collector.get_cpu_metrics()
        cpu_props: Dict[str, Any] = {'Модель процессора': cpu.model, 'Физические ядра': cpu.physical_cores, 'Логические потоки': cpu.logical_cores, 'Базовая частота': f'{cpu.frequency_mhz} MHz', 'Архитектура': cpu.architecture}
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for p in wmi_obj.InstancesOf('Win32_Processor'):
                    if getattr(p, 'SocketDesignation', None):
                        cpu_props['Разъем (Socket)'] = p.SocketDesignation
                    if getattr(p, 'L2CacheSize', None):
                        cpu_props['Кэш L2'] = f'{round(p.L2CacheSize / 1024, 1)} MB ({p.L2CacheSize} KB)'
                    if getattr(p, 'L3CacheSize', None):
                        cpu_props['Кэш L3'] = f'{round(p.L3CacheSize / 1024, 1)} MB ({p.L3CacheSize} KB)'
                    if getattr(p, 'MaxClockSpeed', None):
                        cpu_props['Макс. частота'] = f'{p.MaxClockSpeed} MHz'
                    if getattr(p, 'Manufacturer', None):
                        cpu_props['Производитель'] = p.Manufacturer
                    break
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI Win32_Processor warning: {e}')
        nodes.append(HardwareNode(category='Processor (CPU)', name=cpu.model, properties=cpu_props))
        if os.name == 'nt':
            mb_props: Dict[str, Any] = {}
            mb_name = ''
            mb_mfg = ''
            try:
                import winreg
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 'HARDWARE\\DESCRIPTION\\System\\BIOS') as key:
                    mb_mfg, _ = winreg.QueryValueEx(key, 'BaseBoardManufacturer')
                    mb_name, _ = winreg.QueryValueEx(key, 'BaseBoardProduct')
                    bios_ver, _ = winreg.QueryValueEx(key, 'BIOSVersion')
                    if mb_mfg:
                        mb_props['Производитель платы'] = mb_mfg
                    if mb_name:
                        mb_props['Модель платы'] = mb_name
                    if bios_ver:
                        mb_props['Версия BIOS'] = bios_ver
            except Exception:
                pass
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for b in wmi_obj.InstancesOf('Win32_BaseBoard'):
                    if getattr(b, 'Manufacturer', None):
                        mb_props['Производитель платы'] = b.Manufacturer
                    if getattr(b, 'Product', None):
                        mb_props['Модель платы'] = b.Product
                    if getattr(b, 'SerialNumber', None):
                        mb_props['Серийный номер платы'] = (b.SerialNumber or '').strip()
                    if getattr(b, 'Version', None):
                        mb_props['Ревизия / Версия'] = b.Version
                    mb_name = mb_props.get('Модель платы', mb_name)
                    mb_mfg = mb_props.get('Производитель платы', mb_mfg)
                    break
                for bios in wmi_obj.InstancesOf('Win32_BIOS'):
                    if getattr(bios, 'Manufacturer', None):
                        mb_props['Производитель BIOS'] = bios.Manufacturer
                    if getattr(bios, 'SMBIOSBIOSVersion', None):
                        mb_props['Версия SMBIOS BIOS'] = bios.SMBIOSBIOSVersion
                    if getattr(bios, 'ReleaseDate', None):
                        rel_date = str(bios.ReleaseDate)[:8]
                        if len(rel_date) == 8:
                            mb_props['Дата выпуска BIOS'] = f'{rel_date[6:8]}.{rel_date[4:6]}.{rel_date[0:4]}'
                        else:
                            mb_props['Дата выпуска BIOS'] = str(bios.ReleaseDate)
                    break
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI BaseBoard/BIOS warning: {e}')
            if mb_props:
                nodes.append(HardwareNode(category='Motherboard', name=f'{mb_mfg} {mb_name}'.strip() or 'Motherboard', properties=mb_props))
        mem = self._collector.get_memory_metrics()
        mem_overview_props: Dict[str, Any] = {'Общий объем RAM': f'{mem.total_gb} GB', 'Доступная память': f'{mem.available_gb} GB', 'Файл подкачки (Swap)': f'{mem.swap_total_gb} GB'}
        ram_modules_found = 0
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                total_slots = 0
                max_capacity_str = ''
                for arr in wmi_obj.InstancesOf('Win32_PhysicalMemoryArray'):
                    if getattr(arr, 'MemoryDevices', None):
                        total_slots = int(arr.MemoryDevices)
                        mem_overview_props['Слотов памяти на плате'] = total_slots
                    if getattr(arr, 'MaxCapacity', None):
                        max_gb = round(int(arr.MaxCapacity) / 1024 ** 2, 1)
                        max_capacity_str = f'{max_gb} GB'
                        mem_overview_props['Макс. поддерживаемый объем'] = max_capacity_str
                    break
                type_map = {20: 'DDR', 21: 'DDR2', 22: 'DDR2 FB-DIMM', 24: 'DDR3', 26: 'DDR4', 27: 'LPDDR', 28: 'LPDDR2', 29: 'LPDDR3', 30: 'LPDDR4', 34: 'DDR5', 35: 'LPDDR5'}
                form_map = {8: 'DIMM (Desktop)', 12: 'SODIMM (Laptop)', 9: 'TSOP', 10: 'PGA', 11: 'RIMM'}

                raw_modules = list(wmi_obj.InstancesOf('Win32_PhysicalMemory'))
                ram_modules_found = len(raw_modules)
                module_speeds = [int(getattr(m, 'Speed', 0) or 0) for m in raw_modules if getattr(m, 'Speed', 0)]
                module_clocks = [int(getattr(m, 'ConfiguredClockSpeed', 0) or getattr(m, 'Speed', 0) or 0) for m in raw_modules if (getattr(m, 'ConfiguredClockSpeed', 0) or getattr(m, 'Speed', 0))]
                max_module_speed = max(module_speeds) if module_speeds else 0
                min_module_speed = min(module_speeds) if module_speeds else 0

                for idx, m in enumerate(raw_modules):
                    cap_bytes = int(getattr(m, 'Capacity', 0) or 0)
                    cap_gb = round(cap_bytes / 1024 ** 3, 1)
                    smbios_type = int(getattr(m, 'SMBIOSMemoryType', 0) or 0)
                    mem_type = type_map.get(smbios_type, f'DDR (Тип {smbios_type})' if smbios_type else 'DDR')
                    form_code = int(getattr(m, 'FormFactor', 0) or 0)
                    form_name = form_map.get(form_code, 'DIMM')
                    mfg = (getattr(m, 'Manufacturer', '') or '').strip()
                    if mfg == '04CB000080CE':
                        mfg_display = 'ADATA / Micron (04CB)'
                    elif mfg:
                        mfg_display = mfg
                    else:
                        mfg_display = 'Не определен'
                    sn = (getattr(m, 'SerialNumber', '') or '').strip() or 'N/A'
                    pn = (getattr(m, 'PartNumber', '') or '').strip() or 'N/A'
                    speed = getattr(m, 'Speed', 0) or 0
                    clock = getattr(m, 'ConfiguredClockSpeed', 0) or speed
                    locator = (getattr(m, 'DeviceLocator', '') or f'DIMM {idx + 1}').strip()
                    bank = (getattr(m, 'BankLabel', '') or '').strip()

                    # Определение статуса согласования частот и выявление узких мест
                    if speed and clock and clock < speed:
                        compat_status = f'⚠️ Потенциал не раскрыт: планка рассчитана на {speed} MHz, но контроллер/BIOS ограничил до {clock} MHz (потеря {speed - clock} MHz)'
                        freq_warning = f' (⚠️ занижена на {speed - clock} MHz)'
                        eff_percent = f'{round((clock / speed) * 100, 1)}% от номинала планки'
                    elif max_module_speed and speed and speed < max_module_speed:
                        compat_status = f'⚠️ Узкое место: планка {speed} MHz медленнее других модулей ({max_module_speed} MHz), снижает общую частоту'
                        freq_warning = ''
                        eff_percent = '100% (номинал)'
                    else:
                        compat_status = f'✅ Оптимально: планка работает на паспортной частоте ({clock} MHz)'
                        freq_warning = ''
                        eff_percent = '100% (номинал)'

                    module_props: Dict[str, Any] = {
                        'Слот / Разъем (Locator)': locator,
                        'Объем планки': f'{cap_gb} GB ({cap_bytes:,} байт)',
                        'Номинальная частота': f'{speed} MHz' if speed else 'N/A',
                        'Текущая рабочая частота': f'{clock} MHz{freq_warning}' if clock else 'N/A',
                        'Эффективность планки': eff_percent,
                        'Состояние согласования частоты': compat_status,
                        'Тип памяти': f'{mem_type} (SMBIOS {smbios_type})',
                        'Форм-фактор': form_name,
                        'Производитель': mfg_display,
                        'Серийный номер (S/N)': sn,
                        'Парт-номер (P/N)': pn,
                    }
                    if bank:
                        module_props['Банк памяти (Bank)'] = bank
                    nodes.append(HardwareNode(category='Memory Module (RAM)', name=f'Планка {idx + 1} ({locator}): {cap_gb} GB {mem_type}-{speed or clock}', properties=module_props))
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI PhysicalMemory query warning: {e}')
        if ram_modules_found > 0:
            mem_overview_props['Установлено модулей'] = f'{ram_modules_found} шт.'
            if total_slots > 0:
                free_slots = max(0, total_slots - ram_modules_found)
                mem_overview_props['Конфигурация слотов'] = f'Занято {ram_modules_found} из {total_slots} (свободно: {free_slots})'
            if module_clocks and module_speeds:
                min_c = min(module_clocks)
                max_s = max(module_speeds)
                if min_c < max_s:
                    mem_overview_props['Статус частоты памяти'] = f'⚠️ Частота шины занижена до {min_c} MHz (потенциал планок: {max_s} MHz, проверьте XMP/BIOS)'
                else:
                    mem_overview_props['Статус частоты памяти'] = f'✅ Оптимальный ({min_c} MHz, 100% номинала)'
        nodes.append(HardwareNode(category='System Memory', name=f'{mem.total_gb} GB Physical RAM', properties=mem_overview_props))
        wmi_video_map: Dict[str, Dict[str, Any]] = {}
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for v in wmi_obj.InstancesOf('Win32_VideoController'):
                    v_name = (getattr(v, 'Name', '') or '').strip()
                    v_pnp = (getattr(v, 'PNPDeviceID', '') or '').strip()
                    v_mfg = (getattr(v, 'AdapterCompatibility', '') or '').strip()
                    v_drv_ver = (getattr(v, 'DriverVersion', '') or '').strip()
                    v_drv_date_raw = getattr(v, 'DriverDate', None)
                    v_drv_date = ''
                    if v_drv_date_raw:
                        ds = str(v_drv_date_raw)[:8]
                        if len(ds) == 8 and ds.isdigit():
                            v_drv_date = f'{ds[6:8]}.{ds[4:6]}.{ds[0:4]}'
                    v_proc = (getattr(v, 'VideoProcessor', '') or '').strip()
                    v_mode = (getattr(v, 'VideoModeDescription', '') or '').strip()
                    v_refresh = getattr(v, 'CurrentRefreshRate', None)
                    v_status = (getattr(v, 'Status', '') or 'OK').strip()
                    info_dict = {'name': v_name, 'mfg': v_mfg, 'drv_ver': v_drv_ver, 'drv_date': v_drv_date, 'proc': v_proc, 'mode': v_mode, 'refresh': v_refresh, 'status': v_status, 'pnp': v_pnp}
                    if v_name:
                        wmi_video_map[v_name.lower()] = info_dict
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI VideoController query warning: {e}')
        gpus = self._collector.get_gpu_metrics()
        for idx, gpu in enumerate(gpus):
            v_extra = wmi_video_map.get(gpu.name.lower(), {})
            gpu_mfg = gpu.vendor or v_extra.get('mfg') or ('NVIDIA' if 'geforce' in gpu.name.lower() or 'nvidia' in gpu.name.lower() else 'Intel' if 'intel' in gpu.name.lower() else 'AMD' if 'radeon' in gpu.name.lower() else 'Unknown')
            drv_ver = v_extra.get('drv_ver')
            drv_date = v_extra.get('drv_date')
            vproc = v_extra.get('proc')
            vmode = v_extra.get('mode')

            # Форматирование памяти
            if gpu.dedicated_memory_mb and gpu.dedicated_memory_mb >= 1024:
                ded_str = f'{round(gpu.dedicated_memory_mb / 1024.0, 1)} GB'
            elif gpu.dedicated_memory_mb:
                ded_str = f'{int(gpu.dedicated_memory_mb)} MB'
            else:
                ded_str = f'{gpu.memory_total_gb} GB'

            if gpu.shared_memory_mb and gpu.shared_memory_mb >= 1024:
                shared_str = f'{round(gpu.shared_memory_mb / 1024.0, 1)} GB'
            elif gpu.shared_memory_mb:
                shared_str = f'{int(gpu.shared_memory_mb)} MB'
            else:
                shared_str = '0 MB'

            total_mem_str = (
                f'{round((gpu.dedicated_memory_mb + gpu.shared_memory_mb) / 1024.0, 1)} GB'
                if (gpu.dedicated_memory_mb + gpu.shared_memory_mb > 0)
                else f'{gpu.memory_total_gb} GB'
            )

            gpu_props: Dict[str, Any] = {
                'Индекс устройства': idx,
                'Модель видеокарты': gpu.name,
                'Производитель (Вендор)': gpu_mfg,
                'Тип GPU': gpu.gpu_type or 'Discrete',
                'Видеопамять (VRAM)': f'{gpu.memory_total_gb} GB',
                'Общая память GPU': total_mem_str,
                'Выделенная VRAM': ded_str,
                'Shared GPU Memory': shared_str,
                'Тип памяти': gpu.memory_type or 'Dedicated VRAM',
                'Поддержка DirectX': gpu.directx_version or 'DirectX 12',
            }
            if vproc:
                gpu_props['Видеопроцессор'] = vproc
            if drv_ver:
                gpu_props['Версия драйвера'] = drv_ver
            if drv_date:
                gpu_props['Дата драйвера'] = drv_date
            if vmode:
                gpu_props['Текущий видеорежим'] = vmode
            elif v_extra.get('refresh'):
                gpu_props['Частота обновления'] = f"{v_extra['refresh']} Hz"
            gpu_props['Поддержка CUDA'] = 'Да' if gpu.has_cuda else 'Нет'
            gpu_props['Поддержка ROCm'] = 'Да' if gpu.has_rocm else 'Нет'
            gpu_props['Поддержка DirectML'] = 'Да' if gpu.has_directml else 'Нет'
            gpu_props['Поддержка Vulkan'] = 'Да' if gpu.has_vulkan else 'Нет'
            gpu_props['Поддержка OpenCL'] = 'Да' if gpu.has_opencl else 'Нет'
            if gpu.has_oneapi:
                gpu_props['Поддержка oneAPI'] = 'Да'
            if gpu.compute_apis:
                gpu_props['Вычислительные API'] = ', '.join(gpu.compute_apis)
            if gpu.ai_backends:
                gpu_props['AI Бэкенды'] = ', '.join(gpu.ai_backends)
            gpu_props['Статус устройства'] = v_extra.get('status', 'OK (Активно)')
            if v_extra.get('pnp'):
                gpu_props['Идентификатор PnP'] = v_extra['pnp']
            nodes.append(HardwareNode(category='Display Adapter', name=gpu.name, properties=gpu_props))
        npus = self._collector.get_npu_metrics()
        for idx, npu in enumerate(npus):
            npu_props: Dict[str, Any] = {
                'Индекс устройства': idx,
                'Модель NPU': npu.name,
                'Производитель (Вендор)': npu.vendor,
                'Тип устройства': 'Нейропроцессор (NPU / AI Accelerator)',
                'Статус устройства': npu.status,
            }
            if npu.driver_version:
                npu_props['Версия драйвера'] = npu.driver_version
            if npu.pnp_device_id:
                npu_props['Идентификатор PnP'] = npu.pnp_device_id
            if npu.tops:
                npu_props['Производительность (TOPS)'] = f'{npu.tops} TOPS'
            nodes.append(HardwareNode(category='Neural Processing Unit (NPU)', name=npu.name, properties=npu_props))
        for idx, mon in enumerate(self._collector.get_monitors()):
            nodes.append(HardwareNode(category='Monitors & Displays', name=f'{mon.name} ({mon.width}x{mon.height} @ {mon.frequency_hz}Hz, {mon.orientation})', properties={'Устройство': mon.device, 'Название дисплея': mon.name, 'Ориентация': mon.orientation, 'Подключенный видеоадаптер': mon.adapter or 'Default Adapter', 'Разрешение экрана': f'{mon.width} x {mon.height}', 'Частота развертки': f'{mon.frequency_hz} Hz', 'Глубина цвета': f'{mon.bits_per_pixel}-bit', 'Основной монитор': 'Да (Основной)' if mon.is_primary else 'Нет (Вторичный)'}))
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for d in wmi_obj.InstancesOf('Win32_DiskDrive'):
                    size_bytes = int(getattr(d, 'Size', 0) or 0)
                    size_gb = round(size_bytes / 1024 ** 3, 1)
                    model = (getattr(d, 'Model', '') or 'Hard Disk').strip()
                    iface = (getattr(d, 'InterfaceType', '') or 'SCSI/SATA').strip()
                    media = (getattr(d, 'MediaType', '') or 'Fixed hard disk media').strip()
                    sn = (getattr(d, 'SerialNumber', '') or '').strip() or 'N/A'
                    firmware = (getattr(d, 'FirmwareRevision', '') or '').strip()
                    parts = getattr(d, 'Partitions', 0) or 1
                    status = (getattr(d, 'Status', '') or 'OK').strip()
                    model_l = model.lower()
                    if 'samsung' in model_l:
                        disk_mfg = 'Samsung'
                    elif 'crucial' in model_l or model_l.startswith('ct'):
                        disk_mfg = 'Crucial / Micron'
                    elif 'toshiba' in model_l or model_l.startswith('hdwd') or model_l.startswith('dt01'):
                        disk_mfg = 'Toshiba'
                    elif 'wdc' in model_l or model_l.startswith('wd') or 'western digital' in model_l:
                        disk_mfg = 'Western Digital'
                    elif 'kingston' in model_l or model_l.startswith('sa400') or model_l.startswith('skc'):
                        disk_mfg = 'Kingston'
                    elif 'seagate' in model_l or model_l.startswith('st'):
                        disk_mfg = 'Seagate'
                    elif 'sandisk' in model_l:
                        disk_mfg = 'SanDisk'
                    elif 'kioxia' in model_l:
                        disk_mfg = 'Kioxia'
                    elif 'intel' in model_l:
                        disk_mfg = 'Intel'
                    elif 'micron' in model_l:
                        disk_mfg = 'Micron'
                    elif 'sk hynix' in model_l or 'hynix' in model_l:
                        disk_mfg = 'SK Hynix'
                    else:
                        disk_mfg = 'Универсальный накопитель'
                    disk_props: Dict[str, Any] = {'Модель накопителя': model, 'Производитель (Бренд)': disk_mfg, 'Интерфейс подключения': iface, 'Тип носителя': media, 'Емкость': f'{size_gb} GB ({size_bytes:,} байт)', 'Серийный номер (S/N)': sn}
                    if firmware:
                        disk_props['Версия прошивки (Firmware)'] = firmware
                    disk_props['Число разделов'] = parts
                    disk_props['Статус S.M.A.R.T.'] = status
                    nodes.append(HardwareNode(category='Physical Disk', name=f'{model} ({size_gb} GB)', properties=disk_props))
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI DiskDrive query warning: {e}')
        partitions, _ = self._collector.get_disk_metrics()
        for part in partitions:
            nodes.append(HardwareNode(category='Storage Volume', name=f'Раздел {part.device} ({part.total_gb} GB)', properties={'Дисковый том': part.device, 'Точка монтирования': part.mountpoint, 'Файловая система': part.fstype, 'Общий объем': f'{part.total_gb} GB', 'Свободное место': f'{part.free_gb} GB', 'Занято памяти': f'{part.used_gb} GB ({part.percent}%)'}))
        wmi_net_adapters: Dict[str, Dict[str, Any]] = {}
        wmi_net_configs: Dict[str, Any] = {}
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for cfg in wmi_obj.InstancesOf('Win32_NetworkAdapterConfiguration'):
                    cdesc = (getattr(cfg, 'Description', '') or '').strip()
                    if cdesc:
                        wmi_net_configs[cdesc.lower()] = cfg
                for a in wmi_obj.InstancesOf('Win32_NetworkAdapter'):
                    net_id = (getattr(a, 'NetConnectionID', '') or '').strip()
                    aname = (getattr(a, 'Name', '') or '').strip()
                    adesc = (getattr(a, 'Description', '') or '').strip()
                    apnp = (getattr(a, 'PNPDeviceID', '') or '').strip()
                    amfg = (getattr(a, 'Manufacturer', '') or '').strip()
                    amac = (getattr(a, 'MACAddress', '') or '').strip()
                    aspeed = getattr(a, 'Speed', None)
                    atype = (getattr(a, 'AdapterType', '') or '').strip()
                    astatus_num = getattr(a, 'NetConnectionStatus', None)
                    aphys = getattr(a, 'PhysicalAdapter', False)
                    item = {'net_id': net_id, 'name': aname, 'desc': adesc, 'pnp': apnp, 'mfg': amfg, 'mac': amac, 'speed': aspeed, 'ad_type': atype, 'status_num': astatus_num, 'is_phys': aphys}
                    if net_id:
                        wmi_net_adapters[net_id.lower()] = item
                    if aname:
                        wmi_net_adapters[aname.lower()] = item
                    if adesc:
                        wmi_net_adapters[adesc.lower()] = item
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI NetworkAdapter query warning: {e}')
        if PSUTIL_AVAILABLE:
            ps_addrs = psutil.net_if_addrs()
            ps_stats = psutil.net_if_stats()
            for if_name, addr_list in ps_addrs.items():
                stat = ps_stats.get(if_name)
                w_info = wmi_net_adapters.get(if_name.lower(), {})
                cfg = wmi_net_configs.get(w_info.get('desc', '').lower()) or wmi_net_configs.get(if_name.lower())
                mac_addr = w_info.get('mac')
                if not mac_addr:
                    for a in addr_list:
                        fam_name = getattr(a.family, 'name', '')
                        if fam_name == 'AF_LINK' or a.family == -1 or a.family == getattr(psutil, 'AF_LINK', -1):
                            if a.address and len(a.address) in (12, 17):
                                mac_addr = a.address.replace('-', ':').upper()
                                break
                ipv4_list = [a.address for a in addr_list if a.family == socket.AF_INET]
                ipv6_list = [a.address.split('%')[0] for a in addr_list if hasattr(socket, 'AF_INET6') and a.family == socket.AF_INET6]
                gateways = list(getattr(cfg, 'DefaultIPGateway', []) or []) if cfg else []
                dhcp_server = getattr(cfg, 'DHCPServer', None) if cfg else None
                dhcp_enabled = getattr(cfg, 'DHCPEnabled', None) if cfg else None
                dns_servers = list(getattr(cfg, 'DNSServerSearchOrder', []) or []) if cfg else []
                is_up = stat.isup if stat else True
                status_num = w_info.get('status_num')
                if status_num == 2 or (status_num is None and is_up):
                    status_str = 'Активно (Up)'
                elif status_num == 7:
                    status_str = 'Кабель не подключен (Disconnected)'
                elif status_num == 0:
                    status_str = 'Отключено (Disabled)'
                elif not is_up:
                    status_str = 'Не активно (Down)'
                else:
                    status_str = 'Активно (Up)'
                speed_mbps = 0
                if stat and stat.speed and (stat.speed > 0) and (stat.speed < 1000000):
                    speed_mbps = stat.speed
                elif w_info.get('speed'):
                    try:
                        raw_spd = int(w_info['speed'])
                        if raw_spd < 100000000000:
                            speed_mbps = round(raw_spd / 1000000)
                    except Exception:
                        pass
                if speed_mbps > 0:
                    if speed_mbps >= 1000:
                        speed_str = f'{speed_mbps} Mbps ({round(speed_mbps / 1000, 1)} Gbps)'
                    else:
                        speed_str = f'{speed_mbps} Mbps'
                else:
                    speed_str = 'Автоопределение (0 Mbps)' if not is_up else '1000 Mbps (Авто)'
                model_name = w_info.get('name') or w_info.get('desc') or if_name
                mfg_val = w_info.get('mfg')
                if not mfg_val:
                    if 'intel' in if_name.lower() or 'intel' in model_name.lower():
                        mfg_val = 'Intel Corporation'
                    elif 'realtek' in if_name.lower() or 'realtek' in model_name.lower():
                        mfg_val = 'Realtek'
                    elif 'vethernet' in if_name.lower() or 'hyper-v' in model_name.lower() or 'microsoft' in model_name.lower() or ('local area connection*' in if_name.lower()):
                        mfg_val = 'Microsoft Corporation'
                    else:
                        mfg_val = 'Универсальный сетевой контроллер'
                name_l = if_name.lower()
                desc_l = (w_info.get('desc') or '').lower()
                if 'local area connection*' in name_l:
                    adapter_type = 'Виртуальный адаптер Wi-Fi Direct'
                    if model_name == if_name:
                        model_name = f'Microsoft Wi-Fi Direct Virtual Adapter ({if_name})'
                elif 'wi-fi' in name_l or 'wireless' in desc_l or '802.11' in desc_l:
                    adapter_type = 'Беспроводной адаптер (Wi-Fi 802.11)'
                elif 'bluetooth' in name_l or 'bluetooth' in desc_l:
                    adapter_type = 'Bluetooth PAN адаптер'
                elif 'vethernet' in name_l or 'virtual' in desc_l or 'hyper-v' in desc_l:
                    adapter_type = 'Виртуальный сетевой адаптер (Hyper-V / WSL)'
                elif 'loopback' in name_l:
                    adapter_type = 'Программный интерфейс Loopback'
                elif 'tap' in name_l or 'tun' in name_l or 'vpn' in name_l:
                    adapter_type = 'VPN / Туннельный адаптер'
                else:
                    adapter_type = 'Сетевая карта Ethernet (LAN)'
                net_props: Dict[str, Any] = {'Имя подключения': if_name, 'Модель адаптера': model_name, 'Производитель': mfg_val, 'Тип адаптера': adapter_type, 'Физический (MAC) адрес': mac_addr or 'N/A', 'Состояние соединения': status_str, 'Скорость канала': speed_str}
                if stat and getattr(stat, 'duplex', None) is not None:
                    d_val = getattr(stat.duplex, 'value', stat.duplex)
                    if d_val == 2:
                        net_props['Режим дуплекса'] = 'Full Duplex (Полный)'
                    elif d_val == 1:
                        net_props['Режим дуплекса'] = 'Half Duplex (Полудуплекс)'
                if stat and getattr(stat, 'mtu', None):
                    net_props['Размер MTU'] = f'{stat.mtu} байт'
                net_props['IP-адреса (IPv4)'] = ', '.join(ipv4_list) or 'N/A'
                if ipv6_list:
                    net_props['IP-адреса (IPv6)'] = ', '.join(ipv6_list[:3])
                if gateways:
                    net_props['Основной шлюз'] = ', '.join(gateways)
                if dhcp_server or dhcp_enabled is not None:
                    net_props['DHCP сервер'] = dhcp_server or ('Включен (DHCP)' if dhcp_enabled else 'Статический IP / Отключен')
                if dns_servers:
                    net_props['DNS серверы'] = ', '.join(dns_servers)
                if w_info.get('pnp'):
                    net_props['Идентификатор PnP'] = w_info['pnp']
                display_title = f'{if_name}: {model_name}' if model_name != if_name else if_name
                nodes.append(HardwareNode(category='Network Adapter', name=display_title, properties=net_props))
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for s in wmi_obj.InstancesOf('Win32_SoundDevice'):
                    snd_name = (getattr(s, 'Caption', '') or getattr(s, 'Name', '') or '').strip()
                    snd_mfg = (getattr(s, 'Manufacturer', '') or '').strip() or 'Аудиоустройство'
                    snd_status = (getattr(s, 'Status', '') or 'OK').strip()
                    snd_pnp = (getattr(s, 'PNPDeviceID', '') or '').strip()
                    if snd_name:
                        nodes.append(HardwareNode(category='Audio Device', name=snd_name, properties={'Название устройства': snd_name, 'Производитель': snd_mfg, 'Состояние': f'{snd_status} (Работает)', 'Идентификатор PnP': snd_pnp or 'N/A'}))
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI SoundDevice query warning: {e}')
        if os.name == 'nt':
            try:
                import win32com.client
                wmi_obj = win32com.client.GetObject('winmgmts:')
                for u in wmi_obj.InstancesOf('Win32_USBController'):
                    usb_name = (getattr(u, 'Caption', '') or getattr(u, 'Name', '') or '').strip()
                    usb_mfg = (getattr(u, 'Manufacturer', '') or '').strip() or 'USB Контроллер'
                    usb_status = (getattr(u, 'Status', '') or 'OK').strip()
                    usb_pnp = (getattr(u, 'PNPDeviceID', '') or '').strip()
                    if usb_name:
                        nodes.append(HardwareNode(category='USB Controller', name=usb_name, properties={'Название контроллера': usb_name, 'Производитель': usb_mfg, 'Состояние': f'{usb_status} (Работает)', 'Идентификатор PnP': usb_pnp or 'N/A'}))
            except Exception as e:
                logger.debug(f'[HardwareTree] WMI USBController query warning: {e}')
        upd = self._collector.get_updates_info()
        nodes.append(HardwareNode(category='Windows Updates', name=f'{upd.status} ({upd.installed_kb_count} KBs)', properties={'Статус обновлений': upd.status, 'Число установленных исправлений': upd.installed_kb_count, 'Последние KB пакеты': ', '.join(upd.recent_hotfixes) or 'N/A', 'Дата последней установки': upd.latest_installed_on or 'OK'}))
        self._cached = nodes
        return nodes
