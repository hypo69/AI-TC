# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry - Process Metrics Collector
# =============================================================================
# Description:
#   Сборщик метрик активных процессов: рейтинг по ресурсам, токены, классификация запуска.
#   Вынесено из collector.py при декомпозиции SystemCollector (этап 4 ТЗ оптимизации).
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.process_metrics import ProcessMetricsCollector
#
#     component = ProcessMetricsCollector()
#
# File: process_metrics.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 05:00:00
# =============================================================================

from __future__ import annotations
"""Сборщик метрик активных процессов: рейтинг по ресурсам, токены, классификация запуска."""

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    psutil = None
    PSUTIL_AVAILABLE = False

from .models import ProcessMetrics
from .process_token_collector import ProcessTokenCollector


class ProcessMetricsCollector:
    """Сборщик метрик активных процессов: рейтинг по ресурсам, токены, классификация запуска."""

    @staticmethod
    def _classify_launch_reason(
        parent_name: Optional[str],
        process_name: Optional[str] = None,
        session_id: Optional[int] = None,
        cmdline: Optional[str] = None,
    ) -> str:
        """Классификация причины/контекста запуска процесса по его родителю и окружению.

        Args:
            parent_name: Имя родительского процесса.
            process_name: Имя текущего процесса.
            session_id: Номер сессии Windows (0 = системные службы, 1+ = интерактивная сессия).
            cmdline: Командная строка процесса (опционально).

        Returns:
            str: Категория запуска ('service', 'scheduled_task', 'shell_interactive', 'terminal_cli', 'ide_developer', 'system_boot', 'spawned_by_parent', 'unknown').
        """
        p_name = (parent_name or '').lower()
        if p_name in ('services.exe',) or (p_name in ('svchost.exe',) and session_id == 0):
            return 'service'
        if p_name in ('taskeng.exe', 'taskhostw.exe', 'taskhost.exe') or (cmdline and '-task' in cmdline.lower()):
            return 'scheduled_task'
        if p_name in ('explorer.exe',):
            return 'shell_interactive'
        if p_name in ('cmd.exe', 'powershell.exe', 'pwsh.exe', 'wt.exe', 'windowsterminal.exe', 'bash.exe', 'zsh.exe', 'conhost.exe'):
            return 'terminal_cli'
        if p_name in ('code.exe', 'devenv.exe', 'pycharm64.exe', 'idea64.exe', 'rider64.exe', 'cursor.exe', 'windsurf.exe'):
            return 'ide_developer'
        if p_name in ('winlogon.exe', 'userinit.exe', 'smss.exe', 'csrss.exe', 'wininit.exe', 'lsass.exe'):
            return 'system_boot'
        if p_name:
            clean_parent = p_name.replace('.exe', '')
            return f'spawned_by_{clean_parent}'
        return 'unknown'

    def get_top_processes(self, limit: Any = 25, sort_by: str = 'cpu') -> List[ProcessMetrics]:
        """Retrieve active processes sorted by resource consumption, with token and provenance info.

        Args:
            limit: Maximum processes to return (0 for all).
            sort_by: Attribute to sort by ('cpu', 'memory'/'ram', 'handles'/'descriptors').
        Returns:
            List[ProcessMetrics]: Ranked process metrics, including provenance, integrity_level and elevation.
        """
        limit_val = limit.default if hasattr(limit, "default") else (int(limit) if isinstance(limit, (int, float, str)) and str(limit).isdigit() else 25)
        # Collect token information for all processes
        token_collector = ProcessTokenCollector()
        token_info_map = {info.pid: info for info in token_collector.collect()}

        # Классификация оконных процессов
        from apps.windows.sdk.modules.process_manager.core.classifier import (
            ProcessClassifier,
            WINDOWS_SYSTEM_PROCESS_NAMES,
        )
        classifier = ProcessClassifier()
        windowed_pids, titles_map = classifier.get_windowed_pids_and_titles()

        procs: List[ProcessMetrics] = []
        if PSUTIL_AVAILABLE:
            handle_attr = 'num_handles' if os.name == 'nt' else 'num_fds'
            proc_dict: Dict[int, Dict[str, Any]] = {}
            for p in psutil.process_iter(attrs=['pid', 'ppid', 'name', 'cpu_percent', 'memory_info', 'memory_percent', 'num_threads', 'username', 'create_time', 'exe', 'cpu_times', 'io_counters', handle_attr]):
                try:
                    proc_dict[p.info['pid']] = p.info
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            name_to_windowed = {
                (info.get('name') or '').lower(): True
                for p_id, info in proc_dict.items()
                if p_id in windowed_pids
            }

            def _rank_key(info: Dict[str, Any]) -> float:
                """Ключ ранжирования процесса, совпадающий с итоговой сортировкой."""
                sort_key_name = (sort_by or 'cpu').lower()
                if sort_key_name in ('handles', 'descriptors'):
                    return float(info.get(handle_attr) or 0)
                if sort_key_name in ('memory', 'ram'):
                    mem = info.get('memory_info')
                    return round((int(mem.rss) if mem and hasattr(mem, 'rss') else 0) / (1024 * 1024), 1)
                return round(info.get('cpu_percent') or 0.0, 1)

            ranked_pids = sorted(proc_dict, key=lambda pid_: _rank_key(proc_dict[pid_]), reverse=True)
            selected_pids = ranked_pids if limit_val is None or limit_val <= 0 else ranked_pids[:limit_val]

            for pid in selected_pids:
                info = proc_dict[pid]
                try:
                    p_name = info.get('name') or 'unknown'
                    low_name = p_name.lower()
                    exe_low = (info.get('exe') or '').lower()

                    mem_info = info.get('memory_info')
                    rss_bytes = int(mem_info.rss) if mem_info and hasattr(mem_info, 'rss') else 0
                    rss_mb = round(rss_bytes / (1024 * 1024), 1)
                    private_bytes = int(getattr(mem_info, 'vms', 0) or getattr(mem_info, 'private', 0) or 0) if mem_info else 0
                    page_faults = int(getattr(mem_info, 'num_page_faults', 0) or 0) if mem_info else 0

                    cpu_times = info.get('cpu_times')
                    user_time_ms = int(getattr(cpu_times, 'user', 0) * 1000) if cpu_times else 0
                    kernel_time_ms = int(getattr(cpu_times, 'system', 0) * 1000) if cpu_times else 0

                    io_cnt = info.get('io_counters')
                    rb_total = int(getattr(io_cnt, 'read_bytes', 0) or 0) if io_cnt else 0
                    wb_total = int(getattr(io_cnt, 'write_bytes', 0) or 0) if io_cnt else 0
                    ro_total = int(getattr(io_cnt, 'read_count', 0) or 0) if io_cnt else 0
                    wo_total = int(getattr(io_cnt, 'write_count', 0) or 0) if io_cnt else 0

                    cpu_p = round(info.get('cpu_percent') or 0.0, 1)
                    num_h = info.get(handle_attr) or 0
                    token = token_info_map.get(pid)
                    integrity = token.integrity_level if token else None
                    elevation = token.elevation if token else None
                    sid = token.sid if token else None
                    session_id = token.session_id if token else None

                    ppid = info.get('ppid')
                    parent_info = proc_dict.get(ppid) if ppid else None
                    parent_name = parent_info.get('name') if parent_info else None

                    # Построение цепочки предков
                    ancestors = [p_name or str(pid)]
                    curr_pid = ppid
                    visited = {pid}
                    while curr_pid and curr_pid in proc_dict and curr_pid not in visited:
                        visited.add(curr_pid)
                        curr_p = proc_dict[curr_pid]
                        ancestors.append(curr_p.get('name') or f'PID:{curr_pid}')
                        curr_pid = curr_p.get('ppid')
                    ancestors.reverse()
                    ancestor_chain = ' → '.join(ancestors)

                    create_time_val = info.get('create_time') or 0.0
                    creation_time_str = datetime.fromtimestamp(create_time_val, tz=timezone.utc).isoformat() if create_time_val > 0 else None
                    process_guid = f'proc_{pid}_{int(create_time_val)}'

                    try:
                        proc_handle = psutil.Process(pid)
                        raw_cmdline = proc_handle.cmdline()
                        proc_status = proc_handle.status() or 'running'
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                        raw_cmdline = None
                        proc_status = 'running'
                    cmdline_str = ' '.join(raw_cmdline) if isinstance(raw_cmdline, list) else (str(raw_cmdline) if raw_cmdline else None)
                    launch_reason = self._classify_launch_reason(parent_name, p_name, session_id, cmdline_str)

                    # Классификация категории
                    has_win = pid in windowed_pids
                    is_app = has_win or (low_name in name_to_windowed and low_name not in WINDOWS_SYSTEM_PROCESS_NAMES)
                    if is_app:
                        category = 'app'
                    elif low_name in WINDOWS_SYSTEM_PROCESS_NAMES or ('c:\\windows\\system32' in exe_low and not has_win):
                        category = 'windows'
                    else:
                        category = 'background'

                    win_titles = titles_map.get(pid, [])
                    first_title = win_titles[0] if win_titles else None
                    friendly = classifier._get_friendly_name(p_name, win_titles)

                    procs.append(ProcessMetrics(
                        pid=pid,
                        name=p_name,
                        status=proc_status,
                        cpu_percent=cpu_p,
                        memory_mb=rss_mb,
                        memory_percent=round(info.get('memory_percent') or 0.0, 1),
                        num_threads=info.get('num_threads') or 1,
                        num_handles=num_h,
                        username=info.get('username'),
                        integrity_level=integrity,
                        elevation=elevation,
                        ppid=ppid,
                        parent_name=parent_name,
                        executable_path=info.get('exe'),
                        sid=sid,
                        session_id=session_id,
                        creation_time=creation_time_str,
                        process_guid=process_guid,
                        ancestor_chain=ancestor_chain,
                        launch_reason=launch_reason,
                        category=category,
                        is_app=is_app,
                        friendly_name=friendly,
                        window_title=first_title,
                        user_time_ms=user_time_ms,
                        kernel_time_ms=kernel_time_ms,
                        working_set_bytes=rss_bytes,
                        private_bytes=private_bytes,
                        page_faults_count=page_faults,
                        read_bytes_total=rb_total,
                        write_bytes_total=wb_total,
                        read_ops_total=ro_total,
                        write_ops_total=wo_total,
                    ))
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        else:
            # Fallback for non‑psutil environments
            now_iso = datetime.now(timezone.utc).isoformat()
            p = ProcessMetrics(
                pid=os.getpid(),
                name='python.exe',
                status='running',
                cpu_percent=1.5,
                memory_mb=120.0,
                memory_percent=1.0,
                num_threads=8,
                num_handles=42,
                username=os.getenv('USERNAME', 'SYSTEM'),
                ppid=os.getppid() if hasattr(os, 'getppid') else None,
                parent_name='cmd.exe',
                executable_path=os.path.abspath(__file__),
                sid='S-1-5-21-mock-sid',
                session_id=1,
                creation_time=now_iso,
                process_guid=f'proc_{os.getpid()}_{int(time.time())}',
                ancestor_chain='cmd.exe → python.exe',
                launch_reason='terminal_cli',
                category='background',
                is_app=False,
                friendly_name='Python',
            )
            token = token_info_map.get(p.pid)
            if token:
                p.integrity_level = token.integrity_level
                p.elevation = token.elevation
                p.sid = token.sid
                p.session_id = token.session_id
            procs.append(p)

        # Sorting according to requested key
        sort_key = (sort_by or 'cpu').lower()
        if sort_key in ('handles', 'descriptors'):
            procs.sort(key=lambda x: x.num_handles, reverse=True)
        elif sort_key in ('memory', 'ram'):
            procs.sort(key=lambda x: x.memory_mb, reverse=True)
        else:
            procs.sort(key=lambda x: x.cpu_percent, reverse=True)

        if limit_val is None or limit_val <= 0:
            return procs
        return procs[:limit_val]
