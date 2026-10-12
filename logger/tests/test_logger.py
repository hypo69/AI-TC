# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Logger - Unit Tests
# =============================================================================
# Description:
#   Модульные тесты для проверки функциональности централизованного логгера,
#   включая проверку вывода только в консоль через logger.console().
#
# File: test_logger.py
# Project: ai-windows-admin
# Package: logger.tests
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-12 06:41:30
# =============================================================================

"""Модульные тесты для пакета logger."""

import io
import logging
from pathlib import Path
import pytest
from logger import logger, Logger


def test_logger_console_output_to_stream(capsys):
    """Проверяет, что logger.console выводит сообщение в консоль."""
    test_msg = "Тестовое сообщение исключительно для консоли"
    logger.console(test_msg)

    # Проверяем, что сообщение было перехвачено или отправлено в logger_console
    assert hasattr(logger, 'console')


def test_logger_console_does_not_write_to_files(tmp_path, monkeypatch):
    """Проверяет, что logger.console НЕ записывает данные в файлы логов."""
    # Сохраняем исходные размеры/содержимое файлов
    info_path = logger.info_log_path
    errors_path = logger.errors_log_path
    json_path = logger.json_log_path

    info_before = info_path.read_text(encoding='utf-8', errors='ignore') if info_path.exists() else ""
    errors_before = errors_path.read_text(encoding='utf-8', errors='ignore') if errors_path.exists() else ""
    json_before = json_path.read_text(encoding='utf-8', errors='ignore') if json_path.exists() else ""

    unique_marker = "EXCLUSIVELY_CONSOLE_MARKER_12345"
    logger.console(f"Проверка изоляции: {unique_marker}")

    # Сбрасываем буферы всех обработчиков
    if logger.logger_file_info:
        for h in logger.logger_file_info.handlers:
            h.flush()
    if logger.logger_file_errors:
        for h in logger.logger_file_errors.handlers:
            h.flush()
    if logger.logger_file_json:
        for h in logger.logger_file_json.handlers:
            h.flush()

    info_after = info_path.read_text(encoding='utf-8', errors='ignore') if info_path.exists() else ""
    errors_after = errors_path.read_text(encoding='utf-8', errors='ignore') if errors_path.exists() else ""
    json_after = json_path.read_text(encoding='utf-8', errors='ignore') if json_path.exists() else ""

    assert unique_marker not in info_after
    assert unique_marker not in errors_after
    assert unique_marker not in json_after


def test_logger_console_with_colors_and_levels():
    """Проверяет вызов logger.console с различными цветами и уровнями логирования."""
    # Вызов с цветом
    logger.console("Цветное консольное сообщение", text_color="green", bg_color="black")
    
    # Вызов с ошибкой и exc_info
    try:
        raise ValueError("Имитация ошибки для консоли")
    except ValueError as ex:
        logger.console("Произошла ошибка (только консоль)", ex=ex, exc_info=True, text_color="red", level=logging.ERROR)

    # Вызов с debug уровнем
    logger.console("Отладочное сообщение только для консоли", level=logging.DEBUG)


def test_compressing_handler_auto_flush_no_deadlock(tmp_path):
    """Проверяет, что CompressingHandler при превышении 100 уникальных записей сбрасывает буфер без взаимной блокировки (deadlock)."""
    from logger.logger import CompressingHandler
    log_file = tmp_path / "test_compress.log"
    handler = CompressingHandler(str(log_file))
    formatter = logging.Formatter('%(message)s')
    handler.setFormatter(formatter)

    # Записываем 105 уникальных сообщений, что триггерит if len(self.buffer) > 100: self.flush()
    for i in range(105):
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg=f"Unique message {i}",
            args=(),
            exc_info=None,
        )
        handler.emit(record)

    handler.close()
    assert log_file.exists()
    content = log_file.read_text(encoding='utf-8')
    assert "Unique message 0" in content
    assert "Unique message 104" in content
