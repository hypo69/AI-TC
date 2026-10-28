/**
 * Модуль сетки карточек инструментов System32, фильтрации и модального окна деталей.
 * Файл: apps/windows/api/webgui/tab_system32_commands/panel_grid/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml, tierColors, planeIcons } from '../common/ui_utils.js';

let toolsList = [];
let currentTierFilter = 'all';
let searchQuery = '';
let activeSelectedTool = null;

export function getToolsList() {
  return toolsList;
}

export function setToolsList(list) {
  toolsList = list || [];
}

export function getCurrentTierFilter() {
  return currentTierFilter;
}

export function setCurrentTierFilter(tier) {
  currentTierFilter = tier;
}

export function getSearchQuery() {
  return searchQuery;
}

export function setSearchQuery(query) {
  searchQuery = query;
}

export function getActiveSelectedTool() {
  return activeSelectedTool;
}

export function setActiveSelectedTool(tool) {
  activeSelectedTool = tool;
}

/**
 * Возвращает отфильтрованный список инструментов.
 * @returns {Array<Object>}
 */
export function getFilteredTools() {
  let list = [...toolsList];
  if (currentTierFilter !== 'all') {
    list = list.filter(t => t.telemetry_tier === currentTierFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t =>
      (t.executable || '').toLowerCase().includes(q) ||
      (t.purpose || '').toLowerCase().includes(q) ||
      (t.category_code || '').toLowerCase().includes(q) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }
  return list;
}

/**
 * Отрисовывает сетку карточек инструментов в контейнере.
 */
export function renderToolsGrid() {
  const container = document.getElementById('system32-cards-container');
  if (!container) return;

  const filtered = getFilteredTools();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="bi bi-search fs-2 mb-2"></i>
        <div>Инструменты не найдены по заданному фильтру</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((tool, idx) => {
    const tierStyle = tierColors[tool.telemetry_tier] || { badge: 'bg-secondary' };
    const planeIcon = planeIcons[tool.primary_control_plane] || '💻';
    const firstTemplate = tool.command_templates && tool.command_templates.length > 0 ? tool.command_templates[0] : tool.executable;

    return `
      <div class="col-12 col-md-6 col-lg-4 col-xl-3">
        <div class="card h-100 border-secondary-subtle shadow-sm hover-shadow transition">
          <div class="card-header bg-transparent border-secondary-subtle py-2 px-3 d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-1.5 overflow-hidden text-truncate">
              <span class="fs-5">${planeIcon}</span>
              <span class="fw-bold font-monospace text-truncate text-primary" title="${escapeHtml(tool.executable)}">${escapeHtml(tool.executable)}</span>
            </div>
            <span class="badge ${tierStyle.badge} small" style="font-size: 0.68rem;">${escapeHtml(tool.telemetry_tier)}</span>
          </div>
          <div class="card-body p-2 d-flex flex-column justify-content-between">
            <div>
              <div class="text-muted small mb-1 text-truncate" style="font-size: 0.72rem;" title="${escapeHtml(tool.category_code)}">
                📂 ${escapeHtml(tool.category_code)}
              </div>
              <p class="card-text small text-body mb-2" style="font-size: 0.78rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(tool.purpose)}">
                ${escapeHtml(tool.purpose)}
              </p>
            </div>
            <div class="pt-2 border-top border-secondary-subtle d-flex align-items-center justify-content-between gap-1">
              <button class="btn btn-outline-info btn-sm py-0.5 px-2 btn-open-tool-details" data-idx="${idx}" style="font-size: 0.75rem;" title="Посмотреть эквиваленты и руководство">
                📖 Инструкция
              </button>
              <button class="btn btn-outline-primary btn-sm py-0.5 px-2 btn-paste-cmd" data-cmd="${escapeHtml(firstTemplate)}" style="font-size: 0.75rem;" title="Вставить шаблон в пульт">
                ⚡ В пульт
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-open-tool-details').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!isNaN(idx) && filtered[idx]) {
        showToolDetailsModal(filtered[idx]);
      }
    };
  });

  container.querySelectorAll('.btn-paste-cmd').forEach(btn => {
    btn.onclick = () => {
      const cmd = btn.getAttribute('data-cmd');
      const input = document.getElementById('system32-cmd-input');
      if (input && cmd) {
        input.value = cmd;
        input.focus();
      }
    };
  });
}

/**
 * Открывает модальное окно деталей и документации инструмента.
 * @param {Object} tool - Объект инструмента.
 */
export function showToolDetailsModal(tool) {
  activeSelectedTool = tool;
  const modalTitle = document.getElementById('modal-tool-title');
  const modalIcon = document.getElementById('modal-tool-icon');
  const modalBody = document.getElementById('modal-tool-body');

  if (modalTitle) modalTitle.innerText = `${tool.executable} (${tool.category_code})`;
  if (modalIcon) modalIcon.innerText = planeIcons[tool.primary_control_plane] || '🛠️';

  let subcommandsHtml = '';
  if (tool.subcommands_info && Object.keys(tool.subcommands_info).length > 0) {
    subcommandsHtml = `
      <h6 class="fw-bold mt-3 mb-2">⚡ Подкоманды и контексты:</h6>
      <div class="list-group list-group-flush border rounded small">
        ${Object.entries(tool.subcommands_info).map(([sub, desc]) => `
          <div class="list-group-item py-1.5 px-2 d-flex justify-content-between align-items-center">
            <code class="text-primary font-monospace">${escapeHtml(sub)}</code>
            <span class="text-muted">${escapeHtml(desc)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  let templatesHtml = '';
  if (tool.command_templates && tool.command_templates.length > 0) {
    templatesHtml = `
      <h6 class="fw-bold mt-3 mb-2">💻 Шаблоны команд:</h6>
      <div class="d-flex flex-column gap-1">
        ${tool.command_templates.map(tmpl => `
          <div class="d-flex align-items-center justify-content-between p-2 bg-body-secondary rounded font-monospace small">
            <code class="text-warning">${escapeHtml(tmpl)}</code>
            <button class="btn btn-sm btn-outline-secondary py-0 px-1.5 btn-copy-inline" data-clip="${escapeHtml(tmpl)}" title="Копировать">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (modalBody) {
    modalBody.innerHTML = `
      <div class="mb-3">
        <div class="text-muted small mb-1">Назначение:</div>
        <div class="p-2 bg-body-tertiary rounded small fw-medium">${escapeHtml(tool.purpose)}</div>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
          <div class="p-2 bg-body-tertiary rounded text-center small">
            <span class="text-muted d-block" style="font-size: 0.7rem;">Tier:</span>
            <span class="badge ${tierColors[tool.telemetry_tier]?.badge || 'bg-secondary'}">${escapeHtml(tool.telemetry_tier)}</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-2 bg-body-tertiary rounded text-center small">
            <span class="text-muted d-block" style="font-size: 0.7rem;">Опасность:</span>
            <span class="fw-bold ${tool.danger_level === 'CRITICAL' ? 'text-danger' : 'text-body'}">${escapeHtml(tool.danger_level)}</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-2 bg-body-tertiary rounded text-center small">
            <span class="text-muted d-block" style="font-size: 0.7rem;">Привилегии:</span>
            <span class="fw-semibold">${escapeHtml(tool.required_privileges)}</span>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="p-2 bg-body-tertiary rounded text-center small">
            <span class="text-muted d-block" style="font-size: 0.7rem;">Control Plane:</span>
            <span class="badge bg-secondary">${escapeHtml(tool.primary_control_plane)}</span>
          </div>
        </div>
      </div>

      <h6 class="fw-bold mb-2">🎛️ Эквиваленты в Control Plane:</h6>
      <div class="table-responsive">
        <table class="table table-sm table-bordered small mb-0">
          <tbody>
            <tr>
              <th style="width: 25%;">PowerShell</th>
              <td><code>${escapeHtml(tool.powershell_equivalent || '—')}</code></td>
            </tr>
            <tr>
              <th>Win32 API</th>
              <td><code>${escapeHtml(tool.native_api_equivalent || '—')}</code></td>
            </tr>
            <tr>
              <th>WMI / CIM</th>
              <td><code>${escapeHtml(tool.wmi_cim_equivalent || '—')}</code></td>
            </tr>
            <tr>
              <th>COM</th>
              <td><code>${escapeHtml(tool.com_equivalent || '—')}</code></td>
            </tr>
            ${tool.etw_pipeline_enabled ? '<tr><th>ETW Pipeline</th><td><span class="badge bg-success">Интегрирован в AITelemetry</span></td></tr>' : ''}
            ${tool.usn_journal_enabled ? '<tr><th>USN Journal</th><td><span class="badge bg-info">Поддержка прямого чтения NTFS USN</span></td></tr>' : ''}
          </tbody>
        </table>
      </div>

      ${subcommandsHtml}
      ${templatesHtml}
    `;

    modalBody.querySelectorAll('.btn-copy-inline').forEach(btn => {
      btn.onclick = () => {
        const txt = btn.getAttribute('data-clip');
        if (txt) navigator.clipboard.writeText(txt);
      };
    });
  }

  const modalEl = document.getElementById('toolDetailsModal');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}
