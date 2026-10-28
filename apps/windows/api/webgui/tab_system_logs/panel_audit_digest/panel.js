/**
 * =============================================================================
 * Название: Панель интеллектуального аудита логов (Smart Digest)
 * =============================================================================
 * Описание:
 *   Многоуровневый аудит массива логов с фильтрацией шума, дедупликацией,
 *   шаблонизацией сообщений и детекцией аномалий без расхода токенов LLM.
 *
 * Файл: apps/windows/api/webgui/tab_system_logs/panel_audit_digest/panel.js
 * Пакет: windows/api/webgui/tab_system_logs
 * Автор: hypo69
 * Updated: 2026-10-17 01:25:00
 * =============================================================================
 */

import { escapeHtml, getSeverityClass } from '../common/ui_utils.js';

/**
 * Запрашивает и отображает результаты интеллектуального аудита журнала.
 * @param {string} currentChannel - Имя текущего канала.
 * @param {string} currentFilePath - Путь к файлу лога.
 */
export async function loadAuditView(currentChannel = 'System', currentFilePath = '') {
  const contentEl = document.getElementById('slc-audit-content');
  if (!contentEl) return;

  const hoursSelect = document.getElementById('slc-hours-select');
  const limitSelect = document.getElementById('slc-limit-select');
  const hours = hoursSelect ? hoursSelect.value : '24';
  const limit = limitSelect ? limitSelect.value : '500';

  contentEl.innerHTML = `
    <div class="text-center py-5 text-muted">
      <div class="spinner-border text-info mb-3" role="status"></div>
      <div class="fw-bold text-light">Выполняется многоуровневый аудит массива логов...</div>
      <div class="small text-secondary mt-1">Фильтрация шума • Шаблонизация • Детекция аномалий • Сжатие данных</div>
    </div>
  `;

  try {
    const url = `/api/v1/system_logs/audit?channel=${encodeURIComponent(currentChannel)}&limit=${limit}&hours=${hours}&file_path=${encodeURIComponent(currentFilePath)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const anomaliesHtml = (data.anomalies || []).map((a) => {
      const badgeClass = getSeverityClass(a.level);
      return `
        <div class="p-2 mb-2 rounded bg-black border border-secondary d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <span class="badge ${badgeClass} text-uppercase me-2">${escapeHtml(a.level)}</span>
            <strong class="text-info">${escapeHtml(a.provider)}</strong>
            <span class="text-muted font-monospace small">(ID ${a.event_id})</span>
            <div class="small text-light mt-1 font-monospace" style="word-break: break-word;">${escapeHtml(a.sample)}</div>
            <div class="small text-secondary mt-1"><i class="bi bi-clock me-1"></i>Окно: ${escapeHtml(a.time_window)}</div>
          </div>
          <div class="text-end">
            <span class="badge bg-danger rounded-pill px-3 py-2 fs-6">${a.count}x</span>
          </div>
        </div>
      `;
    }).join('') || `<div class="text-success small p-2"><i class="bi bi-check-circle me-1"></i>Аномалий и критических сбоев не обнаружено.</div>`;

    const clustersHtml = (data.top_clusters || []).map((cl, idx) => {
      const badgeClass = getSeverityClass(cl.level);
      return `
        <tr class="small">
          <td class="text-center font-monospace">${idx + 1}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(cl.level)}</span></td>
          <td class="text-info text-truncate" style="max-width: 140px;" title="${escapeHtml(cl.provider)}">${escapeHtml(cl.provider)}</td>
          <td class="text-center font-monospace">${cl.event_id || '-'}</td>
          <td class="font-monospace text-light" style="max-width: 320px; word-break: break-word;" title="${escapeHtml(cl.template)}">${escapeHtml(cl.template)}</td>
          <td class="text-center"><span class="badge bg-secondary font-monospace">${cl.count}</span></td>
          <td class="small text-secondary font-monospace text-nowrap">${escapeHtml(cl.first_seen)}</td>
        </tr>
      `;
    }).join('');

    const totalScanned = data.total_analyzed ?? data.total_scanned ?? 0;
    const uniqueCount = data.unique_patterns_count ?? (data.top_clusters ? data.top_clusters.length : 0);
    const redundancyPct = data.redundancy_pct !== undefined ? `${data.redundancy_pct.toFixed(1)}%` : (data.compression_ratio || '0%');
    const errSum = (data.error_count || 0) + (data.critical_count || 0);
    const warnSum = data.warning_count || 0;
    const summaryText = data.strategy_rationale || data.executive_summary || `Стратегия обработки: ${data.strategy || 'Стандартная'}. Найдено ${uniqueCount} ключевых шаблонов.`;

    contentEl.innerHTML = `
      <!-- Карточка общей сводки аудита -->
      <div class="card bg-dark border-info mb-2 shadow-sm">
        <div class="card-header bg-black text-info fw-bold py-1 px-3 d-flex justify-content-between align-items-center small">
          <span><i class="bi bi-cpu me-1"></i>Сводка аудита: ${escapeHtml(data.channel)}</span>
          <span class="badge bg-info text-dark font-monospace">Дублирование: ${redundancyPct}</span>
        </div>
        <div class="card-body p-2">
          <div class="row g-2 text-center mb-2">
            <div class="col-sm-3 col-6">
              <div class="p-1 rounded bg-black border border-secondary">
                <div class="small text-muted" style="font-size: 0.72rem;">Просканировано</div>
                <div class="fs-5 fw-bold text-light font-monospace">${totalScanned}</div>
              </div>
            </div>
            <div class="col-sm-3 col-6">
              <div class="p-1 rounded bg-black border border-secondary">
                <div class="small text-muted" style="font-size: 0.72rem;">Шаблонов</div>
                <div class="fs-5 fw-bold text-info font-monospace">${uniqueCount}</div>
              </div>
            </div>
            <div class="col-sm-3 col-6">
              <div class="p-1 rounded bg-black border border-secondary">
                <div class="small text-muted" style="font-size: 0.72rem;">Ошибок / Сбоев</div>
                <div class="fs-5 fw-bold text-danger font-monospace">${errSum}</div>
              </div>
            </div>
            <div class="col-sm-3 col-6">
              <div class="p-1 rounded bg-black border border-secondary">
                <div class="small text-muted" style="font-size: 0.72rem;">Предупреждений</div>
                <div class="fs-5 fw-bold text-warning font-monospace">${warnSum}</div>
              </div>
            </div>
          </div>
          <p class="mb-0 text-light small"><i class="bi bi-info-circle text-info me-1"></i>${escapeHtml(summaryText)}</p>
        </div>
      </div>

      <!-- Секция обнаруженных аномалий -->
      <div class="card bg-dark border-secondary mb-2 shadow-sm">
        <div class="card-header bg-black text-warning fw-bold py-1 px-3 small">
          <i class="bi bi-exclamation-triangle me-1"></i>Обнаруженные аномалии и всплески
        </div>
        <div class="card-body p-2">
          ${anomaliesHtml}
        </div>
      </div>

      <!-- Таблица топ-паттернов дедупликации -->
      <div class="card bg-dark border-secondary">
        <div class="card-header bg-black text-light fw-bold d-flex justify-content-between align-items-center">
          <span><i class="bi bi-collection me-2"></i>Топ шаблонов событий (Дедупликация)</span>
          <span class="small text-muted">Топ 10 кластеров</span>
        </div>
        <div class="table-responsive">
          <table class="table slc-table mb-0">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th style="width: 80px;">Уровень</th>
                <th style="width: 140px;">Поставщик</th>
                <th style="width: 60px;">ID</th>
                <th>Шаблон сообщения (Masked)</th>
                <th style="width: 70px;" class="text-center">Кол-во</th>
                <th style="width: 140px;">Впервые</th>
              </tr>
            </thead>
            <tbody>
              ${clustersHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    contentEl.innerHTML = `<div class="alert alert-danger">Ошибка проведения аудита: ${escapeHtml(err.message)}</div>`;
  }
}
