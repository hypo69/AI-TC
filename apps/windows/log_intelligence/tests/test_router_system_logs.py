# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Log_Intelligence Tests - Test Router System Logs
# =============================================================================
# Description:
#   Тесты FastAPI роутера System Logs Viewer для проверки In-Memory RAG эндпоинтов.
#
# Usage Examples:
#   pytest apps/windows/log_intelligence/tests/test_router_system_logs.py -v
#
# File: test_router_system_logs.py
# Project: ai-windows-admin
# Package: apps.windows.log_intelligence.tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 17:50:00
# =============================================================================

"""Тесты эндпоинтов FastAPI роутера System Logs Viewer."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from apps.windows.api.routers.router_system_logs import router


@pytest.fixture
def client() -> TestClient:
    """Создать тестовый клиент FastAPI с подключенным роутером системных логов."""
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_router_rag_status_endpoint(client: TestClient) -> None:
    """Проверка эндпоинта /api/v1/system_logs/rag/status."""
    response = client.get('/api/v1/system_logs/rag/status')
    assert response.status_code == 200
    data = response.json()
    assert data['storage_mode'] == 'RAM_IN_MEMORY'
    assert 'total_events' in data


def test_router_rag_build_and_query_endpoints(client: TestClient) -> None:
    """Проверка сборки RAG индекса за разные периоды (сутки, неделя, месяц, все время) и поиска."""
    for h in [24, 168, 720, 0]:
        build_resp = client.post(f'/api/v1/system_logs/rag/build?all_channels=true&hours={h}&limit=10')
        assert build_resp.status_code == 200
        b_data = build_resp.json()
        assert b_data['status'] == 'ok'
        assert b_data['storage_mode'] == 'RAM_IN_MEMORY'
        assert b_data['indexed_events'] >= 0
        assert b_data['hours'] == h
        assert 'period_label' in b_data

    query_resp = client.post(
        '/api/v1/system_logs/rag/query',
        json={'query': 'ошибка или сбой системы', 'channel': 'all', 'top_k': 10},
    )
    assert query_resp.status_code == 200
    q_data = query_resp.json()
    assert q_data['storage_mode'] == 'RAM_IN_MEMORY'
    assert isinstance(q_data['results'], list)


def test_router_timeline_endpoint(client: TestClient) -> None:
    """Проверка эндпоинта /api/v1/system_logs/timeline с параметрами фильтрации и GitHub heatmap."""
    response = client.get('/api/v1/system_logs/timeline?channel=System&hours=24&limit=50')
    assert response.status_code == 200
    data = response.json()
    assert 'histogram' in data
    assert 'heatmap' in data
    assert 'summary' in data
    assert 'top_providers' in data
    assert isinstance(data['histogram'], list)
    assert len(data['heatmap']) == 7
    assert len(data['heatmap'][0]) == 24
    assert data['summary']['total_events'] >= 0


