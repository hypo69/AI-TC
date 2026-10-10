# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin AI - Unified RAG Router
# =============================================================================
# Description:
#   FastAPI REST API роутер для унифицированного RAG, Pixel RAG и базы знаний.
#
# Usage Examples:
#   Python API:
#     from src.ai.rag.router import init_router
#
#     router = init_router()
#
# File: router.py
# Project: ai-windows-admin
# Package: src.ai.rag
# Author: hypo69
# Copyright: © 2026 hypo69
# Updated: 2026-10-10 22:28:45
# =============================================================================

from __future__ import annotations
"""FastAPI REST API роутер для RAG, Pixel RAG и Unified Knowledge Hub."""

import asyncio
import base64
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from logger import logger
from .unified_hub import UnifiedKnowledgeHub
from .text_rag import TextRAG
from .pixel_rag import PixelRAG

router = APIRouter(prefix="/api/rag", tags=["Unified RAG & Knowledge Hub"])
_hub_instance: Optional[UnifiedKnowledgeHub] = None


def get_hub() -> UnifiedKnowledgeHub:
    """Возвращает или инициализирует глобальный экземпляр UnifiedKnowledgeHub."""
    global _hub_instance
    if _hub_instance is None:
        _hub_instance = UnifiedKnowledgeHub()
    return _hub_instance


class RagSearchRequest(BaseModel):
    """Схема запроса поиска по RAG."""
    query: str = Field(..., description="Поисковый запрос")
    top_k: int = Field(default=5, ge=1, le=50, description="Максимум результатов")
    threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Порог схожести")


class PixelSearchRequest(BaseModel):
    """Схема запроса поиска по Pixel RAG."""
    query: str = Field(..., description="Текстовый запрос или описание")
    top_k: int = Field(default=5, ge=1, le=50, description="Максимум результатов")


class UnifiedResolveRequest(BaseModel):
    """Схема сквозного разрешения артефакта через Unified Knowledge Hub."""
    query: str = Field(..., description="Код ошибки, команда, симптом или запрос")
    image_base64: Optional[str] = Field(default=None, description="Опциональный скриншот в base64")
    sync_gemini: bool = Field(default=True, description="Вызывать ли Gemini при отсутствии в кэше")
    top_k: int = Field(default=5, description="Лимит связанных сниппетов")


@router.get("/status")
async def get_rag_status() -> Dict[str, Any]:
    """Возвращает метрики и статус глобального индекса RAG."""
    hub = get_hub()
    metrics = hub.get_metrics()
    text_count = metrics["text_rag"]["total_documents"]
    pixel_count = metrics["pixel_rag"]["total_images"]
    log_count = metrics["log_rag"]["total_chunks"]

    return {
        "total_documents": text_count,
        "total_chunks": text_count + pixel_count + log_count,
        "total_size_mb": metrics["pixel_rag"]["total_size_mb"],
        "provider": "Gemini Embedding-2 / FAISS / WikiLLM",
        "last_built_at": metrics["pixel_rag"]["last_built_at"],
        "sources": {
            "global_docs": text_count,
            "images": pixel_count,
            "log_chunks": log_count,
            "wiki_entities": metrics["wikillm"]["total_entities"],
        },
    }


@router.post("/search")
async def search_rag(req: RagSearchRequest) -> Dict[str, Any]:
    """Выполняет поиск по текстовому RAG-индексу."""
    hub = get_hub()
    results = await asyncio.to_thread(hub.text_rag.search, req.query, req.top_k, req.threshold)
    return {"results": results, "total_found": len(results)}


@router.get("/pixel/status")
async def get_pixel_rag_status() -> Dict[str, Any]:
    """Возвращает статус и метрики хранилища Pixel RAG."""
    hub = get_hub()
    return hub.pixel_rag.get_status()


@router.post("/pixel/index")
async def index_pixel_images(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Индексирует загруженные изображения в Pixel RAG."""
    hub = get_hub()
    indexed_results: List[Dict[str, Any]] = []

    for file in files:
        try:
            content = await file.read()
            item = hub.pixel_rag.index_image_bytes(
                data=content,
                filename=file.filename or "screenshot.png",
                title=file.filename or "UI Screenshot",
            )
            indexed_results.append(item)
        except Exception as e:
            logger.error(f"[Router RAG] Ошибка индексации изображения {file.filename}: {e}")

    return {
        "status": "ok",
        "indexed_count": len(indexed_results),
        "results": indexed_results,
    }


@router.post("/pixel/search")
async def search_pixel_rag(req: PixelSearchRequest) -> Dict[str, Any]:
    """Выполняет поиск по скриншотам и OCR в Pixel RAG."""
    hub = get_hub()
    results = await asyncio.to_thread(hub.pixel_rag.search_by_text, req.query, req.top_k)
    return {"results": results, "total_found": len(results)}


@router.post("/unified/resolve")
async def unified_resolve(req: UnifiedResolveRequest) -> Dict[str, Any]:
    """Выполняет сквозное разрешение через Unified Knowledge Hub (WikiLLM + Text + Pixel + Log)."""
    hub = get_hub()
    img_bytes = None
    if req.image_base64:
        try:
            img_bytes = base64.b64decode(req.image_base64)
        except Exception as e:
            logger.debug(f"[Router RAG] Не удалось декодировать image_base64: {e}")

    return await hub.resolve_query(
        query=req.query,
        image_bytes=img_bytes,
        sync_gemini=req.sync_gemini,
        top_k=req.top_k,
    )


@router.get("/metrics")
async def get_all_metrics() -> Dict[str, Any]:
    """Возвращает подробные метрики всех слоев знаний."""
    hub = get_hub()
    return hub.get_metrics()


def init_router(hub: Optional[UnifiedKnowledgeHub] = None) -> APIRouter:
    """Инициализирует роутер с опциональным хабом."""
    global _hub_instance
    if hub is not None:
        _hub_instance = hub
    return router
