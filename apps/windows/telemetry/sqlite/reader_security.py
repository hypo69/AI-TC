# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Telemetry Sqlite - TelemetrySecurityReaderMixin
# =============================================================================
# Description:
#   Миксин чтения событий безопасности и питания: журнал Security, неудачные входы, создание процессов, сессии и события питания.
#   Вынесено при декомпозиции TelemetryReader (этап 4 ТЗ оптимизации).
#   Хост-класс обязан предоставлять атрибут ``_cm`` (менеджер соединений SQLite)
#   и, где требуется, ``_delta_tracker``.
#
# Usage Examples:
#   Python API:
#     from apps.windows.telemetry.sqlite.reader_security import TelemetrySecurityReaderMixin
#
#     class TelemetryReader(TelemetrySecurityReaderMixin): ...
#
# File: reader_security.py
# Project: ai-windows-admin
# Package: apps.windows.telemetry.sqlite
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-11 11:30:00
# =============================================================================

from __future__ import annotations

"""Миксин чтения событий безопасности и питания: журнал Security, неудачные входы, создание процессов, сессии и события питания."""

import json
import time
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Union,
)


try:
    from logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class TelemetrySecurityReaderMixin:
    """Миксин чтения событий безопасности и питания: журнал Security, неудачные входы, создание процессов, сессии и события питания."""

    def get_security_events(
        self,
        event_id: Optional[int] = None,
        user: Optional[str] = None,
        process_name: Optional[str] = None,
        pid: Optional[int] = None,
        channel: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        since_epoch: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Выборка нормализованных событий журнала безопасности Windows с фильтрами.

        Args:
            event_id: Фильтр по Event ID (например, 4688, 4624, 1116).
            user: Фильтр по имени субъекта или целевого пользователя (подстрока).
            process_name: Фильтр по имени процесса.
            pid: Фильтр по идентификатору процесса PID.
            channel: Фильтр по имени журнала (Security или Defender).
            limit: Максимальное количество возвращаемых записей.
            offset: Смещение выборки.
            since_epoch: Нижняя граница времени epoch.

        Returns:
            List[Dict[str, Any]]: Список событий безопасности.
        """
        conditions: List[str] = []
        params: List[Any] = []

        if channel:
            conditions.append('channel = ?')
            params.append(str(channel))

        if event_id is not None:
            conditions.append('event_id = ?')
            params.append(int(event_id))

        if user:
            conditions.append('(subject_user LIKE ? OR target_user LIKE ?)')
            params.extend([f'%{user}%', f'%{user}%'])

        if process_name:
            conditions.append('(process_name LIKE ? OR parent_process_name LIKE ?)')
            params.extend([f'%{process_name}%', f'%{process_name}%'])

        if pid is not None:
            conditions.append('(process_id = ? OR parent_process_id = ?)')
            params.extend([int(pid), int(pid)])

        if since_epoch is not None:
            conditions.append('created_at >= ?')
            params.append(float(since_epoch))

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f'''
            SELECT * FROM security_events
            {where_clause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        '''
        params.extend([int(limit), int(offset)])

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = [dict(r) for r in cursor.fetchall()]
            for r in rows:
                if r.get('event_data_json'):
                    try:
                        r['event_data'] = json.loads(r['event_data_json'])
                    except Exception:
                        r['event_data'] = {}
                else:
                    r['event_data'] = {}
            return rows

    def get_security_failed_logons(self, limit: int = 50, hours: int = 24) -> List[Dict[str, Any]]:
        """Выборка событий неудачных попыток входа и сбоев аутентификации (4625, 4771).

        Args:
            limit: Лимит записей.
            hours: Глубина выборки в часах.

        Returns:
            List[Dict[str, Any]]: Список неудачных попыток входа.
        """
        since_time = time.time() - (hours * 3600) if hours > 0 else 0.0
        query = '''
            SELECT * FROM security_events
            WHERE event_id IN (4625, 4771) AND created_at >= ?
            ORDER BY id DESC
            LIMIT ?
        '''
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (since_time, int(limit)))
            return [dict(r) for r in cursor.fetchall()]

    def get_security_process_creations(
        self,
        process_name: Optional[str] = None,
        user: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Выборка событий создания процессов (Event ID 4688) с информацией о родителях и командной строке.

        Args:
            process_name: Подстрока имени процесса.
            user: Имя пользователя инициатора.
            limit: Лимит записей.

        Returns:
            List[Dict[str, Any]]: Список запусков процессов.
        """
        conditions = ['event_id = 4688']
        params: List[Any] = []

        if process_name:
            conditions.append('(process_name LIKE ? OR command_line LIKE ?)')
            params.extend([f'%{process_name}%', f'%{process_name}%'])

        if user:
            conditions.append('subject_user LIKE ?')
            params.append(f'%{user}%')

        where_clause = f"WHERE {' AND '.join(conditions)}"
        query = f'''
            SELECT id, event_record_id, timestamp, subject_user, process_id,
                   process_name, parent_process_id, parent_process_name,
                   command_line, logon_id, message
            FROM security_events
            {where_clause}
            ORDER BY id DESC
            LIMIT ?
        '''
        params.append(int(limit))

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_security_bookmark(self, channel: str = 'Security') -> Optional[Dict[str, Any]]:
        """Извлечение последней сохраненной закладки для канала журнала событий.

        Args:
            channel: Имя канала (по умолчанию 'Security').

        Returns:
            Optional[Dict[str, Any]]: Словарь с состоянием закладки или None.
        """
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM security_collector_bookmarks WHERE channel = ?', (channel,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_security_stats(self) -> Dict[str, Any]:
        """Получить сводную статистику по событиям безопасности в базе данных SQLite.

        Returns:
            Dict[str, Any]: Словарь со счетчиками и последним record_id.
        """
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*), MAX(event_record_id), MIN(timestamp), MAX(timestamp) FROM security_events')
            row = cursor.fetchone()
            total_events = row[0] if row else 0
            max_rec_id = row[1] if row and row[1] else 0
            min_ts = row[2] if row and row[2] else ''
            max_ts = row[3] if row and row[3] else ''

            cursor.execute('''
                SELECT event_id, COUNT(*) as cnt
                FROM security_events
                GROUP BY event_id
                ORDER BY cnt DESC
                LIMIT 10
            ''')
            top_ids = {r[0]: r[1] for r in cursor.fetchall()}

            cursor.execute('SELECT COUNT(*) FROM security_events WHERE event_id = 4688')
            proc_events = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM security_events WHERE event_id = 4625')
            failed_logons = cursor.fetchone()[0]

            return {
                'total_events': total_events,
                'max_record_id': max_rec_id,
                'first_event_time': min_ts,
                'latest_event_time': max_ts,
                'process_creation_count': proc_events,
                'failed_logon_count': failed_logons,
                'top_event_ids': top_ids,
            }

    def get_power_sessions(
        self,
        limit: int = 50,
        offset: int = 0,
        shutdown_type: Optional[str] = None,
        unexpected_only: bool = False,
        clean_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """Извлечь список сессий питания операционной системы из SQLite.

        Args:
            limit: Максимальное количество записей.
            offset: Смещение выборки.
            shutdown_type: Фильтрация по типу выключения (Restart, Shutdown, Unexpected, etc.).
            unexpected_only: Только внезапные завершения работы.
            clean_only: Только штатные выключения.

        Returns:
            List[Dict[str, Any]]: Список словарей с полями PowerSessionRecord.
        """
        where_clauses: List[str] = []
        params: List[Any] = []

        if shutdown_type:
            where_clauses.append("LOWER(shutdown_type) = LOWER(?)")
            params.append(shutdown_type)

        if unexpected_only:
            where_clauses.append("unexpected_shutdown = 1")
        elif clean_only:
            where_clauses.append("clean_shutdown = 1 AND unexpected_shutdown = 0")

        sql = "SELECT * FROM power_sessions"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += " ORDER BY boot_time DESC LIMIT ? OFFSET ?"
        params.extend([max(1, limit), max(0, offset)])

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results: List[Dict[str, Any]] = []
            for row in rows:
                item = dict(row)
                if item.get('initiator_chain_json'):
                    try:
                        item['initiator_chain'] = json.loads(item['initiator_chain_json'])
                    except Exception:
                        item['initiator_chain'] = []
                else:
                    item['initiator_chain'] = []

                if item.get('events_json'):
                    try:
                        item['events'] = json.loads(item['events_json'])
                    except Exception:
                        item['events'] = []
                else:
                    item['events'] = []

                item['clean_shutdown'] = bool(item.get('clean_shutdown'))
                item['unexpected_shutdown'] = bool(item.get('unexpected_shutdown'))
                results.append(item)
            return results

    def get_power_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Извлечь детальную информацию по конкретной сессии питания.

        Args:
            session_id: Идентификатор сессии (session_id или id).

        Returns:
            Optional[Dict[str, Any]]: Словарь с полями сессии или None.
        """
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if session_id.isdigit():
                cursor.execute("SELECT * FROM power_sessions WHERE id = ? OR session_id = ?", (int(session_id), session_id))
            else:
                cursor.execute("SELECT * FROM power_sessions WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            if not row:
                return None
            item = dict(row)
            if item.get('initiator_chain_json'):
                try:
                    item['initiator_chain'] = json.loads(item['initiator_chain_json'])
                except Exception:
                    item['initiator_chain'] = []
            else:
                item['initiator_chain'] = []

            if item.get('events_json'):
                try:
                    item['events'] = json.loads(item['events_json'])
                except Exception:
                    item['events'] = []
            else:
                item['events'] = []

            item['clean_shutdown'] = bool(item.get('clean_shutdown'))
            item['unexpected_shutdown'] = bool(item.get('unexpected_shutdown'))
            return item

    def get_power_events(
        self,
        limit: int = 100,
        offset: int = 0,
        event_id: Optional[Union[int, List[int]]] = None,
        event_type: Optional[str] = None,
        hours: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Извлечь события питания и жизненного цикла из таблицы power_events.

        Args:
            limit: Лимит записей.
            offset: Смещение.
            event_id: Фильтр по Event ID или списку ID.
            event_type: Фильтр по типу события (boot, shutdown, etc.).
            hours: Ограничение глубины в часах.

        Returns:
            List[Dict[str, Any]]: Список событий.
        """
        where_clauses: List[str] = []
        params: List[Any] = []

        if isinstance(event_id, list) and event_id:
            placeholders = ', '.join(['?'] * len(event_id))
            where_clauses.append(f"event_id IN ({placeholders})")
            params.extend(event_id)
        elif isinstance(event_id, int) and event_id > 0:
            where_clauses.append("event_id = ?")
            params.append(event_id)

        if event_type:
            where_clauses.append("LOWER(event_type) = LOWER(?)")
            params.append(event_type)

        if hours and hours > 0:
            cutoff = time.time() - (hours * 3600)
            where_clauses.append("created_at >= ?")
            params.append(cutoff)

        sql = "SELECT * FROM power_events"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += " ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?"
        params.extend([max(1, limit), max(0, offset)])

        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results: List[Dict[str, Any]] = []
            for row in rows:
                item = dict(row)
                if item.get('details_json'):
                    try:
                        item['details'] = json.loads(item['details_json'])
                    except Exception:
                        item['details'] = {}
                else:
                    item['details'] = {}
                item['unexpected'] = bool(item.get('unexpected'))
                results.append(item)
            return results

    def get_power_summary(self) -> Dict[str, Any]:
        """Получить сводную статистику по сессиям и событиям питания из SQLite.

        Returns:
            Dict[str, Any]: Сводная статистика (аптайм, число сессий, сбои, последнее выключение).
        """
        with self._cm.lock, self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM power_sessions")
            total_sessions = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM power_sessions WHERE clean_shutdown = 1 AND unexpected_shutdown = 0")
            clean_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM power_sessions WHERE unexpected_shutdown = 1")
            unexpected_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM power_events WHERE event_id = 1001 OR bugcheck_code IS NOT NULL")
            bsod_count = cursor.fetchone()[0]

            cursor.execute("SELECT * FROM power_sessions WHERE shutdown_time IS NOT NULL ORDER BY boot_time DESC LIMIT 1")
            last_shutdown_row = cursor.fetchone()

            last_shutdown_type = last_shutdown_row['shutdown_type'] if last_shutdown_row else None
            last_initiator = last_shutdown_row['initiator'] if last_shutdown_row else None
            last_reason = last_shutdown_row['reason'] if last_shutdown_row else None

            # Текущая активная сессия
            cursor.execute("SELECT * FROM power_sessions WHERE shutdown_time IS NULL ORDER BY boot_time DESC LIMIT 1")
            active_row = cursor.fetchone()

            cur_boot = active_row['boot_time'] if active_row else ''
            cur_uptime_sec = active_row['uptime_seconds'] if active_row else 0.0
            cur_uptime_human = active_row['uptime_human'] if active_row else ''

            return {
                'total_sessions_count': total_sessions,
                'clean_shutdowns_count': clean_count,
                'unexpected_shutdowns_count': unexpected_count,
                'bsod_count': bsod_count,
                'current_boot_time': cur_boot,
                'current_uptime_seconds': cur_uptime_sec,
                'current_uptime_human': cur_uptime_human,
                'last_shutdown_type': last_shutdown_type,
                'last_initiator': last_initiator,
                'last_reason': last_reason,
            }
