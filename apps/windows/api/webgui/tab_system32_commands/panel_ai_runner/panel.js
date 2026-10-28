/**
 * Модуль нижнего ИИ-пульта интерпретации и безопасного запуска команд System32.
 * Файл: apps/windows/api/webgui/tab_system32_commands/panel_ai_runner/panel.js
 * Updated: 2026-10-17 01:55:00
 */

import { escapeHtml, tierColors } from '../common/ui_utils.js';
import { getActiveSelectedTool } from '../panel_grid/panel.js';

let isExecuting = false;

/**
 * Настройка нижнего пульта AI-команд и привязка обработчиков.
 */
export function setupAiCommandRunner() {
  const form = document.getElementById('system32-ai-cmd-form');
  const input = document.getElementById('system32-cmd-input');
  const sendBtn = document.getElementById('btn-system32-cmd-send');
  const statusInd = document.getElementById('ai-cmd-status-indicator');
  const resultBox = document.getElementById('ai-command-result-box');
  const dryRunCheck = document.getElementById('check-cmd-dry-run');
  const confirmAdminCheck = document.getElementById('check-cmd-confirm-admin');

  const resToolName = document.getElementById('res-tool-name');
  const resTierBadge = document.getElementById('res-tier-badge');
  const resDangerBadge = document.getElementById('res-danger-badge');
  const resDuration = document.getElementById('res-duration-badge');
  const resCmdLine = document.getElementById('res-cmd-line');
  const resExplanation = document.getElementById('res-explanation');
  const resPsEquiv = document.getElementById('res-ps-equiv');
  const resWin32Equiv = document.getElementById('res-win32-equiv');
  const resOutput = document.getElementById('res-output-pre');
  const btnCopyOutput = document.getElementById('btn-copy-command-output');
  const btnCloseBox = document.getElementById('btn-close-result-box');

  if (btnCloseBox && resultBox) {
    btnCloseBox.onclick = () => { resultBox.style.display = 'none'; };
  }

  if (btnCopyOutput && resOutput) {
    btnCopyOutput.onclick = () => {
      navigator.clipboard.writeText(resOutput.innerText);
      btnCopyOutput.innerHTML = '<i class="bi bi-check2 me-1"></i>Скопировано';
      setTimeout(() => {
        btnCopyOutput.innerHTML = '<i class="bi bi-clipboard me-1"></i>Копировать';
      }, 1800);
    };
  }

  const btnModalPaste = document.getElementById('btn-modal-paste-command');
  if (btnModalPaste && input) {
    btnModalPaste.onclick = () => {
      const tool = getActiveSelectedTool();
      if (tool) {
        const tmpl = tool.command_templates?.[0] || tool.executable;
        input.value = tmpl;
        input.focus();
        const modalEl = document.getElementById('toolDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          bootstrap.Modal.getInstance(modalEl)?.hide();
        }
      }
    };
  }

  document.querySelectorAll('.quick-cmd-pill').forEach(btn => {
    btn.onclick = () => {
      if (isExecuting) return;
      const prompt = btn.getAttribute('data-prompt');
      if (prompt && input) {
        input.value = prompt;
        executePrompt(prompt);
      }
    };
  });

  if (form && input) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const prompt = input.value.trim();
      if (prompt) executePrompt(prompt);
    };
  }

  async function executePrompt(promptText) {
    if (isExecuting) return;
    isExecuting = true;

    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (statusInd) statusInd.innerText = '🧠 Подбор инструмента и формирование команды...';

    if (resultBox) {
      resultBox.style.display = '';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (resToolName) resToolName.innerText = 'Анализ намерения...';
    if (resCmdLine) resCmdLine.innerText = '...';
    if (resExplanation) resExplanation.innerText = 'Подбор штатной утилиты System32...';
    if (resOutput) {
      resOutput.className = 'p-2 bg-black rounded text-info small mb-0 font-monospace';
      resOutput.innerText = 'Выполнение системной команды... Пожалуйста, подождите.';
    }

    const isDryRun = dryRunCheck ? dryRunCheck.checked : false;
    const confirmAdmin = confirmAdminCheck ? confirmAdminCheck.checked : true;

    try {
      const response = await fetch('/api/v1/system32/interpret-and-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          execute: !isDryRun,
          confirmed_by_user: !confirmAdmin,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (resToolName) resToolName.innerText = data.matched_executable;
      if (resTierBadge) {
        resTierBadge.className = `badge ${tierColors[data.telemetry_tier]?.badge || 'bg-secondary'} ms-2`;
        resTierBadge.innerText = data.telemetry_tier;
      }
      if (resDangerBadge) {
        if (data.danger_level === 'HIGH' || data.danger_level === 'CRITICAL') {
          resDangerBadge.style.display = '';
          resDangerBadge.innerText = data.danger_level;
        } else {
          resDangerBadge.style.display = 'none';
        }
      }
      if (resDuration) resDuration.innerText = `${data.execution_time_ms} ms`;
      if (resCmdLine) resCmdLine.innerText = data.command_line;
      if (resExplanation) resExplanation.innerText = data.explanation;
      if (resPsEquiv) resPsEquiv.innerHTML = data.powershell_equivalent ? `⚡ PowerShell: <code>${escapeHtml(data.powershell_equivalent)}</code>` : '';
      if (resWin32Equiv) resWin32Equiv.innerHTML = data.win32_api_equivalent ? `⚙️ Win32 API: <code>${escapeHtml(data.win32_api_equivalent)}</code>` : '';

      if (resOutput) {
        if (data.status === 'success') {
          resOutput.className = 'p-2 bg-black rounded text-success small mb-0 font-monospace';
        } else if (data.status === 'warn' || data.status === 'requires_confirmation') {
          resOutput.className = 'p-2 bg-black rounded text-warning small mb-0 font-monospace';
        } else {
          resOutput.className = 'p-2 bg-black rounded text-danger small mb-0 font-monospace';
        }
        resOutput.innerText = data.execution_output || 'Команда выполнена успешно.';
      }

      if (statusInd) statusInd.innerText = `Готово: ${data.matched_executable} (${data.status})`;
    } catch (err) {
      console.error('[System32CommandsTab] Execution error:', err);
      if (resOutput) {
        resOutput.className = 'p-2 bg-black rounded text-danger small mb-0 font-monospace';
        resOutput.innerText = `Сбой запроса: ${err.message}`;
      }
      if (statusInd) statusInd.innerText = 'Ошибка выполнения';
    } finally {
      isExecuting = false;
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  }
}
