# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Tests - Diagnostics Prompt Resolver
# =============================================================================
# Description:
#   Тесты механизма разрешения и привязки системных инструкций и промптов
#   к идентификаторам панелей (panel_id) и типам таблиц (table_type).
#
# File: test_diagnostics_prompt_resolver.py
# Project: ai-windows-admin
# Package: tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-12 07:07:00
# =============================================================================

from __future__ import annotations

from pathlib import Path
import pytest
from apps.windows.api.diagnostics_prompt_manager import (
    DiagnosticsPromptManager,
    DEFAULT_PROMPTS,
)


def test_get_template_by_table_type(tmp_path: Path) -> None:
    """Проверка возврата стандартного шаблона по table_type."""
    mgr = DiagnosticsPromptManager(storage_dir=tmp_path)
    tmpl = mgr.get_template("cpu")
    assert tmpl.table_type == "cpu"
    assert "процессора" in tmpl.name.lower()
    assert not tmpl.is_customized


def test_get_template_by_panel_id_fallback_to_table_type(tmp_path: Path) -> None:
    """Если кастомного файла для panel_id нет, резолвер откатывается к table_type."""
    mgr = DiagnosticsPromptManager(storage_dir=tmp_path)
    tmpl = mgr.get_template("security_event", panel_id="panel-system-control-3")
    assert tmpl.table_type == "security_event"
    assert "безопасности" in tmpl.name.lower()
    assert not tmpl.is_customized


def test_save_and_resolve_by_panel_id(tmp_path: Path) -> None:
    """Сохранение кастомной инструкции для конкретной панели имеет приоритет."""
    mgr = DiagnosticsPromptManager(storage_dir=tmp_path)
    panel_id = "panel-system-control-defender-filter"

    # Сохраняем индивидуальную инструкцию именно для этой панели
    saved = mgr.save_template(
        target_key=panel_id,
        system_instruction="Ты — эксперт по анализу журналов Microsoft Defender.",
        prompt_template="Анализ события Defender: {title}\n{metadata}",
        name="Инструкция для панели Defender",
    )
    assert saved.table_type == panel_id
    assert saved.is_customized

    # Проверяем, что get_template с указанием panel_id возвращает именно ее
    resolved = mgr.get_template("security_event", panel_id=panel_id)
    assert resolved.table_type == panel_id
    assert resolved.system_instruction == "Ты — эксперт по анализу журналов Microsoft Defender."
    assert resolved.is_customized

    # А для другой панели или без panel_id возвращается стандартный security_event
    default_tmpl = mgr.get_template("security_event", panel_id="panel-system-control-other")
    assert default_tmpl.table_type == "security_event"
    assert not default_tmpl.is_customized


def test_reset_template_by_panel_id(tmp_path: Path) -> None:
    """Сброс шаблона конкретной панели удаляет файл и откатывается к базовому типу."""
    mgr = DiagnosticsPromptManager(storage_dir=tmp_path)
    panel_id = "panel-proc-top-cpu"

    mgr.save_template(
        target_key=panel_id,
        system_instruction="Кастомная инструкция для топ CPU",
        prompt_template="Шаблон: {title}",
        name="Топ CPU Процессы",
    )

    # Проверяем наличие
    assert (tmp_path / f"{panel_id}.json").exists()

    # Сбрасываем
    reset_tmpl = mgr.reset_template(panel_id, fallback_table_type="process")
    assert not (tmp_path / f"{panel_id}.json").exists()
    assert reset_tmpl.table_type == "process"
    assert not reset_tmpl.is_customized
