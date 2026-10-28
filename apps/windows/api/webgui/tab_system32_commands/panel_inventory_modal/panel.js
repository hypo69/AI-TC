/**
 * Модуль модального окна инвентаризации утилит System32 на хосте.
 * Файл: apps/windows/api/webgui/tab_system32_commands/panel_inventory_modal/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Загружает инвентарь утилит System32 и отрисовывает таблицу в модальном окне.
 */
export async function loadHostInventory() {
  const body = document.getElementById('modal-inventory-body');
  if (!body) return;

  try {
    const res = await fetch('/api/v1/system32/inventory');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    body.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-3 p-2 bg-body-tertiary rounded small">
        <div>📁 Каталог: <code>${escapeHtml(data.system32_path)}</code></div>
        <div>✅ Найдено: <strong>${data.total_installed}</strong> / <strong>${data.total_registered}</strong></div>
      </div>
      <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
        <table class="table table-sm table-hover table-striped small">
          <thead>
            <tr>
              <th>Инструмент</th>
              <th>Категория</th>
              <th>Статус</th>
              <th>Путь / Источник</th>
            </tr>
          </thead>
          <tbody>
            ${(data.installed || []).map(item => `
              <tr>
                <td class="font-monospace fw-bold text-success">${escapeHtml(item.executable)}</td>
                <td class="text-muted">${escapeHtml(item.category_code || item.category)}</td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle">Доступен</span></td>
                <td class="font-monospace text-muted" style="font-size: 0.72rem;">${escapeHtml(item.path)}</td>
              </tr>
            `).join('')}
            ${(data.missing || []).map(item => `
              <tr class="table-warning">
                <td class="font-monospace text-muted">${escapeHtml(item.executable)}</td>
                <td class="text-muted">${escapeHtml(item.category_code || item.category)}</td>
                <td><span class="badge bg-secondary-subtle text-secondary">Не найден</span></td>
                <td class="text-muted" style="font-size: 0.72rem;">${escapeHtml(item.source)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="text-danger p-3 text-center">Ошибка инвентаризации: ${escapeHtml(err.message)}</div>`;
  }
}
