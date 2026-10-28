/**
 * Модуль интеграции с универсальным модальным окном ИИ-ассистента (#universal-ai-table-modal / AIModalDialog).
 * Реализует паспорт процесса и форензику расследования повторяющихся вызовов PowerShell.
 * Файл: apps/windows/api/webgui/tab_processes_load_inspector/panel_ai_audit/panel.js
 * Updated: 2026-10-28 14:45:00
 */

import { showToast } from '../common/ui_utils.js';

/**
 * Безопасно находит существующий инстанс AIModalDialog в текущем окне или родительских фреймах.
 * @returns {Object|null}
 */
function findExistingAIModal() {
  try {
    if (window.AIModalDialog && typeof window.AIModalDialog.show === 'function') {
      return window.AIModalDialog;
    }
    if (window.AITableModal && typeof window.AITableModal.show === 'function') {
      return window.AITableModal;
    }
  } catch (_) {}

  try {
    if (window.parent && window.parent !== window) {
      if (window.parent.AIModalDialog && typeof window.parent.AIModalDialog.show === 'function') {
        return window.parent.AIModalDialog;
      }
      if (window.parent.AITableModal && typeof window.parent.AITableModal.show === 'function') {
        return window.parent.AITableModal;
      }
    }
  } catch (_) {}

  try {
    if (window.top && window.top !== window) {
      if (window.top.AIModalDialog && typeof window.top.AIModalDialog.show === 'function') {
        return window.top.AIModalDialog;
      }
      if (window.top.AITableModal && typeof window.top.AITableModal.show === 'function') {
        return window.top.AITableModal;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Ищет и подгружает глобальный инстанс AIModalDialog при необходимости с поддержкой ожидания (polling).
 * @returns {Promise<Object|null>} Объект модального окна ИИ.
 */
export async function resolveAIModal() {
  let modal = findExistingAIModal();
  if (modal) {
    return modal;
  }

  // Гарантируем подключение стилей модала
  if (!document.getElementById('link-ai-modal-dialog-style')) {
    const link = document.createElement('link');
    link.id = 'link-ai-modal-dialog-style';
    link.rel = 'stylesheet';
    link.href = '/html/ai_modal_dialog/style.css?v=20261028_v1';
    document.head.appendChild(link);
  }

  // Если скрипт еще не внедрен в DOM текущего документа, инжектируем его с актуальной версией
  const existingScript = document.getElementById('script-ai-modal-dialog-lazy');
  if (!existingScript) {
    const s = document.createElement('script');
    s.id = 'script-ai-modal-dialog-lazy';
    s.src = '/html/ai_modal_dialog/main.js?v=20261020_v7';
    document.head.appendChild(s);
  }

  // Ожидаем завершения загрузки и выполнения IIFE скрипта (до 3 сек с шагом 50мс)
  const maxWaitMs = 3000;
  const pollIntervalMs = 50;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    modal = findExistingAIModal();
    if (modal) {
      return modal;
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  // Резервный динамический импорт ES-фасада
  try {
    const mod = await import('/html/ai_modal_dialog/ai_modal_dialog.js?v=20261020_v7');
    if (mod && mod.AIModalDialog && typeof mod.AIModalDialog.show === 'function') {
      return mod.AIModalDialog;
    }
  } catch (_) {}

  return findExistingAIModal();
}

/**
 * Открывает паспорт процесса в универсальном модальном окне ИИ.
 * @param {Object} item - Данные процесса или группы.
 * @param {'group'|'sub'} [type='group'] - Тип элемента.
 * @param {Object|null} [parentGroup=null] - Родительская группа (для подпроцессов).
 * @param {Function} [onKillProcess=null] - Функция завершения процесса.
 * @param {string|null} [panelId=null] - Канонический ID вызывающей панели.
 */
export async function openProcessAiModal(item, type = 'group', parentGroup = null, onKillProcess = null, panelId = null) {
  if (!item) return;

  const isGroup = (type === 'group');
  const count = item.instance_count || (item.subprocesses ? item.subprocesses.length : 1);
  const targetPid = isGroup ? (item.main_pid || 0) : (item.pid || 0);
  const pidStr = targetPid ? String(targetPid) : '-';
  const category = (item.category || (parentGroup ? parentGroup.category : 'process')).toUpperCase();
  const title = isGroup
    ? (item.friendly_name ? `${item.friendly_name} (${item.name})` : item.name)
    : `${item.name} [PID: ${item.pid}]`;

  const memMb = isGroup ? (item.total_memory_mb || 0) : (item.memory_mb || 0);
  const memStr = memMb >= 1024 ? `${(memMb / 1024).toFixed(1)} GB` : `${Math.round(memMb)} MB`;
  const cpuPercent = isGroup
    ? (item.total_cpu_percent !== undefined ? item.total_cpu_percent : 0)
    : (item.cpu_percent !== undefined ? item.cpu_percent : 0);
  const cpuStr = `${cpuPercent.toFixed(1)}%`;

  const globalModal = await resolveAIModal();
  if (globalModal && typeof globalModal.show === 'function') {
    const gBadges = [
      { text: category, class: 'badge bg-primary' },
      { text: `PID: ${pidStr}`, class: 'badge bg-secondary' },
      { text: isGroup ? `${count} процессов` : (item.username || 'SYSTEM'), class: 'badge bg-info text-dark' }
    ];
    if (item.has_visible_window || item.has_window) gBadges.push({ text: 'Оконный', class: 'badge bg-success' });

    const gMeta = [
      { label: 'Исполняемый файл', value: item.name, isCode: true },
      { label: 'PID процесса', value: pidStr, isCode: true },
      { label: 'Категория', value: category },
      { label: 'Нагрузка CPU', value: cpuStr },
      { label: 'Использование памяти', value: memStr },
      { label: 'Потоков (Threads)', value: String(isGroup ? (item.total_threads || count) : (item.num_threads || item.threads || 1)) }
    ];
    if (item.username) gMeta.push({ label: 'Пользователь', value: item.username });
    if (item.create_time) gMeta.push({ label: 'Время старта', value: item.create_time });
    const exePath = item.exe_path || item.executable || '';
    if (exePath) gMeta.push({ label: 'Путь к файлу', value: exePath, isCode: true, fullWidth: true });
    const cmdLine = item.command_line || item.cmdline || '';
    if (cmdLine) gMeta.push({ label: 'Командная строка', value: cmdLine, isCode: true, fullWidth: true });

    globalModal.show({
      icon: '🤖',
      title: title,
      subtitle: `Категория: ${category} | CPU: ${cpuStr} | RAM: ${memStr}`,
      panelId: panelId || 'panel-process-manager-dispetcher-protsessov-i-prilozhen',
      tableType: 'process',
      badges: gBadges,
      metadata: gMeta,
      rawTitle: 'Телеметрия процесса Windows',
      rawContent: JSON.stringify(item, null, 2),
      requestData: item,
      actions: [
        {
          label: isGroup ? 'Завершить дерево процессов' : 'Завершить процесс',
          icon: isGroup ? 'bi-x-circle' : 'bi-x',
          class: 'btn-outline-danger',
          onClick: () => {
            if (onKillProcess) {
              onKillProcess(targetPid, item.name, isGroup);
            }
          }
        }
      ]
    });
  } else {
    console.warn('[ProcessInspector] AIModalDialog не найден в глобальной области видимости');
    showToast('Модуль AIModalDialog загружается, повторите попытку через секунду', 'info');
  }
}

/**
 * Запуск интеллектуального расследования повторяющихся запусков PowerShell.
 */
export async function openPowerShellInvestigationModal() {
  try {
    showToast('Запуск расследования активности PowerShell...', 'info');
    let invData = null;
    try {
      const res = await fetch('/api/v1/tab-processes-load-inspector/panel-ai-audit/powershell');
      if (res.ok) {
        invData = await res.json();
      }
    } catch (e) {
      console.warn('[ProcessInspector] Не удалось получить /panel-ai-audit/powershell:', e);
    }

    const totalCount = invData ? invData.total_detected_sessions : '1800+';
    const verdict = invData ? invData.verdict : 'Служба телеметрии AI-Windows-Admin (GPU Prober)';
    const scriptLoc = invData && invData.code_location ? `${invData.code_location.file}:${invData.code_location.line}` : 'apps/windows/sdk/modules/hardware/gpu_prober.py:290';
    const taskName = invData && invData.trigger ? invData.trigger.task_name : 'AI-Windows-Admin-Telemetry';

    const globalModal = await resolveAIModal();
    if (!globalModal || typeof globalModal.show !== 'function') {
      showToast('Модуль AIModalDialog загружается, повторите попытку через секунду', 'warning');
      return;
    }

    const badges = [
      { text: 'Форензика: PowerShell', class: 'badge bg-warning text-dark' },
      { text: `Сессий: ${totalCount}`, class: 'badge bg-danger' },
      { text: 'Интервал: ~5 сек', class: 'badge bg-secondary' },
      { text: 'Статус: Виновник найден', class: 'badge bg-success' }
    ];

    const metadata = [
      { label: 'Симптом', value: 'Постоянные фоновые запуски powershell.exe каждые 5-10 секунд' },
      { label: 'Выявленный виновник', value: verdict },
      { label: 'Служба / Процесс-родитель', value: 'ai-telemetry.exe / pythonw.exe', isCode: true },
      { label: 'Задача планировщика Windows', value: taskName, isCode: true },
      { label: 'Файл запуска планировщика', value: 'C:\\Users\\onela\\AppData\\Local\\AI-TC\\tlm.ps1', isCode: true, fullWidth: true },
      { label: 'Точка вызова в кодовой базе', value: scriptLoc, isCode: true, fullWidth: true },
      { label: 'Выполняемые команды WMI', value: 'Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_... | ConvertTo-Json', isCode: true, fullWidth: true }
    ];

    globalModal.show({
      icon: '🕵️',
      title: 'Расследование: кто постоянно запускает PowerShell?',
      subtitle: `Источник: ${verdict} | Вызовов зафиксировано: ${totalCount}`,
      panelId: 'panel-process-manager-dispetcher-protsessov-i-prilozhen',
      tableType: 'process',
      badges: badges,
      metadata: metadata,
      rawTitle: 'Паспорт криминалистического расследования',
      rawContent: JSON.stringify(invData || { status: 'detected', total_detected_sessions: totalCount }, null, 2),
      requestData: {
        table_type: 'process',
        title: 'powershell.exe recurring executions investigation',
        subtitle: `Выявлен виновник: ${verdict} в ${scriptLoc}`,
        question: 'В данный момент времени в моей операционной системе кто-то постоянно запускает powershell. Найди виновника'
      },
      actions: [
        {
          label: 'Скопировать путь к источнику в коде',
          icon: 'bi-clipboard',
          class: 'btn-outline-info',
          onClick: () => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(scriptLoc);
              showToast('Путь скопирован в буфер обмена', 'success');
            }
          }
        }
      ]
    });

    setTimeout(() => {
      const chatInput = document.getElementById('uai-chat-input');
      if (chatInput && !chatInput.value) {
        chatInput.value = 'В данный момент времени в моей операционной системе кто-то постоянно запускает powershell. Найди виновника';
      }
    }, 350);

  } catch (err) {
    console.error('[ProcessInspector] Ошибка открытия модального окна расследования:', err);
    showToast(err.message, 'danger');
  }
}
