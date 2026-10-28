/**
 * Модуль консоли вывода и синхронизации видимости вкладок плагинов в навигации.
 * Файл: apps/windows/api/webgui/tab_plugins/panel_console_nav/panel.js
 * Updated: 2026-10-17 01:55:00
 */

/**
 * Логирование сообщений в консоль плагина на странице.
 * @param {string} text - Текст сообщения.
 */
export function logToPluginConsole(text) {
  const consoleEl = document.getElementById('plugin-console-output');
  if (!consoleEl) return;
  const time = new Date().toLocaleTimeString();
  consoleEl.textContent = `[${time}] ${text}\n` + consoleEl.textContent;
}

/**
 * Очистка консоли вывода плагинов.
 */
export function clearPluginConsole() {
  const consoleEl = document.getElementById('plugin-console-output');
  if (consoleEl) consoleEl.textContent = 'Консоль очищена.\n';
}

/**
 * Переход к конкретному плагину из выпадающего меню навигации.
 * @param {string} pluginName - Имя плагина.
 */
export function openPluginFromDropdown(pluginName) {
  if (!pluginName) return;

  // 1. Закрываем открытые выпадающие списки
  document.querySelectorAll('#mainTabs .dropdown-menu.show').forEach((m) => {
    m.classList.remove('show');
    m.closest('.dropdown')?.querySelector('.dropdown-toggle')?.classList.remove('show');
  });

  const normalized = pluginName.toLowerCase().replace(/-/g, '_');

  // 2. Если у плагина есть своя выделенная вкладка в DOM, открываем ее
  if (normalized === 'telegram_channel_rag' || normalized === 'telegram_rag') {
    const pane = document.getElementById('tab-telegram-rag') || document.getElementById('tab-telegram_rag');
    if (pane && typeof window.switchTab === 'function') {
      window.switchTab('tab-telegram-rag');
      return;
    }
  }
  if (normalized === 'news_feed' || normalized === 'news' || normalized === 'smart_news' || normalized === 'smart_feed_news') {
    const pane = document.getElementById('tab-news');
    if (pane && typeof window.switchTab === 'function') {
      window.switchTab('tab-news');
      return;
    }
  }

  // 3. Иначе переключаемся на вкладку плагинов и выбираем плагин в каталоге
  if (typeof window.switchTab === 'function') {
    window.switchTab('tab-plugins');
  }

  const select = () => {
    if (typeof window.selectPlugin === 'function') {
      window.selectPlugin(pluginName);
    }
  };

  select();
  setTimeout(select, 150);
  setTimeout(select, 400);
}

/**
 * Синхронизирует видимость элементов навигации в навбаре с активностью плагинов.
 * @param {Array<Object>} plugins - Список плагинов.
 */
export function syncPluginTabsVisibility(plugins) {
  if (!Array.isArray(plugins)) return;
  const pluginMap = {};
  plugins.forEach(p => {
    pluginMap[p.name] = Boolean(p.enabled);
  });

  // 1. Обновляем выпадающие списки включенных плагинов в шапке
  const enabledContainers = document.querySelectorAll('#nav-enabled-plugins-list, .nav-enabled-plugins-list');
  const enabledPlugins = plugins.filter(p => p.enabled);

  enabledContainers.forEach(container => {
    if (enabledPlugins.length === 0) {
      container.innerHTML = `
        <div class="list-group-item dropdown-item text-muted small py-2 px-3 fst-italic">
          Нет активных плагинов
        </div>
      `;
    } else {
      let html = '';
      enabledPlugins.forEach(p => {
        const icon = p.icon || '🧩';
        const title = p.title || p.name;
        const desc = p.description || title;
        html += `
          <button class="list-group-item list-group-item-action dropdown-item d-flex align-items-center gap-2 py-2 px-3 text-truncate" 
                  type="button" 
                  data-plugin="${p.name}"
                  title="${desc}"
                  onclick="openPluginFromDropdown('${p.name}')">
            <span>${icon}</span>
            <span class="text-truncate">${title}</span>
          </button>
        `;
      });
      container.innerHTML = html;
    }
  });

  // 2. Находим все элементы навигации, привязанные к отдельным плагинам
  const pluginNavItems = document.querySelectorAll('[data-plugin-tab]');
  pluginNavItems.forEach(item => {
    const pluginName = item.getAttribute('data-plugin-tab');
    const isEnabled = (pluginMap[pluginName] !== undefined) ? pluginMap[pluginName] : false;

    if (isEnabled) {
      item.classList.remove('d-none');
    } else {
      item.classList.add('d-none');
      const button = item.querySelector('.nav-link, .dropdown-item');
      if (button && button.classList.contains('active')) {
        if (typeof window.switchTab === 'function') {
          window.switchTab('tab-chat');
        } else {
          const chatTab = document.querySelector('[data-bs-target="#tab-chat"]');
          if (chatTab && window.bootstrap?.Tab) {
            const tab = new window.bootstrap.Tab(chatTab);
            tab.show();
          }
        }
      }
    }
  });
}
