import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

(() => {
    const owner = Symbol.for('sirius.ui.chart');
    if (window[owner]) return;
    window[owner] = true;
    const states = new Map();
    const extensions = new Map();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const plain = value => value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
    function copy(value) {
        if (Array.isArray(value)) return value.map(copy);
        if (!plain(value)) return value;
        return merge({}, value);
    }
    function merge(target, ...sources) {
        for (const source of sources) if (plain(source)) {
            for (const [key, value] of Object.entries(source)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
                target[key] = plain(value) ? merge(plain(target[key]) ? target[key] : {}, value) : copy(value);
            }
        }
        return target;
    }
    window.SiriusChart = {
        get: id => [...states.values()].find(state => state.root.id === id)?.chart ?? null,
        register(id, factory) {
            if (typeof factory !== 'function') throw new TypeError('Chart extensions require a local factory.');
            extensions.set(id, factory);
            schedule();
            return () => {
                if (extensions.get(id) !== factory) return;
                extensions.delete(id); schedule();
            };
        },
    };
    function disposeChart(state) {
        const chart = state.chart ?? Chart.getChart(state.canvas);
        state.chart = null;
        chart?.destroy();
    }
    function loading(state) {
        const busy = state.requests > 0 || state.root.dataset.chartLoading === 'true' || state.root.hasAttribute('data-chart-request');
        state.root.setAttribute('aria-busy', String(busy));
        state.canvas.inert = busy;
        const overlay = state.root.querySelector('[data-chart-loading]');
        if (overlay.hidden === busy) overlay.hidden = !busy;
    }
    function configure(state) {
        const root = state.root;
        const payload = JSON.parse(root.dataset.chartPayload);
        const strings = JSON.parse(root.dataset.chartStrings);
        const stage = root.querySelector('[data-chart-stage]');
        const feedback = root.querySelector('[data-chart-status]');
        const retry = root.querySelector('[data-chart-retry]');
        const empty = root.querySelector('[data-chart-empty]');
        empty.textContent = strings.empty;
        retry.textContent = strings.retry;
        root.querySelector('[data-chart-loading-label]').textContent = strings.loading;
        const factory = extensions.get(root.id);
        const color = getComputedStyle(root).color;
        const signature = JSON.stringify([payload.type, payload.options, color, motion.matches]);
        const rebuild = !state.chart || state.signature !== signature || state.factory !== factory;
        const resized = state.width !== payload.width || state.height !== payload.height;
        stage.style.height = payload.height + 'px';
        stage.style.width = payload.width === null ? '100%' : payload.width + 'px';
        state.canvas.setAttribute('aria-label', root.dataset.chartLabel);
        const description = document.getElementById(root.id + '-description');
        if (description && !description.hidden) state.canvas.setAttribute('aria-describedby', description.id);
        else state.canvas.removeAttribute('aria-describedby');
        try {
            state.canvas.hidden = false;
            if (rebuild) {
                disposeChart(state);
                const extra = factory?.({ id: root.id, element: root, wire: state.wire, library: Chart }) ?? {};
                if (!plain(extra) || Object.keys(extra).some(key => !['options', 'plugins'].includes(key))) {
                    throw new TypeError('Chart extensions may return only options and plugins.');
                }
                if (extra.options !== undefined && !plain(extra.options)) throw new TypeError('Chart extension options must be an object.');
                if (extra.plugins !== undefined && !Array.isArray(extra.plugins)) throw new TypeError('Chart extension plugins must be an array.');
                const borderColor = getComputedStyle(root).getPropertyValue('--sir-color-border').trim();
                const options = merge({ color, plugins: { legend: { labels: { color } }, title: { color }, subtitle: { color } } }, payload.options, extra.options);
                if (payload.explicitHeight) options.maintainAspectRatio = false;
                if (motion.matches) options.animation = false;
                const explicitScales = copy(options.scales ?? {});
                const themePlugin = { id: 'siriusTheme', beforeInit(chart) {
                    for (const [id, scale] of Object.entries(chart.config.options.scales ?? {})) {
                        const explicit = explicitScales[id] ?? {};
                        for (const field of ['ticks', 'pointLabels', 'title']) {
                            if (explicit[field]?.color === undefined) scale[field] = merge(scale[field] ?? {}, { color: options.color });
                        }
                        for (const field of ['grid', 'border', 'angleLines']) {
                            if (explicit[field]?.color === undefined) scale[field] = merge(scale[field] ?? {}, { color: options.borderColor ?? borderColor });
                        }
                    }
                } };
                if (extra.plugins?.some(plugin => plugin.id === themePlugin.id)) throw new TypeError('The siriusTheme plugin is managed by the chart adapter.');
                state.canvas.width = Math.max(1, stage.clientWidth);
                state.canvas.height = payload.height;
                state.chart = new Chart(state.canvas, { type: payload.type, data: copy(payload.data), options, plugins: [themePlugin, ...extra.plugins ?? []] });
                state.factory = factory;
                state.signature = signature;
                root.dispatchEvent(new CustomEvent('sirius:chart-ready', { bubbles: true, detail: { id: root.id, chart: state.chart } }));
            } else {
                state.chart.data = copy(payload.data);
                state.chart.update(motion.matches ? 'none' : undefined);
            }
            const values = payload.data.datasets.flatMap(dataset => Object.values(dataset.data ?? {}));
            const isEmpty = values.length === 0 || values.every(value => value === null);
            state.canvas.hidden = isEmpty;
            empty.hidden = !isEmpty;
            feedback.textContent = '';
            retry.hidden = true;
            root.dataset.chartState = isEmpty ? 'empty' : 'ready';
            if (state.chart.options.responsive !== false) state.chart.resize();
            else if (resized) state.chart.resize(stage.clientWidth, payload.height);
        } catch (error) {
            disposeChart(state);
            state.canvas.hidden = true;
            empty.hidden = true;
            feedback.textContent = strings.error;
            retry.hidden = false;
            root.dataset.chartState = 'error';
            root.dispatchEvent(new CustomEvent('sirius:chart-error', { bubbles: true, detail: { id: root.id, error } }));
        }
        state.source = root.dataset.chartPayload;
        state.translation = root.dataset.chartStrings;
        state.label = root.dataset.chartLabel;
        state.description = description?.textContent;
        state.color = color;
        state.factory = factory;
        state.width = payload.width;
        state.height = payload.height;
        loading(state);
    }
    function destroy(state) {
        state.observer.disconnect();
        state.cleanup.forEach(cleanup => cleanup());
        if (state.finishFrame !== null) cancelAnimationFrame(state.finishFrame);
        disposeChart(state);
        states.delete(state.root);
    }
    function scan() {
        for (const state of states.values()) if (!state.root.isConnected) destroy(state);
        if (!window.Livewire) return;
        for (const root of document.querySelectorAll('[data-sir-chart]')) {
            let state = states.get(root);
            if (!state) {
                const wireId = root.closest('[wire\\:id]')?.getAttribute('wire:id');
                const wire = wireId ? Livewire.find(wireId) : null;
                if (!wire) continue;
                state = { root, wire, canvas: root.querySelector('[data-chart-canvas]'), chart: null, requests: 0, cleanup: [], finishFrame: null };
                states.set(root, state);
                const owners = new Set([wireId, root.parentElement?.closest('[wire\\:id]')?.getAttribute('wire:id')].filter(Boolean));
                state.cleanup.push(Livewire.interceptMessage(({ message, onFinish }) => {
                    if (!owners.has(message.component.id)) return;
                    state.requests++; loading(state);
                    onFinish(() => {
                        state.requests = Math.max(0, state.requests - 1);
                        if (state.finishFrame !== null) cancelAnimationFrame(state.finishFrame);
                        state.finishFrame = requestAnimationFrame(() => {
                            state.finishFrame = null;
                            if (root.isConnected) { loading(state); schedule(); }
                        });
                    });
                }));
                state.observer = new window.ResizeObserver(() => {
                    if (state.chart && root.isConnected && state.chart.options.responsive !== false && stageVisible(state)) state.chart.resize();
                });
                state.observer.observe(root.querySelector('[data-chart-stage]'));
                configure(state);
            } else {
                loading(state);
                if (state.source !== root.dataset.chartPayload || state.translation !== root.dataset.chartStrings || state.label !== root.dataset.chartLabel ||
                    state.description !== document.getElementById(root.id + '-description')?.textContent ||
                    state.factory !== extensions.get(root.id) || state.color !== getComputedStyle(root).color || state.reduced !== motion.matches) configure(state);
            }
            state.reduced = motion.matches;
        }
    }
    function stageVisible(state) { return state.root.querySelector('[data-chart-stage]').getBoundingClientRect().width > 0; }
    let queued = false;
    function schedule() { if (!queued) { queued = true; queueMicrotask(() => { queued = false; scan(); }); } }
    document.addEventListener('click', event => {
        const root = event.target instanceof Element ? event.target.closest('[data-sir-chart]') : null;
        if (root && event.target.closest('[data-chart-retry]')) {
            const state = states.get(root);
            if (state) configure(state);
        }
    });
    for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
        if (!(event.target instanceof Element)) return;
        const root = event.target.closest('[data-sir-chart]');
        if (root?.getAttribute('aria-busy') === 'true' && event.target.closest('[data-chart-canvas]')) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-chart-payload', 'data-chart-strings', 'data-chart-loading', 'data-chart-request', 'data-chart-label'] });
    const themes = new MutationObserver(schedule);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme'] });
    if (document.body) themes.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    motion.addEventListener('change', schedule);
    document.addEventListener('livewire:navigated', schedule);
    document.addEventListener('livewire:initialized', schedule);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true }); else schedule();
})();
