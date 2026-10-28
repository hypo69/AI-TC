/**
 * Модуль управления сетевым профилем (Частная/Общая) и сетевым обнаружением (Вкл/Выкл).
 * Файл: apps/windows/api/webgui/tab_about_system/panel_regional_network/network.js
 * Updated: 2026-10-20 17:44:00
 */

import { escapeHtml } from '../common/ui_utils.js';

let currentNetworkCategory = 'Public';
let currentDiscoveryEnabled = false;
let currentNetworkInterfaceIndex = null;

/**
 * Получает текущий индекс сетевого интерфейса.
 * @returns {number|null} Индекс интерфейса.
 */
export function getNetworkInterfaceIndex() {
  return currentNetworkInterfaceIndex;
}

/**
 * Устанавливает индекс сетевого интерфейса.
 * @param {number|null} idx - Индекс интерфейса.
 */
export function setNetworkInterfaceIndex(idx) {
  currentNetworkInterfaceIndex = idx;
}

/**
 * Возвращает флаг включенности сетевого обнаружения.
 * @returns {boolean} Статус сетевого обнаружения.
 */
export function isDiscoveryEnabled() {
  return currentDiscoveryEnabled;
}

/**
 * Возвращает текущую категорию сетевого профиля ('Public' или 'Private').
 * @returns {string} Категория профиля.
 */
export function getNetworkCategory() {
  return currentNetworkCategory;
}

/**
 * Обновляет состояние переключателей и бейджей профиля сети (Частная / Общая) и обнаружения (Вкл / Выкл).
 * @param {string} [category] - Имя профиля сети (Public или Private).
 * @param {string|null} [ifaceName=null] - Название сетевого интерфейса.
 * @param {boolean|null} [isDiscovery=null] - Флаг сетевого обнаружения.
 */
export function updateNetworkProfileUI(category, ifaceName = null, isDiscovery = null) {
  if (category) {
    currentNetworkCategory = category.trim();
  }
  if (isDiscovery !== null) {
    currentDiscoveryEnabled = !!isDiscovery;
  }

  const isPriv = currentNetworkCategory.toLowerCase() === 'private';

  // 1. Интерфейс
  const ifaceEl = document.getElementById('about-net-iface-name');
  if (ifaceEl && ifaceName) {
    ifaceEl.textContent = ifaceName;
  }

  // 2. Переключатель 1: Частная / Общая (Главная панель)
  const btnPub = document.getElementById('btn-net-profile-public');
  const btnPriv = document.getElementById('btn-net-profile-private');
  if (btnPub && btnPriv) {
    if (isPriv) {
      btnPriv.className = 'btn btn-sm btn-success font-monospace py-0 px-2.5 fw-semibold';
      btnPub.className = 'btn btn-sm btn-outline-secondary font-monospace py-0 px-2.5';
    } else {
      btnPriv.className = 'btn btn-sm btn-outline-secondary font-monospace py-0 px-2.5';
      btnPub.className = 'btn btn-sm btn-warning text-dark font-monospace py-0 px-2.5 fw-semibold';
    }
  }

  // 3. Переключатель 2: Сетевое обнаружение Вкл / Выкл (Главная панель)
  const btnDiscOn = document.getElementById('btn-net-discovery-on');
  const btnDiscOff = document.getElementById('btn-net-discovery-off');
  if (btnDiscOn && btnDiscOff) {
    if (currentDiscoveryEnabled) {
      btnDiscOn.className = 'btn btn-sm btn-info font-monospace py-0 px-2 fw-semibold';
      btnDiscOff.className = 'btn btn-sm btn-outline-secondary font-monospace py-0 px-2';
    } else {
      btnDiscOn.className = 'btn btn-sm btn-outline-secondary font-monospace py-0 px-2';
      btnDiscOff.className = 'btn btn-sm btn-secondary font-monospace py-0 px-2 fw-semibold';
    }
  }

  // 4. Элементы обратной совместимости (если присутствуют)
  const catBadge = document.getElementById('about-net-category-badge');
  if (catBadge) {
    catBadge.textContent = isPriv ? 'Частная' : 'Общая';
    catBadge.className = `badge font-monospace ${isPriv ? 'bg-success' : 'bg-warning'}`;
  }

  const discPill = document.getElementById('about-net-discovery-pill');
  if (discPill) {
    discPill.textContent = currentDiscoveryEnabled ? 'Обнаружение: Вкл' : 'Обнаружение: Выкл';
    discPill.className = `badge font-monospace ${currentDiscoveryEnabled ? 'bg-info fw-semibold' : 'border border-secondary border-opacity-50 text-body-secondary'}`;
  }

  // 5. Модальное окно региональных настроек
  const modalBadge = document.getElementById('reg-cur-net-category-badge');
  if (modalBadge) {
    modalBadge.textContent = isPriv ? 'Частная (Private)' : 'Общая (Public)';
    modalBadge.className = `badge font-monospace ms-1 ${isPriv ? 'bg-success' : 'bg-warning'}`;
  }

  const modalDiscBadge = document.getElementById('reg-net-discovery-badge');
  if (modalDiscBadge) {
    modalDiscBadge.textContent = currentDiscoveryEnabled ? 'Обнаружение: Вкл' : 'Обнаружение: Выкл';
    modalDiscBadge.className = `badge font-monospace ms-1 ${currentDiscoveryEnabled ? 'bg-info fw-semibold' : 'border border-secondary border-opacity-50 text-body-secondary'}`;
  }

  const btnModalPub = document.getElementById('btn-modal-net-public');
  const btnModalPriv = document.getElementById('btn-modal-net-private');
  if (btnModalPub && btnModalPriv) {
    if (isPriv) {
      btnModalPriv.className = 'btn btn-sm btn-success py-1 px-3 fw-semibold w-100 disabled';
      btnModalPriv.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Активный профиль (Частная)';
      btnModalPub.className = 'btn btn-sm btn-outline-warning py-1 px-3 fw-semibold w-100';
      btnModalPub.innerHTML = '<i class="bi bi-shield-lock me-1"></i>Сделать общедоступной';
    } else {
      btnModalPub.className = 'btn btn-sm btn-warning text-dark py-1 px-3 fw-semibold w-100 disabled';
      btnModalPub.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Активный профиль (Общая)';
      btnModalPriv.className = 'btn btn-sm btn-outline-success py-1 px-3 fw-semibold w-100';
      btnModalPriv.innerHTML = '<i class="bi bi-shield-check me-1"></i>Сделать частной';
    }
  }

  const btnToggleDisc = document.getElementById('btn-reg-toggle-discovery');
  if (btnToggleDisc) {
    if (currentDiscoveryEnabled) {
      btnToggleDisc.className = 'btn btn-sm btn-outline-danger py-1 px-3 font-monospace';
      btnToggleDisc.innerHTML = '<i class="bi bi-slash-circle me-1"></i>Отключить обнаружение';
    } else {
      btnToggleDisc.className = 'btn btn-sm btn-outline-info py-1 px-3 font-monospace';
      btnToggleDisc.innerHTML = '<i class="bi bi-broadcast me-1"></i>Включить обнаружение';
    }
  }
}

/**
 * Переключает категорию сетевого профиля (Public или Private).
 * @param {string} newCategory - Новая категория ('Public' или 'Private').
 * @param {Function} showRegModalAlert - Функция вывода уведомления в модалке.
 */
export async function changeNetworkCategory(newCategory, showRegModalAlert) {
  const isPriv = newCategory.toLowerCase() === 'private';
  const cat = isPriv ? 'Private' : 'Public';

  if (currentNetworkCategory.toLowerCase() === cat.toLowerCase()) {
    return;
  }

  const btnPub = document.getElementById('btn-net-profile-public');
  const btnPriv = document.getElementById('btn-net-profile-private');
  if (btnPub) btnPub.disabled = true;
  if (btnPriv) btnPriv.disabled = true;

  updateNetworkProfileUI(cat);

  try {
    const res = await fetch('/api/v1/system/network-profile/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, interface_index: currentNetworkInterfaceIndex })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      const finalCat = data.category || cat;
      updateNetworkProfileUI(finalCat);
      const catRu = finalCat.toLowerCase() === 'private' ? 'Частная' : 'Общедоступная';
      const msg = `✅ Профиль сети успешно переключен на «<strong>${escapeHtml(catRu)}</strong>»`;
      if (showRegModalAlert) showRegModalAlert(msg, 'success');
      if (window.showToast) window.showToast(`✅ Сетевой профиль переключен на «${catRu}»`, 'success');
    } else {
      const errMsg = data.message || 'Не удалось переключить профиль сети';
      if (showRegModalAlert) showRegModalAlert(`Ошибка: ${escapeHtml(errMsg)}`, 'danger');
      if (window.showToast) window.showToast(`Ошибка: ${errMsg}`, 'danger');
      fetchNetworkProfile();
    }
  } catch (e) {
    const errText = `Ошибка сети: ${escapeHtml(e.message || String(e))}`;
    if (showRegModalAlert) showRegModalAlert(errText, 'danger');
    if (window.showToast) window.showToast(errText, 'danger');
    fetchNetworkProfile();
  } finally {
    if (btnPub) btnPub.disabled = false;
    if (btnPriv) btnPriv.disabled = false;
  }
}

/**
 * Переключает статус сетевого обнаружения в Windows.
 * @param {boolean} enableState - Включить или выключить.
 * @param {Function} showRegModalAlert - Функция вывода уведомления в модалке.
 */
export async function toggleNetworkDiscovery(enableState, showRegModalAlert) {
  if (currentDiscoveryEnabled === enableState) {
    return;
  }

  const btnToggle = document.getElementById('btn-reg-toggle-discovery');
  const btnDiscOn = document.getElementById('btn-net-discovery-on');
  const btnDiscOff = document.getElementById('btn-net-discovery-off');

  if (btnToggle) {
    btnToggle.disabled = true;
    btnToggle.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Применение...';
  }
  if (btnDiscOn) btnDiscOn.disabled = true;
  if (btnDiscOff) btnDiscOff.disabled = true;

  try {
    const res = await fetch('/api/v1/system/network-discovery/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: enableState,
        set_category: enableState ? 'Private' : null,
        interface_index: currentNetworkInterfaceIndex
      })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      updateNetworkProfileUI(data.current_category, null, data.is_discovery_enabled);
      const msg = enableState
        ? '✅ Сетевое обнаружение, службы и брандмауэр успешно активированы'
        : '✅ Сетевое обнаружение отключено с возвратом в безопасный режим';
      if (showRegModalAlert) showRegModalAlert(msg, 'info');
      if (window.showToast) window.showToast(msg, 'info');
    } else {
      const errMsg = data.message || 'Ошибка изменения статуса обнаружения';
      if (showRegModalAlert) showRegModalAlert(`Ошибка: ${escapeHtml(errMsg)}`, 'danger');
      if (window.showToast) window.showToast(`Ошибка: ${errMsg}`, 'danger');
    }
  } catch (e) {
    const errText = `Ошибка: ${escapeHtml(e.message || String(e))}`;
    if (showRegModalAlert) showRegModalAlert(errText, 'danger');
    if (window.showToast) window.showToast(errText, 'danger');
  } finally {
    if (btnToggle) btnToggle.disabled = false;
    if (btnDiscOn) btnDiscOn.disabled = false;
    if (btnDiscOff) btnDiscOff.disabled = false;
    fetchNetworkProfile();
  }
}

/**
 * Запрашивает текущий профиль сети и сетевое обнаружение с сервера.
 */
export async function fetchNetworkProfile() {
  try {
    const res = await fetch('/api/v1/system/network-profile');
    if (res.ok) {
      const data = await res.json();
      currentNetworkInterfaceIndex = data.primary_interface_index || null;
      const ifaceAlias = data.primary_profile?.InterfaceAlias || (data.primary_interface_index ? `IF #${data.primary_interface_index}` : 'Ethernet');
      updateNetworkProfileUI(data.current_category, ifaceAlias, data.is_discovery_enabled);
    }
  } catch (e) {
    console.warn('[AboutSystemTab] fetchNetworkProfile warning:', e);
  }
}
