/**
 * =============================================================================
 * Название: Вспомогательные утилиты интерфейса вкладки сценариев
 * =============================================================================
 * Описание:
 *   Экранирование HTML, форматирование Markdown, разбор тегов ответов
 *   и константы иконок состояний.
 *
 * Файл: apps/windows/api/webgui/tab_scenarios/common/ui_utils.js
 * Пакет: windows/api/webgui/tab_scenarios
 * Автор: hypo69
 * Updated: 2026-10-17 01:15:00
 * =============================================================================
 */

export const categoryIcons = {
  quick: '⚡',
  logs: '📜',
  diagnostics: '🖥️',
  security: '🛡️',
  network: '🌐',
  ai: '🤖',
};

export const statusIcons = {
  ok: '✅',
  warn: '⚠️',
  error: '❌',
  skipped: '⏭️',
};

/**
 * Безопасное экранирование специальных символов HTML.
 * @param {string} str - Исходная строка.
 * @returns {string} Экранированная строка.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Простое преобразование Markdown в HTML для чата ассистента.
 * @param {string} text - Исходный markdown-текст.
 * @returns {string} HTML-разметка.
 */
export function formatMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // Жирный шрифт
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Курсив
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Встроенный код
  html = html.replace(/`(.*?)`/g, '<code class="text-primary bg-body-secondary px-1 rounded">$1</code>');
  // Цитаты
  html = html.replace(/^&gt;\s+(.*$)/gim, '<div class="border-start border-primary border-3 ps-2 my-1 text-body bg-body-secondary py-1 rounded-end">$1</div>');
  // Заголовки
  html = html.replace(/^###\s+(.*$)/gim, '<h6 class="fw-bold text-primary mt-2 mb-1">$1</h6>');
  html = html.replace(/^##\s+(.*$)/gim, '<h5 class="fw-bold text-body mt-2 mb-1">$1</h5>');
  // Переносы строк
  html = html.replace(/\n/g, '<br>');
  return html;
}

/**
 * Извлечение блоков [CHAT] и [VOICE] из текста ответа и очистка управляющих тегов действий.
 * @param {string} rawText - Исходный ответ модели.
 * @returns {{chatText: string, voiceText: string}} Очищенные тексты для чата и озвучивания.
 */
export function parseChatAndVoice(rawText) {
  if (!rawText) return { chatText: '', voiceText: '' };
  let text = rawText;
  let voiceText = '';

  if (text.includes('[CHAT]') || text.includes('[VOICE]')) {
    const voiceMatch = text.match(/\[VOICE\]([\s\S]*?)(?:\[\/VOICE\]|(?=\[CHAT\])|$)/i);
    if (voiceMatch) {
      voiceText = voiceMatch[1].trim();
    }
    const chatMatch = text.match(/\[CHAT\]([\s\S]*?)(?:\[\/CHAT\]|(?=\[VOICE\])|$)/i);
    if (chatMatch) {
      text = chatMatch[1].trim();
    } else {
      text = text.replace(/\[VOICE\][\s\S]*?(?:\[\/VOICE\]|(?=\[CHAT\])|$)/gi, '').trim();
    }
  }

  // Очистка блоков действий от отображения в чате
  text = text.replace(/```(?:action|json:action)[\s\S]*?```/gi, '').trim();
  text = text.replace(/\[ACTION:[\s\S]*?\]/gi, '').trim();

  // Удаление оставшихся служебных тегов
  text = text.replace(/\[\/?CHAT\]/gi, '').replace(/\[\/?VOICE\]/gi, '').trim();
  return { chatText: text, voiceText: voiceText || text };
}
