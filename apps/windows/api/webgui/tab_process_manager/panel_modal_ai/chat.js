/**
 * @file apps/windows/api/webgui/tab_process_manager/panel_modal_ai/chat.js
 * @description Интерактивный мини-чат с ИИ по конкретному процессу
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:12:00
 */

import { escapeHtml } from '../common/ui_utils.js';
import { getActiveDeepTelemetry } from '../panel_modal_telemetry/panel.js';

/**
 * Отправка вопроса в интерактивный мини-чат процесса
 * @param {Object} item Данные процесса
 * @param {string|null} quickText Быстрый текст вопроса
 */
export async function sendProcessChatMessage(item, quickText = null) {
  const inputEl = document.getElementById('pm-chat-input');
  const chatContainer = document.getElementById('pm-chat-messages-container');
  const placeholder = document.getElementById('pm-chat-placeholder');
  if (!chatContainer) return;

  const qText = quickText || (inputEl ? inputEl.value.trim() : '');
  if (!qText) return;
  if (inputEl) inputEl.value = '';
  if (placeholder) placeholder.style.display = 'none';

  const userMsg = document.createElement('div');
  userMsg.className = 'text-end mb-2';
  userMsg.innerHTML = `<span class="badge bg-primary text-wrap text-start p-2" style="max-width: 85%; font-size: 0.82rem;">${escapeHtml(qText)}</span>`;
  chatContainer.appendChild(userMsg);

  const aiMsg = document.createElement('div');
  aiMsg.className = 'text-start mb-2';
  aiMsg.innerHTML = `
    <div class="p-2 rounded bg-dark border border-secondary text-light" style="max-width: 90%;">
      <div class="fw-bold small text-info mb-1"><i class="bi bi-robot"></i> ИИ-Ассистент:</div>
      <div class="pm-chat-content small text-light"><div class="spinner-border spinner-border-sm text-info me-1"></div>Формирование ответа...</div>
    </div>
  `;
  chatContainer.appendChild(aiMsg);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const contentEl = aiMsg.querySelector('.pm-chat-content');
  const targetItem = item || {};
  const deepTlm = getActiveDeepTelemetry();

  try {
    const payload = {
      name: targetItem.name || 'Windows Process',
      path: targetItem.exe_path || targetItem.name || '',
      prompt: qText,
      stream: false,
      metadata: {
        pid: String(targetItem.pid || targetItem.main_pid || 0),
        category: targetItem.category || 'process',
        cpu: String(targetItem.cpu_percent || 0),
        memory_mb: String(targetItem.memory_mb || 0),
        uptime: deepTlm ? `${deepTlm.uptime_seconds}s` : 'unknown',
        disk_read_mb: deepTlm ? String(deepTlm.disk_read_mb_total) : '0',
        disk_write_mb: deepTlm ? String(deepTlm.disk_write_mb_total) : '0'
      }
    };

    const res = await fetch('/api/v1/chat/software-explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      contentEl.innerHTML = escapeHtml(data.response || data.explanation || data.answer || JSON.stringify(data));
    } else {
      contentEl.innerHTML = `Процесс <strong>${escapeHtml(targetItem.name || 'Windows')}</strong>: запрос обработан. Процесс относится к категории ${escapeHtml(targetItem.category || 'system')}.`;
    }
  } catch (err) {
    contentEl.innerHTML = `Процесс <strong>${escapeHtml(targetItem.name || 'Windows')}</strong>: ${escapeHtml(err.message)}`;
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
