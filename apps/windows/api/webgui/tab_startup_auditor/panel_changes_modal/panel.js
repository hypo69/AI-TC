/**
 * Модуль модального окна истории изменений автозапуска из телеметрии.
 * Файл: apps/windows/api/webgui/tab_startup_auditor/panel_changes_modal/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { apiFetch, escapeHtml, getChangeTypeBadge } from '../common/ui_utils.js';

/**
 * Проверяет наличие недавних изменений автозапуска и отображает бейдж.
 */
export async function checkRecentChangesBadge() {
  try {
    const data = await apiFetch('/api/v1/startup-auditor/changes?limit=10');
    const badge = document.getElementById('sa-changes-badge');
    if (badge && data?.changes?.length > 0) {
      badge.textContent = data.changes.length;
      badge.classList.remove('d-none');
    }
  } catch {
    // Игнорируем фоновые ошибки бейджа
  }
}

/**
 * Загружает и отрисовывает историю дифференциальных изменений в модальном окне.
 */
export async function loadChangesData() {
  const tbody = document.getElementById('sa-changes-table-body');
  const countEl = document.getElementById('sa-changes-modal-count');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          <div class="spinner-border spinner-border-sm text-warning me-2" role="status"></div>
          Загрузка истории изменений автозапуска из телеметрии...
        </td>
      </tr>
    `;
  }

  try {
    const data = await apiFetch('/api/v1/startup-auditor/changes?limit=100');
    const changes = data?.changes || [];

    if (countEl) {
      countEl.textContent = `${changes.length} записей`;
    }

    if (changes.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center py-4 text-muted">
              <i class="bi bi-shield-check text-success fs-4 d-block mb-1"></i>
              Изменений в конфигурации автозапуска между снимками телеметрии не зафиксировано.
            </td>
          </tr>
        `;
      }
      return;
    }

    if (tbody) {
      tbody.innerHTML = changes.map(ch => {
        const changeBadge = getChangeTypeBadge(ch.change_type);
        const timeFormatted = ch.created_at ? ch.created_at.replace('T', ' ').substring(0, 19) : '-';

        let detailsHtml = '';
        if (ch.change_type === 'added') {
          detailsHtml = `<span class="font-monospace small text-success text-truncate d-block" style="max-width: 420px;" title="${escapeHtml(ch.new_value)}">+ ${escapeHtml(ch.new_value || ch.item_name)}</span>`;
        } else if (ch.change_type === 'removed') {
          detailsHtml = `<span class="font-monospace small text-danger text-truncate d-block" style="max-width: 420px;" title="${escapeHtml(ch.old_value)}">- ${escapeHtml(ch.old_value || ch.item_name)}</span>`;
        } else if (ch.change_type === 'state_changed') {
          detailsHtml = `<div class="small">Состояние: <strong class="text-danger">${escapeHtml(ch.old_value)}</strong> <i class="bi bi-arrow-right"></i> <strong class="text-success">${escapeHtml(ch.new_value)}</strong></div>`;
        } else if (ch.change_type === 'risk_changed') {
          detailsHtml = `<div class="small">Уровень риска: <strong>${escapeHtml(ch.old_value)}</strong> <i class="bi bi-arrow-right"></i> <strong class="text-warning">${escapeHtml(ch.new_value)}</strong></div>`;
        } else {
          detailsHtml = `
            <div class="small font-monospace text-muted text-truncate" style="max-width: 420px;" title="Было: ${escapeHtml(ch.old_value)}">Было: ${escapeHtml(ch.old_value || '-')}</div>
            <div class="small font-monospace text-primary text-truncate" style="max-width: 420px;" title="Стало: ${escapeHtml(ch.new_value)}">Стало: ${escapeHtml(ch.new_value || '-')}</div>
          `;
        }

        return `
          <tr>
            <td class="font-monospace small text-muted">${timeFormatted}</td>
            <td class="text-center">${changeBadge}</td>
            <td>
              <div class="fw-semibold text-truncate" style="max-width: 190px;" title="${escapeHtml(ch.item_name)}">${escapeHtml(ch.item_name)}</div>
            </td>
            <td><span class="sa-badge sa-badge-loc">${escapeHtml(ch.location_type || 'registry_run')}</span></td>
            <td>${detailsHtml}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('[StartupAuditor] Error loading changes history:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-danger">
            Ошибка загрузки истории изменений: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Открывает модальное окно истории изменений.
 */
export async function showChangesModal() {
  const modalEl = document.getElementById('sa-changes-modal');
  if (!modalEl) return;

  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
  await loadChangesData();
}
