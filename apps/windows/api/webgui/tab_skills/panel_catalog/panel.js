/**
 * @file apps/windows/api/webgui/tab_skills/panel_catalog/panel.js
 * @description Панель каталога навыков (карточки, табличный вид, фильтры и статистика)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:17:00
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Фильтрация списка навыков по строке поиска и признакам компонентов
 * @param {Array<Object>} skills Список всех навыков
 * @param {string} searchQuery Текст поиска
 * @param {string} activeFilter Фильтр ('all', 'scripts', 'references', 'packaged')
 * @returns {Array<Object>} Отфильтрованный список
 */
export function filterSkills(skills, searchQuery, activeFilter) {
  const query = (searchQuery || '').trim().toLowerCase();
  return (skills || []).filter(skill => {
    if (query) {
      const nameMatch = (skill.name || '').toLowerCase().includes(query);
      const descMatch = (skill.description || '').toLowerCase().includes(query);
      const i18nMatch = Object.values(skill.descriptions_i18n || {}).some(d => (d || '').toLowerCase().includes(query));
      if (!nameMatch && !descMatch && !i18nMatch) return false;
    }

    if (activeFilter === 'scripts' && !skill.has_scripts) return false;
    if (activeFilter === 'references' && !skill.has_references) return false;
    if (activeFilter === 'packaged' && !skill.has_dist) return false;

    return true;
  });
}

/**
 * Обновление верхних счетчиков статистики каталога навыков
 * @param {Array<Object>} skills Список всех навыков
 */
export function updateStats(skills) {
  const list = skills || [];
  const total = list.length;
  const withScripts = list.filter(s => s.has_scripts).length;
  const withRefs = list.filter(s => s.has_references).length;
  const packaged = list.filter(s => s.has_dist).length;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('skills-total-badge', total);
  setVal('stat-total-skills', total);
  setVal('stat-scripts-skills', withScripts);
  setVal('stat-refs-skills', withRefs);
  setVal('stat-packaged-skills', packaged);
}

/**
 * Отрисовка каталога навыков в режиме сетки карточек или таблицы
 * @param {Array<Object>} filteredSkills Отфильтрованные навыки
 * @param {string} viewMode Режим отображения ('cards' | 'table')
 */
export function renderCatalog(filteredSkills, viewMode) {
  const cardsContainer = document.getElementById('skills-cards-container');
  const tableCard = document.getElementById('skills-table-card');
  const emptyNotice = document.getElementById('skills-empty');

  if (!cardsContainer || !tableCard) return;

  if (!filteredSkills || filteredSkills.length === 0) {
    cardsContainer.innerHTML = '';
    tableCard.classList.add('d-none');
    emptyNotice?.classList.remove('d-none');
    return;
  }

  emptyNotice?.classList.add('d-none');

  if (viewMode === 'cards') {
    tableCard.classList.add('d-none');
    cardsContainer.classList.remove('d-none');
    cardsContainer.innerHTML = filteredSkills.map(s => renderSkillCard(s)).join('');
  } else {
    cardsContainer.classList.add('d-none');
    tableCard.classList.remove('d-none');
    const tableBody = document.getElementById('skills-table-body');
    if (tableBody) {
      tableBody.innerHTML = filteredSkills.map(s => renderSkillTableRow(s)).join('');
    }
  }
}

/**
 * Отрисовка карточки отдельного навыка
 * @param {Object} skill
 * @returns {string} HTML карточки
 */
export function renderSkillCard(skill) {
  const badges = [];
  if (skill.has_scripts) badges.push('<span class="badge bg-info-subtle text-info border border-info-subtle small me-1"><i class="bi bi-file-earmark-code"></i> scripts</span>');
  if (skill.has_references) badges.push('<span class="badge bg-warning-subtle text-warning border border-warning-subtle small me-1"><i class="bi bi-journal-text"></i> references</span>');
  if (skill.has_assets) badges.push('<span class="badge bg-secondary border border-secondary small me-1"><i class="bi bi-images"></i> assets</span>');
  if (skill.has_dist) badges.push('<span class="badge bg-success-subtle text-success border border-success-subtle small me-1"><i class="bi bi-box-seam"></i> .skill</span>');

  const descRu = skill.descriptions_i18n?.ru || '';
  const descDisplay = descRu ? `${descRu}` : (skill.description || 'Описание отсутствует');

  return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card bg-dark border-secondary text-white h-100 shadow-sm skill-card">
        <div class="card-header border-secondary d-flex justify-content-between align-items-center bg-black bg-opacity-25 py-2">
          <span class="badge bg-primary font-monospace fs-6 text-truncate" style="max-width: 70%;" title="${escapeHtml(skill.name)}">
            ⚡ ${escapeHtml(skill.name)}
          </span>
          <span class="text-muted small" title="Количество файлов">
            <i class="bi bi-files"></i> ${skill.files_count || 1}
          </span>
        </div>
        <div class="card-body py-2">
          <p class="card-text text-light small mb-2 text-truncate-3" style="min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(descDisplay)}">
            ${escapeHtml(descDisplay)}
          </p>
          <div class="mb-2 text-truncate">
            <small class="text-secondary font-monospace"><i class="bi bi-folder"></i> ${escapeHtml(skill.relative_path)}</small>
          </div>
          <div class="d-flex flex-wrap gap-1">
            ${badges.join('')}
          </div>
        </div>
        <div class="card-footer border-secondary bg-black bg-opacity-25 py-2 d-flex justify-content-between align-items-center">
          <button type="button" class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onclick="window.skillsTab?.openSkillDetails('${escapeHtml(skill.name)}')">
            <i class="bi bi-sliders"></i> Детали
          </button>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-warning" title="Тестировать в Sandbox" onclick="window.skillsTab?.openSkillSandbox('${escapeHtml(skill.name)}')">
              <i class="bi bi-play-circle"></i>
            </button>
            <button type="button" class="btn btn-outline-info" title="Собрать .skill архив" onclick="window.skillsTab?.packageSkill('${escapeHtml(skill.name)}')">
              <i class="bi bi-box-seam"></i>
            </button>
            <button type="button" class="btn btn-outline-danger" title="Удалить навык" onclick="window.skillsTab?.deleteSkill('${escapeHtml(skill.name)}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Отрисовка строки таблицы для отдельного навыка
 * @param {Object} skill
 * @returns {string} HTML строки таблицы
 */
export function renderSkillTableRow(skill) {
  const badges = [];
  if (skill.has_scripts) badges.push('<span class="badge bg-info-subtle text-info border border-info-subtle small me-1">scripts</span>');
  if (skill.has_references) badges.push('<span class="badge bg-warning-subtle text-warning border border-warning-subtle small me-1">refs</span>');
  if (skill.has_dist) badges.push('<span class="badge bg-success-subtle text-success border border-success-subtle small me-1">.skill</span>');

  const descRu = skill.descriptions_i18n?.ru || '';
  const descDisplay = descRu ? `${descRu}` : (skill.description || '—');

  return `
    <tr>
      <td>
        <span class="badge bg-primary font-monospace fs-6">⚡ ${escapeHtml(skill.name)}</span>
      </td>
      <td>
        <div class="small text-light text-truncate" style="max-width: 350px;" title="${escapeHtml(descDisplay)}">
          ${escapeHtml(descDisplay)}
        </div>
      </td>
      <td>
        <code class="small text-secondary">${escapeHtml(skill.relative_path)}</code>
      </td>
      <td>
        ${badges.length ? badges.join('') : '<span class="text-muted small">—</span>'}
      </td>
      <td style="text-align: right;">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-primary" title="Открыть детали" onclick="window.skillsTab?.openSkillDetails('${escapeHtml(skill.name)}')">
            <i class="bi bi-sliders"></i>
          </button>
          <button type="button" class="btn btn-outline-warning" title="Тестировать в Sandbox" onclick="window.skillsTab?.openSkillSandbox('${escapeHtml(skill.name)}')">
            <i class="bi bi-play-circle"></i>
          </button>
          <button type="button" class="btn btn-outline-info" title="Собрать архив" onclick="window.skillsTab?.packageSkill('${escapeHtml(skill.name)}')">
            <i class="bi bi-box-seam"></i>
          </button>
          <button type="button" class="btn btn-outline-danger" title="Удалить" onclick="window.skillsTab?.deleteSkill('${escapeHtml(skill.name)}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}
