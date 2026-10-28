/**
 * VirtualTableScroller — Легковесный модуль виртуализации длинных таблиц (1000+ элементов).
 * Рендерит только видимые элементы + буфер, предотвращая лаги DOM в WebGUI.
 * 
 * Файл: virtual_scroll.js
 */
class VirtualTableScroller {
    constructor(options) {
        this.container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
        this.tbody = typeof options.tbody === 'string' ? document.querySelector(options.tbody) : options.tbody;
        this.rowHeight = options.rowHeight || 40; // Высота строки в px
        this.buffer = options.buffer || 10;       // Запасные строки сверху/снизу
        this.renderRow = options.renderRow;       // Функция renderRow(item, index) => HTML string
        this.data = [];

        this.init();
    }

    init() {
        if (!this.container || !this.tbody) return;
        this.container.style.position = 'relative';
        this.container.style.overflowY = 'auto';
        this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });
    }

    setData(newData) {
        this.data = newData || [];
        this.render();
    }

    onScroll() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => this.render());
    }

    render() {
        if (!this.data.length) {
            this.tbody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted p-3">Нет данных</td></tr>';
            return;
        }

        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;

        let startIndex = Math.floor(scrollTop / this.rowHeight) - this.buffer;
        let endIndex = Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.buffer;

        startIndex = Math.max(0, startIndex);
        endIndex = Math.min(this.data.length, endIndex);

        const topPadding = startIndex * this.rowHeight;
        const bottomPadding = (this.data.length - endIndex) * this.rowHeight;

        const visibleItems = this.data.slice(startIndex, endIndex);

        let html = '';
        if (topPadding > 0) {
            html += `<tr style="height: ${topPadding}px;"><td colspan="100%" style="padding:0;border:none;"></td></tr>`;
        }

        for (let i = 0; i < visibleItems.length; i++) {
            const globalIdx = startIndex + i;
            html += this.renderRow(visibleItems[i], globalIdx);
        }

        if (bottomPadding > 0) {
            html += `<tr style="height: ${bottomPadding}px;"><td colspan="100%" style="padding:0;border:none;"></td></tr>`;
        }

        this.tbody.innerHTML = html;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VirtualTableScroller };
}
