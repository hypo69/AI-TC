/**
 * @file apps/windows/api/webgui/tab_process_manager/panel_modal_ai/panel.js
 * @description Интерактивное модальное окно ИИ-ассистента и экспертная диагностика процессов Windows
 * @author hypo69
 * @version 1.1.0
 * Updated: 2026-10-17 01:13:00
 */

import { escapeHtml } from '../common/ui_utils.js';
import {
  getActiveDeepTelemetry,
  resetDeepTelemetryFields,
  loadProcessDeepTelemetry
} from '../panel_modal_telemetry/panel.js';
import { sendProcessChatMessage } from './chat.js';

let activeModalProcess = null;
let activeModalType = 'group';
let activeModalParent = null;

/**
 * Отправка сообщения в чат активного процесса
 * @param {string|null} quickText
 */
export function sendChat(quickText = null) {
  return sendProcessChatMessage(activeModalProcess, quickText);
}

/**
 * Получение текущего активного процесса модального окна
 * @returns {Object|null}
 */
export function getActiveModalProcess() {
  return activeModalProcess;
}

/**
 * Поиск процесса или группы и вызов универсального модального окна ИИ-ассистента
 * @param {string} type - 'group' или 'sub'
 * @param {string} name - Имя процесса
 * @param {number|null} pid - PID процесса
 * @param {Object} currentReport - Текущий отчет менеджера процессов
 * @param {Function} killFn - Функция завершения процесса
 */
export function findAndShowProcessAiModal(type, name, pid, currentReport, killFn) {
  if (!currentReport) return;
  const allGroups = [
    ...(currentReport.apps || []),
    ...(currentReport.background_processes || []),
    ...(currentReport.windows_processes || [])
  ];

  if (type === 'sub' && pid) {
    for (const grp of allGroups) {
      if (grp.subprocesses) {
        const foundSub = grp.subprocesses.find(s => s.pid === pid);
        if (foundSub) {
          openProcessAiModal(foundSub, 'sub', grp, killFn);
          return;
        }
      }
    }
  }

  const foundGroup = allGroups.find(g => (pid && g.main_pid === pid) || g.name === name);
  if (foundGroup) {
    openProcessAiModal(foundGroup, 'group', null, killFn);
    return;
  }

  openProcessAiModal({ name, pid }, 'sub', null, killFn);
}

/**
 * Открытие модального окна ИИ-ассистента для процесса (#pm-process-ai-modal)
 * @param {Object} item - Данные процесса или группы
 * @param {string} type - Тип сущности ('group' или 'sub')
 * @param {Object|null} parentGroup - Родительская группа
 * @param {Function} killFn - Callback завершения процесса
 */
export function openProcessAiModal(item, type = 'group', parentGroup = null, killFn = null) {
  if (!item) return;
  activeModalProcess = item;
  activeModalType = type;
  activeModalParent = parentGroup;

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

  // 1. Попытка синхронизации с глобальным синглтоном AIModalDialog
  const globalModal = window.AIModalDialog || window.AITableModal || (window.parent && (window.parent.AIModalDialog || window.parent.AITableModal));
  if (globalModal && typeof globalModal.show === 'function') {
    try {
      const gBadges = [
        { text: category, class: 'badge bg-primary' },
        { text: `PID: ${pidStr}`, class: 'badge bg-secondary' },
        { text: isGroup ? `${count} процессов` : (item.username || 'SYSTEM'), class: 'badge bg-info text-dark' }
      ];
      if (item.has_visible_window || item.has_window) gBadges.push({ text: 'Оконный', class: 'badge bg-success' });

      const gMeta = [
        { label: 'Имя исполняемого файла', value: item.name, isCode: true },
        { label: 'Идентификатор PID', value: pidStr, isCode: true },
        { label: 'Категория процесса', value: category },
        { label: 'Нагрузка CPU', value: cpuStr },
        { label: 'Использование RAM', value: memStr }
      ];
      if (item.exe_path) gMeta.push({ label: 'Путь к файлу', value: item.exe_path, isCode: true, fullWidth: true });
      if (item.command_line) gMeta.push({ label: 'Командная строка', value: item.command_line, isCode: true, fullWidth: true });

      globalModal.show({
        icon: '🤖',
        title: title,
        subtitle: `Категория: ${category} | CPU: ${cpuStr} | RAM: ${memStr}`,
        panelId: 'panel-process-manager-dispetcher-protsessov-i-prilozhen',
        tableType: 'process',
        badges: gBadges,
        metadata: gMeta,
        rawTitle: 'Телеметрия процесса WinAPI/psutil',
        rawContent: JSON.stringify(item, null, 2),
        requestData: item,
        actions: [
          {
            label: isGroup ? 'Завершить дерево процессов' : 'Завершить процесс',
            icon: isGroup ? 'bi-x-circle' : 'bi-x',
            class: 'btn-outline-danger',
            onClick: () => {
              if (killFn) killFn(isGroup ? item.main_pid : item.pid, item.name, isGroup);
            }
          }
        ]
      });
      return;
    } catch (e) {
      console.warn('[ProcessManager] Переключение на локальное модальное окно:', e);
    }
  }

  // 2. Локальное модальное окно #pm-process-ai-modal в DOM
  const modalEl = document.getElementById('pm-process-ai-modal');
  if (!modalEl) {
    console.error('[ProcessManager] DOM-элемент #pm-process-ai-modal не найден');
    return;
  }

  const titleEl = document.getElementById('pm-modal-title');
  if (titleEl) titleEl.textContent = title;

  const badgesEl = document.getElementById('pm-modal-badges');
  if (badgesEl) {
    let bHtml = `<span class="badge bg-primary">${escapeHtml(category)}</span>`;
    bHtml += `<span class="badge bg-secondary font-monospace">PID: ${pidStr}</span>`;
    bHtml += `<span class="badge bg-info text-dark">${isGroup ? `${count} процессов` : (escapeHtml(item.username || 'SYSTEM'))}</span>`;
    if (item.has_visible_window || item.has_window) {
      bHtml += `<span class="badge bg-success">Оконный</span>`;
    }
    badgesEl.innerHTML = bHtml;
  }

  renderModalMetadataGrid(item, isGroup, pidStr, category, cpuStr, memStr, count);

  const rawContent = document.getElementById('pm-modal-raw-content');
  if (rawContent) rawContent.textContent = JSON.stringify(item, null, 2);

  loadPanelSystemInstruction();

  const killBtn = document.getElementById('pm-modal-btn-kill');
  if (killBtn) {
    killBtn.textContent = isGroup ? 'Завершить дерево процессов' : 'Завершить процесс';
    killBtn.onclick = () => {
      if (killFn) killFn(isGroup ? item.main_pid : item.pid, item.name, isGroup);
    };
  }

  const copyBtn = document.getElementById('pm-modal-btn-copy');
  if (copyBtn) {
    const pathToCopy = item.exe_path || (item.subprocesses && item.subprocesses[0] && item.subprocesses[0].exe_path) || item.name;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(pathToCopy).then(() => {
        if (window.toast) window.toast.info('Буфер обмена', 'Путь скопирован');
      });
    };
  }

  const chatMessages = document.getElementById('pm-chat-messages-container');
  if (chatMessages) {
    chatMessages.innerHTML = '<div class="text-muted small text-center" id="pm-chat-placeholder">Задайте вопрос или выберите быстрый сценарий:</div>';
  }

  resetDeepTelemetryFields();
  openModalDialogElement(modalEl);

  // Загружаем глубокую телеметрию
  loadProcessDeepTelemetry(targetPid, item.name);
}

/**
 * Отрисовка сетки метаданных в модальном окне
 */
function renderModalMetadataGrid(item, isGroup, pidStr, category, cpuStr, memStr, count) {
  const metaGrid = document.getElementById('pm-modal-metadata-grid');
  if (!metaGrid) return;

  const metaList = [
    { label: 'Исполняемый файл', value: item.name, isCode: true },
    { label: 'PID процесса', value: pidStr, isCode: true },
    { label: 'Категория', value: category },
    { label: 'Нагрузка CPU', value: cpuStr },
    { label: 'Использование памяти', value: memStr },
    { label: 'Потоков (Threads)', value: String(isGroup ? (item.total_threads || count) : (item.num_threads || 1)) }
  ];

  if (!isGroup) {
    if (item.username) metaList.push({ label: 'Пользователь (кем запущен)', value: item.username });
    if (item.create_time) metaList.push({ label: 'Время запуска', value: `${item.create_time}${item.uptime_str ? ` (${item.uptime_str})` : ''}` });
    if (item.launch_summary) metaList.push({ label: 'Ключ запуска / Модуль', value: item.launch_summary, isCode: true });
    if (item.real_parent && item.real_parent !== item.name) metaList.push({ label: 'Истинный родитель / Хост', value: item.real_parent, isCode: true });
    if (item.parent_name || item.ppid) metaList.push({ label: 'Родительский процесс', value: `${item.parent_name || 'Процесс'} [PPID: ${item.ppid || '-'}]`, isCode: true });
    if (item.window_title) metaList.push({ label: 'Заголовок окна', value: item.window_title, fullWidth: true });
    if (item.exe_path) metaList.push({ label: 'Путь к файлу', value: item.exe_path, isCode: true, fullWidth: true });
    if (item.command_line) metaList.push({ label: 'Командная строка', value: item.command_line, isCode: true, fullWidth: true });
  } else {
    if (item.friendly_name) metaList.push({ label: 'Читаемое название', value: item.friendly_name });
    if (item.is_pwa_or_electron) metaList.push({ label: 'Архитектура приложения', value: 'PWA / Electron (Chromium Platform)' });
    if (item.real_parent_name) metaList.push({ label: 'Истинный родитель', value: item.real_parent_name, isCode: true });
    if (item.launch_summary) metaList.push({ label: 'Ключ/суть запуска', value: item.launch_summary, isCode: true });
    if (item.username) metaList.push({ label: 'Пользователь', value: item.username });
    if (item.create_time) metaList.push({ label: 'Время запуска старейшего', value: item.create_time });
    const titles = (item.window_titles || []).filter(Boolean);
    if (titles.length > 0) metaList.push({ label: 'Окна приложения', value: titles.join('; '), fullWidth: true });
    const firstSub = (item.subprocesses || [])[0];
    if (firstSub && firstSub.exe_path) metaList.push({ label: 'Путь к файлу', value: firstSub.exe_path, isCode: true, fullWidth: true });
    if (firstSub && firstSub.command_line) metaList.push({ label: 'Командная строка', value: firstSub.command_line, isCode: true, fullWidth: true });
  }

  metaGrid.innerHTML = metaList.map(m => {
    const colCls = m.fullWidth ? 'col-12' : 'col-sm-6';
    const valHtml = m.isCode
      ? `<span class="font-monospace text-info">${escapeHtml(m.value)}</span>`
      : `<span class="text-light">${escapeHtml(m.value)}</span>`;
    return `
      <div class="${colCls}">
        <strong class="text-muted">${escapeHtml(m.label)}:</strong> ${valHtml}
      </div>
    `;
  }).join('');
}

/**
 * Загрузка системной инструкции панели
 */
export async function loadPanelSystemInstruction() {
  const sysTextarea = document.getElementById('pm-modal-sys-textarea');
  if (!sysTextarea) return;
  try {
    const res = await fetch('/api/v1/diagnostics/prompts/process?panel_id=panel-process-manager-dispetcher-protsessov-i-prilozhen');
    if (res.ok) {
      const data = await res.json();
      sysTextarea.value = data.system_instruction || '';
    }
  } catch (_) {
    sysTextarea.value = 'Эксперт по внутреннему устройству Windows (Windows Internals) и анализу процессов.';
  }
}

/**
 * Запуск экспертной диагностики выбранного процесса с обогащением накопленной телеметрией
 */
export async function runProcessDiagnostics() {
  if (!activeModalProcess) return;
  const aiExplanation = document.getElementById('pm-modal-ai-explanation');
  if (!aiExplanation) return;

  aiExplanation.innerHTML = `
    <div class="p-3 text-center text-muted">
      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
      ИИ-анализатор исследует контекст процесса, системные зависимости и параметры безопасности...
    </div>
  `;

  const item = activeModalProcess;
  const isGroup = (activeModalType === 'group');
  const pid = isGroup ? (item.main_pid || 0) : (item.pid || 0);

  const metadataPayload = {
    pid: String(pid),
    name: item.name,
    category: item.category || 'process',
    cpu_percent: String(item.cpu_percent || item.total_cpu_percent || 0),
    memory_mb: String(item.memory_mb || item.total_memory_mb || 0),
    exe_path: item.exe_path || '',
    command_line: item.command_line || '',
    username: item.username || ''
  };

  const deepTlm = getActiveDeepTelemetry();
  if (deepTlm) {
    metadataPayload.started_at = deepTlm.start_time;
    metadataPayload.uptime_seconds = String(deepTlm.uptime_seconds);
    metadataPayload.started_by_user = deepTlm.user_name || 'SYSTEM';
    metadataPayload.parent_process = `${deepTlm.parent_name || 'unknown'} (PPID: ${deepTlm.ppid || '-'})`;
    metadataPayload.disk_read_total = `${deepTlm.disk_read_mb_total} MB (${deepTlm.disk_read_ops_total} ops)`;
    metadataPayload.disk_write_total = `${deepTlm.disk_write_mb_total} MB (${deepTlm.disk_write_ops_total} ops)`;
    metadataPayload.cpu_total_time_sec = String(deepTlm.cpu_total_time_sec);
    metadataPayload.peak_working_set_ram = `${deepTlm.memory_peak_working_set_mb} MB`;
    metadataPayload.private_bytes_ram = `${deepTlm.memory_private_bytes_mb} MB`;
    metadataPayload.microphone_access = deepTlm.microphone?.is_active_now ? 'ACTIVE' : (deepTlm.microphone?.last_used || 'NONE');
    metadataPayload.camera_access = deepTlm.camera?.is_active_now ? 'ACTIVE' : (deepTlm.camera?.last_used || 'NONE');
    metadataPayload.active_network_sockets = String(deepTlm.active_sockets_count || 0);

    if (deepTlm.suspicion_score !== undefined) {
      metadataPayload.suspicion_risk = `${deepTlm.suspicion_level || 'SAFE'} (Score: ${deepTlm.suspicion_score}/100)`;
      metadataPayload.powershell_spawns_count = String(deepTlm.powershell_spawns_count || 0);
      metadataPayload.suspicious_children_count = String(deepTlm.suspicious_children_count || 0);
      metadataPayload.suspicion_triggers = (deepTlm.suspicion_triggers && deepTlm.suspicion_triggers.length > 0)
        ? deepTlm.suspicion_triggers.join('; ')
        : 'None detected';
    }
  }

  const payload = {
    table_type: 'process',
    panel_id: 'panel-process-manager-dispetcher-protsessov-i-prilozhen',
    title: item.name,
    subtitle: isGroup ? (item.friendly_name || item.name) : `PID: ${item.pid}`,
    metadata: metadataPayload,
    raw_data: JSON.stringify({ item, telemetry: deepTlm }, null, 2)
  };

  try {
    const res = await fetch('/api/v1/diagnostics/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const sourceBadge = data.source === 'wikillm'
      ? '<span class="badge bg-success-subtle text-success border border-success mb-2"><i class="bi bi-patch-check-fill me-1"></i>Верифицировано в WikiLLM</span>'
      : '<span class="badge bg-info-subtle text-info border border-info mb-2"><i class="bi bi-robot me-1"></i>Ответ модели ИИ</span>';

    aiExplanation.innerHTML = `
      ${sourceBadge}
      <div class="mb-2"><strong class="text-primary"><i class="bi bi-card-text me-1"></i>Назначение:</strong> ${escapeHtml(data.summary)}</div>
      <div class="mb-2"><strong class="text-muted"><i class="bi bi-building me-1"></i>Разработчик / Категория:</strong> ${escapeHtml(data.developer || 'Неизвестен')} (${escapeHtml(data.category || 'Процесс')})</div>
      <div class="mb-2"><strong class="text-warning"><i class="bi bi-shield-lock me-1"></i>Оценка безопасности:</strong> ${escapeHtml(data.security_verdict)}</div>
      <div class="mb-2"><strong class="text-info"><i class="bi bi-speedometer2 me-1"></i>Влияние на ресурсы:</strong> ${escapeHtml(data.performance_impact)}</div>
      <div class="p-2 mb-2 rounded bg-black bg-opacity-40 border border-secondary border-opacity-25">
        <strong class="text-warning"><i class="bi bi-lightbulb me-1"></i>Рекомендация:</strong> ${escapeHtml(data.recommendation)}
      </div>
      ${data.action_steps && data.action_steps.length > 0 ? `
        <div class="small fw-bold text-muted text-uppercase mb-1">Рекомендуемые действия:</div>
        <ul class="mb-0 ps-3">
          ${data.action_steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      ` : ''}
    `;
  } catch (err) {
    aiExplanation.innerHTML = `
      <div class="alert alert-warning py-2 mb-0 small">
        <i class="bi bi-exclamation-triangle me-1"></i>Не удалось получить объяснение ИИ: ${escapeHtml(err.message)}
        <div class="mt-2">
          <button class="btn btn-xs btn-outline-primary" id="btn-pm-retry-diagnose">Повторить попытку</button>
        </div>
      </div>
    `;
    const retryBtn = document.getElementById('btn-pm-retry-diagnose');
    if (retryBtn) retryBtn.onclick = runProcessDiagnostics;
  }
}

/**
 * Надежное отображение модального окна (Bootstrap или Vanilla fallback)
 * @param {HTMLElement} modalEl
 */
export function openModalDialogElement(modalEl) {
  if (!modalEl) return;
  if (window.bootstrap && window.bootstrap.Modal) {
    try {
      const bs = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      bs.show();
      return;
    } catch (_) {}
  }
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  modalEl.removeAttribute('aria-hidden');
  modalEl.setAttribute('aria-modal', 'true');

  let backdrop = document.getElementById('pm-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'pm-modal-backdrop';
    backdrop.className = 'modal-backdrop fade show';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeModalDialogElement);
  }
}

/**
 * Закрытие модального окна
 */
export function closeModalDialogElement() {
  const modalEl = document.getElementById('pm-process-ai-modal');
  if (modalEl) {
    if (window.bootstrap && window.bootstrap.Modal) {
      try {
        const bs = window.bootstrap.Modal.getInstance(modalEl);
        if (bs) bs.hide();
      } catch (_) {}
    }
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.removeAttribute('aria-modal');
  }
  const backdrop = document.getElementById('pm-modal-backdrop');
  if (backdrop) backdrop.remove();
}

/**
 * Открытие первого доступного или активного процесса в модальном окне
 * @param {Object} currentReport
 * @param {Function} killFn
 */
export function openFirstAvailableProcessAiModal(currentReport, killFn) {
  if (!currentReport) return;
  const apps = currentReport.apps || [];
  const bg = currentReport.background_processes || [];
  const win = currentReport.windows_processes || [];

  const target = apps[0] || bg[0] || win[0];
  if (target) {
    openProcessAiModal(target, 'group', null, killFn);
  } else {
    openProcessAiModal({
      name: 'System Process Manager',
      friendly_name: 'Диспетчер процессов Windows',
      category: 'system',
      main_pid: 0,
      total_cpu_percent: 0,
      total_memory_mb: 0
    }, 'group', null, killFn);
  }
}
