/**
 * =============================================================================
 * Название: Панель аудита привилегий и политики паролей SAM
 * =============================================================================
 * Описание:
 *   Экспресс-проверки безопасности: анализ администраторов (Who is Admin?),
 *   прав входа в качестве службы (SeServiceLogonRight), удаленного доступа RDP,
 *   поиск осиротевших SID/профилей и проверка политики паролей SAM.
 *
 * Файл: apps/windows/api/webgui/tab_windows_admin/panel_audit_sam/panel.js
 * Пакет: windows/api/webgui/tab_windows_admin
 * Автор: hypo69
 * Updated: 2026-10-20 17:18:00
 * =============================================================================
 */

import { escapeHtml } from '../common/ui_utils.js';

/**
 * Загрузка и отображение локальной политики паролей SAM.
 */
export async function loadPasswordPolicy() {
  const container = document.getElementById('password-policy-container');
  if (!container) return;
  try {
    const res = await fetch('/api/windows/identity/auth/policies');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pol = await res.json();
    container.innerHTML = `
      <ul class="list-group list-group-flush bg-transparent">
        <li class="list-group-item bg-transparent text-body d-flex justify-content-between align-items-center px-0 py-1 border-secondary">
          <span>Мин. длина пароля:</span>
          <strong>${pol.min_password_length} симв.</strong>
        </li>
        <li class="list-group-item bg-transparent text-body d-flex justify-content-between align-items-center px-0 py-1 border-secondary">
          <span>Макс. возраст пароля:</span>
          <strong>${pol.max_password_age_days} дней</strong>
        </li>
        <li class="list-group-item bg-transparent text-body d-flex justify-content-between align-items-center px-0 py-1 border-secondary">
          <span>Глубина истории:</span>
          <strong>${pol.password_history_length}</strong>
        </li>
        <li class="list-group-item bg-transparent text-body d-flex justify-content-between align-items-center px-0 py-1 border-secondary">
          <span>Порог блокировки:</span>
          <strong>${pol.lockout_threshold === 0 ? 'Отключен' : pol.lockout_threshold + ' попыток'}</strong>
        </li>
      </ul>
    `;
  } catch (err) {
    container.innerHTML = `<div class="text-danger">Ошибка политики: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Экспресс-аудит: Who is Admin? (Прямой и вложенный административный доступ).
 */
export async function runWhoIsAdminCheck() {
  const outputEl = document.getElementById('security-audit-results');
  if (outputEl) outputEl.innerHTML = '<div class="text-muted text-center py-3">Анализ администраторов системы...</div>';
  try {
    const res = await fetch('/api/windows/identity/who-is-admin');
    const admins = await res.json();
    if (!admins || admins.length === 0) {
      if (outputEl) outputEl.innerHTML = '<div>Администраторы не найдены</div>';
      return;
    }
    const html = admins.map(a => `
      <div class="mb-2 pb-1 border-bottom border-secondary">
        <div class="fw-bold text-danger"><i class="bi bi-shield-lock-fill me-1"></i> ${escapeHtml(a.username)} <span class="ui-badge ui-badge-neutral">${a.is_direct ? 'Прямой доступ' : 'Вложенное членство'}</span></div>
        <div class="small text-muted font-monospace">SID: ${a.sid}</div>
        <div class="small text-primary">Цепочка: ${(a.path_to_admin || []).join(' → ')}</div>
      </div>
    `).join('');
    if (outputEl) outputEl.innerHTML = html;
  } catch (err) {
    if (outputEl) outputEl.innerHTML = `<div class="text-danger">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Экспресс-аудит: Учетные записи с правом входа в качестве службы (SeServiceLogonRight).
 */
export async function runServiceLogonCheck() {
  const outputEl = document.getElementById('security-audit-results');
  if (outputEl) outputEl.innerHTML = '<div class="text-muted text-center py-3">Поиск аккаунтов с SeServiceLogonRight...</div>';
  try {
    const res = await fetch('/api/windows/identity/who-can-logon-as-service');
    const list = await res.json();
    if (!list || list.length === 0) {
      if (outputEl) outputEl.innerHTML = '<div class="text-success">Специфических сервисных учетных записей не назначено.</div>';
      return;
    }
    const html = `<h6>Аккаунты с правом SeServiceLogonRight:</h6>` + list.map(a => `<div class="font-monospace text-primary mb-1">• ${escapeHtml(a)}</div>`).join('');
    if (outputEl) outputEl.innerHTML = html;
  } catch (err) {
    if (outputEl) outputEl.innerHTML = `<div class="text-danger">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Экспресс-аудит: Доступ к удаленному рабочему столу (RDP).
 */
export async function runRdpCheck() {
  const outputEl = document.getElementById('security-audit-results');
  if (outputEl) outputEl.innerHTML = '<div class="text-muted text-center py-3">Поиск аккаунтов с доступом к RDP...</div>';
  try {
    const res = await fetch('/api/windows/identity/who-can-rdp');
    const list = await res.json();
    const html = `<h6>Аккаунты и группы с доступом к Remote Desktop:</h6>` + list.map(a => `<div class="font-monospace text-warning mb-1">• ${escapeHtml(a)}</div>`).join('');
    if (outputEl) outputEl.innerHTML = html;
  } catch (err) {
    if (outputEl) outputEl.innerHTML = `<div class="text-danger">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Экспресс-аудит: Поиск осиротевших SID в реестре и профилей без учетных записей.
 */
export async function runOrphanedCheck() {
  const outputEl = document.getElementById('security-audit-results');
  if (outputEl) outputEl.innerHTML = '<div class="text-muted text-center py-3">Поиск осиротевших SID и профилей...</div>';
  try {
    const [resSids, resProfiles] = await Promise.all([
      fetch('/api/windows/identity/orphaned-sids'),
      fetch('/api/windows/identity/orphaned-profiles'),
    ]);
    const sids = await resSids.json();
    const profiles = await resProfiles.json();

    if ((!sids || sids.length === 0) && (!profiles || profiles.length === 0)) {
      if (outputEl) outputEl.innerHTML = '<div class="text-success"><i class="bi bi-check-circle-fill me-1"></i> Осиротевших SID и профилей в системе не обнаружено.</div>';
      return;
    }

    let html = '<h6>Осиротевшие субъекты:</h6>';
    for (const s of sids) {
      html += `<div class="text-danger font-monospace mb-1">⚠️ SID: ${s.sid} (${s.location})</div>`;
    }
    for (const p of profiles) {
      html += `<div class="text-warning font-monospace mb-1">📁 Профиль без пользователя: ${p.profile_path} (SID: ${p.sid})</div>`;
    }
    if (outputEl) outputEl.innerHTML = html;
  } catch (err) {
    if (outputEl) outputEl.innerHTML = `<div class="text-danger">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}
