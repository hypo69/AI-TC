/**
 * =============================================================================
 * Process Name: Windows AI Ecosystem Tab - Main Script
 * =============================================================================
 * Description:
 *   Клиентский контроллер консолидированной панели ИИ-компонентов.
 *   Управляет суб-вкладками «Агенты», «Навыки» и «MCP Серверы».
 *
 * File: main.js
 * Project: ai-windows-admin
 * Package: windows/api/webgui/tab_ai_ecosystem
 * Author: hypo69
 * Copyright: © 2026 hypo69
 * Updated: 2026-10-13 14:05:00
 * =============================================================================
 */

(function () {
  'use strict';

  function loadScript(src) {
    return new Promise((resolve) => {
      const cleanSrc = src.split('?')[0];
      const existing = document.querySelector(`script[src^="${cleanSrc}"]`);
      if (existing) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (err) => {
        console.warn(`[AiEcosystem] Не удалось загрузить скрипт ${src}:`, err);
        resolve();
      };
      document.body.appendChild(s);
    });
  }

  async function loadSubPane(containerId, htmlUrl, jsUrl, initFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!container.hasChildNodes()) {
      try {
        const res = await fetch(`${htmlUrl}?v=${Date.now()}`);
        if (!res.ok) return;
        container.innerHTML = await res.text();
      } catch (err) {
        console.warn(`[AiEcosystem] Ошибка загрузки HTML для ${containerId}:`, err);
        return;
      }
    }

    if (jsUrl) {
      try {
        await loadScript(`${jsUrl}?v=${Date.now()}`);
        if (initFnName && typeof window[initFnName] === 'function') {
          try { window[initFnName](); } catch (err) { console.debug(`[AiEcosystem] ${initFnName} error:`, err); }
        }
      } catch (err) {
        console.warn(`[AiEcosystem] Ошибка скрипта для ${containerId}:`, err);
      }
    }
  }

  async function loadSubPanes() {
    // 1. Агенты
    await loadSubPane(
      'ai-agents-embed-container',
      '/html/tab_agents/index.html',
      '/html/tab_agents/main.js',
      'initAgentsTab'
    );

    // 2. Навыки и MCP
    await Promise.allSettled([
      loadSubPane(
        'ai-skills-embed-container',
        '/html/tab_skills/index.html',
        '/html/tab_skills/main.js',
        'initSkillsTab'
      ),
      loadSubPane(
        'ai-mcp-embed-container',
        '/html/tab_mcp/index.html',
        '/html/tab_mcp/main.js',
        'initMcpTab'
      ),
    ]);
  }

  async function triggerSubTabInit(subtabName) {
    if (subtabName === 'agents') {
      await loadSubPane('ai-agents-embed-container', '/html/tab_agents/index.html', '/html/tab_agents/main.js', 'initAgentsTab');
      if (typeof window.initAgentsTab === 'function') window.initAgentsTab();
    } else if (subtabName === 'skills') {
      await loadSubPane('ai-skills-embed-container', '/html/tab_skills/index.html', '/html/tab_skills/main.js', 'initSkillsTab');
      if (typeof window.initSkillsTab === 'function') window.initSkillsTab();
    } else if (subtabName === 'mcp') {
      await loadSubPane('ai-mcp-embed-container', '/html/tab_mcp/index.html', '/html/tab_mcp/main.js', 'initMcpTab');
      if (typeof window.initMcpTab === 'function') window.initMcpTab();
    }
  }

  window.switchAiEcosystemSubTab = function(subtabName) {
    let btnId = 'subtab-ai-agents-btn';
    if (subtabName === 'skills') btnId = 'subtab-ai-skills-btn';
    else if (subtabName === 'mcp') btnId = 'subtab-ai-mcp-btn';

    const btn = document.getElementById(btnId);
    if (btn) {
      if (window.bootstrap && window.bootstrap.Tab) {
        new window.bootstrap.Tab(btn).show();
      } else {
        btn.click();
      }
      triggerSubTabInit(subtabName);
    }
  };

  async function initAiEcosystemTab() {
    await loadSubPanes();
  }

  window.initAiEcosystemTab = initAiEcosystemTab;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiEcosystemTab);
  } else {
    initAiEcosystemTab();
  }
})();

