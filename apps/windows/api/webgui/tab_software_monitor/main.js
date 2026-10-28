/**
 * =============================================================================
 * Process Name: Windows Software Monitor - Main Orchestrator
 * =============================================================================
 * Description:
 *   Главный клиентский оркестратор консолидированного хаба установленного ПО.
 *   Координирует субпанели реестра, пакетных менеджеров (WinGet, Microsoft Store,
 *   Ninite), спящих программ, автозапуска, ИИ-аудита рисков, ресурсов и сокетов.
 *
 * Usage Examples:
 *   HTML Integration:
 *     <script type="module" src="/windows/api/webgui/tab_software_monitor/main.js?v=20261018_v1"></script>
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: apps/windows/api/webgui/tab_software_monitor
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-20 20:20:00
 * =============================================================================
 */

import {
  setupSubTabNavigation,
  triggerSubTabInit,
  switchSoftwareSubTab
} from './panel_subtabs/panel.js';
import { triggerHeavyAnomalyAnalysis } from './panel_heavy/panel.js';
import { triggerSocketInspection } from './panel_sockets/panel.js';

/**
 * Инициализирует консолидированную вкладку Установленные программы и Мониторинг ПО.
 */
export async function initSoftwareMonitorTab() {
  setupSubTabNavigation();

  // Интеллектуальные тултипы ИИ (AI Smart Tooltips)
  if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
    const rootEl = document.getElementById('software-monitor-container') ||
                   document.getElementById('software-scanner-container') ||
                   document;
    window.AISmartTooltip.initAll(rootEl);
  }

  // По умолчанию загружаем Реестр программ (Инвентарь)
  await triggerSubTabInit('inventory');
}

export const init = initSoftwareMonitorTab;
export const initSoftwareScannerTab = initSoftwareMonitorTab;

// Экспорт методов в глобальную область window
if (typeof window !== 'undefined') {
  window.initSoftwareMonitorTab = initSoftwareMonitorTab;
  window.initSoftwareScannerTab = initSoftwareMonitorTab;
  window.switchSoftwareSubTab = switchSoftwareSubTab;
  window.triggerHeavyAnomalyAnalysis = triggerHeavyAnomalyAnalysis;
  window.triggerSocketInspection = triggerSocketInspection;

  window.activateSoftwareMonitorTab = function () {
    if (window.AISmartTooltip && typeof window.AISmartTooltip.initAll === 'function') {
      const rootEl = document.getElementById('software-monitor-container') ||
                     document.getElementById('software-scanner-container') ||
                     document;
      window.AISmartTooltip.initAll(rootEl);
    }
  };
  window.activateSoftwareScannerTab = window.activateSoftwareMonitorTab;
}

// Реэкспорт навигации субвкладок
export { switchSoftwareSubTab };

// Автоматический запуск при автономной загрузке
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSoftwareMonitorTab);
  } else {
    initSoftwareMonitorTab();
  }
}
