// FullCalendar measures and writes layout in resize callbacks. Deliver its callbacks
// on the next frame so those writes do not feed the browser's observer delivery loop.
// esbuild injects this adapter into the Calendar bundle only; the global API is unchanged.
const NativeObserver = globalThis.ResizeObserver;
export const ResizeObserver = NativeObserver ? class {
    constructor(callback) {
        this.entries = new Map();
        this.frame = null;
        this.observer = new NativeObserver(entries => {
            for (const entry of entries) this.entries.set(entry.target, entry);
            if (this.frame === null) this.frame = requestAnimationFrame(() => {
                this.frame = null;
                const batch = [...this.entries.values()];
                this.entries.clear();
                if (batch.length) callback(batch, this);
            });
        });
    }
    observe(target, options) { this.observer.observe(target, options); }
    unobserve(target) { this.entries.delete(target); this.observer.unobserve(target); }
    disconnect() {
        this.observer.disconnect(); this.entries.clear();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }
} : undefined;
