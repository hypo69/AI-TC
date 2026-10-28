/**
 * =============================================================================
 * Название: Панель семантического RAG-поиска по журналу событий
 * =============================================================================
 * Описание:
 *   Динамический поиск по кластерам, аномалиям и шаблонам логов через TF-IDF/BM25
 *   с нулевым расходом токенов языковой модели.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_rag/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml, getSeverityClass } from '../common/ui_utils.js';

/**
 * Выполняет семантический запрос по динамическому RAG-индексу логов.
 * @param {string} currentChannel - Имя текущего канала.
 */
export async function performRAGSearch(currentChannel = 'System') {
  const inputEl = document.getElementById('slc-rag-input');
  const resultsEl = document.getElementById('slc-rag-results');
  if (!inputEl || !resultsEl) return;

  const query = inputEl.value.trim();
  if (!query) return;

  resultsEl.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-info me-2"></div>Поиск по динамическому RAG-индексу...</div>`;

  try {
    const res = await fetch('/api/v1/system_logs/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, channel: currentChannel, top_k: 6 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      resultsEl.innerHTML = `
        <div class="card bg-dark border-secondary p-4 text-center text-muted">
          По запросу «${escapeHtml(query)}» ничего не найдено в RAG-индексе. Попробуйте нажать «Перестроить RAG-индекс».
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = results.map((r) => {
      const badgeClass = getSeverityClass(r.meta?.level || 'info');
      return `
        <div class="card bg-dark border-secondary mb-3 shadow-sm">
          <div class="card-header bg-black d-flex justify-content-between align-items-center">
            <span class="fw-bold text-info"><i class="bi bi-file-earmark-text me-2"></i>${escapeHtml(r.title)}</span>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${badgeClass}">${escapeHtml(r.meta?.level || r.type)}</span>
              <span class="badge bg-secondary font-monospace">Score: ${r.relevance_score}</span>
            </div>
          </div>
          <div class="card-body">
            <pre class="bg-black text-light p-3 rounded font-monospace small mb-0" style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(r.text)}</pre>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    resultsEl.innerHTML = `<div class="alert alert-danger">Ошибка поиска RAG: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Инициирует перестроение динамического RAG-индекса для выбранного канала.
 * @param {string} currentChannel - Имя текущего канала.
 * @param {string} currentFilePath - Путь к файлу лога.
 */
export async function rebuildRAGIndex(currentChannel = 'System', currentFilePath = '') {
  const resultsEl = document.getElementById('slc-rag-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-info me-2"></div>Перестроение динамического RAG-индекса для «${escapeHtml(currentChannel)}»...</div>`;

  try {
    const res = await fetch(`/api/v1/system_logs/rag/build?channel=${encodeURIComponent(currentChannel)}&limit=500&hours=24&file_path=${encodeURIComponent(currentFilePath)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    resultsEl.innerHTML = `
      <div class="alert alert-success d-flex align-items-center gap-2">
        <i class="bi bi-check-circle-fill fs-5"></i>
        <div>
          <strong>RAG-индекс успешно обновлен!</strong> Добавлено ${data.chunks_added} чанков (Всего в индексе: ${data.total_index_chunks}).
          <div class="small mt-1 text-light">${escapeHtml(data.executive_summary)}</div>
        </div>
      </div>
    `;
  } catch (err) {
    resultsEl.innerHTML = `<div class="alert alert-danger">Ошибка перестроения RAG: ${escapeHtml(err.message)}</div>`;
  }
}
