/**
 * =============================================================================
 * Название: Панель инспектора процессов и досье токена по PID
 * =============================================================================
 * Описание:
 *   Исследование контекста безопасности процесса: родительский PID, доменная
 *   учетная запись, уровень целостности (Integrity Level), привилегии и сессия.
 *
 * Файл: apps/windows/api/webgui/tab_windows_admin/panel_pid_inspector/panel.js
 * Пакет: windows/api/webgui/tab_windows_admin
 * Автор: hypo69
 * Updated: 2026-10-17 01:35:00
 * =============================================================================
 */

/**
 * Исследует процесс по указанному PID и формирует текстовое дерево токена.
 */
export async function handleExplainPid() {
  const input = document.getElementById('input-explain-pid');
  const outputEl = document.getElementById('pid-dossier-output');
  const pidVal = parseInt(input?.value || '0', 10);

  if (!pidVal || isNaN(pidVal)) {
    alert('Укажите корректный PID процесса');
    return;
  }

  if (outputEl) {
    outputEl.style.display = 'block';
    outputEl.textContent = `Исследование процесса PID ${pidVal}...`;
  }

  try {
    const res = await fetch(`/api/windows/identity/explain-pid/${pidVal}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const acc = data.account || {};
    const privs = data.privileges || [];
    const groups = data.groups || [];

    const lines = [
      `PID ${data.pid}`,
      '│',
      `├── Process: ${data.process_name}`,
      `├── Parent: ${data.parent_name} (PID ${data.parent_pid})`,
      '│',
      '├── Account',
      `│   ├── ${acc.domain}\\${acc.user}`,
      `│   └── SID: ${acc.sid}`,
      '│',
      `├── Groups (${groups.length})`,
      ...groups.map(g => `│   ├── ${g}`),
      '│',
      `├── Integrity: ${data.integrity}`,
      `├── Elevated: ${data.elevated ? 'YES (🟢)' : 'NO'}`,
      '│',
      `├── Privileges (${privs.length})`,
      ...privs.map(p => `│   ├── ${p}`),
      '│',
      '└── Session',
      '    ├── Console',
      `    └── Session ID: ${data.session_id}`,
    ];

    if (outputEl) outputEl.textContent = lines.join('\n');
  } catch (err) {
    if (outputEl) outputEl.textContent = `Ошибка исследования PID ${pidVal}: ${err.message}`;
  }
}
