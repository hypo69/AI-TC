/**
 * @file apps/windows/api/webgui/tab_process_manager/panel_modal_telemetry/panel.js
 * @description Панель глубокой телеметрии процесса (Per-PID жизненный цикл, диск, сокеты, приватность, подозрительность)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:08:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let activeDeepTelemetry = null;

/**
 * Получение текущего объекта глубокой телеметрии
 * @returns {Object|null}
 */
export function getActiveDeepTelemetry() {
  return activeDeepTelemetry;
}

/**
 * Установка или сброс объекта глубокой телеметрии
 * @param {Object|null} val
 */
export function setActiveDeepTelemetry(val) {
  activeDeepTelemetry = val;
}

/**
 * Сброс значений глубокой телеметрии перед загрузкой новых данных
 */
export function resetDeepTelemetryFields() {
  activeDeepTelemetry = null;
  const statusBadge = document.getElementById('pm-tlm-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Загрузка телеметрии...';
    statusBadge.className = 'badge border border-secondary text-secondary small';
  }

  const elUptime = document.getElementById('pm-tlm-uptime');
  if (elUptime) elUptime.textContent = '-';

  const elParent = document.getElementById('pm-tlm-parent');
  if (elParent) elParent.textContent = '-';

  const elRam = document.getElementById('pm-tlm-ram');
  if (elRam) elRam.textContent = '-';

  const elPeakRam = document.getElementById('pm-tlm-peak-ram');
  if (elPeakRam) elPeakRam.textContent = '-';

  const elPrivRam = document.getElementById('pm-tlm-priv-ram');
  if (elPrivRam) elPrivRam.textContent = '-';

  const elPf = document.getElementById('pm-tlm-page-faults');
  if (elPf) elPf.textContent = '-';

  const elDiskRead = document.getElementById('pm-tlm-disk-read');
  if (elDiskRead) elDiskRead.textContent = '-';

  const elDiskWrite = document.getElementById('pm-tlm-disk-write');
  if (elDiskWrite) elDiskWrite.textContent = '-';

  const elDiskOps = document.getElementById('pm-tlm-disk-ops');
  if (elDiskOps) elDiskOps.textContent = '-';

  const elCpuTime = document.getElementById('pm-tlm-cpu-time');
  if (elCpuTime) elCpuTime.textContent = '-';

  const elCpuSplit = document.getElementById('pm-tlm-cpu-split');
  if (elCpuSplit) elCpuSplit.textContent = '-';

  const elVram = document.getElementById('pm-tlm-vram');
  if (elVram) elVram.textContent = '-';

  const elNetSent = document.getElementById('pm-tlm-net-sent');
  if (elNetSent) elNetSent.textContent = '-';

  const elNetRecv = document.getElementById('pm-tlm-net-recv');
  if (elNetRecv) elNetRecv.textContent = '-';

  const elSockCount = document.getElementById('pm-tlm-sockets-count');
  if (elSockCount) elSockCount.textContent = '0';

  const sockTbody = document.getElementById('pm-tlm-sockets-tbody');
  if (sockTbody) {
    sockTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Загрузка сетевых соединений...</td></tr>';
  }

  const elMic = document.getElementById('pm-tlm-mic-status');
  if (elMic) {
    elMic.className = 'badge bg-secondary text-light';
    elMic.textContent = 'Проверка...';
  }

  const elCam = document.getElementById('pm-tlm-cam-status');
  if (elCam) {
    elCam.className = 'badge bg-secondary text-light';
    elCam.textContent = 'Проверка...';
  }

  const elHandles = document.getElementById('pm-tlm-handles-gdi');
  if (elHandles) elHandles.textContent = '-';

  const suspBadge = document.getElementById('pm-suspicion-badge');
  if (suspBadge) {
    suspBadge.textContent = 'Оценка...';
    suspBadge.className = 'badge bg-secondary text-light';
  }

  const suspList = document.getElementById('pm-suspicion-triggers-list');
  if (suspList) suspList.innerHTML = '';

  const suspEmpty = document.getElementById('pm-suspicion-empty-alert');
  if (suspEmpty) suspEmpty.classList.remove('d-none');
}

/**
 * Загрузка глубокой исторической телеметрии процесса по PID
 * @param {number} pid Идентификатор процесса
 * @param {string} processName Имя процесса
 */
export async function loadProcessDeepTelemetry(pid, processName) {
  const statusBadge = document.getElementById('pm-tlm-status-badge');
  if (!pid) {
    if (statusBadge) {
      statusBadge.textContent = 'Телеметрия группы (обобщенная)';
      statusBadge.className = 'badge border border-info text-info small';
    }
    return null;
  }

  try {
    const res = await fetch(`/api/v1/telemetry/processes/${pid}/deep-history?name=${encodeURIComponent(processName || '')}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    activeDeepTelemetry = data;

    if (statusBadge) {
      statusBadge.textContent = `Телеметрия активна (БД: ${data.source_db || 'SQLite'})`;
      statusBadge.className = 'badge border border-success text-success small';
    }

    const elUptime = document.getElementById('pm-tlm-uptime');
    if (elUptime) {
      const sec = data.uptime_seconds || 0;
      if (sec < 60) elUptime.textContent = `${Math.round(sec)} сек`;
      else if (sec < 3600) elUptime.textContent = `${Math.floor(sec / 60)} мин ${Math.round(sec % 60)} сек`;
      else elUptime.textContent = `${(sec / 3600).toFixed(1)} ч (${Math.round(sec)} сек)`;
    }

    const elParent = document.getElementById('pm-tlm-parent');
    if (elParent) elParent.textContent = data.parent_name ? `${data.parent_name} (PID: ${data.ppid})` : (data.ppid ? `PID: ${data.ppid}` : 'Неизвестен');

    // Память
    const elRam = document.getElementById('pm-tlm-ram');
    if (elRam) elRam.textContent = `${data.memory_working_set_mb} MB`;

    const elPeakRam = document.getElementById('pm-tlm-peak-ram');
    if (elPeakRam) elPeakRam.textContent = `${data.memory_peak_working_set_mb} MB`;

    const elPrivRam = document.getElementById('pm-tlm-priv-ram');
    if (elPrivRam) elPrivRam.textContent = `${data.memory_private_bytes_mb} MB`;

    const elPf = document.getElementById('pm-tlm-page-faults');
    if (elPf) elPf.textContent = (data.memory_page_faults_total || 0).toLocaleString('ru-RU');

    // Дисковый ввод-вывод
    const elDiskRead = document.getElementById('pm-tlm-disk-read');
    if (elDiskRead) elDiskRead.textContent = `${data.disk_read_mb_total} MB (${(data.disk_read_bytes_total || 0).toLocaleString('ru-RU')} Б)`;

    const elDiskWrite = document.getElementById('pm-tlm-disk-write');
    if (elDiskWrite) elDiskWrite.textContent = `${data.disk_write_mb_total} MB (${(data.disk_write_bytes_total || 0).toLocaleString('ru-RU')} Б)`;

    const elDiskOps = document.getElementById('pm-tlm-disk-ops');
    if (elDiskOps) elDiskOps.textContent = `Чтение: ${data.disk_read_ops_total || 0} | Запись: ${data.disk_write_ops_total || 0}`;

    // CPU & Видео
    const elCpuTime = document.getElementById('pm-tlm-cpu-time');
    if (elCpuTime) elCpuTime.textContent = `${data.cpu_total_time_sec} сек (${(data.cpu_total_time_sec / 60).toFixed(1)} мин)`;

    const elCpuSplit = document.getElementById('pm-tlm-cpu-split');
    if (elCpuSplit) elCpuSplit.textContent = `Ядро: ${data.cpu_kernel_time_sec}s / Польз: ${data.cpu_user_time_sec}s`;

    const elVram = document.getElementById('pm-tlm-vram');
    if (elVram) elVram.textContent = `${data.gpu_vram_mb} MB (GPU: ${data.gpu_load_percent}%)`;

    // Сеть
    const elNetSent = document.getElementById('pm-tlm-net-sent');
    if (elNetSent) elNetSent.textContent = `${data.net_sent_mb_total} MB (${(data.net_bytes_sent_total || 0).toLocaleString('ru-RU')} Б)`;

    const elNetRecv = document.getElementById('pm-tlm-net-recv');
    if (elNetRecv) elNetRecv.textContent = `${data.net_recv_mb_total} MB (${(data.net_bytes_recv_total || 0).toLocaleString('ru-RU')} Б)`;

    const elSockCount = document.getElementById('pm-tlm-sockets-count');
    if (elSockCount) elSockCount.textContent = data.active_sockets_count || 0;

    const sockTbody = document.getElementById('pm-tlm-sockets-tbody');
    if (sockTbody) {
      if (data.sockets && data.sockets.length > 0) {
        sockTbody.innerHTML = data.sockets.map(s => `
          <tr>
            <td><span class="badge bg-secondary">${escapeHtml(s.protocol)}</span></td>
            <td class="text-info">${escapeHtml(s.local_address)}</td>
            <td class="text-warning">${escapeHtml(s.remote_address || '-')}</td>
            <td><span class="badge ${s.status === 'ESTABLISHED' ? 'bg-success' : 'bg-dark'}">${escapeHtml(s.status)}</span></td>
          </tr>
        `).join('');
      } else {
        sockTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Нет активных сетевых соединений</td></tr>';
      }
    }

    // Датчики конфиденциальности (Микрофон, Камера)
    renderPrivacySensors(data);

    const elHandles = document.getElementById('pm-tlm-handles-gdi');
    if (elHandles) {
      elHandles.textContent = `Handles: ${data.handles_count} | GDI: ${data.gdi_objects} | USER: ${data.user_objects}`;
    }

    // Оценка подозрительности и аномалий поведения
    renderSuspicionSection(data);

    return data;
  } catch (err) {
    if (statusBadge) {
      statusBadge.textContent = 'Телеметрия недоступна';
      statusBadge.className = 'badge border border-warning text-warning small';
    }
    return null;
  }
}

/**
 * Отрисовка статуса микрофона и камеры
 * @param {Object} data Данные телеметрии
 */
function renderPrivacySensors(data) {
  const elMic = document.getElementById('pm-tlm-mic-status');
  if (elMic) {
    if (data.microphone?.is_active_now) {
      elMic.className = 'badge bg-danger';
      elMic.innerHTML = '<i class="bi bi-record-circle me-1"></i>АКТИВЕН (Запись звука)';
    } else if (data.microphone?.last_used) {
      elMic.className = 'badge bg-secondary text-light';
      elMic.textContent = `Использовался: ${new Date(data.microphone.last_used).toLocaleDateString('ru-RU')}`;
    } else {
      elMic.className = 'badge bg-success-subtle text-success';
      elMic.textContent = 'Не используется';
    }
  }

  const elCam = document.getElementById('pm-tlm-cam-status');
  if (elCam) {
    if (data.camera?.is_active_now) {
      elCam.className = 'badge bg-danger';
      elCam.innerHTML = '<i class="bi bi-camera-video-fill me-1"></i>АКТИВНА (Видеопоток)';
    } else if (data.camera?.last_used) {
      elCam.className = 'badge bg-secondary text-light';
      elCam.textContent = `Использовалась: ${new Date(data.camera.last_used).toLocaleDateString('ru-RU')}`;
    } else {
      elCam.className = 'badge bg-success-subtle text-success';
      elCam.textContent = 'Не используется';
    }
  }
}

/**
 * Отрисовка секции эвристической оценки подозрительности
 * @param {Object} data Данные телеметрии
 */
function renderSuspicionSection(data) {
  const suspBadge = document.getElementById('pm-suspicion-badge');
  const suspIcon = document.getElementById('pm-suspicion-icon');
  const suspCard = document.getElementById('pm-modal-suspicion-section');
  const suspEmpty = document.getElementById('pm-suspicion-empty-alert');
  const suspList = document.getElementById('pm-suspicion-triggers-list');

  const score = Number(data.suspicion_score || 0);
  const level = data.suspicion_level || 'SAFE';
  const triggers = data.suspicion_triggers || [];

  if (suspBadge) {
    suspBadge.textContent = `${level} (${score}/100)`;
    if (level === 'CRITICAL' || level === 'HIGH') {
      suspBadge.className = 'badge bg-danger text-white fw-bold';
    } else if (level === 'MEDIUM') {
      suspBadge.className = 'badge bg-warning text-dark fw-bold';
    } else if (level === 'LOW') {
      suspBadge.className = 'badge bg-info text-dark fw-bold';
    } else {
      suspBadge.className = 'badge bg-success text-white fw-bold';
    }
  }

  if (suspIcon) {
    if (level === 'CRITICAL') suspIcon.textContent = '🚨';
    else if (level === 'HIGH') suspIcon.textContent = '⚠️';
    else if (level === 'MEDIUM') suspIcon.textContent = '⚡';
    else if (level === 'LOW') suspIcon.textContent = 'ℹ️';
    else suspIcon.textContent = '🛡️';
  }

  if (suspCard) {
    if (level === 'CRITICAL' || level === 'HIGH') {
      suspCard.className = 'card border-danger p-3 mb-3 bg-black bg-opacity-35';
    } else if (level === 'MEDIUM') {
      suspCard.className = 'card border-warning p-3 mb-3 bg-black bg-opacity-35';
    } else if (level === 'LOW') {
      suspCard.className = 'card border-info p-3 mb-3 bg-black bg-opacity-35';
    } else {
      suspCard.className = 'card border-success border-opacity-50 p-3 mb-3 bg-black bg-opacity-35';
    }
  }

  if (triggers.length > 0) {
    if (suspEmpty) suspEmpty.classList.add('d-none');
    if (suspList) {
      suspList.classList.remove('d-none');
      suspList.innerHTML = triggers.map(t => `
        <li class="list-group-item bg-transparent text-light border-secondary px-0 py-1 d-flex align-items-start gap-2">
          <i class="bi bi-exclamation-triangle-fill ${level === 'CRITICAL' || level === 'HIGH' ? 'text-danger' : 'text-warning'} mt-0.5"></i>
          <span>${escapeHtml(t)}</span>
        </li>
      `).join('');
    }
  } else {
    if (suspEmpty) suspEmpty.classList.remove('d-none');
    if (suspList) {
      suspList.classList.add('d-none');
      suspList.innerHTML = '';
    }
  }
}
