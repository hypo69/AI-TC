/**
 * Модуль панели сырых записей телеметрии, пагинации и поиска.
 * Файл: apps/windows/api/webgui/tab_telemetry_research/panel_records/panel.js
 * Updated: 2026-10-17 01:55:00
 */

let trCurrentPage = 1;
const trPageSize = 25;
let trTotalPages = 1;
let trSearchQuery = '';

export function getTrCurrentPage() {
  return trCurrentPage;
}

export function setTrCurrentPage(page) {
  trCurrentPage = page;
}

export function getTrTotalPages() {
  return trTotalPages;
}

export function getTrSearchQuery() {
  return trSearchQuery;
}

export function setTrSearchQuery(q) {
  trSearchQuery = q;
}

/**
 * Загрузка записей телеметрии с пагинацией и поиском.
 */
export async function loadRecords() {
  const tbody = document.getElementById('tr-records-tbody');
  const infoEl = document.getElementById('tr-records-pagination-info');
  const selectSource = document.getElementById('tr-select-source');
  const sourcePath = selectSource ? selectSource.value : null;

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span> Загрузка...</td></tr>';
  }

  try {
    const url = new URL('/apps/telemetry_research/records', window.location.origin);
    if (sourcePath) url.searchParams.set('source_path', sourcePath);
    if (trSearchQuery) url.searchParams.set('query', trSearchQuery);
    url.searchParams.set('page', trCurrentPage);
    url.searchParams.set('page_size', trPageSize);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    trTotalPages = data.total_pages || 1;
    if (infoEl) {
      infoEl.textContent = `Стр. ${data.page} из ${trTotalPages} (всего ${data.total})`;
    }

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Записей не найдено</td></tr>';
      return;
    }

    tbody.innerHTML = data.items
      .map((r, i) => {
        const num = (trCurrentPage - 1) * trPageSize + i + 1;
        const ts = r.timestamp || r.time || '--';
        const cpu = r.cpu ? `${r.cpu.total_percent || r.cpu.load_percent || '--'}%` : '--';
        const ram = r.memory ? `${r.memory.percent || '--'}%` : '--';
        const gpu = r.gpu ? `${r.gpu.load_percent || '--'}%` : '--';
        let disk = '--';
        if (r.disk_io) {
          const rMb = ((r.disk_io.read_bytes_per_sec || 0) / 1048576).toFixed(1);
          const wMb = ((r.disk_io.write_bytes_per_sec || 0) / 1048576).toFixed(1);
          disk = `${rMb} / ${wMb} MB/s`;
        }
        const eventInfo = r.event_type || r.friendly_name || JSON.stringify(r).slice(0, 50);

        return `
          <tr>
            <td>${num}</td>
            <td class="text-muted">${ts}</td>
            <td>${cpu}</td>
            <td>${ram}</td>
            <td>${gpu}</td>
            <td>${disk}</td>
            <td class="text-truncate" style="max-width: 250px;" title="${eventInfo}">${eventInfo}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Ошибка: ${err.message}</td></tr>`;
    }
  }
}
