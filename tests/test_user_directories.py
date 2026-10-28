# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - User Directories
# =============================================================================
# Description:
#   Модульные тесты менеджера пользователей UserManager и эндпоинтов
#   управления персональными хранилищами (/api/admin/user-directories/*).
#
# File: test_user_directories.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-14 04:00:00
# =============================================================================

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.windows.api.server import get_app
from src.user_manager import UserManager, user_manager


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Фикстура TestClient для FastAPI приложения."""
    app = get_app()
    return TestClient(app)


def test_user_manager_initialization() -> None:
    """Проверка корректной инициализации UserManager и администратора по умолчанию."""
    users = user_manager.get_all_users()
    assert len(users) >= 1
    admin_user = users[0]
    assert admin_user["id"] == 1
    assert admin_user["email"] == "admin@cli.local"
    assert admin_user["role"] == "admin"
    assert admin_user["is_admin"] == 1


def test_user_storage_structure_and_stats() -> None:
    """Проверка структуры персонального каталога и статистики использования квоты."""
    stats = user_manager.get_user_storage_stats(1)
    assert stats["user_id"] == 1
    assert stats["files_count"] >= 1
    assert stats["size_bytes"] > 0
    assert "quota_bytes" in stats
    assert "quota_formatted" in stats


def test_api_user_directories_summary(client: TestClient) -> None:
    """Проверка эндпоинта сводки хранилища /api/admin/user-directories/summary."""
    response = client.get("/api/admin/user-directories/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    summary = data["summary"]
    assert summary["total_users"] >= 1
    assert summary["total_files_count"] >= 1
    assert "total_storage_formatted" in summary


def test_api_user_directories_users(client: TestClient) -> None:
    """Проверка эндпоинта списка пользователей /api/admin/user-directories/users."""
    response = client.get("/api/admin/user-directories/users")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data["users"], list)
    assert len(data["users"]) >= 1

    user_item = data["users"][0]
    assert user_item["id"] == 1
    assert user_item["name"] == "Admin"
    assert "quota_percent" in user_item
    assert "size_formatted" in user_item


def test_api_user_directories_tree(client: TestClient) -> None:
    """Проверка получения файлового дерева пользователя."""
    response = client.get("/api/admin/user-directories/users/1/tree")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["total_items"] >= 1
    assert any(item["name"] == "welcome.md" for item in data["items"])


def test_api_user_directories_tree_subfolder_filter(client: TestClient) -> None:
    """Проверка фильтрации по подпапке (например, subfolder=files)."""
    response = client.get("/api/admin/user-directories/users/1/tree?subfolder=files")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert any(item["name"] == "welcome.md" for item in data["items"])


def test_api_user_directories_file_preview_and_download(client: TestClient) -> None:
    """Проверка предпросмотра и скачивания файла."""
    preview_res = client.get("/api/admin/user-directories/users/1/file/preview?path=files/welcome.md")
    assert preview_res.status_code == 200
    pdata = preview_res.json()
    assert pdata["status"] == "ok"
    assert "welcome" in pdata["content"].lower() or "каталог" in pdata["content"].lower()

    download_res = client.get("/api/admin/user-directories/users/1/file/download?path=files/welcome.md")
    assert download_res.status_code == 200
    assert len(download_res.content) > 0


def test_api_user_directories_path_traversal_prevention(client: TestClient) -> None:
    """Проверка защиты от path traversal при запросе файлов."""
    res = client.get("/api/admin/user-directories/users/1/file/preview?path=../../tc.ps1")
    assert res.status_code in (400, 404)


def test_api_user_directories_orphaned_lifecycle(client: TestClient) -> None:
    """Проверка обнаружения и очистки осиротевших каталогов."""
    orphaned_res = client.get("/api/admin/user-directories/orphaned")
    assert orphaned_res.status_code == 200
    data = orphaned_res.json()
    assert data["status"] == "ok"
    assert "orphaned_dirs" in data

    # Создаем тестовую осиротевшую директорию
    orphan_dir = user_manager.users_dir / "temp_orphan_9999"
    orphan_dir.mkdir(parents=True, exist_ok=True)
    (orphan_dir / "dummy.txt").write_text("orphan content", encoding="utf-8")

    # Проверяем, что она появилась в списке
    res_after = client.get("/api/admin/user-directories/orphaned")
    assert res_after.status_code == 200
    names = [d["dir_name"] for d in res_after.json()["orphaned_dirs"]]
    assert "temp_orphan_9999" in names

    # Очищаем осиротевшую директорию
    clean_res = client.post("/api/admin/user-directories/orphaned/clean", json={"dirs": ["temp_orphan_9999"]})
    assert clean_res.status_code == 200
    clean_data = clean_res.json()
    assert clean_data["deleted_count"] >= 1
    assert not orphan_dir.exists()
