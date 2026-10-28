# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin User Manager
# =============================================================================
# Description:
#   Менеджер пользователей и изолированных персональных хранилищ платформы.
#   Управляет учетными записями, квотами и каталогами данных (data/users/<id>/).
#
# File: user_manager.py
# Project: ai-windows-admin
# Package: src
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-14 04:00:00
# =============================================================================

from __future__ import annotations

import base64
import datetime
import json
import mimetypes
import os
import shutil
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from logger import logger

_DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024  # 10 ГБ по умолчанию


def _format_bytes(size: int) -> str:
    """Форматирует размер в байтах в человекочитаемую строку."""
    if size < 1024:
        return f"{size} B"
    for unit in ["KB", "MB", "GB", "TB"]:
        size_f = size / 1024.0
        if size_f < 1024.0 or unit == "TB":
            return f"{size_f:.1f} {unit}"
        size = int(size_f)
    return f"{size} B"


class UserManager:
    """Менеджер пользователей и персональных хранилищ."""

    def __init__(self, root_dir: Optional[Path] = None) -> None:
        """Инициализация менеджера пользователей.

        Args:
            root_dir: Корневой каталог проекта.
        """
        if root_dir is None:
            root_dir = Path(__file__).resolve().parent.parent
        self.root_dir = root_dir
        self.data_dir = self.root_dir / "data"
        self.users_dir = self.data_dir / "users"
        self.db_path = self.data_dir / "users.db"

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.users_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Возвращает соединение с базой данных SQLite."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Инициализирует таблицы базы данных и создает администратора по умолчанию."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    password_hash TEXT DEFAULT '',
                    role TEXT DEFAULT 'user',
                    is_admin INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    is_email_verified INTEGER DEFAULT 1,
                    telegram_id INTEGER DEFAULT NULL,
                    telegram_username TEXT DEFAULT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id INTEGER PRIMARY KEY,
                    settings_json TEXT DEFAULT '{}',
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
                """
            )

            # Проверяем наличие хотя бы одного пользователя
            cursor = conn.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            if count == 0:
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                conn.execute(
                    """
                    INSERT INTO users (
                        id, email, name, role, is_admin, is_active, is_email_verified, created_at, updated_at
                    ) VALUES (
                        1, 'admin@cli.local', 'Admin', 'admin', 1, 1, 1, ?, ?
                    )
                    """,
                    (now_str, now_str),
                )
                conn.execute(
                    """
                    INSERT INTO user_settings (user_id, settings_json, updated_at)
                    VALUES (1, '{}', ?)
                    """,
                    (now_str,),
                )
                conn.commit()

        # Гарантируем структуру каталога для первого пользователя
        self.ensure_user_storage(1)

    def ensure_user_storage(self, user_id: int) -> Path:
        """Создает и подготавливает изолированный каталог хранилища пользователя.

        Args:
            user_id: Числовой идентификатор пользователя.

        Returns:
            Path: Путь к директории пользователя.
        """
        user_path = self.users_dir / str(user_id)
        subdirs = ["files", "rag", "profile", "temp"]
        for sub in subdirs:
            (user_path / sub).mkdir(parents=True, exist_ok=True)

        welcome_file = user_path / "files" / "welcome.md"
        if not welcome_file.exists():
            try:
                welcome_content = (
                    f"# Каталог пользователя #{user_id}\n\n"
                    "Персональное хранилище данных пользователя AI Windows Admin.\n\n"
                    "Разделы:\n"
                    "- `files/` — документы и рабочие файлы\n"
                    "- `rag/` — базы знаний и векторные индексы\n"
                    "- `profile/` — настройки и профиль пользователя\n"
                    "- `temp/` — временные файлы сессий\n"
                )
                welcome_file.write_text(welcome_content, encoding="utf-8")
            except Exception as exc:
                logger.debug(f"[UserManager] Не удалось создать welcome.md: {exc}")

        return user_path

    def get_all_users(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """Возвращает список всех зарегистрированных пользователей."""
        query = "SELECT * FROM users"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY id ASC"

        with self._get_connection() as conn:
            rows = conn.execute(query).fetchall()
            return [dict(r) for r in rows]

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Возвращает данные пользователя по его идентификатору."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Возвращает данные пользователя по адресу электронной почты."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
            return dict(row) if row else None

    def user_exists(self, email: str) -> bool:
        """Проверяет существование пользователя по адресу электронной почты."""
        return self.get_user_by_email(email) is not None

    def create_user_admin(
        self,
        email: str,
        name: str,
        password: str = "",
        role: str = "user",
        is_admin: int = 0,
        is_active: int = 1,
        is_email_verified: int = 1,
    ) -> Optional[int]:
        """Создает нового пользователя администратором."""
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        email_clean = email.strip().lower()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    """
                    INSERT INTO users (
                        email, name, password_hash, role, is_admin, is_active, is_email_verified, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (email_clean, name.strip(), password, role, is_admin, is_active, is_email_verified, now_str, now_str),
                )
                user_id = cursor.lastrowid
                conn.execute(
                    "INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, '{}', ?)",
                    (user_id, now_str),
                )
                conn.commit()

            if user_id:
                self.ensure_user_storage(user_id)
            return user_id
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка создания пользователя {email}: {exc}")
            return None

    def update_user(self, user_id: int, **updates: Any) -> bool:
        """Обновляет данные существующего пользователя."""
        if not updates:
            return True
        allowed_fields = {
            "name", "email", "role", "is_admin", "is_active",
            "is_email_verified", "telegram_id", "telegram_username",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed_fields}
        if not filtered:
            return True

        filtered["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        set_clause = ", ".join(f"{k} = ?" for k in filtered.keys())
        values = list(filtered.values()) + [user_id]

        try:
            with self._get_connection() as conn:
                conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
                conn.commit()
            return True
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка обновления пользователя {user_id}: {exc}")
            return False

    def update_user_password(self, user_id: int, password: str) -> bool:
        """Обновляет пароль пользователя."""
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with self._get_connection() as conn:
                conn.execute(
                    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                    (password, now_str, user_id),
                )
                conn.commit()
            return True
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка изменения пароля пользователя {user_id}: {exc}")
            return False

    def delete_user(self, user_id: int) -> bool:
        """Удаляет пользователя из базы данных."""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))
                conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
                conn.commit()
            return True
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка удаления пользователя {user_id}: {exc}")
            return False

    def get_user_settings(self, user_id: int) -> Dict[str, Any]:
        """Возвращает настройки пользователя."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT settings_json FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
            if row and row[0]:
                try:
                    return json.loads(row[0])
                except Exception:
                    pass
        return {}

    def update_user_settings(self, user_id: int, **settings: Any) -> bool:
        """Обновляет настройки пользователя."""
        current = self.get_user_settings(user_id)
        current.update(settings)
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        data_str = json.dumps(current, ensure_ascii=False)

        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO user_settings (user_id, settings_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
                    """,
                    (user_id, data_str, now_str),
                )
                conn.commit()
            return True
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка сохранения настроек {user_id}: {exc}")
            return False

    def get_user_permissions(self, user_id: int) -> Dict[str, Any]:
        """Возвращает права доступа пользователя."""
        user = self.get_user_by_id(user_id)
        is_admin = bool(user and (user.get("is_admin") or user.get("role") == "admin"))
        return {
            "can_access_admin": is_admin,
            "can_manage_users": is_admin,
            "can_view_logs": True,
            "can_edit_prompts": is_admin,
        }

    def get_user_storage_stats(self, user_id: int) -> Dict[str, Any]:
        """Возвращает статистику занятого дискового пространства пользователем."""
        user_path = self.ensure_user_storage(user_id)
        total_size = 0
        total_files = 0
        subfolder_stats: Dict[str, Dict[str, Any]] = {}

        for item in user_path.rglob("*"):
            if item.is_file():
                try:
                    sz = item.stat().st_size
                    total_size += sz
                    total_files += 1

                    rel_parts = item.relative_to(user_path).parts
                    sub = rel_parts[0] if len(rel_parts) > 1 else "root"
                    if sub not in subfolder_stats:
                        subfolder_stats[sub] = {"files": 0, "size": 0}
                    subfolder_stats[sub]["files"] += 1
                    subfolder_stats[sub]["size"] += sz
                except (OSError, PermissionError):
                    pass

        quota_bytes = _DEFAULT_QUOTA_BYTES
        quota_percent = min(100.0, round((total_size / quota_bytes) * 100, 1)) if quota_bytes else 0.0

        return {
            "user_id": user_id,
            "path": str(user_path),
            "files_count": total_files,
            "size_bytes": total_size,
            "size_formatted": _format_bytes(total_size),
            "quota_bytes": quota_bytes,
            "quota_formatted": _format_bytes(quota_bytes),
            "quota_percent": quota_percent,
            "subfolders": subfolder_stats,
        }

    def get_storage_summary(self) -> Dict[str, Any]:
        """Возвращает общую сводную информацию о хранилище всех пользователей."""
        users = self.get_all_users()
        total_users = len(users)
        total_storage = 0
        total_files = 0

        for u in users:
            stats = self.get_user_storage_stats(u["id"])
            total_storage += stats["size_bytes"]
            total_files += stats["files_count"]

        orphaned = self.get_orphaned_user_directories()
        orphaned_bytes = sum(o["size_bytes"] for o in orphaned)

        return {
            "total_users": total_users,
            "total_storage_bytes": total_storage,
            "total_storage_formatted": _format_bytes(total_storage),
            "total_files_count": total_files,
            "orphaned_bytes": orphaned_bytes,
            "orphaned_formatted": _format_bytes(orphaned_bytes),
        }

    def get_orphaned_user_directories(self) -> List[Dict[str, Any]]:
        """Ищет осиротевшие директории в data/users/."""
        if not self.users_dir.exists():
            return []

        active_users = self.get_all_users()
        active_ids = {str(u["id"]) for u in active_users}
        orphaned: List[Dict[str, Any]] = []

        for entry in self.users_dir.iterdir():
            if not entry.is_dir():
                continue
            dir_name = entry.name
            is_valid_user = dir_name in active_ids

            if not is_valid_user:
                total_size = 0
                files_count = 0
                for f in entry.rglob("*"):
                    if f.is_file():
                        try:
                            total_size += f.stat().st_size
                            files_count += 1
                        except (OSError, PermissionError):
                            pass

                try:
                    mtime = entry.stat().st_mtime
                    mod_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    mod_str = "-"

                reason = (
                    "Каталог не привязан к существующему пользователю"
                    if not dir_name.isdigit()
                    else f"Пользователь #{dir_name} удален из базы данных"
                )

                orphaned.append({
                    "dir_name": dir_name,
                    "full_path": str(entry),
                    "reason": reason,
                    "files_count": files_count,
                    "size_bytes": total_size,
                    "size_formatted": _format_bytes(total_size),
                    "modified_formatted": mod_str,
                })

        return orphaned

    def cleanup_orphaned_user_directories(self, dir_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Очищает указанные или все осиротевшие каталоги."""
        orphaned = self.get_orphaned_user_directories()
        deleted_count = 0
        freed_bytes = 0

        target_names = set(dir_names) if dir_names is not None else None

        for item in orphaned:
            name = item["dir_name"]
            if target_names is not None and name not in target_names:
                continue

            target_path = self.users_dir / name
            if target_path.exists() and target_path.is_dir():
                try:
                    freed_bytes += item["size_bytes"]
                    shutil.rmtree(target_path, ignore_errors=True)
                    deleted_count += 1
                except Exception as exc:
                    logger.error(f"[UserManager] Не удалось удалить {target_path}: {exc}")

        return {
            "status": "ok",
            "deleted_count": deleted_count,
            "freed_bytes": freed_bytes,
            "freed_formatted": _format_bytes(freed_bytes),
        }

    def get_user_directory_tree(
        self,
        user_id: int,
        subfolder: str = "",
        query: str = "",
        extension: str = "",
    ) -> Dict[str, Any]:
        """Возвращает список файлов и директорий пользователя с фильтрацией."""
        user_path = self.ensure_user_storage(user_id)
        base_scan = user_path / subfolder if subfolder else user_path
        if not base_scan.exists():
            return {
                "status": "ok",
                "total_items": 0,
                "total_size_bytes": 0,
                "total_size_formatted": "0 B",
                "items": [],
            }

        items: List[Dict[str, Any]] = []
        total_size = 0
        q_lower = query.strip().lower()
        ext_clean = extension.strip().lower().lstrip(".")

        for entry in base_scan.rglob("*"):
            rel = entry.relative_to(user_path).as_posix()
            name = entry.name
            is_dir = entry.is_dir()

            rel_parts = entry.relative_to(user_path).parts
            sub = rel_parts[0] if len(rel_parts) > 1 or is_dir else "root"

            if q_lower and q_lower not in name.lower() and q_lower not in rel.lower():
                continue

            entry_ext = entry.suffix.lstrip(".").lower()
            if ext_clean and not is_dir and entry_ext != ext_clean:
                continue

            sz = 0
            if not is_dir:
                try:
                    sz = entry.stat().st_size
                    total_size += sz
                except (OSError, PermissionError):
                    pass

            try:
                mod_str = datetime.datetime.fromtimestamp(entry.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                mod_str = "-"

            items.append({
                "name": name,
                "relative_path": rel,
                "subfolder": sub,
                "is_dir": is_dir,
                "size_bytes": sz,
                "size_formatted": _format_bytes(sz) if not is_dir else "-",
                "modified_formatted": mod_str,
                "extension": entry_ext,
            })

        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

        return {
            "status": "ok",
            "total_items": len(items),
            "total_size_bytes": total_size,
            "total_size_formatted": _format_bytes(total_size),
            "items": items,
        }

    def resolve_safe_user_file_path(self, user_id: int, relative_path: str) -> Optional[Path]:
        """Безопасно разрешает путь к файлу внутри хранилища пользователя без path traversal."""
        user_path = (self.users_dir / str(user_id)).resolve()
        clean_rel = relative_path.replace("\\", "/").strip().lstrip("/")
        target = (user_path / clean_rel).resolve()
        try:
            target.relative_to(user_path)
            return target
        except ValueError:
            return None

    def get_file_preview(self, user_id: int, relative_path: str) -> Dict[str, Any]:
        """Возвращает данные для предпросмотра файла."""
        target = self.resolve_safe_user_file_path(user_id, relative_path)
        if not target or not target.exists() or not target.is_file():
            return {
                "status": "error",
                "message": "Файл не найден",
                "relative_path": relative_path,
                "content": "",
            }

        size = target.stat().st_size
        mime, _ = mimetypes.guess_type(str(target))
        ext = target.suffix.lstrip(".").lower()
        is_image = bool(mime and mime.startswith("image/"))

        content = ""
        if is_image:
            try:
                data = target.read_bytes()
                encoded = base64.b64encode(data).decode("ascii")
                content = f"data:{mime};base64,{encoded}"
            except Exception as exc:
                content = f"Ошибка чтения изображения: {exc}"
        else:
            try:
                # Читаем до 500 КБ текста
                max_bytes = 500 * 1024
                raw = target.read_bytes()[:max_bytes]
                content = raw.decode("utf-8", errors="replace")
            except Exception as exc:
                content = f"Ошибка чтения файла: {exc}"

        return {
            "status": "ok",
            "relative_path": relative_path,
            "size_bytes": size,
            "size_formatted": _format_bytes(size),
            "mime_type": mime or "application/octet-stream",
            "extension": ext,
            "is_image": is_image,
            "content": content,
        }

    def delete_user_file(self, user_id: int, relative_path: str) -> bool:
        """Безопасно удаляет файл или папку пользователя."""
        target = self.resolve_safe_user_file_path(user_id, relative_path)
        if not target or not target.exists():
            return False

        try:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            return True
        except Exception as exc:
            logger.error(f"[UserManager] Ошибка удаления {target}: {exc}")
            return False


# Глобальный синглтон менеджера пользователей
user_manager = UserManager()

__all__ = ["UserManager", "user_manager"]
