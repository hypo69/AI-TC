/**
 * @file apps/windows/api/webgui/tab_defender_firewall/panel_asr_cfa/panel.js
 * @description Панель правил Attack Surface Reduction (ASR) и защиты от шифровальщиков Controlled Folder Access (CFA)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:25:00
 */

import { fetchJSON } from '../common/ui_utils.js';

let isAsrLoaded = false;
let isCfaLoaded = false;

/**
 * Сброс флагов кеша
 */
export function resetAsrCfaCache() {
  isAsrLoaded = false;
  isCfaLoaded = false;
}

/**
 * Загрузка и рендеринг правил Attack Surface Reduction (ASR)
 * @param {boolean} force
 */
export async function loadASRRules(force = false) {
  if (!force && isAsrLoaded) return;
  try {
    const rules = await fetchJSON('/api/v1/defender/asr');
    isAsrLoaded = true;
    const tbody = document.getElementById('def-asr-tbody');
    const badge = document.getElementById('def-asr-count-badge');
    if (badge) badge.textContent = `Всего: ${rules.length}`;

    if (tbody) {
      tbody.innerHTML = rules.map(r => {
        let stateBadge = '<span class="badge bg-secondary">Не задано</span>';
        if (r.state === 'enabled') stateBadge = '<span class="badge def-badge-active">Блокировка (Block)</span>';
        else if (r.state === 'audit') stateBadge = '<span class="badge def-badge-audit">Аудит (Audit)</span>';
        else if (r.state === 'warn') stateBadge = '<span class="badge def-badge-warn">Предупреждение</span>';
        else if (r.state === 'disabled') stateBadge = '<span class="badge def-badge-disabled">Отключено</span>';

        return `
          <tr>
            <td>
              <div class="fw-semibold text-body">${r.name}</div>
              <div class="text-secondary" style="font-size: 0.72rem;">${r.description}</div>
            </td>
            <td><span class="badge bg-body-secondary text-body border">${r.category}</span></td>
            <td class="text-center">${stateBadge}</td>
            <td class="text-secondary small">${r.recommendation || '-'}</td>
            <td class="text-secondary font-monospace" style="font-size: 0.68rem;">${r.guid}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading ASR rules:', err);
  }
}

/**
 * Загрузка и рендеринг списков Controlled Folder Access (папки и приложения)
 * @param {boolean} force
 */
export async function loadCFA(force = false) {
  if (!force && isCfaLoaded) return;
  try {
    const cfa = await fetchJSON('/api/v1/defender/cfa');
    isCfaLoaded = true;
    const foldersList = document.getElementById('def-cfa-folders-list');
    const appsList = document.getElementById('def-cfa-apps-list');

    if (foldersList) {
      if (cfa.protected_folders && cfa.protected_folders.length > 0) {
        foldersList.innerHTML = `
          <ul class="list-group list-group-flush bg-transparent">
            ${cfa.protected_folders.map(f => `
              <li class="list-group-item bg-transparent text-body border-secondary py-1 px-0 font-monospace small">
                📁 ${f}
              </li>
            `).join('')}
          </ul>
        `;
      } else {
        foldersList.innerHTML = '<div class="text-muted small">Нет настроенных защищенных папок.</div>';
      }
    }

    if (appsList) {
      if (cfa.allowed_applications && cfa.allowed_applications.length > 0) {
        appsList.innerHTML = `
          <ul class="list-group list-group-flush bg-transparent">
            ${cfa.allowed_applications.map(a => `
              <li class="list-group-item bg-transparent text-body border-secondary py-1 px-0 font-monospace small d-flex justify-content-between align-items-center">
                <span class="text-truncate me-2">🛡️ ${a}</span>
                <button class="btn btn-outline-danger btn-xs py-0 px-1.5" title="Удалить из разрешенных" onclick="window._removeCfaApp('${encodeURIComponent(a)}')">
                  <i class="bi bi-trash"></i>
                </button>
              </li>
            `).join('')}
          </ul>
        `;
      } else {
        appsList.innerHTML = '<div class="text-muted small">Список доверенных приложений пуст.</div>';
      }
    }
  } catch (err) {
    console.error('[DefenderTab] Error loading CFA:', err);
  }
}

/**
 * Удаление разрешенного приложения CFA
 * @param {string} rawPath
 */
export async function removeCfaApp(rawPath) {
  if (!confirm(`Удалить приложение "${rawPath}" из списка разрешенных CFA?`)) return;
  try {
    const res = await fetch(`/api/v1/defender/cfa/allowed-apps?path=${encodeURIComponent(rawPath)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      if (window.showToast) window.showToast('Приложение удалено из CFA', 'info');
      await loadCFA(true);
    } else {
      const err = await res.json();
      alert(`Ошибка удаления: ${err.detail || 'Не удалось удалить'}`);
    }
  } catch (e) {
    console.error('[DefenderTab] Ошибка удаления приложения CFA:', e);
  }
}

/**
 * Привязка обработчика модального окна добавления доверенного приложения CFA
 */
export function bindCfaAddModal() {
  const submitBtn = document.getElementById('btn-cfa-submit-add-app');
  if (submitBtn && !submitBtn._bound) {
    submitBtn._bound = true;
    submitBtn.addEventListener('click', async () => {
      const pathInput = document.getElementById('cfa-app-path-input');
      const appPath = pathInput ? pathInput.value.trim() : '';
      if (!appPath) {
        alert('Пожалуйста, укажите путь к исполняемому файлу программы.');
        return;
      }
      try {
        const res = await fetch('/api/v1/defender/cfa/allowed-apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: appPath })
        });
        if (res.ok) {
          if (pathInput) pathInput.value = '';
          const modalEl = document.getElementById('cfaAddAppModal');
          if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getInstance(modalEl)?.hide();
          }
          if (window.showToast) window.showToast('Приложение добавлено в CFA', 'success');
          await loadCFA(true);
        } else {
          const err = await res.json();
          alert(`Ошибка добавления: ${err.detail || 'Не удалось добавить'}`);
        }
      } catch (e) {
        console.error('[DefenderTab] Ошибка отправки приложения CFA:', e);
      }
    });
  }
}

// Экспорт глобальной функции для инлайн-обработчика HTML
window._removeCfaApp = function(encodedPath) {
  removeCfaApp(decodeURIComponent(encodedPath));
};
