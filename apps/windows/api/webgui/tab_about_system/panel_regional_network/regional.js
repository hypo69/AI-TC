/**
 * Модуль региональных настроек, локализации, часовых поясов и учетных записей.
 * Файл: apps/windows/api/webgui/tab_about_system/panel_regional_network/regional.js
 * Updated: 2026-10-20 18:54:00
 */

import { apiFetch, escapeHtml, setText } from '../common/ui_utils.js';
import {
  changeNetworkCategory,
  toggleNetworkDiscovery,
  updateNetworkProfileUI,
  setNetworkInterfaceIndex,
  isDiscoveryEnabled
} from './network.js';
import { renderTimezonesList, renderLanguagePacksList } from './localization.js';

let cachedRegionalData = null;

/**
 * Переключает активную вкладку в модальном окне региональных настроек.
 * @param {string} targetPaneId - ID целевой панели (например, 'pane-net').
 */
export function switchRegionalTab(targetPaneId) {
  const panes = document.querySelectorAll('.regional-tab-pane');
  panes.forEach(pane => {
    if (pane.id === targetPaneId) {
      pane.classList.remove('d-none');
    } else {
      pane.classList.add('d-none');
    }
  });

  const navBtns = document.querySelectorAll('.btn-reg-nav');
  navBtns.forEach(btn => {
    if (btn.getAttribute('data-tab-target') === targetPaneId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Отображает уведомление внутри модального окна региональных настроек.
 * @param {string} msg - Текст сообщения (может содержать HTML).
 * @param {string} [type='success'] - CSS-класс уведомления.
 */
export function showRegModalAlert(msg, type = 'success') {
  const alertBox = document.getElementById('reg-modal-alert');
  if (!alertBox) return;
  alertBox.className = `alert alert-${type} py-2 px-3 small mb-0`;
  alertBox.innerHTML = msg;
  alertBox.classList.remove('d-none');
  setTimeout(() => {
    alertBox.classList.add('d-none');
  }, 6000);
}

/**
 * Вызов API установки или активации языкового пакета.
 * @param {string} tag - Тэг языкового пакета (например 'ru-RU').
 * @param {HTMLElement} btnEl - Кнопка запуска операции.
 */
export async function installLanguagePack(tag, btnEl) {
  if (!tag) return;
  const origHtml = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Установка...';
  }

  try {
    const res = await fetch('/api/v1/system/install-language-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      const msg = data.message || `Языковой пакет ${tag} успешно обработан`;
      showRegModalAlert(`✅ ${escapeHtml(msg)}`, 'success');
      if (window.showToast) window.showToast(`✅ ${msg}`, 'success');
      await loadRegionalOptions('pane-loc');
    } else {
      const errMsg = data.message || 'Ошибка установки языкового пакета';
      showRegModalAlert(`Ошибка: ${escapeHtml(errMsg)}`, 'danger');
      if (window.showToast) window.showToast(`Ошибка: ${errMsg}`, 'danger');
    }
  } catch (err) {
    showRegModalAlert(`Сетевая ошибка: ${escapeHtml(err.message || String(err))}`, 'danger');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = origHtml;
    }
  }
}

/**
 * Загружает параметры региона, времени и пользователя с сервера.
 * @param {string|null} [targetPaneId=null] - Опциональный ID вкладки для показа.
 */
export async function loadRegionalOptions(targetPaneId = null) {
  if (targetPaneId) {
    switchRegionalTab(targetPaneId);
  }
  const tzBadge = document.getElementById('reg-cur-tz-badge');
  if (tzBadge) tzBadge.textContent = 'Загрузка...';

  try {
    const data = await apiFetch('/api/v1/system/regional-options');
    cachedRegionalData = data;

    if (tzBadge) tzBadge.textContent = data.current_timezone || 'Не определен';

    if (data.network_category) {
      const ifaceIndex = data.network_interface_index || null;
      setNetworkInterfaceIndex(ifaceIndex);
      const ifaceAlias = ifaceIndex ? `IF #${ifaceIndex}` : 'Ethernet';
      updateNetworkProfileUI(data.network_category, ifaceAlias, data.is_discovery_enabled);
    }

    const hostEl = document.getElementById('about-kpi-os-host');
    let curHost = hostEl ? hostEl.textContent.replace(/^Host:\s*/i, '').trim() : '';
    if (!curHost || curHost === '--') curHost = window.location.hostname || 'Host';
    const regHostInput = document.getElementById('reg-net-host-input');
    if (regHostInput) regHostInput.value = curHost;
    const regHostBadge = document.getElementById('reg-cur-host-badge');
    if (regHostBadge) regHostBadge.textContent = curHost;

    const wgEl = document.getElementById('about-kpi-os-workgroup');
    let curWg = wgEl ? wgEl.textContent.replace(/^Workgroup:\s*/i, '').trim() : '';
    if (!curWg || curWg === '--') curWg = 'WORKGROUP';
    const regWgInput = document.getElementById('reg-net-wg-input');
    if (regWgInput) regWgInput.value = curWg;
    const regWgBadge = document.getElementById('reg-cur-wg-badge');
    if (regWgBadge) regWgBadge.textContent = curWg;

    const searchInput = document.getElementById('reg-tz-search-input');
    const curQuery = searchInput ? searchInput.value.trim() : '';
    renderTimezonesList(data.timezones || [], curQuery, data.current_timezone);

    renderLanguagePacksList(data.language_packs || [], installLanguagePack);

    if (Array.isArray(data.locales) && data.locales.length > 0) {
      const sysLocSelect = document.getElementById('reg-loc-sys-select');
      const usrLocSelect = document.getElementById('reg-loc-usr-select');
      const optionsHtml = data.locales.map(loc => 
        `<option value="${escapeHtml(loc.code)}">${escapeHtml(loc.name)} [${escapeHtml(loc.code)}]</option>`
      ).join('');
      
      if (sysLocSelect) {
        sysLocSelect.innerHTML = optionsHtml;
        if (data.current_system_locale) sysLocSelect.value = data.current_system_locale;
      }
      if (usrLocSelect) {
        usrLocSelect.innerHTML = optionsHtml;
        if (data.current_user_locale) usrLocSelect.value = data.current_user_locale;
      }
    }

    const usrNameInput = document.getElementById('reg-usr-name-input');
    const usrFullNameInput = document.getElementById('reg-usr-fullname-input');
    const usrDescInput = document.getElementById('reg-usr-desc-input');
    const usrDomainInput = document.getElementById('reg-usr-domain-input');
    const usrSidBadge = document.getElementById('reg-usr-sid-badge');
    const usrProfileBadge = document.getElementById('reg-usr-profile-badge');
    const usrGroupsBadge = document.getElementById('reg-usr-groups-badge');
    const usrLogonBadge = document.getElementById('reg-usr-logon-badge');
    const usrTypeBadge = document.getElementById('reg-usr-type-badge');

    if (usrNameInput) usrNameInput.value = data.current_username || '';
    if (usrFullNameInput) usrFullNameInput.value = data.current_user_fullname || '';
    if (usrDescInput) usrDescInput.value = data.current_user_description || '';
    if (usrDomainInput) usrDomainInput.value = data.current_user_domain || '';
    if (usrSidBadge) usrSidBadge.textContent = data.current_user_sid || '--';
    if (usrProfileBadge) usrProfileBadge.textContent = data.current_user_profile || '--';
    if (usrGroupsBadge) usrGroupsBadge.textContent = Array.isArray(data.current_user_groups) ? data.current_user_groups.join(', ') : '--';
    if (usrLogonBadge) usrLogonBadge.textContent = data.current_user_last_logon || '--';
    if (usrTypeBadge) usrTypeBadge.textContent = data.current_user_account_type || 'Локальный пользователь Windows';

  } catch (err) {
    console.error('[AboutSystemTab] loadRegionalOptions error:', err);
    if (tzBadge) tzBadge.textContent = 'Ошибка загрузки';
    showRegModalAlert(`Ошибка загрузки параметров: ${escapeHtml(err.message || String(err))}`, 'danger');
  }
}

/**
 * Fallback отображение модального окна без зависимости от Bootstrap JS.
 * @param {HTMLElement} modalEl - DOM-элемент модального окна.
 */
function fallbackShowModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('show');
  modalEl.style.display = 'block';
  modalEl.removeAttribute('aria-hidden');
  modalEl.setAttribute('aria-modal', 'true');
  let backdrop = document.getElementById('about-reg-modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'about-reg-modal-backdrop';
    backdrop.className = 'modal-backdrop fade show';
    document.body.appendChild(backdrop);
  }
  const closeHandler = () => {
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.removeAttribute('aria-modal');
    const bd = document.getElementById('about-reg-modal-backdrop');
    if (bd) bd.remove();
  };
  const closeBtns = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
  closeBtns.forEach(btn => {
    btn.onclick = closeHandler;
  });
}

/**
 * Открывает модальное окно редактора параметров системы и окружения.
 * @param {string} [targetTab='pane-net'] - ID целевой вкладки ('pane-net', 'pane-usr', 'pane-loc', 'pane-tz').
 * @param {Event} [event=null] - Событие клика для фильтрации интерактивных дочерних элементов.
 */
export function openRegionalModal(targetTab = 'pane-net', event = null) {
  const modalEl = document.getElementById('aboutRegionalSettingsModal');
  if (modalEl) {
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
    const bs = window.bootstrap || (typeof bootstrap !== 'undefined' ? bootstrap : null);
    if (bs && bs.Modal) {
      try {
        const modalInst = bs.Modal.getOrCreateInstance(modalEl);
        modalInst.show();
      } catch (err) {
        console.warn('[AboutSystemTab] bs.Modal error, fallback to display:', err);
        fallbackShowModal(modalEl);
      }
    } else {
      fallbackShowModal(modalEl);
    }
  }
  loadRegionalOptions(targetTab);
  switchRegionalTab(targetTab);
}

/**
 * Привязывает обработчики событий модального окна региональных настроек.
 * @param {Object} callbacks - Колбэки для обновления часов и перезагрузки данных.
 */
export function bindRegionalEvents(callbacks = {}) {
  // Экспорт в глобальный контекст для прямого вызова из inline onclick
  window.openRegionalSettingsModal = openRegionalModal;
  window.openRegionalModal = openRegionalModal;

  const openButtons = document.querySelectorAll('#btn-open-regional-settings, .btn-open-reg-tab');
  openButtons.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetTab = btn.getAttribute('data-reg-tab') || 'pane-net';
      openRegionalModal(targetTab, e);
    };
  });

  // Привязка кликов по строкам с редактируемыми полями
  const editableRows = document.querySelectorAll('.about-sys-editable-row, tr[data-reg-tab]');
  editableRows.forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest('button, a, input, select, textarea, label')) {
        return;
      }
      const targetTab = row.getAttribute('data-reg-tab') || 'pane-net';
      openRegionalModal(targetTab, e);
    };
  });

  document.querySelectorAll('.btn-reg-nav').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const targetPane = btn.getAttribute('data-tab-target');
      if (targetPane) {
        switchRegionalTab(targetPane);
      }
    };
  });

  const tzSearchInput = document.getElementById('reg-tz-search-input');
  const tzSelect = document.getElementById('reg-tz-select');
  if (tzSearchInput) {
    tzSearchInput.oninput = () => {
      if (cachedRegionalData && cachedRegionalData.timezones) {
        const currentVal = tzSelect ? tzSelect.value : '';
        renderTimezonesList(cachedRegionalData.timezones, tzSearchInput.value.trim(), currentVal);
      }
    };
  }

  if (tzSelect) {
    tzSelect.onchange = () => {
      const selLabel = document.getElementById('reg-tz-selected-label');
      if (selLabel) {
        selLabel.textContent = tzSelect.value ? `Выбран: ${tzSelect.value}` : 'Выберите пояс из списка';
      }
    };
  }

  const btnSaveHost = document.getElementById('btn-reg-save-host');
  const inputHost = document.getElementById('reg-net-host-input');
  if (btnSaveHost && inputHost) {
    btnSaveHost.onclick = async (e) => {
      e.preventDefault();
      const newName = inputHost.value.trim();

      if (!newName) {
        showRegModalAlert('Пожалуйста, введите новое имя компьютера', 'warning');
        return;
      }

      const validNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,13}[a-zA-Z0-9])?$/;
      if (!validNamePattern.test(newName) || newName.length > 15) {
        showRegModalAlert('Имя должно содержать от 1 до 15 символов (A-Z, 0-9, дефис) без пробелов', 'warning');
        return;
      }

      btnSaveHost.disabled = true;
      inputHost.disabled = true;
      btnSaveHost.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

      try {
        const res = await fetch('/api/v1/system/rename-computer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_name: newName, restart: false }),
        });
        const result = await res.json();
        if (res.ok && result.status === 'ok') {
          setText('about-kpi-os-host', `Host: ${newName}`);
          setText('about-ident-hostname', newName);
          const curHostBadge = document.getElementById('reg-cur-host-badge');
          if (curHostBadge) curHostBadge.textContent = newName;

          showRegModalAlert(`✅ Имя компьютера изменено на «<strong>${escapeHtml(newName)}</strong>». Требуется перезагрузка Windows.`, 'warning');
          if (window.showToast) {
            window.showToast(`✅ Имя компьютера изменено на «${newName}». Требуется перезагрузка!`, 'warning');
          }
        } else {
          showRegModalAlert(`Ошибка: ${escapeHtml(result.message || 'Не удалось изменить имя компьютера')}`, 'danger');
        }
      } catch (err) {
        showRegModalAlert(`Сетевая ошибка: ${escapeHtml(err.message || String(err))}`, 'danger');
      } finally {
        btnSaveHost.disabled = false;
        inputHost.disabled = false;
        btnSaveHost.innerHTML = '<i class="bi bi-check-lg me-1"></i> Сохранить';
      }
    };
  }

  const btnSaveWg = document.getElementById('btn-reg-save-wg');
  const inputWg = document.getElementById('reg-net-wg-input');
  if (btnSaveWg && inputWg) {
    btnSaveWg.onclick = async (e) => {
      e.preventDefault();
      const newWg = inputWg.value.trim().toUpperCase();

      if (!newWg) {
        showRegModalAlert('Пожалуйста, введите имя рабочей группы', 'warning');
        return;
      }

      btnSaveWg.disabled = true;
      inputWg.disabled = true;
      btnSaveWg.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

      try {
        const res = await fetch('/api/v1/system/change-workgroup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_workgroup: newWg, restart: false }),
        });
        const result = await res.json();
        if (res.ok && result.status === 'ok') {
          setText('about-kpi-os-workgroup', `Workgroup: ${newWg}`);
          const curWgBadge = document.getElementById('reg-cur-wg-badge');
          if (curWgBadge) curWgBadge.textContent = newWg;

          showRegModalAlert(`✅ Рабочая группа изменена на «<strong>${escapeHtml(newWg)}</strong>». Требуется перезагрузка Windows.`, 'warning');
          if (window.showToast) {
            window.showToast(`✅ Рабочая группа изменена на «${newWg}». Требуется перезагрузка!`, 'warning');
          }
        } else {
          showRegModalAlert(`Ошибка: ${escapeHtml(result.message || 'Не удалось изменить рабочую группу')}`, 'danger');
        }
      } catch (err) {
        showRegModalAlert(`Сетевая ошибка: ${escapeHtml(err.message || String(err))}`, 'danger');
      } finally {
        btnSaveWg.disabled = false;
        inputWg.disabled = false;
        btnSaveWg.innerHTML = '<i class="bi bi-check-lg me-1"></i> Сохранить';
      }
    };
  }

  const btnSaveTz = document.getElementById('btn-reg-save-tz');
  if (btnSaveTz) {
    btnSaveTz.onclick = async () => {
      const tzVal = tzSelect ? tzSelect.value : '';
      if (!tzVal) {
        showRegModalAlert('Пожалуйста, выберите часовой пояс из списка', 'warning');
        return;
      }

      btnSaveTz.disabled = true;
      btnSaveTz.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Применение...';

      try {
        const res = await apiFetch('/api/v1/system/set-timezone', {
          method: 'POST',
          body: JSON.stringify({ timezone_id: tzVal })
        });

        if (res.status === 'ok') {
          showRegModalAlert(`✅ Часовой пояс успешно изменен на «<strong>${escapeHtml(res.timezone_id || tzVal)}</strong>»`, 'success');
          if (window.showToast) window.showToast(`✅ Часовой пояс изменен на «${tzVal}»`, 'success');
          const tzBadge = document.getElementById('reg-cur-tz-badge');
          if (tzBadge) tzBadge.textContent = res.timezone_id || tzVal;
          if (callbacks.updateClock) callbacks.updateClock();
          if (callbacks.refreshSummary) callbacks.refreshSummary();
        } else {
          showRegModalAlert(`Ошибка: ${escapeHtml(res.message || 'Не удалось применить пояс')}`, 'danger');
        }
      } catch (err) {
        showRegModalAlert(`Ошибка при смене часового пояса: ${escapeHtml(err.message || String(err))}`, 'danger');
      } finally {
        btnSaveTz.disabled = false;
        btnSaveTz.innerHTML = '<i class="bi bi-check-lg me-1"></i> Применить пояс';
      }
    };
  }

  const btnSaveLoc = document.getElementById('btn-reg-save-loc');
  if (btnSaveLoc) {
    btnSaveLoc.onclick = async () => {
      const sysLoc = document.getElementById('reg-loc-sys-select')?.value;
      const usrLoc = document.getElementById('reg-loc-usr-select')?.value;

      btnSaveLoc.disabled = true;
      btnSaveLoc.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Сохранение...';

      try {
        const res = await apiFetch('/api/v1/system/set-locale', {
          method: 'POST',
          body: JSON.stringify({ system_locale: sysLoc, user_locale: usrLoc })
        });

        if (res.status === 'ok') {
          const rebootMsg = res.reboot_required ? '<br><small class="text-warning">⚠️ Для полного применения требуется перезагрузка Windows.</small>' : '';
          showRegModalAlert(`✅ Системная локаль обновлена: <strong>${escapeHtml(res.locale || sysLoc)}</strong>.${rebootMsg}`, 'success');
          if (window.showToast) window.showToast(`✅ Системная локаль обновлена на «${res.locale || sysLoc}»`, 'warning');
          if (callbacks.refreshSummary) callbacks.refreshSummary();
        } else {
          showRegModalAlert(`Ошибка: ${escapeHtml(res.message || 'Не удалось изменить локаль')}`, 'danger');
        }
      } catch (err) {
        showRegModalAlert(`Ошибка при изменении локали: ${escapeHtml(err.message || String(err))}`, 'danger');
      } finally {
        btnSaveLoc.disabled = false;
        btnSaveLoc.innerHTML = '<i class="bi bi-check-lg me-1"></i> Применить локаль';
      }
    };
  }

  const btnSaveUsr = document.getElementById('btn-reg-save-usr');
  if (btnSaveUsr) {
    btnSaveUsr.onclick = async () => {
      const usrName = document.getElementById('reg-usr-name-input')?.value.trim();
      const fullName = document.getElementById('reg-usr-fullname-input')?.value.trim();
      const desc = document.getElementById('reg-usr-desc-input')?.value.trim();

      if (!usrName) {
        showRegModalAlert('Имя учетной записи не указано', 'warning');
        return;
      }

      btnSaveUsr.disabled = true;
      btnSaveUsr.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Сохранение...';

      try {
        const res = await apiFetch('/api/v1/system/update-user-profile', {
          method: 'POST',
          body: JSON.stringify({ username: usrName, full_name: fullName, description: desc })
        });

        if (res.status === 'ok') {
          showRegModalAlert(`✅ Профиль пользователя «<strong>${escapeHtml(usrName)}</strong>» успешно обновлен`, 'success');
          if (window.showToast) window.showToast(`✅ Профиль пользователя «${usrName}» обновлен`, 'success');
          if (callbacks.refreshAll) callbacks.refreshAll();
        } else {
          showRegModalAlert(`Ошибка: ${escapeHtml(res.message || 'Не удалось обновить профиль')}`, 'danger');
        }
      } catch (err) {
        showRegModalAlert(`Ошибка при обновлении профиля: ${escapeHtml(err.message || String(err))}`, 'danger');
      } finally {
        btnSaveUsr.disabled = false;
        btnSaveUsr.innerHTML = '<i class="bi bi-check-lg me-1"></i> Сохранить профиль';
      }
    };
  }

  const btnNetPub = document.getElementById('btn-net-profile-public');
  const btnNetPriv = document.getElementById('btn-net-profile-private');
  if (btnNetPub) {
    btnNetPub.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      changeNetworkCategory('Public', showRegModalAlert);
    };
  }
  if (btnNetPriv) {
    btnNetPriv.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      changeNetworkCategory('Private', showRegModalAlert);
    };
  }

  const btnModalPub = document.getElementById('btn-modal-net-public');
  const btnModalPriv = document.getElementById('btn-modal-net-private');
  if (btnModalPub) {
    btnModalPub.onclick = (e) => {
      e.preventDefault();
      changeNetworkCategory('Public', showRegModalAlert);
    };
  }
  if (btnModalPriv) {
    btnModalPriv.onclick = (e) => {
      e.preventDefault();
      changeNetworkCategory('Private', showRegModalAlert);
    };
  }

  const btnToggleDisc = document.getElementById('btn-reg-toggle-discovery');
  if (btnToggleDisc) {
    btnToggleDisc.onclick = (e) => {
      e.preventDefault();
      toggleNetworkDiscovery(!isDiscoveryEnabled(), showRegModalAlert);
    };
  }

  const btnDiscOn = document.getElementById('btn-net-discovery-on');
  const btnDiscOff = document.getElementById('btn-net-discovery-off');
  if (btnDiscOn) {
    btnDiscOn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleNetworkDiscovery(true, showRegModalAlert);
    };
  }
  if (btnDiscOff) {
    btnDiscOff.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleNetworkDiscovery(false, showRegModalAlert);
    };
  }
}
