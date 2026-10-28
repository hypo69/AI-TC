/**
 * Модуль дерева каналов Windows Event Log и всплывающих подсказок (Channel Tree & Tooltips).
 * 
 * Отвечает за:
 * - Сканирование каналов WevtAPI и файлов EVTX
 * - Интерактивное дерево каналов с фильтрацией и бейджами количества записей
 * - Всплывающие подсказки с метаданными канала (размер, записи, доступность)
 * - Локальный кэш журнала в браузере (localStorage)
 * 
 * Updated: 2026-10-17 00:35:00
 */

import { escapeHtml, t } from '../common/ui_utils.js';

let globalTooltipEl = null;

export function createGlobalChannelTooltip() {
  if (globalTooltipEl) return;
  globalTooltipEl = document.createElement('div');
  globalTooltipEl.className = 'slc-tooltip-popup';
  globalTooltipEl.id = 'slc-global-tooltip';
  document.body.appendChild(globalTooltipEl);
}

export function showChannelTooltip(channelData, mouseEvent) {
  if (!globalTooltipEl) createGlobalChannelTooltip();
  const isFile = !!(channelData.file_path || channelData.location || (channelData.source_type && channelData.source_type !== 'channel'));
  const icon = isFile ? '📄' : '📁';
  const rawTitle = channelData.display_name || channelData.channel_name || channelData.name || 'Channel';
  const chanTitle = rawTitle.replace(/^evt:/, '');
  const typeLabel = (channelData.source_type === 'channel' || !isFile) ? t('systemControl.tooltipTypeLive', 'Live Windows Channel') : t('systemControl.tooltipTypeArchive', 'EVTX File Archive');
  const countVal = channelData.record_count !== undefined ? channelData.record_count : (channelData.records || 'N/A');
  const recCount = typeof countVal === 'number' ? countVal.toLocaleString() : String(countVal);
  const sizeStr = channelData.file_size_mb ? `${channelData.file_size_mb} MB` : (channelData.size_bytes ? `${(channelData.size_bytes / 1024 / 1024).toFixed(1)} MB` : 'N/A');

  globalTooltipEl.innerHTML = `
    <div class="fw-bold mb-1 d-flex align-items-center gap-1.5" style="color: var(--text-color);">
      <span>${icon}</span>
      <span class="text-truncate">${escapeHtml(chanTitle)}</span>
    </div>
    <div class="mb-2" style="font-size: 0.76rem; color: var(--text-muted) !important;">
      ${escapeHtml(channelData.description || t('systemControl.tooltipDefaultDesc', 'Стандартный системный канал событий Windows.'))}
    </div>
    <div class="d-flex justify-content-between align-items-center pt-1 border-top" style="border-color: var(--border-color) !important; font-size: 0.74rem;">
      <span class="text-muted">${t('systemControl.tooltipType', 'Тип:')} <strong style="color: var(--text-color);">${typeLabel}</strong></span>
      <span class="text-muted">${t('systemControl.tooltipRecords', 'Записей:')} <strong class="text-info">${recCount}</strong></span>
    </div>
    <div class="d-flex justify-content-between align-items-center pt-1" style="font-size: 0.74rem;">
      <span class="text-muted">${t('systemControl.tooltipSize', 'Размер:')} <strong style="color: var(--text-color);">${sizeStr}</strong></span>
      <span class="text-success fw-bold">${t('systemControl.tooltipAvailable', 'Доступен')}</span>
    </div>
  `;

  const pad = 15;
  let left = mouseEvent.clientX + pad;
  let top = mouseEvent.clientY + pad;
  if (left + 330 > window.innerWidth) left = mouseEvent.clientX - 335;
  if (top + 140 > window.innerHeight) top = mouseEvent.clientY - 145;

  globalTooltipEl.style.left = `${Math.max(10, left)}px`;
  globalTooltipEl.style.top = `${Math.max(10, top)}px`;
  globalTooltipEl.classList.add('show');
}

export function hideChannelTooltip() {
  if (globalTooltipEl) {
    globalTooltipEl.classList.remove('show');
  }
}

export function getLogBrowserCacheKey(channelName, filePath = '') {
  if (filePath) {
    try {
      return `ai_win_log_cache_file_${btoa(unescape(encodeURIComponent(filePath))).replace(/=/g, '').slice(0, 32)}`;
    } catch (_) {
      return `ai_win_log_cache_file_${filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-32)}`;
    }
  }
  const clean = (channelName || 'System').replace(/^evt:/, '').split(' (')[0].trim().toLowerCase();
  return `ai_win_log_cache_${clean}`;
}

export function loadLogFromBrowserCache(channelName, filePath = '') {
  try {
    const key = getLogBrowserCacheKey(channelName, filePath);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.events)) {
      return data;
    }
  } catch (e) {
    console.debug('[LogCache] Ошибка чтения из кеша:', e);
  }
  return null;
}

export function saveLogToBrowserCache(channelName, filePath, events) {
  try {
    const key = getLogBrowserCacheKey(channelName, filePath);
    const now = new Date();
    const dateFormatted = now.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const payload = {
      channel: channelName,
      filePath: filePath,
      cachedAt: now.toISOString(),
      cachedAtFormatted: dateFormatted,
      events: (events || []).slice(0, 500)
    };
    localStorage.setItem(key, JSON.stringify(payload));
    updateCacheDateUI(dateFormatted);
    return dateFormatted;
  } catch (e) {
    console.warn('[LogCache] Ошибка сохранения в кеш:', e);
  }
  return null;
}

export function updateCacheDateUI(dateText) {
  const el = document.getElementById('slc-cache-date-text');
  if (el) {
    el.textContent = dateText ? `Кеш: ${dateText}` : 'Кеш: нет данных';
  }
  const badge = document.getElementById('slc-cache-date-badge');
  if (badge) {
    badge.title = dateText ? `Журнал сохранен в кеше браузера: ${dateText}` : 'Журнал еще не сохранен в кеше браузера';
  }
}
