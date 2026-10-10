# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Wikillm -   Init  
# =============================================================================
# Description:
#   Инициализатор пакета WikiLLM (Progressive Knowledge Acquisition + Retrieval)
#
# Usage Examples:
#
#
# File: __init__.py
# Project: ai-windows-admin
# Package: apps.windows.wikillm
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 17:35:00
# =============================================================================

"""Инициализатор пакета WikiLLM (Progressive Knowledge Acquisition + Retrieval).

Реэкспортирует основные компоненты из корневого пакета src.ai.wikillm.
"""

from src.ai.wikillm import (
    WikiLLMEngine,
    WikiStorage,
    WikiLLMConfig,
    load_config,
    ArtifactExtractor,
    CanonicalKeyNormalizer,
    CodeKnowledgeIndexer,
    TelemetryWikiBridge,
    router,
    init_router,
    ArtifactInput,
    ArtifactType,
    KnowledgeEntity,
    KnowledgeSource,
    LookupLevel,
    ResolutionResult,
    ResolutionAction,
    Claim,
    Evidence,
    ObservationRecord,
    DiagnosticKnowledge,
    CodeKnowledge,
)

__all__ = [
    "WikiLLMEngine",
    "WikiStorage",
    "WikiLLMConfig",
    "load_config",
    "ArtifactExtractor",
    "CanonicalKeyNormalizer",
    "CodeKnowledgeIndexer",
    "TelemetryWikiBridge",
    "router",
    "init_router",
    "ArtifactInput",
    "ArtifactType",
    "KnowledgeEntity",
    "KnowledgeSource",
    "LookupLevel",
    "ResolutionResult",
    "ResolutionAction",
    "Claim",
    "Evidence",
    "ObservationRecord",
    "DiagnosticKnowledge",
    "CodeKnowledge",
]

