/**
 * @file apps/windows/api/webgui/tab_defender_firewall/panel_overview/panel.js
 * @description Панель общего состояния и эшелонов защиты Microsoft Defender (Real-time, Cloud, службы)
 * @author hypo69
 * @version 1.0.0
 * Updated: 2026-10-17 01:24:00
 */

import { fetchJSON, showAlert } from '../common/ui_utils.js';

let defenderData = null;

/**
 * Получение текущих данных статуса Defender
 * @returns {Object|null}
 */
export function getDefenderData() {
  return defenderData;
}

/**
 * Загрузка сводного статуса и служб Защитника Windows
 */
export async function loadDefenderStatus() {
  try {
    const status = await fetchJSON('/api/v1/defender/status');
    defenderData = status;

    const engBadge = document.getElementById('def-engine-ver-badge');
    if (engBadge) engBadge.textContent = `Движок: ${status.engine_version || 'N/A'}`;
    const sigsBadge = document.getElementById('def-sigs-ver-badge');
    if (sigsBadge) sigsBadge.textContent = `Базы: ${status.antivirus_signature_version || 'N/A'}`;

    const rtVal = document.getElementById('def-realtime-val');
    if (rtVal) {
      rtVal.textContent = status.real_time_protection_enabled ? 'ВКЛ' : 'ВЫКЛ';
      rtVal.className = `def-card-value ${status.real_time_protection_enabled ? 'text-success' : 'text-danger'}`;
    }

    const cloudVal = document.getElementById('def-cloud-val');
    if (cloudVal) {
      cloudVal.textContent = status.cloud_protection_enabled ? 'АКТИВНА' : 'ВЫКЛ';
      cloudVal.className = `def-card-value ${status.cloud_protection_enabled ? 'text-success' : 'text-warning'}`;
    }

    const puaCfaVal = document.getElementById('def-pua-cfa-val');
    if (puaCfaVal) {
      const puaText = status.pua_protection_enabled ? 'PUA: ✓' : 'PUA: ✗';
      const cfaText = status.controlled_folder_access_enabled ? 'CFA: ✓' : 'CFA: ✗';
      puaCfaVal.textContent = `${puaText} | ${cfaText}`;
      puaCfaVal.className = 'def-card-value small text-info';
    }

    renderShieldsTable(status);
    renderServicesTable(status);
  } catch (err) {
    console.error('[DefenderTab] Error loading status:', err);
    showAlert(`Ошибка загрузки статуса Defender: ${err.message}`, true);
  }
}

/**
 * Отрисовка эшелонов защиты антивируса
 * @param {Object} status
 */
function renderShieldsTable(status) {
  const shieldsTbody = document.getElementById('def-shields-tbody');
  if (!shieldsTbody) return;

  const shields = [
    { name: 'Real-time Protection', enabled: status.real_time_protection_enabled, desc: 'Постоянный перехват и проверка файлов при создании и обращении' },
    { name: 'Cloud Protection (MAPS)', enabled: status.cloud_protection_enabled, desc: `Мгновенная блокировка новых угроз через облачный ИИ Microsoft (${status.cloud_block_level || 'Default'})` },
    { name: 'Behavior Monitoring', enabled: status.behavior_monitor_enabled, desc: 'Анализ поведения запущенных процессов и цепочек активности' },
    { name: 'IOAV Protection', enabled: status.ioav_protection_enabled, desc: 'Проверка файлов, загружаемых из браузера, почты и мессенджеров' },
    { name: 'AMSI Script Scanning', enabled: status.script_scanning_enabled, desc: 'Инспекция скриптов PowerShell, VBScript, JavaScript до их выполнения' },
    { name: 'Tamper Protection', enabled: status.tamper_protection_enabled, desc: 'Защита настроек антивируса от отключения вредоносным ПО' },
    { name: 'PUA Protection', enabled: status.pua_protection_enabled, desc: 'Блокировка нежелательного ПО, рекламных инсталляторов и майнеров' },
    { name: 'Controlled Folder Access', enabled: status.controlled_folder_access_enabled, desc: 'Защита папок Документы/Рабочий стол от шифрования Ransomware' },
    { name: 'Network Protection', enabled: status.network_protection_enabled, desc: 'Блокировка сетевых соединений с вредоносными доменами и IP' },
  ];

  shieldsTbody.innerHTML = shields.map(s => `
    <tr>
      <td class="fw-semibold text-body">${s.name}</td>
      <td class="text-center">
        <span class="badge ${s.enabled ? 'def-badge-active' : 'def-badge-disabled'}">
          ${s.enabled ? 'ВКЛЮЧЕНО' : 'ОТКЛЮЧЕНО'}
        </span>
      </td>
      <td class="text-secondary">${s.desc}</td>
    </tr>
  `).join('');
}

/**
 * Отрисовка таблицы служб и фоновых процессов Defender
 * @param {Object} status
 */
function renderServicesTable(status) {
  const servicesTbody = document.getElementById('def-services-tbody');
  if (!servicesTbody || !status.services) return;

  servicesTbody.innerHTML = status.services.map(svc => `
    <tr>
      <td>
        <div class="fw-semibold text-body">${svc.name}</div>
        <div class="text-secondary" style="font-size: 0.68rem;">${svc.display_name}</div>
      </td>
      <td class="text-center">
        <span class="badge ${svc.running ? 'bg-success' : 'bg-secondary'}">
          ${svc.running ? 'АКТИВЕН' : 'СТОП'}
        </span>
      </td>
      <td class="text-end text-secondary">${svc.pid || '-'}</td>
      <td class="text-end font-monospace">${svc.running ? svc.memory_mb + ' MB' : '-'}</td>
    </tr>
  `).join('');
}
