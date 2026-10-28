# Справочник API AIModalDialog

Компонент: `apps/windows/api/webgui/ai_modal_dialog/`  
Глобальный синглтон: `window.AIModalDialog` (или `window.AITableModal`)

---

## 📌 Сигнатура вызова `window.AIModalDialog.show(options)`

```javascript
window.AIModalDialog.show({
  // Заголовок и контекст
  title: 'spoolsv.exe',
  subtitle: 'PID: 1420 | Диспетчер печати Windows',
  icon: '🖨️', // Эмодзи или текстовая иконка

  // Тип таблицы для авто-выбора системного промпта
  // 'process' | 'service' | 'software' | 'task' | 'network' | 'registry' | 'user' | 'website' | 'rag_doc' | 'disk' | 'startup' | 'generic'
  tableType: 'service',

  // Бейджи статусов в шапке окна
  badges: [
    { text: 'Running', class: 'badge bg-success' },
    { text: 'Automatic', class: 'badge bg-body-secondary text-body' }
  ],

  // Сетка пар «Ключ — Значение»
  metadata: [
    { label: 'Исполняемый файл', value: 'C:\\Windows\\System32\\spoolsv.exe', isCode: true, fullWidth: true },
    { label: 'Память', value: '14.2 MB' },
    { label: 'Пользователь', value: 'NT AUTHORITY\\SYSTEM' }
  ],

  // Блок сырых данных (сворачиваемый спойлер)
  rawTitle: 'WMI Win32_Service Dump',
  rawContent: '{"Name": "Spooler", "State": "Running", "StartMode": "Auto"}',

  // Автоматический старт генерации LLM при отсутствии в L1 кэше WikiLLM
  autoRun: false,

  // Кнопки быстрых действий в футере карточки
  actions: [
    {
      label: 'Перезапустить службу',
      icon: 'bi-arrow-repeat',
      class: 'btn-outline-warning',
      onClick: (opts) => {
        console.log('Restarting:', opts.title);
      }
    }
  ]
});
```

---

## ⚡ Особенности работы диалога
1. **L1 Exact Cache (WikiLLM)**: Сначала проверяется локальная верифицированная база данных SQLite. Если карточка найдена — отображается мгновенно с бейджем «Одобрено в WikiLLM».
2. **Web Grounding**: Позволяет модели проверить подлинность и репутацию файла/сервиса через поиск Google/DuckDuckGo.
3. **Follow-up Chat**: Встроенный диалоговый блок для дополнительных вопросов оператора по анализируемой сущности.
4. **Редактор промптов**: Кнопка с иконкой карандаша в заголовке окна позволяет оператору отредактировать системную инструкцию и шаблон промпта для этого типа сущности.
