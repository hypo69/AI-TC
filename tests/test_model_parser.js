/**
 * Тест парсера ответов модели без сторонней библиотеки Prism.js
 * Updated: 2026-10-20 19:10:00
 */
const fs = require('fs');
const jsCode = fs.readFileSync('apps/windows/api/webgui/ai_modal_dialog/main.js', 'utf8');

globalThis.window = { AIModalDialog: null };
globalThis.document = { getElementById: () => null, addEventListener: () => {} };

eval(jsCode);
const modalApi = globalThis.window.AIModalDialog;

// Тест 1: Стандартный ответ со synthesis и action
const sampleResponse = [
  '> 💡 🧠 Анализ задачи и исследование ящика инструментов WikiLLM...',
  '> 💡 ⚙️ Шаг рассуждения 1: выбор инструмента или синтез решения...',
  '> ⚙️ WikiLLM Toolbox: Запуск windows_collector',
  '> 💡 🔍 Выполнение инструмента из ящика WikiLLM: windows_collector...',
  '> 📊 Данные от windows_collector:',
  '{',
  '  "domain_name": "processes",',
  '  "metrics": { "total_processes_count": 285 }',
  '}',
  '',
  '> 💡 ⚙️ Шаг рассуждения 2: выбор инструмента или синтез решения...',
  '> 🛠️ WikiLLM Synthesis: Модель создала новый инструмент check_antigravity_process: check_antigravity_process',
  '> 💡 ✨ Модель синтезировала новый инструмент в WikiLLM: «check_antigravity_process». Выполняю на хосте...',
  '> 📊 Данные от create_custom_tool:',
  '[',
  '  { "Name": "Antigravity", "Id": 9744, "Responding": true }',
  ']',
  '',
  '```action',
  '{',
  '  "action_id": "stop_antigravity_processes",',
  '  "title": "Безопасное завершение процессов Antigravity.exe",',
  '  "risk": "caution",',
  '  "description": "Принудительное завершение всех связанных процессов Antigravity",',
  '  "execution_command": "Get-Process -Name \'Antigravity\' -ErrorAction SilentlyContinue | Stop-Process -Force"',
  '}',
  '```',
  '',
  '### Заключение эксперта',
  'Процесс Antigravity (PID 9744) активен. Завершение может привести к потере несохраненных данных.'
].join('\n');

const html1 = modalApi.parseModelResponse(sampleResponse);
console.log('Test 1 HTML length:', html1.length);
console.log('Test 1 Has accordion:', html1.includes('uai-investigation-accordion'));
console.log('Test 1 Has ready tool card:', html1.includes('uai-ready-tool-card'));
console.log('Test 1 Has Run button:', html1.includes('uai-btn-run-cmd'));

if (!html1.includes('uai-investigation-accordion') || !html1.includes('uai-ready-tool-card') || !html1.includes('uai-btn-run-cmd')) {
  console.error('FAIL: Test 1 failed');
  process.exit(1);
}

// Тест 2: Ответ с net user, необрамленными шагами рассуждения и cmd блоком
const userPayload = `
 🧠 Анализ задачи и исследование ящика инструментов WikiLLM...
 ⚙️ Шаг рассуждения 1: выбор инструмента или синтез решения...
️ WikiLLM Toolbox: Запуск safe_powershell_probe
 🔍 Выполнение инструмента из ящика WikiLLM: safe_powershell_probe...
Данные от safe_powershell_probe:
[
  {
    "Name": "Administrator",
    "SID": "S-1-5-21-3883612645-4145461085-1751314526-500",
    "Disabled": true,
    "Lockout": false,
    "PasswordRequired": true,
    "PasswordChangeable": true
  }
]

💡 *⚙️ Шаг рассуждения 2: выбор инструмента или синтез решения...*

💡 *📝 Формирование итогового экспертного заключения...*
🕵️‍♂️ Результаты расследования безопасности учетных записей Windows

На основе собранной телеметрии обнаружена учетная запись user.

\`\`\`cmd
net user user /delete
\`\`\`
`;

const html2 = modalApi.parseModelResponse(userPayload);
console.log('Test 2 HTML length:', html2.length);
console.log('Test 2 Has accordion:', html2.includes('uai-investigation-accordion'));
console.log('Test 2 Accordion open:', html2.includes('<details class="uai-investigation-accordion uai-matrix-terminal mb-3" open>'));
console.log('Test 2 Has net user card:', html2.includes('uai-ready-tool-card'));
console.log('Test 2 Has CMD shell:', html2.includes('CMD Console'));

if (!html2.includes('uai-investigation-accordion')) {
  console.error('FAIL: Test 2 Missing matrix accordion');
  process.exit(1);
}
if (!html2.includes('open>')) {
  console.error('FAIL: Test 2 Accordion is not open');
  process.exit(1);
}
if (!html2.includes('uai-ready-tool-card')) {
  console.error('FAIL: Test 2 Missing net user tool card');
  process.exit(1);
}

console.log('SUCCESS: All parseModelResponse assertions PASSED (Both Test 1 and Test 2)!');
