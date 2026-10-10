# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry - CLI Controller
# =============================================================================
# Description:
#   Консольный контроллер AITelemetryCtl для мониторинга, управления службой
#   Windows Service, проверки базы данных и выполнения диагностики.
#
# Usage Examples:
#   CLI:
#     AITelemetryCtl.exe status
#     AITelemetryCtl.exe start
#     AITelemetryCtl.exe stop
#     AITelemetryCtl.exe restart
#     AITelemetryCtl.exe diagnose
#     AITelemetryCtl.exe database
#
# File: ctl.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 22:22:44
# =============================================================================

from __future__ import annotations
from logger import logger
"""Консольная утилита управления и диагностики службы AITelemetry."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

_current_dir = Path(__file__).resolve().parent
_project_root = str(_current_dir.parents[2]) if len(_current_dir.parents) >= 3 else str(_current_dir)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


def get_service_status_scm(service_name: str = 'AITelemetry') -> Dict[str, Any]:
    """Запрашивает состояние службы через Windows SCM (sc.exe).

    Args:
        service_name: Имя службы в диспетчере Windows.

    Returns:
        Dict[str, Any]: Словарь со статусом и деталями службы.
    """
    try:
        res = subprocess.run(
            ['sc.exe', 'query', service_name],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = res.stdout
        is_installed = res.returncode == 0
        state = 'UNKNOWN'
        if 'RUNNING' in output:
            state = 'RUNNING'
        elif 'STOPPED' in output:
            state = 'STOPPED'
        elif 'START_PENDING' in output:
            state = 'START_PENDING'
        elif 'STOP_PENDING' in output:
            state = 'STOP_PENDING'
        elif not is_installed:
            state = 'NOT_INSTALLED'

        return {
            'installed': is_installed,
            'state': state,
            'raw_output': output.strip()
        }
    except Exception as ex:
        return {'installed': False, 'state': 'ERROR', 'error': str(ex)}


def cmd_status() -> int:
    """Выводит подробный статус службы и базы данных."""
    logger.console("=" * 60)
    logger.console("       AITelemetry - Статус службы и мониторинга")
    logger.console("=" * 60)

    scm_status = get_service_status_scm('AITelemetry')
    state = scm_status.get('state', 'UNKNOWN')
    state_icon = "🟢" if state == 'RUNNING' else ("🔴" if state == 'STOPPED' else "⚪")
    logger.console(f"Служба Windows (SCM):   {state_icon} {state}")
    logger.console(f"Установлена в системе: {'Да' if scm_status.get('installed') else 'Нет'}")

    try:
        from apps.windows.telemetry.telemetry_config import TelemetryConfigManager
        cfg_mgr = TelemetryConfigManager()
        cfg_path = cfg_mgr.config_path
        logger.console(f"Файл конфигурации:     {cfg_path} (существует: {cfg_path.exists()})")
        logger.console(f"Режим работы:          {cfg_mgr.get_mode()}")
        logger.console(f"Интервал замеров:      {cfg_mgr.get_interval_seconds()} сек")
    except Exception as ex:
        logger.console(f"Конфигурация:          Ошибка чтения ({ex})")

    try:
        from apps.windows.telemetry.sqlite import TelemetryStorage
        storage = TelemetryStorage.get_instance(read_only=True)
        db_path = storage.db_path
        logger.console(f"База данных SQLite:    {db_path} (размер: {db_path.stat().st_size / 1024 / 1024:.2f} МБ)")
        stats = storage.get_storage_stats()
        logger.console(f"Всего снимков (polls): {stats.get('snapshots_count', 0)}")
        logger.console(f"Метрик процессов:      {stats.get('process_metrics_count', 0)}")
        logger.console(f"Событий (events):      {stats.get('events_count', 0)}")
    except Exception as ex:
        logger.console(f"База данных:           Недоступна ({ex})")

    logger.console("=" * 60)
    return 0


def cmd_control(action: str) -> int:
    """Управляет службой через sc.exe / net.exe.

    Args:
        action: Действие ('start', 'stop', 'restart').

    Returns:
        int: Код возврата команды.
    """
    if action == 'start':
        logger.console("Запуск службы AITelemetry...")
        res = subprocess.run(['net.exe', 'start', 'AITelemetry'])
        return res.returncode
    elif action == 'stop':
        logger.console("Остановка службы AITelemetry...")
        res = subprocess.run(['net.exe', 'stop', 'AITelemetry'])
        return res.returncode
    elif action == 'restart':
        logger.console("Перезапуск службы AITelemetry...")
        subprocess.run(['net.exe', 'stop', 'AITelemetry'])
        res = subprocess.run(['net.exe', 'start', 'AITelemetry'])
        return res.returncode
    return 1


def cmd_database() -> int:
    """Выводит детальную статистику таблиц SQLite."""
    try:
        from apps.windows.telemetry.sqlite import TelemetryStorage
        storage = TelemetryStorage.get_instance(read_only=True)
        stats = storage.get_storage_stats()
        logger.console(json.dumps(stats, indent=2, ensure_ascii=False))
        return 0
    except Exception as ex:
        logger.console(f"Ошибка чтения базы данных: {ex}")
        return 1


def cmd_diagnose() -> int:
    """Выполняет экспресс-диагностику системных метрик."""
    logger.console("Выполнение глубокой диагностики системы...")
    try:
        from apps.windows.telemetry.collector import SystemCollector
        collector = SystemCollector()
        snapshot = collector.collect_snapshot(top_processes_limit=10)
        logger.console(f"CPU: {snapshot.cpu.usage_percent:.1f}%")
        logger.console(f"Память: {snapshot.memory.percent_used:.1f}% (Свободно: {snapshot.memory.available_mb / 1024:.2f} ГБ)")
        logger.console(f"Количество процессов: {len(snapshot.processes)}")
        logger.console("Диагностика успешно выполнена.")
        return 0
    except Exception as ex:
        logger.console(f"Ошибка при диагностике: {ex}")
        return 1


def cmd_security(args: argparse.Namespace) -> int:
    """Обработчик группы команд ait security."""
    from apps.windows.telemetry.security_collector import WindowsSecurityCollector
    collector = WindowsSecurityCollector()
    action = getattr(args, 'sec_action', 'status')

    if action == 'status':
        status = collector.check_access_and_audit()
        logger.console("=" * 60)
        logger.console("       AITelemetry - Windows Security Event Subsystem")
        logger.console("=" * 60)
        acc_str = "🟢 Доступен" if status.accessible else f"🔴 Недоступен ({status.error})"
        logger.console(f"Журнал Security:       {acc_str}")
        logger.console(f"Всего событий в журнале ОС: {status.record_count:,}")
        logger.console(f"Событий в telemetry.db:     {status.total_ingested_events:,}")
        logger.console(f"Последний EventRecordID:    {status.last_record_id:,}")
        cmd_audit_str = "🟢 Включен" if status.command_line_audit_enabled else "⚪ Отключен (ProcessCreationIncludeCmdLine_Enabled)"
        logger.console(f"Аудит командной строки 4688: {cmd_audit_str}")
        logger.console("=" * 60)
        return 0

    elif action == 'tail':
        limit = getattr(args, 'limit', 20) or 20
        eid = getattr(args, 'event_id', None)
        search = getattr(args, 'search', '') or ''
        events = collector.get_live_tail(limit=limit, event_id=eid, search=search)
        logger.console(f"\n[+] Последние {len(events)} событий Security (Live Tail):")
        for ev in reversed(events):
            logger.console(f"  [{ev.timestamp}] Event {ev.event_id:<4} | {ev.message}")
        return 0

    elif action == 'search':
        eid = int(args.target) if str(args.target).isdigit() else None
        limit = getattr(args, 'limit', 50) or 50
        events = collector.storage.get_security_events(event_id=eid, limit=limit)
        logger.console(f"\n[+] Найдено {len(events)} событий для Event ID {eid}:")
        for ev in events:
            logger.console(f"  [{ev.get('timestamp')}] ID {ev.get('event_id')} | {ev.get('message')}")
        return 0

    elif action == 'user':
        username = args.target
        limit = getattr(args, 'limit', 50) or 50
        events = collector.storage.get_security_events(user=username, limit=limit)
        logger.console(f"\n[+] События безопасности для пользователя '{username}' ({len(events)} записей):")
        for ev in events:
            logger.console(f"  [{ev.get('timestamp')}] Event {ev.get('event_id')} | {ev.get('message')}")
        return 0

    elif action == 'process':
        pname = args.target
        limit = getattr(args, 'limit', 50) or 50
        events = collector.storage.get_security_process_creations(process_name=pname, limit=limit)
        logger.console(f"\n[+] Запуски процесса '{pname}' ({len(events)} записей):")
        for ev in events:
            logger.console(f"  [{ev.get('timestamp')}] PID: {ev.get('process_id')} | User: {ev.get('subject_user')} | {ev.get('command_line') or ev.get('process_name')}")
        return 0

    elif action == 'failed-logons':
        hours = getattr(args, 'hours', 24) or 24
        events = collector.storage.get_security_failed_logons(hours=hours)
        logger.console(f"\n[+] Неудачные попытки входа за последние {hours} ч ({len(events)} записей):")
        for ev in events:
            logger.console(f"  [{ev.get('timestamp')}] User: {ev.get('target_user')} | IP: {ev.get('source_ip')} | {ev.get('message')}")
        return 0

    elif action == 'collect':
        batch_size = getattr(args, 'batch', 500) or 500
        max_records = getattr(args, 'max', 5000) or 5000
        save_raw = getattr(args, 'raw', False)
        logger.console(f"Запуск инкрементального сбора Security... (batch={batch_size}, max={max_records})")
        report = collector.collect_incremental(batch_size=batch_size, max_records=max_records, save_raw=save_raw)
        logger.console(f"[+] Сбор завершен. Сохранено {report.total_events_ingested} событий. Последний RecordID: {report.last_record_id}")
        if report.events_by_id:
            logger.console("    Распределение по типам событий:")
            for eid, count in sorted(report.events_by_id.items(), key=lambda x: x[1], reverse=True)[:8]:
                logger.console(f"      Event {eid:<4}: {count} событий")
        return 0

    elif action == 'correlate':
        pid = getattr(args, 'pid', None)
        user = getattr(args, 'user', None)
        corrs = collector.correlate_security_with_telemetry(pid=pid, user=user)
        logger.console(f"\n[+] Корреляция событий безопасности с телеметрией ({len(corrs)} цепочек):")
        for c in corrs[:20]:
            notes_str = "; ".join(c.notes) if c.notes else "нормальная активность"
            logger.console(f"  * [{c.timestamp}] {c.event_type} | {c.user} -> {c.process_name} (PID {c.pid}) | {notes_str}")
        return 0

    return 0


def cmd_logs(args: argparse.Namespace) -> int:
    """Обрабатывает подкоманды каталога журналов событий Windows."""
    from apps.windows.telemetry.event_catalog import WindowsEventCatalogEngine
    engine = WindowsEventCatalogEngine()
    action = getattr(args, 'logs_action', None) or 'domains'

    if action == 'domains':
        summary = engine.get_domains_summary()
        logger.console("\n" + "=" * 65)
        logger.console("     7 ДОМЕНОВ ТЕЛЕМЕТРИИ WINDOWS EVENT LOGS")
        logger.console("=" * 65)
        logger.console(f"Всего провайдеров в каталоге: {summary.get('total_registered_providers')}")
        logger.console(f"Служба Sysmon:                {'🟢 Активна' if summary.get('sysmon_installed') else '⚪ Не обнаружена'}\n")
        for dom in summary.get('domains', []):
            logger.console(f"  * {dom.get('title')} [{dom.get('status')}]")
            logger.console(f"    Каналов: {dom.get('channels_count')} | Записей: {dom.get('total_records'):,} | ID: {dom.get('key_events')}")
            logger.console(f"    {dom.get('description')}\n")
        return 0

    elif action == 'catalog':
        catalog = engine.get_full_catalog()
        logger.console("\n" + "=" * 65)
        logger.console(f"   КАТАЛОГ ПРОВАЙДЕРОВ WINDOWS EVENT LOG ({len(catalog)} источников)")
        logger.console("=" * 65)
        for entry in catalog:
            logger.console(f"  [{entry.domain.value}] {entry.provider} -> {entry.channel}")
            logger.console(f"    Объем: {entry.volume_rating:<7} | Записей: {entry.record_count:<8,} | ID: {list(entry.key_events.keys())}")
            logger.console(f"    {entry.description}\n")
        return 0

    elif action == 'provenance':
        proc = getattr(args, 'process', None)
        pid = getattr(args, 'pid', None)
        graph = engine.reconstruct_process_provenance(process_name=proc, pid=pid)
        logger.console("\n" + "=" * 65)
        logger.console("   ДЕРЕВО ПРОИСХОЖДЕНИЯ ПРОЦЕССОВ (PROCESS PROVENANCE)")
        logger.console("=" * 65)
        logger.console(f"Узлов: {graph.get('total_nodes')}, Связей: {graph.get('total_links')}\n")
        for node in graph.get('nodes', []):
            logger.console(f"  * [{node.get('type')}] {node.get('name')} (PID {node.get('pid')}) | User: {node.get('user')}")
            if node.get('command_line'):
                logger.console(f"      CMD: {node.get('command_line')}")
        for link in graph.get('links', []):
            logger.console(f"    -> {link.get('source')} ===[{link.get('relationship')}]===> {link.get('target')}")
        return 0

    elif action == 'lifecycle':
        hours = getattr(args, 'hours', 72) or 72
        timeline = engine.reconstruct_power_lifecycle(hours=hours)
        logger.console("\n" + "=" * 65)
        logger.console(f"   ЖИЗНЕННЫЙ ЦИКЛ ПИТАНИЯ ОС ЗА ПОСЛЕДНИЕ {hours} Ч ({len(timeline)} событий)")
        logger.console("=" * 65)
        for item in timeline:
            logger.console(f"  {item.get('icon')} [{item.get('timestamp')}] {item.get('phase'):<18} | Event {item.get('event_id')} ({item.get('provider')}) | {item.get('message')}")
        return 0

    elif action == 'sysmon':
        status = engine.check_sysmon_status()
        logger.console("\n" + "=" * 65)
        logger.console("   СТАТУС И ВОЗМОЖНОСТИ SYSMON OBSERVABILITY LAYER")
        logger.console("=" * 65)
        logger.console(f"Установлен:   {'🟢 Да' if status.get('installed') else '⚪ Нет'}")
        logger.console(f"Канал логов:  {status.get('channel_name')}")
        logger.console(f"Записей:      {status.get('record_count'):,}")
        logger.console(f"Возможности:  {', '.join(status.get('capabilities', [])) or 'N/A'}")
        logger.console(f"Рекомендации: {status.get('recommended_config')}")
        return 0

    return 0


def main() -> int:
    """Точка входа утилиты AITelemetryCtl."""
    parser = argparse.ArgumentParser(description='AITelemetry CLI Controller')
    subparsers = parser.add_subparsers(dest='command', help='Команды управления')

    subparsers.add_parser('status', help='Показать статус службы и БД')
    subparsers.add_parser('start', help='Запустить службу')
    subparsers.add_parser('stop', help='Остановить службу')
    subparsers.add_parser('restart', help='Перезапустить службу')
    subparsers.add_parser('database', help='Показать статистику базы данных')
    subparsers.add_parser('diagnose', help='Выполнить экспресс-диагностику')

    sec_parser = subparsers.add_parser('security', help='Управление и аналитика журнала безопасности Security.evtx')
    sec_sub = sec_parser.add_subparsers(dest='sec_action', help='Действия security')

    sec_sub.add_parser('status', help='Статус журнала безопасности и политик аудита')

    tail_p = sec_sub.add_parser('tail', help='Свежие события безопасности в реальном времени')
    tail_p.add_argument('--limit', type=int, default=20, help='Количество событий')
    tail_p.add_argument('--event-id', type=int, default=None, help='Фильтр по Event ID')
    tail_p.add_argument('--search', type=str, default='', help='Поисковая подстрока')

    search_p = sec_sub.add_parser('search', help='Поиск по Event ID в сохраненной базе')
    search_p.add_argument('target', help='Идентификатор события (например 4624, 4688)')
    search_p.add_argument('--limit', type=int, default=50, help='Лимит записей')

    user_p = sec_sub.add_parser('user', help='Поиск событий по пользователю')
    user_p.add_argument('target', help='Имя пользователя (например David, SYSTEM)')
    user_p.add_argument('--limit', type=int, default=50, help='Лимит записей')

    proc_p = sec_sub.add_parser('process', help='История создания процессов (4688)')
    proc_p.add_argument('target', help='Имя процесса (например python.exe, cmd.exe)')
    proc_p.add_argument('--limit', type=int, default=50, help='Лимит записей')

    failed_p = sec_sub.add_parser('failed-logons', help='Неудачные попытки входа (4625)')
    failed_p.add_argument('--hours', type=int, default=24, help='Глубина выборки в часах')

    coll_p = sec_sub.add_parser('collect', help='Запустить инкрементальный сбор из Security.evtx')
    coll_p.add_argument('--batch', type=int, default=500, help='Размер пакета')
    coll_p.add_argument('--max', type=int, default=5000, help='Максимум событий')
    coll_p.add_argument('--raw', action='store_true', help='Сохранять сырой XML')

    corr_p = sec_sub.add_parser('correlate', help='Корреляция событий с метриками телеметрии')
    corr_p.add_argument('--pid', type=int, default=None, help='Фильтр по PID')
    corr_p.add_argument('--user', type=str, default=None, help='Фильтр по пользователю')

    # Команда logs (Каталог 7 доменов, Provenance, Power Lifecycle)
    logs_p = subparsers.add_parser('logs', help='Иерархический каталог Windows Event Logs, 7 доменов и графы происхождения')
    logs_sub = logs_p.add_subparsers(dest='logs_action', help='Действия logs')
    logs_sub.add_parser('domains', help='Сводка по 7 доменам телеметрии Windows Event Logs')
    logs_sub.add_parser('catalog', help='Полный реестр провайдеров и каналов')
    prov_p = logs_sub.add_parser('provenance', help='Граф происхождения процессов (User -> Process -> Parent -> SCM)')
    prov_p.add_argument('--process', type=str, default=None, help='Фильтр по имени процесса')
    prov_p.add_argument('--pid', type=int, default=None, help='Фильтр по PID')
    life_p = logs_sub.add_parser('lifecycle', help='Таймлайн жизненного цикла ОС (Boot/Sleep/Wake/Shutdown/Crash)')
    life_p.add_argument('--hours', type=int, default=72, help='Глубина выборки в часах')
    logs_sub.add_parser('sysmon', help='Проверить статус и возможности Sysmon')

    args = parser.parse_args()

    if not args.command or args.command == 'status':
        return cmd_status()
    elif args.command in ('start', 'stop', 'restart'):
        return cmd_control(args.command)
    elif args.command == 'database':
        return cmd_database()
    elif args.command == 'diagnose':
        return cmd_diagnose()
    elif args.command == 'security':
        return cmd_security(args)
    elif args.command == 'logs':
        return cmd_logs(args)
    return 0


if __name__ == '__main__':
    sys.exit(main())

