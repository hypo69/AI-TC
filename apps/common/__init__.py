# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Common - Package Init
# =============================================================================
# Description:
#   Общие вспомогательные утилиты для приложений Windows.
#
# File: __init__.py
# Project: ai-windows-admin
# Package: apps.common
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 19:36:50
# =============================================================================

from __future__ import annotations
"""Общие компоненты и утилиты приложений."""

from apps.common.telemetry_logger import AppTelemetryLogger

__all__ = [
    'AppTelemetryLogger',
]
