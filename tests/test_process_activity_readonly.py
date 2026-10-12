# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - Test Process Activity Readonly
# =============================================================================
# Description:
#   Тесты на проверку строгого режима Read-Only для метода get_active_instances
#   в ProcessActivityEngine: метод не должен инициировать сбор процессов или
#   запись в SQLite при запросах от веб-интерфейса.
#
# File: test_process_activity_readonly.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-12 07:27:00
# =============================================================================

from unittest.mock import MagicMock, patch
import pytest
from apps.windows.sdk.core.process_activity_engine import ProcessActivityEngine


def test_get_active_instances_does_not_call_sync_processes():
    """Проверяет, что get_active_instances не вызывает sync_processes и работает строго на чтение."""
    engine = ProcessActivityEngine.get_instance()

    with patch.object(engine, "sync_processes") as mock_sync:
        res = engine.get_active_instances(limit=10)
        assert isinstance(res, list)
        mock_sync.assert_not_called()
