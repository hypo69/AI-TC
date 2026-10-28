/**
 * =============================================================================
 * Название: Менеджер сохранения навыков, SafeOps действий и обучения
 * =============================================================================
 * Описание:
 *   Обработка пользовательских действий: сохранение сгенерированных навыков (.skills/),
 *   ручная корректировка перед сохранением, выполнение SafeOps исправлений и фиксация
 *   диалоговых пар (вопрос-ответ) в базе обучения модели Test Computer.
 *
 * Файл: apps/windows/api/webgui/tab_scenarios/panel_chat/skills_manager.js
 * Пакет: windows/api/webgui/tab_scenarios
 * Автор: hypo69
 * Updated: 2026-10-17 01:15:00
 * =============================================================================
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Отрисовывает интерфейс сохранения или использования навыка (.skills).
 * @param {Object} finalData - Данные завершенного ответа.
 * @param {string} msgId - Идентификатор сообщения.
 * @returns {string} HTML-разметка интерфейса навыка.
 */
export function renderSkillActionHtml(finalData, msgId) {
  if (finalData.created_skill) {
    const isNew = finalData.created_skill.is_new !== false;
    const badgeTitle = isNew ? '✨ <strong>Автоматически создан навык:</strong>' : '📁 <strong>Использован существующий навык:</strong>';
    const badgeClass = isNew ? 'bg-success bg-opacity-10 border-success border-opacity-50 text-success' : 'bg-info bg-opacity-10 border-info border-opacity-50 text-info';
    return `
      <div class="mt-2 p-2 ${badgeClass} border rounded small" id="skill-action-container-${msgId}">
        ${badgeTitle} <code>${escapeHtml(finalData.created_skill.path)}</code>
        <div class="text-muted small mt-1">${escapeHtml(finalData.created_skill.description_ru)}</div>
      </div>
    `;
  }

  if (finalData.tool_plan) {
    return `
      <div class="mt-2 pt-2 border-top border-secondary border-opacity-25 d-flex align-items-center gap-2 flex-wrap" id="skill-action-container-${msgId}">
        <button class="btn btn-outline-success btn-sm d-flex align-items-center gap-1.5 py-1 px-2.5 shadow-sm" id="btn-save-skill-${msgId}" type="button">
          <i class="bi bi-bookmark-check-fill text-success"></i>
          <span>Ответ правильный, запомнить как навык</span>
        </button>
        <button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1.5 py-1 px-2 shadow-sm" id="btn-edit-skill-${msgId}" type="button">
          <i class="bi bi-pencil-square"></i>
          <span>Скорректировать</span>
        </button>
      </div>
      <div id="skill-edit-form-${msgId}" class="mt-2 p-2.5 bg-body-secondary border border-secondary-subtle rounded small d-none">
        <div class="fw-semibold text-warning mb-2"><i class="bi bi-sliders me-1"></i>Корректировка навыка перед сохранением</div>
        <div class="mb-2">
          <label class="form-label text-muted mb-1" style="font-size:0.75rem;">Заголовок навыка:</label>
          <input type="text" class="form-control form-control-sm border-secondary" id="edit-title-${msgId}" value="${escapeHtml(finalData.tool_plan.tool_title || '')}">
        </div>
        <div class="mb-2">
          <label class="form-label text-muted mb-1" style="font-size:0.75rem;">Описание (русский язык):</label>
          <textarea class="form-control form-control-sm border-secondary" id="edit-desc-${msgId}" rows="2">${escapeHtml(finalData.tool_plan.description_ru || '')}</textarea>
        </div>
        <div class="mb-2">
          <label class="form-label text-muted mb-1" style="font-size:0.75rem;">Команда проверки / скрипт:</label>
          <input type="text" class="form-control form-control-sm border-secondary font-monospace" id="edit-cmd-${msgId}" value="${escapeHtml(finalData.command_executed || finalData.tool_plan.probe_script || '')}">
        </div>
        <div class="d-flex gap-2 justify-content-end mt-2">
          <button class="btn btn-secondary btn-sm py-1 px-2" id="btn-cancel-edit-${msgId}" type="button">Отмена</button>
          <button class="btn btn-success btn-sm py-1 px-2.5" id="btn-save-edited-${msgId}" type="button">
            <i class="bi bi-check-circle-fill me-1"></i>Сохранить скорректированный навык
          </button>
        </div>
      </div>
    `;
  }

  return '';
}

/**
 * Привязывает обработчики к кнопкам сохранения и редактирования навыка.
 * @param {Object} finalData - Данные завершенного ответа.
 * @param {string} msgId - Идентификатор сообщения.
 * @param {HTMLElement} statusInd - Индикатор статуса чата.
 */
export function setupSkillListeners(finalData, msgId, statusInd) {
  if (finalData.created_skill || !finalData.tool_plan) return;

  const saveBtn = document.getElementById(`btn-save-skill-${msgId}`);
  const editBtn = document.getElementById(`btn-edit-skill-${msgId}`);
  const editForm = document.getElementById(`skill-edit-form-${msgId}`);
  const cancelEditBtn = document.getElementById(`btn-cancel-edit-${msgId}`);
  const saveEditedBtn = document.getElementById(`btn-save-edited-${msgId}`);

  const executeSave = async (payload) => {
    const container = document.getElementById(`skill-action-container-${msgId}`);
    if (saveBtn) saveBtn.disabled = true;
    if (saveEditedBtn) saveEditedBtn.disabled = true;
    if (saveBtn) saveBtn.innerHTML = `<div class="spinner-border spinner-border-sm text-success me-1" role="status"></div><span>Сохранение...</span>`;

    try {
      const saveRes = await fetch('/api/v1/scenarios/save-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) throw new Error(`HTTP ${saveRes.status}`);
      const savedData = await saveRes.json();
      if (container) {
        container.innerHTML = `
          <div class="p-2 bg-success bg-opacity-10 border border-success border-opacity-50 text-success rounded small w-100">
            ✨ <strong>Навык успешно сохранён:</strong> <code>${escapeHtml(savedData.path)}</code>
            <div class="text-muted small mt-1">${escapeHtml(savedData.description_ru)}</div>
          </div>
        `;
      }
      if (editForm) editForm.classList.add('d-none');
      if (statusInd) statusInd.innerText = `Навык '${savedData.name}' сохранён!`;
    } catch (saveErr) {
      console.error('[ScenariosTab] Ошибка сохранения навыка:', saveErr);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i><span>Ошибка. Повторить</span>`;
      }
      if (saveEditedBtn) saveEditedBtn.disabled = false;
    }
  };

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      executeSave({
        tool_name: finalData.tool_plan.tool_name,
        tool_title: finalData.tool_plan.tool_title,
        description_ru: finalData.tool_plan.description_ru,
        probe_type: finalData.tool_plan.probe_type || 'powershell',
        collector_name: finalData.tool_plan.collector_name,
        probe_script: finalData.tool_plan.probe_script,
        instructions: finalData.tool_plan.instructions,
        command_executed: finalData.command_executed,
      });
    });
  }

  if (editBtn && editForm) {
    editBtn.addEventListener('click', () => {
      editForm.classList.toggle('d-none');
    });
  }

  if (cancelEditBtn && editForm) {
    cancelEditBtn.addEventListener('click', () => {
      editForm.classList.add('d-none');
    });
  }

  if (saveEditedBtn) {
    saveEditedBtn.addEventListener('click', () => {
      const editedTitle = document.getElementById(`edit-title-${msgId}`)?.value || finalData.tool_plan.tool_title;
      const editedDesc = document.getElementById(`edit-desc-${msgId}`)?.value || finalData.tool_plan.description_ru;
      const editedCmd = document.getElementById(`edit-cmd-${msgId}`)?.value || finalData.command_executed;

      executeSave({
        tool_name: finalData.tool_plan.tool_name,
        tool_title: editedTitle,
        description_ru: editedDesc,
        probe_type: finalData.tool_plan.probe_type || 'powershell',
        collector_name: finalData.tool_plan.collector_name,
        probe_script: editedCmd,
        instructions: finalData.tool_plan.instructions,
        command_executed: editedCmd,
      });
    });
  }
}

/**
 * Привязывает обработчики к кнопкам применения исправлений SafeOps.
 * @param {Object} finalData - Данные завершенного ответа.
 * @param {string} msgId - Идентификатор сообщения.
 * @param {HTMLElement} statusInd - Индикатор статуса чата.
 */
export function setupRemediationListeners(finalData, msgId, statusInd) {
  if (!Array.isArray(finalData.remediation_actions) || finalData.remediation_actions.length === 0) return;

  const remContainer = document.getElementById(`remediation-container-${msgId}`);
  if (!remContainer) return;

  remContainer.querySelectorAll('.btn-exec-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const actionId = btn.dataset.actionId;
      const actionType = btn.dataset.actionType;
      const title = btn.dataset.title;
      const description = btn.dataset.description;
      const target = btn.dataset.target;
      const risk = btn.dataset.risk;
      const command = btn.dataset.command;

      // Запрос подтверждения при повышенном риске
      const isRisky = (risk || '').toLowerCase() === 'caution' || (risk || '').toLowerCase() === 'critical';
      if (isRisky) {
        const ok = confirm(`Подтвердите применение исправления:\n\n«${title}»\n\nКоманда: ${command || target}`);
        if (!ok) return;
      }

      btn.disabled = true;
      btn.innerHTML = `<div class="spinner-border spinner-border-sm text-warning" role="status"></div><span>Применение...</span>`;
      if (statusInd) statusInd.innerText = `Применение '${title}'...`;

      try {
        const execRes = await fetch('/api/v1/scenarios/execute-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_id: actionId,
            action_type: actionType,
            title: title,
            description: description,
            target: target,
            risk: risk,
            execution_command: command,
            confirmed_by_user: true,
          }),
        });

        if (!execRes.ok) throw new Error(`HTTP ${execRes.status}`);
        const resData = await execRes.json();
        if (resData.success) {
          btn.className = 'btn btn-success btn-sm py-1 px-3 d-flex align-items-center gap-1.5 shadow-sm';
          btn.innerHTML = `<i class="bi bi-check-circle-fill"></i><span>Подтверждено и выполнено</span>`;
          if (statusInd) statusInd.innerText = `Действие '${title}' успешно выполнено!`;
        } else {
          btn.disabled = false;
          btn.className = 'btn btn-danger btn-sm py-0.5 px-2.5 d-flex align-items-center gap-1 shadow-sm';
          btn.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i><span>Ошибка</span>`;
          btn.title = resData.error_message || resData.message;
          if (statusInd) statusInd.innerText = `Ошибка: ${resData.error_message || resData.message}`;
        }
      } catch (exErr) {
        console.error('[ScenariosTab] Ошибка применения исправления:', exErr);
        btn.disabled = false;
        btn.className = 'btn btn-outline-danger btn-sm py-0.5 px-2.5 d-flex align-items-center gap-1 shadow-sm';
        btn.innerHTML = `<i class="bi bi-arrow-repeat"></i><span>Повторить</span>`;
        if (statusInd) statusInd.innerText = `Сбой: ${exErr.message}`;
      }
    });
  });
}

/**
 * Привязывает обработчик к кнопке сохранения пары QA для обучения модели.
 * @param {Object} finalData - Данные завершенного ответа.
 * @param {string} msgId - Идентификатор сообщения.
 * @param {string} message - Текст исходного вопроса пользователя.
 * @param {string} chatText - Текст ответа для чата.
 * @param {string} voiceText - Текст ответа для озвучивания.
 * @param {HTMLElement} statusInd - Индикатор статуса чата.
 */
export function setupTrainingListeners(finalData, msgId, message, chatText, voiceText, statusInd) {
  const btnSaveTraining = document.getElementById(`btn-save-training-${msgId}`);
  if (!btnSaveTraining) return;

  btnSaveTraining.onclick = async () => {
    btnSaveTraining.disabled = true;
    btnSaveTraining.innerHTML = `<div class="spinner-border spinner-border-sm text-info me-1" role="status"></div><span>Сохранение...</span>`;
    try {
      const res = await fetch('/api/v1/scenarios/save-approved-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'tc_admin',
          query: message,
          chat_text: chatText,
          voice_text: voiceText || '',
          system_context: {
            command_executed: finalData.command_executed || '',
            tool_plan: finalData.tool_plan || null,
            platform: 'Windows'
          },
          tags: ['tc', 'diagnostics', 'training']
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const container = document.getElementById(`training-save-container-${msgId}`);
      if (container) {
        container.innerHTML = `
          <div class="p-1.5 px-2.5 bg-success bg-opacity-10 border border-success border-opacity-50 text-success rounded small d-flex align-items-center gap-1.5 w-100 shadow-sm">
            <i class="bi bi-check-circle-fill text-success"></i>
            <span><strong>Успешно:</strong> ответ сохранён для обучения модели и RAG (<code>data/tc/approved_responses</code>)</span>
          </div>
        `;
      }
      if (statusInd) statusInd.innerText = 'Ответ сохранён в базу для обучения модели!';
    } catch (saveErr) {
      console.error('[ScenariosTab] Ошибка сохранения данных для обучения:', saveErr);
      btnSaveTraining.disabled = false;
      btnSaveTraining.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i><span>Ошибка сохранения. Повторить</span>`;
    }
  };
}
