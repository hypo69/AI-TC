/**
 * Модуль генерации элементов управления и полей конфигурации плагина.
 * Файл: apps/windows/api/webgui/tab_plugins/panel_config_fields/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Отрисовывает форму параметров плагина в DOM.
 * @param {Object} plugin - Объект плагина со структурой fields и текущим config.
 */
export function renderPluginFields(plugin) {
  const container = document.getElementById('plugin-fields-container');
  const section = document.getElementById('plugin-config-section');
  if (!container || !section) return;

  const fields = plugin?.fields || [];
  if (fields.length === 0) {
    section.classList.add('d-none');
    return;
  }

  section.classList.remove('d-none');
  const currentCfg = plugin?.config || {};

  let html = '';
  fields.forEach(f => {
    const val = (currentCfg[f.id] !== undefined) ? currentCfg[f.id] : (f.default !== undefined ? f.default : '');
    const desc = f.description ? `<div class="form-text text-muted small">${f.description}</div>` : '';

    if (f.type === 'select') {
      let optionsHtml = '';
      (f.options || []).forEach(opt => {
        const isSel = String(opt.value) === String(val) ? 'selected' : '';
        optionsHtml += `<option value="${opt.value}" ${isSel}>${opt.label}</option>`;
      });
      html += `
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold mb-1">${f.label}</label>
          <select class="form-select form-select-sm" name="${f.id}" data-field-type="select">
            ${optionsHtml}
          </select>
          ${desc}
        </div>
      `;
    } else if (f.type === 'boolean') {
      const checked = Boolean(val) ? 'checked' : '';
      html += `
        <div class="col-12 col-md-6 d-flex flex-column justify-content-center">
          <div class="form-check form-switch mt-2">
            <input class="form-check-input" type="checkbox" role="switch" name="${f.id}" id="field_${f.id}" ${checked} data-field-type="boolean">
            <label class="form-check-label small fw-semibold" for="field_${f.id}">${f.label}</label>
          </div>
          ${desc}
        </div>
      `;
    } else if (f.type === 'list_string') {
      const listVals = Array.isArray(val) ? val.join(', ') : (val || '');
      html += `
        <div class="col-12">
          <label class="form-label small fw-semibold mb-1">${f.label} (через запятую)</label>
          <input type="text" class="form-control form-control-sm font-monospace" name="${f.id}" value="${listVals}" data-field-type="list_string">
          ${desc}
        </div>
      `;
    } else if (f.type === 'readonly') {
      html += `
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold mb-1 text-muted">${f.label}</label>
          <input type="text" class="form-control form-control-sm bg-body-tertiary text-muted" value="${val}" readonly>
          ${desc}
        </div>
      `;
    } else if (f.type === 'number') {
      html += `
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold mb-1">${f.label}</label>
          <input type="number" class="form-control form-control-sm" name="${f.id}" value="${val}" data-field-type="number">
          ${desc}
        </div>
      `;
    } else {
      html += `
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold mb-1">${f.label}</label>
          <input type="text" class="form-control form-control-sm" name="${f.id}" value="${val}" data-field-type="string">
          ${desc}
        </div>
      `;
    }
  });

  container.innerHTML = html;
}
