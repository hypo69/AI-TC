# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin AI Instruments - Storage
# =============================================================================
# Description:
#   Хранилище инструментов ИИ-агента (ai_instruments.db).
#   Поддерживает два режима работы:
#     1. Локальный SQLite файл ai_instruments.db (по умолчанию)
#     2. Удалённая база данных на сервере Hostinger (MariaDB / PHP API bridge)
#
# Usage Examples:
#   Python API:
#     from apps.windows.ai_instruments.storage import AIInstrumentsStorage
#
#     storage = AIInstrumentsStorage("data/ai_instruments/ai_instruments.db")
#     tool = storage.save_instrument(inst)
#
# File: storage.py
# Project: ai-windows-admin
# Package: apps.windows.ai_instruments
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-20 12:38:00
# =============================================================================

from __future__ import annotations

"""Хранилище базы инструментов ИИ-агента (ai_instruments.db) для SQLite и Hostinger."""

import json
import sqlite3
import urllib.parse
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from logger import logger
from .models import AIInstrument, get_current_iso_time


class AIInstrumentsStorage:
    """Хранилище инструментов агента с поддержкой SQLite и Hostinger."""

    def __init__(
        self,
        db_path: str | Path = "data/ai_instruments/ai_instruments.db",
        engine: str = "sqlite",
        hostinger_config: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Инициализирует подключение к хранилищу ai_instruments.

        Args:
            db_path: Путь к SQLite файлу ai_instruments.db или ':memory:'.
            engine: Тип движка: 'sqlite', 'mariadb' или 'hostinger'.
            hostinger_config: Параметры удаленного подключения к Hostinger.
        """
        self.engine = engine.lower()
        self.hostinger_config = hostinger_config or {}
        self.db_path = Path(db_path) if str(db_path) != ":memory:" else ":memory:"
        self._mem_conn: Optional[sqlite3.Connection] = None

        if self.engine in ("sqlite", "memory"):
            if self.db_path == ":memory:":
                self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
                self._mem_conn.row_factory = sqlite3.Row
            elif isinstance(self.db_path, Path):
                self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._init_sqlite_db()
        elif self.engine in ("mariadb", "hostinger"):
            self._init_remote_db()

    @contextmanager
    def _connect_sqlite(self) -> Generator[sqlite3.Connection, None, None]:
        """Контекстный менеджер соединения с локальной базой SQLite."""
        if self._mem_conn is not None:
            try:
                yield self._mem_conn
                self._mem_conn.commit()
            except Exception:
                self._mem_conn.rollback()
                raise
        else:
            conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _init_sqlite_db(self) -> None:
        """Создает таблицы и индексы в SQLite базе ai_instruments.db."""
        with self._connect_sqlite() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_instruments (
                    tool_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    tool_type TEXT NOT NULL DEFAULT 'powershell',
                    command TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    target_entity TEXT DEFAULT '',
                    parameters_schema TEXT DEFAULT '{}',
                    risk_level TEXT DEFAULT 'safe',
                    author_agent TEXT DEFAULT 'reasoning_chain',
                    tags TEXT DEFAULT '["#agent_tool"]',
                    execution_count INTEGER DEFAULT 0,
                    last_executed_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_inst_target ON ai_instruments(target_entity)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_inst_type ON ai_instruments(tool_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_inst_name ON ai_instruments(name)")

    def _init_remote_db(self) -> None:
        """Инициализирует таблицу ai_instruments на удаленном сервере Hostinger."""
        php_api_url = self.hostinger_config.get("php_api_url")
        if not php_api_url:
            return

        sql_init = """
        CREATE TABLE IF NOT EXISTS ai_instruments (
            tool_id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            tool_type VARCHAR(50) NOT NULL DEFAULT 'powershell',
            command LONGTEXT NOT NULL,
            description MEDIUMTEXT,
            target_entity VARCHAR(255) DEFAULT '',
            parameters_schema_json LONGTEXT,
            risk_level VARCHAR(50) NOT NULL DEFAULT 'safe',
            author_agent VARCHAR(100) NOT NULL DEFAULT 'reasoning_chain',
            tags_json LONGTEXT,
            execution_count INT NOT NULL DEFAULT 0,
            last_executed_at VARCHAR(100),
            created_at VARCHAR(100) NOT NULL,
            updated_at VARCHAR(100) NOT NULL,
            INDEX idx_ai_inst_target (target_entity),
            INDEX idx_ai_inst_type (tool_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        try:
            self._call_hostinger_api("execute", {"sql": sql_init})
            logger.info("[AIInstrumentsStorage] Таблица ai_instruments на сервере Hostinger проверена")
        except Exception as ex:
            logger.warning(f"[AIInstrumentsStorage] Предупреждение при инициализации на Hostinger: {ex}")

    def _call_hostinger_api(self, action: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Отправляет запрос к REST API мосту на сервере Hostinger.

        Args:
            action: Действие ('query', 'execute', 'status').
            data: Данные запроса.

        Returns:
            Dict[str, Any]: Ответ сервера.
        """
        php_api_url = self.hostinger_config.get("php_api_url")
        if not php_api_url:
            raise ValueError("php_api_url не настроен для Hostinger")

        url = f"{php_api_url}?action={action}"
        encoded_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=encoded_data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "AI-Windows-Admin-Instruments/1.0",
                "X-API-Key": self.hostinger_config.get("php_api_key", ""),
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            return json.loads(resp_body)

    def _row_to_instrument(self, row: sqlite3.Row | Dict[str, Any]) -> AIInstrument:
        """Преобразует строку базы данных в объект AIInstrument."""
        if isinstance(row, sqlite3.Row):
            d = dict(row)
        else:
            d = dict(row)

        schema_raw = d.get("parameters_schema") or d.get("parameters_schema_json") or "{}"
        if isinstance(schema_raw, str):
            try:
                schema_dict = json.loads(schema_raw)
            except Exception:
                schema_dict = {}
        else:
            schema_dict = schema_raw or {}

        tags_raw = d.get("tags") or d.get("tags_json") or "[]"
        if isinstance(tags_raw, str):
            try:
                tags_list = json.loads(tags_raw)
            except Exception:
                tags_list = ["#agent_tool"]
        else:
            tags_list = tags_raw or ["#agent_tool"]

        return AIInstrument(
            tool_id=d["tool_id"],
            name=d["name"],
            tool_type=d.get("tool_type", "powershell"),
            command=d["command"],
            description=d.get("description", ""),
            target_entity=d.get("target_entity", ""),
            parameters_schema=schema_dict,
            risk_level=d.get("risk_level", "safe"),
            author_agent=d.get("author_agent", "reasoning_chain"),
            tags=tags_list,
            execution_count=int(d.get("execution_count", 0)),
            last_executed_at=d.get("last_executed_at"),
            created_at=d.get("created_at", get_current_iso_time()),
            updated_at=d.get("updated_at", get_current_iso_time()),
        )

    def save_instrument(self, inst: AIInstrument) -> AIInstrument:
        """Сохраняет или обновляет инструмент в базе ai_instruments.db или Hostinger.

        Args:
            inst: Экземпляр инструмента.

        Returns:
            AIInstrument: Сохраненный инструмент.
        """
        inst.updated_at = get_current_iso_time()
        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            sql = """
            INSERT INTO ai_instruments 
                (tool_id, name, tool_type, command, description, target_entity, parameters_schema_json,
                 risk_level, author_agent, tags_json, execution_count, last_executed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                tool_type = VALUES(tool_type),
                command = VALUES(command),
                description = VALUES(description),
                target_entity = VALUES(target_entity),
                parameters_schema_json = VALUES(parameters_schema_json),
                risk_level = VALUES(risk_level),
                tags_json = VALUES(tags_json),
                updated_at = VALUES(updated_at);
            """
            params = [
                inst.tool_id,
                inst.name,
                inst.tool_type,
                inst.command,
                inst.description,
                inst.target_entity,
                json.dumps(inst.parameters_schema, ensure_ascii=False),
                inst.risk_level,
                inst.author_agent,
                json.dumps(inst.tags, ensure_ascii=False),
                inst.execution_count,
                inst.last_executed_at,
                inst.created_at,
                inst.updated_at,
            ]
            self._call_hostinger_api("execute", {"sql": sql, "params": params})
            return inst

        with self._connect_sqlite() as conn:
            conn.execute(
                """
                INSERT INTO ai_instruments 
                    (tool_id, name, tool_type, command, description, target_entity, parameters_schema,
                     risk_level, author_agent, tags, execution_count, last_executed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(tool_id) DO UPDATE SET
                    name = excluded.name,
                    tool_type = excluded.tool_type,
                    command = excluded.command,
                    description = excluded.description,
                    target_entity = excluded.target_entity,
                    parameters_schema = excluded.parameters_schema,
                    risk_level = excluded.risk_level,
                    tags = excluded.tags,
                    updated_at = excluded.updated_at
                """,
                (
                    inst.tool_id,
                    inst.name,
                    inst.tool_type,
                    inst.command,
                    inst.description,
                    inst.target_entity,
                    json.dumps(inst.parameters_schema, ensure_ascii=False),
                    inst.risk_level,
                    inst.author_agent,
                    json.dumps(inst.tags, ensure_ascii=False),
                    inst.execution_count,
                    inst.last_executed_at,
                    inst.created_at,
                    inst.updated_at,
                ),
            )
        return inst

    def get_instrument(self, tool_id: str) -> Optional[AIInstrument]:
        """Возвращает инструмент по уникальному ID."""
        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            sql = "SELECT * FROM ai_instruments WHERE tool_id = ? LIMIT 1"
            res = self._call_hostinger_api("query", {"sql": sql, "params": [tool_id]})
            rows = res.get("rows", [])
            return self._row_to_instrument(rows[0]) if rows else None

        with self._connect_sqlite() as conn:
            row = conn.execute("SELECT * FROM ai_instruments WHERE tool_id = ?", (tool_id,)).fetchone()
            return self._row_to_instrument(row) if row else None

    def list_instruments(
        self,
        limit: int = 50,
        offset: int = 0,
        tool_type: Optional[str] = None,
        target_entity: Optional[str] = None,
    ) -> List[AIInstrument]:
        """Возвращает список инструментов с фильтрацией по типу и сущности."""
        query = "SELECT * FROM ai_instruments WHERE 1=1"
        params: List[Any] = []
        if tool_type:
            query += " AND tool_type = ?"
            params.append(tool_type)
        if target_entity:
            query += " AND target_entity = ?"
            params.append(target_entity)
        query += " ORDER BY execution_count DESC, updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            res = self._call_hostinger_api("query", {"sql": query, "params": params})
            rows = res.get("rows", [])
            return [self._row_to_instrument(r) for r in rows]

        with self._connect_sqlite() as conn:
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_instrument(r) for r in rows]

    def search_instruments(self, query_str: str, limit: int = 20) -> List[AIInstrument]:
        """Выполняет поиск инструментов по названию, описанию и коду команды."""
        q = f"%{query_str.strip()}%"
        sql = """
        SELECT * FROM ai_instruments 
        WHERE name LIKE ? OR description LIKE ? OR command LIKE ? OR target_entity LIKE ?
        ORDER BY execution_count DESC, updated_at DESC LIMIT ?
        """
        params = [q, q, q, q, limit]

        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            res = self._call_hostinger_api("query", {"sql": sql, "params": params})
            rows = res.get("rows", [])
            return [self._row_to_instrument(r) for r in rows]

        with self._connect_sqlite() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [self._row_to_instrument(r) for r in rows]

    def delete_instrument(self, tool_id: str) -> bool:
        """Удаляет инструмент из базы ai_instruments.db."""
        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            sql = "DELETE FROM ai_instruments WHERE tool_id = ?"
            res = self._call_hostinger_api("execute", {"sql": sql, "params": [tool_id]})
            return bool(res.get("affected_rows", 0) > 0)

        with self._connect_sqlite() as conn:
            cur = conn.execute("DELETE FROM ai_instruments WHERE tool_id = ?", (tool_id,))
            return cur.rowcount > 0

    def record_execution(self, tool_id: str) -> bool:
        """Инкрементирует счётчик выполнения и фиксирует временную метку."""
        now = get_current_iso_time()
        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            sql = "UPDATE ai_instruments SET execution_count = execution_count + 1, last_executed_at = ?, updated_at = ? WHERE tool_id = ?"
            res = self._call_hostinger_api("execute", {"sql": sql, "params": [now, now, tool_id]})
            return bool(res.get("affected_rows", 0) > 0)

        with self._connect_sqlite() as conn:
            cur = conn.execute(
                "UPDATE ai_instruments SET execution_count = execution_count + 1, last_executed_at = ?, updated_at = ? WHERE tool_id = ?",
                (now, now, tool_id),
            )
            return cur.rowcount > 0

    def get_stats(self) -> Dict[str, Any]:
        """Возвращает статистику базы данных инструментов агента."""
        count = 0
        if self.engine in ("mariadb", "hostinger") and self.hostinger_config.get("php_api_url"):
            sql = "SELECT COUNT(*) AS cnt FROM ai_instruments"
            res = self._call_hostinger_api("query", {"sql": sql, "params": []})
            rows = res.get("rows", [])
            if rows:
                count = int(rows[0].get("cnt", 0))
            return {
                "engine": "hostinger_mariadb",
                "total_instruments": count,
                "host": self.hostinger_config.get("host", "srv1502.hstgr.io"),
                "database": self.hostinger_config.get("database", "u177424397_comp_knowledge"),
                "table": "ai_instruments",
            }

        with self._connect_sqlite() as conn:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM ai_instruments").fetchone()
            if row:
                count = int(row["cnt"])
        return {
            "engine": "sqlite",
            "total_instruments": count,
            "database_path": str(self.db_path),
            "table": "ai_instruments",
        }
