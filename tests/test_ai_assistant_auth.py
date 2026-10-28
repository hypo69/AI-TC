# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI Assistant - Google OAuth & Auth Router Tests
# =============================================================================
# Description:
#   Модульные тесты проверки маршрутов Google OAuth 2.0 авторизации,
#   проверки профиля (/auth/check), страницы входа (/auth/google)
#   и управления пулом аккаунтов Google Workspace.
#
# Usage Examples:
#   pytest tests/test_ai_assistant_auth.py -v
#
# File: test_ai_assistant_auth.py
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-22 13:00:00
# =============================================================================

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.ai_assistant.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Создает тестовый клиент автономного приложения AI Assistant."""
    return TestClient(app)


def test_auth_check_endpoint(client: TestClient) -> None:
    """Проверяет эндпоинт проверки статуса авторизации /auth/check."""
    resp = client.get("/auth/check")
    assert resp.status_code == 200
    data = resp.json()
    assert "authenticated" in data
    assert "email" in data
    assert "name" in data
    assert "has_google" in data
    assert "accounts" in data
    assert isinstance(data["accounts"], list)


def test_auth_google_page_endpoint(client: TestClient) -> None:
    """Проверяет отдачу страницы авторизации Google OAuth /auth/google."""
    resp = client.get("/auth/google?next=/ai_assistant")
    assert resp.status_code == 200
    assert "Google OAuth Авторизация" in resp.text
    assert "btn-trigger-oauth" in resp.text


def test_auth_logout_endpoint(client: TestClient) -> None:
    """Проверяет эндпоинт завершения сессии /auth/logout."""
    resp = client.post("/auth/logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"


def test_google_accounts_list_endpoint(client: TestClient) -> None:
    """Проверяет получение списка Google аккаунтов /api/v1/auth/google-accounts."""
    resp = client.get("/api/v1/auth/google-accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    assert "accounts" in data
    assert isinstance(data["accounts"], list)


def test_google_account_test_endpoint(client: TestClient) -> None:
    """Проверяет эндпоинт тестирования токена Google аккаунта."""
    resp = client.post("/api/v1/auth/google-accounts/davidka/test")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "name" in data
    assert data["name"] == "davidka"
