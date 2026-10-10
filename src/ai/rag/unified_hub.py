# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin AI - Unified Knowledge Hub
# =============================================================================
# Description:
#   Единый координатор знаний ИИ, объединяющий WikiLLM, Text RAG,
#   Pixel RAG и Log RAG в сквозной конвейер извлечения и самообучения.
#
# Usage Examples:
#   Python API:
#     from src.ai.rag.unified_hub import UnifiedKnowledgeHub
#
#     hub = UnifiedKnowledgeHub()
#     result = await hub.resolve_query("0x80070490")
#
# File: unified_hub.py
# Project: ai-windows-admin
# Package: src.ai.rag
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 17:35:00
# =============================================================================

from __future__ import annotations
"""Единый координатор знаний: WikiLLM + Text RAG + Pixel RAG + Log RAG."""

import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from logger import logger
from src.ai.wikillm.engine import WikiLLMEngine
from src.ai.wikillm.extractor import ArtifactExtractor
from src.ai.wikillm.models import ArtifactInput, ResolutionResult
from src.ai.wikillm.storage import WikiStorage
from .text_rag import TextRAG
from .pixel_rag import PixelRAG
from .log_rag import LogRAG


class UnifiedKnowledgeHub:
    """Единый координационный хаб знаний платформы AI Windows Admin.

    Интегрирует детерминированную прогрессивную базу знаний WikiLLM ($O(1)$ кэш),
    векторный поиск документов TextRAG, визуальный мультимодальный поиск PixelRAG
    и адаптивный анализ журналов LogRAG.

    Attributes:
        wikillm: Экземпляр движка WikiLLMEngine.
        text_rag: Экземпляр текстового векторного хранилища TextRAG.
        pixel_rag: Экземпляр визуального хранилища скриншотов PixelRAG.
        log_rag: Экземпляр адаптивного анализатора журналов LogRAG.
    """

    def __init__(
        self,
        base_dir: Optional[Path] = None,
        wikillm_engine: Optional[WikiLLMEngine] = None,
        text_rag: Optional[TextRAG] = None,
        pixel_rag: Optional[PixelRAG] = None,
        log_rag: Optional[LogRAG] = None,
    ) -> None:
        """Инициализирует UnifiedKnowledgeHub.

        Args:
            base_dir: Базовая директория для данных и индексов.
            wikillm_engine: Пользовательский экземпляр WikiLLMEngine.
            text_rag: Пользовательский экземпляр TextRAG.
            pixel_rag: Пользовательский экземпляр PixelRAG.
            log_rag: Пользовательский экземпляр LogRAG.
        """
        root = base_dir or Path("data/rag")
        root.mkdir(parents=True, exist_ok=True)

        self.wikillm = wikillm_engine or WikiLLMEngine()
        self.text_rag = text_rag or TextRAG(db_path=root / "text_index")
        self.pixel_rag = pixel_rag or PixelRAG(storage_dir=root / "pixel_storage")
        self.log_rag = log_rag or LogRAG(storage_dir=root / "logs_storage")

    async def resolve_query(
        self,
        query: str,
        image_bytes: Optional[bytes] = None,
        sync_gemini: bool = True,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """Сквозное разрешение запроса через согласованный конвейер знаний.

        1. Проверка визуального слоя PixelRAG (при наличии скриншота).
        2. Извлечение артефактов и $O(1)$ поиск в WikiLLM (L1 Exact / L2 Fingerprint).
        3. Полнотекстовый и векторный поиск в TextRAG и LogRAG.
        4. Синтез нового знания через Gemini при промахе кэша (L4 Resolver).

        Args:
            query: Текстовый поисковый запрос, код ошибки или имя команды.
            image_bytes: Опциональные байты скриншота или изображения.
            sync_gemini: Разрешать ли синхронный вызов LLM при отсутствии точного кэша.
            top_k: Количество контекстных сниппетов для векторного поиска.

        Returns:
            Словарь с унифицированным ответом, сущностью WikiLLM, визуальными совпадениями и RAG-контекстом.
        """
        start_t = time.perf_counter()
        results: Dict[str, Any] = {
            "query": query,
            "wikillm": None,
            "pixel_matches": [],
            "text_rag_matches": [],
            "log_rag_matches": [],
            "source": "not_found",
            "execution_time_ms": 0.0,
        }

        # 1. Поиск в PixelRAG если передано изображение
        if image_bytes:
            try:
                results["pixel_matches"] = self.pixel_rag.search_by_visual(image_bytes, top_k=top_k)
            except Exception as e:
                logger.debug(f"[UnifiedKnowledgeHub] Ошибка визуального поиска PixelRAG: {e}")

        # 2. Поиск в WikiLLM (L1/L2/L3/L4)
        extracted = ArtifactExtractor.from_raw_text(query)
        art = extracted[0] if extracted else ArtifactInput(raw_query=query)

        try:
            wiki_res: ResolutionResult = await self.wikillm.resolve(art, sync_gemini=sync_gemini)
            if wiki_res.entity:
                results["wikillm"] = {
                    "canonical_key": wiki_res.entity.canonical_key,
                    "name": wiki_res.entity.name,
                    "category": wiki_res.entity.category,
                    "severity": wiki_res.entity.severity,
                    "summary": wiki_res.entity.summary,
                    "lookup_level": wiki_res.lookup_level.value,
                    "cached": wiki_res.cached,
                    "diagnostic_info": wiki_res.entity.diagnostic_info.model_dump() if wiki_res.entity.diagnostic_info else None,
                    "code_info": wiki_res.entity.code_info.model_dump() if wiki_res.entity.code_info else None,
                    "claims": [c.model_dump() for c in wiki_res.entity.claims],
                }
                results["source"] = "wikillm"
        except Exception as e:
            logger.debug(f"[UnifiedKnowledgeHub] Ошибка разрешения WikiLLM: {e}")

        # 3. Дополнительное обогащение контекстом из TextRAG и LogRAG
        try:
            results["text_rag_matches"] = self.text_rag.search(query, top_k=top_k)
        except Exception as e:
            logger.debug(f"[UnifiedKnowledgeHub] Ошибка TextRAG: {e}")

        try:
            results["log_rag_matches"] = self.log_rag.search_chunks(query, top_k=top_k)
        except Exception as e:
            logger.debug(f"[UnifiedKnowledgeHub] Ошибка LogRAG: {e}")

        if results["source"] == "not_found":
            if results["text_rag_matches"] or results["log_rag_matches"] or results["pixel_matches"]:
                results["source"] = "hybrid_rag"

        results["execution_time_ms"] = round((time.perf_counter() - start_t) * 1000.0, 2)
        return results

    def search_all(self, query: str, top_k: int = 5) -> Dict[str, Any]:
        """Синхронный мульти-поиск по всем хранилищам знаний.

        Args:
            query: Строка поискового запроса.
            top_k: Лимит результатов для каждого хранилища.

        Returns:
            Словарь с объединенными результатами поиска.
        """
        wiki_results = [
            {
                "canonical_key": e.canonical_key,
                "name": e.name,
                "summary": e.summary,
                "category": e.category,
            }
            for e in self.wikillm.storage.search_fts(query, limit=top_k)
        ]

        text_results = self.text_rag.search(query, top_k=top_k)
        pixel_results = self.pixel_rag.search_by_text(query, top_k=top_k)
        log_results = self.log_rag.search_chunks(query, top_k=top_k)

        return {
            "query": query,
            "wikillm": wiki_results,
            "text_rag": text_results,
            "pixel_rag": pixel_results,
            "log_rag": log_results,
            "total_found": len(wiki_results) + len(text_results) + len(pixel_results) + len(log_results),
        }

    def get_metrics(self) -> Dict[str, Any]:
        """Возвращает агрегированные метрики всех подсистем знаний."""
        return {
            "wikillm": self.wikillm.get_metrics(),
            "text_rag": {
                "total_documents": self.text_rag.count(),
            },
            "pixel_rag": self.pixel_rag.get_status(),
            "log_rag": self.log_rag.get_stats(),
        }
