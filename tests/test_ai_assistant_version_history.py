# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - AI Assistant Smart Version History
# =============================================================================
# Description:
#   Модульные и интеграционные тесты модуля умной истории версий (apps/ai_assistant):
#   тестирование GitAdapter, WikiAdapter, SmartHistoryRAGRetriever,
#   координатора SmartHistoryOrchestrator и эндпоинтов FastAPI REST API.
#
# File: test_ai_assistant_version_history.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-15 07:35:00
# =============================================================================

from __future__ import annotations
"""Тесты для модуля умной истории версий (Git + WikiLLM + RAG)."""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from apps.ai_assistant.git_adapter import GitAdapter
from apps.ai_assistant.models import (
    DiffHunk,
    FileChange,
    GitCommitInfo,
    QueryRequest,
    QueryResponse,
)
from apps.ai_assistant.orchestrator import SmartHistoryOrchestrator
from apps.ai_assistant.rag_retriever import SmartHistoryRAGRetriever
from apps.ai_assistant.wiki_adapter import WikiAdapter
from apps.windows.api.server import create_app


def test_git_adapter_availability() -> None:
    """Проверяет доступность Git и получение текущего хэша HEAD."""
    adapter = GitAdapter()
    assert adapter.is_git_available() is True, "Git должен быть доступен в текущем репозитории"
    head = adapter.get_current_commit()
    assert len(head) == 40, f"Хэш HEAD должен содержать 40 символов SHA-1, получено: {head}"


def test_git_adapter_commit_history() -> None:
    """Проверяет извлечение списка недавних коммитов."""
    adapter = GitAdapter()
    commits = adapter.get_commit_history(max_count=5)
    assert len(commits) > 0, "История коммитов не должна быть пустой"
    first = commits[0]
    assert len(first.commit_hash) == 40
    assert first.author != ""
    assert first.message != ""


def test_git_adapter_commit_details_and_diff() -> None:
    """Проверяет получение деталей коммита и его diff."""
    adapter = GitAdapter()
    commits = adapter.get_commit_history(max_count=1)
    assert len(commits) > 0
    top_hash = commits[0].commit_hash

    c_info, changes = adapter.get_commit_details(top_hash)
    assert c_info is not None
    assert c_info.commit_hash == top_hash

    diff_text = adapter.get_file_diff(top_hash)
    assert isinstance(diff_text, str)


def test_wiki_adapter_links_in_memory() -> None:
    """Проверяет создание и выборку связей knowledge_links в базе данных."""
    wiki = WikiAdapter(db_path=":memory:")
    link = wiki.add_link(
        source_type="commit",
        source_id="11223344556677889900aabbccddeeff11223344",
        relation_type="fixes",
        target_type="error",
        target_id="ERR_TELEMETRY_CRASH",
        confidence=0.95,
        provenance="test_case",
    )
    assert link.relation_type == "fixes"
    assert link.target_id == "ERR_TELEMETRY_CRASH"

    # Выборка по источнику
    by_source = wiki.get_links_for_source("commit", "11223344556677889900aabbccddeeff11223344")
    assert len(by_source) == 1
    assert by_source[0].target_id == "ERR_TELEMETRY_CRASH"

    # Выборка по цели
    by_target = wiki.get_links_for_target("error", "ERR_TELEMETRY_CRASH")
    assert len(by_target) == 1


def test_wiki_adapter_auto_link() -> None:
    """Проверяет авто-определение связей из сообщения коммита."""
    wiki = WikiAdapter(db_path=":memory:")
    commit = GitCommitInfo(
        commit_hash="deadbeef1234567890abcdef1234567890abcdef",
        author="Tester <test@example.com>",
        timestamp="2026-10-15T07:00:00Z",
        message="Fixes: #404 Исправлена ошибка инициализации телеметрии в collector.py",
    )
    files = [
        FileChange(file_path="apps/windows/telemetry/collector.py", change_type="M"),
    ]

    links = wiki.auto_link_commit(commit, files)
    assert len(links) >= 2
    relations = [l.relation_type for l in links]
    assert "modifies" in relations
    assert "fixes" in relations


def test_rag_retriever_incremental_indexing(tmp_path: Path) -> None:
    """Проверяет инкрементальную индексацию и поиск в RAG-ретривере."""
    rag = SmartHistoryRAGRetriever(index_dir=tmp_path / "rag_test")

    commit = GitCommitInfo(
        commit_hash="abcdef0123456789abcdef0123456789abcdef01",
        author="Dev <dev@test.com>",
        timestamp="2026-10-15T07:10:00Z",
        message="Оптимизация опроса датчиков температуры NPU",
    )
    hunks = [
        DiffHunk(
            file_path="apps/windows/telemetry/sensor_collector.py",
            commit_hash=commit.commit_hash,
            old_start=10,
            old_lines=5,
            new_start=10,
            new_lines=8,
            hunk_text="@@ -10,5 +10,8 @@\n+    # Добавлен TTL кэш для NPU\n+    cached_npu_metrics()",
        )
    ]

    added = rag.index_commit(commit, hunks)
    assert added == 2, "Должно быть добавлено 2 чанка: сообщение коммита и diff-фрагмент"

    # Повторная индексация того же коммита должна пропустить дубликаты (zero-token)
    added_again = rag.index_commit(commit, hunks)
    assert added_again == 0, "Повторный коммит с теми же хэшами должен быть пропущен"

    # Поиск по ключевому слову
    results = rag.search("датчики температуры NPU", top_k=3)
    assert len(results) > 0
    assert results[0]["commit_hash"] == commit.commit_hash


@pytest.mark.asyncio
async def test_orchestrator_pipeline_execution(tmp_path: Path) -> None:
    """Проверяет полный 5-этапный конвейер поиска координатора."""
    wiki = WikiAdapter(db_path=":memory:")
    rag = SmartHistoryRAGRetriever(index_dir=tmp_path / "rag_orch")
    git = GitAdapter()

    orchestrator = SmartHistoryOrchestrator(
        git_adapter=git,
        wiki_adapter=wiki,
        rag_retriever=rag,
    )

    req = QueryRequest(
        query="Когда исправлялась телеметрия?",
        top_k=3,
        include_diff=True,
    )
    response = await orchestrator.execute_query(req)

    assert isinstance(response, QueryResponse)
    assert response.status == "ok"
    assert len(response.explanation) > 0
    assert len(response.suggested_quick_questions) > 0


def test_api_router_endpoints() -> None:
    """Проверяет доступность эндпоинтов модуля умной истории через FastAPI TestClient."""
    app = create_app()
    client = TestClient(app)

    # 1. Проверка статуса модуля
    res_status = client.get("/api/v1/ai-assistant/version-history/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert data_status["status"] == "ok"
    assert data_status["git_available"] is True

    # 2. Список коммитов
    res_commits = client.get("/api/v1/ai-assistant/version-history/commits?max_count=3")
    assert res_commits.status_code == 200
    data_commits = res_commits.json()
    assert data_commits["status"] == "ok"
    assert len(data_commits["commits"]) > 0

    top_hash = data_commits["commits"][0]["commit_hash"]

    # 3. Получение diff
    res_diff = client.get(f"/api/v1/ai-assistant/version-history/diff?commit_hash={top_hash}")
    assert res_diff.status_code == 200
    assert res_diff.json()["status"] in ("ok", "not_found")

    # 4. Проверка связей графа знаний
    res_links = client.get("/api/v1/ai-assistant/version-history/knowledge-links?limit=5")
    assert res_links.status_code == 200
    assert res_links.json()["status"] == "ok"

    # 5. Выполнение запроса через POST /query
    res_query = client.post(
        "/api/v1/ai-assistant/version-history/query",
        json={"query": "Показать последние изменения", "top_k": 2},
    )
    assert res_query.status_code == 200
    data_query = res_query.json()
    assert data_query["status"] == "ok"
    assert "explanation" in data_query
    assert len(data_query["suggested_quick_questions"]) > 0
