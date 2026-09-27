(() => {
    const owner = Symbol.for('sirius.ui.slider');
    if (window[owner]) return;
    window[owner] = true;
    const states = new Map();
    const clean = value => Number.isInteger(value) ? value : Number(value.toPrecision(15));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const grid = (state, i, number, rounding = Math.round) => clean(state.config.min[i] + rounding((number - state.config.min[i]) / state.config.step[i]) * state.config.step[i]);
    function limits(state, i) {
        const { min, max, range } = state.config;
        return [grid(state, i, range && i === 1 ? Math.max(min[i], state.values[0]) : min[i], n => Math.ceil(n - 1e-9)),
            grid(state, i, range && i === 0 ? Math.min(max[i], state.values[1]) : max[i], n => Math.floor(n + 1e-9))];
    }
    function validate(state, value) {
        const values = state.config.range ? value : [value];
        if (!Array.isArray(values) || values.length !== state.config.min.length) return null;
        const numbers = values.map(v => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN);
        if (numbers.some((v, i) => !Number.isFinite(v) || v < state.config.min[i] || v > state.config.max[i] || Math.abs((v - state.config.min[i]) / state.config.step[i] - Math.round((v - state.config.min[i]) / state.config.step[i])) > 1e-7)) return null;
        return state.config.range && numbers[0] > numbers[1] ? null : numbers;
    }
    function error(state, invalid) {
        state.invalid = invalid;
        state.status.textContent = invalid ? state.config.messages.invalid : '';
        state.sources[0].setCustomValidity(state.status.textContent);
    }
    function set(state, value) {
        const numbers = validate(state, value);
        error(state, !numbers);
        if (numbers) state.values = numbers;
        refresh(state);
    }
    function emit(state, type) {
        state.model.dispatchEvent(new Event(type, { bubbles: type !== 'blur' }));
        state.emitting = true;
        try { state.sources[0].dispatchEvent(new Event(type, { bubbles: type !== 'blur' })); }
        finally { state.emitting = false; }
    }
    function refresh(state) {
        const { sources, config, ui } = state;
        const locked = sources[0].disabled || sources[0].readOnly;
        ui.dataset.readonly = String(sources[0].readOnly);
        ui.dataset.disabled = String(sources[0].disabled);
        const low = Math.min(...config.min), high = Math.max(...config.max);
        const percent = number => high === low ? 0 : (number - low) / (high - low) * 100;
        const start = config.range ? percent(state.values[0]) : 0;
        state.fill.style.left = start + '%';
        state.fill.style.width = (percent(state.values.at(-1)) - start) + '%';
        state.output.textContent = state.values.join(' – ');
        state.buttons.forEach((button, i) => {
            const source = sources[i];
            source.value = state.values[i]; source.hidden = true; source.dataset.sliderEnhanced = 'true';
            button.style.left = percent(state.values[i]) + '%';
            button.disabled = source.disabled;
            button.tabIndex = source.disabled ? -1 : Number(source.getAttribute('tabindex') ?? 0);
            button.setAttribute('aria-readonly', String(source.readOnly));
            button.setAttribute('aria-disabled', String(source.disabled));
            button.setAttribute('aria-valuenow', state.values[i]);
            const [min, max] = limits(state, i);
            button.setAttribute('aria-valuemin', min); button.setAttribute('aria-valuemax', max);
            button.setAttribute('aria-invalid', state.invalid ? 'true' : source.getAttribute('aria-invalid') || 'false');
            const description = [source.getAttribute('aria-describedby'), state.status.id].filter(Boolean).join(' ');
            button.setAttribute('aria-describedby', description);
            const label = sources[0].labels?.[0];
            const labelText = source.getAttribute('aria-label') || label?.textContent.trim() || config.messages.value;
            button.setAttribute('aria-label', labelText);
            if (source.hasAttribute('aria-labelledby')) button.setAttribute('aria-labelledby', source.getAttribute('aria-labelledby') + (config.range ? ' ' + state.names[i].id : ''));
            else button.removeAttribute('aria-labelledby');
        });
        if (locked) state.drag = null;
    }
    function move(state, i, value) {
        if (state.sources[0].readOnly || state.sources[0].disabled) return;
        const [min, max] = limits(state, i);
        const next = Math.min(max, Math.max(min, grid(state, i, value)));
        error(state, false);
        if (next === state.values[i]) { refresh(state); return; }
        state.values[i] = next; refresh(state); emit(state, 'input');
    }
    function initialize(root) {
        const sources = [...root.querySelectorAll('[data-slider-source]')];
        const model = root.querySelector('[data-slider-model]'), ui = root.querySelector('[data-slider-ui]');
        const config = JSON.parse(root.dataset.sliderConfig);
        let state = states.get(root), preserved;
        if (state && (!same(config, state.config) || sources.some((s, i) => s !== state.sources[i]) || state.model !== model || state.ui !== ui)) {
            preserved = same(config.value, state.config.value) ? [...state.values] : config.value;
            destroy(state); state = null;
        }
        if (state) { refresh(state); return; }
        const initial = model.value;
        state = { root, sources, model, ui, config, values: [...config.value], buttons: [], names: [], invalid: false };
        states.set(root, state);
        ui.replaceChildren(); ui.className = 'sir-slider';
        const track = state.track = document.createElement('div'); track.className = 'sir-slider-track';
        const fill = state.fill = document.createElement('div'); fill.className = 'sir-slider-fill'; track.append(fill);
        const output = state.output = document.createElement('output'); output.className = 'sir-slider-output';
        const status = state.status = document.createElement('p'); status.className = 'sir-slider-status'; status.id = sources[0].id + '-slider-status'; status.setAttribute('role', 'status');
        ui.append(track, output, status);
        sources.forEach((source, i) => {
            const button = document.createElement('button');
            button.type = 'button'; button.id = source.id + '-handle'; button.className = 'sir-slider-thumb';
            button.setAttribute('role', 'slider'); button.setAttribute('aria-orientation', 'horizontal');
            state.buttons.push(button); track.append(button);
            const name = document.createElement('span'); name.hidden = true; name.id = source.id + '-slider-name';
            name.textContent = config.messages[i ? 'upper' : 'lower']; state.names.push(name); ui.append(name);
            button.addEventListener('keydown', event => {
                const step = config.step[i];
                const keys = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
                if (!(event.key in keys) && !['Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const bounds = limits(state, i);
                move(state, i, event.key === 'Home' ? bounds[0] : event.key === 'End' ? bounds[1] : state.values[i] + keys[event.key]);
                if (!source.readOnly && !source.disabled) emit(state, 'change');
            });
            button.addEventListener('blur', () => emit(state, 'blur'));
        });
        const pointerValue = event => {
            const rect = track.getBoundingClientRect();
            const low = Math.min(...config.min), high = Math.max(...config.max);
            return low + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * (high - low);
        };
        track.addEventListener('pointerdown', event => {
            if (event.button !== 0 || sources[0].disabled || sources[0].readOnly) return;
            const value = pointerValue(event);
            const target = state.buttons.indexOf(event.target);
            const i = target >= 0 ? target : state.values.reduce((best, v, index) => Math.abs(v - value) < Math.abs(state.values[best] - value) ? index : best, 0);
            state.drag = { id: event.pointerId, i }; track.setPointerCapture(event.pointerId);
            state.buttons[i].focus(); event.preventDefault(); move(state, i, value);
        });
        track.addEventListener('pointermove', event => { if (state.drag?.id === event.pointerId) move(state, state.drag.i, pointerValue(event)); });
        const end = event => { if (state.drag?.id === event.pointerId) { state.drag = null; emit(state, 'change'); } };
        track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
        Object.defineProperty(model, 'value', { configurable: true, get: () => config.range ? [...state.values] : state.values[0], set: value => set(state, value) });
        state.change = () => { if (!state.emitting) { set(state, config.range ? sources.map(s => s.value) : sources[0].value); if (!state.invalid) { emit(state, 'input'); emit(state, 'change'); } } };
        state.invalidHandler = event => { event.preventDefault(); state.buttons[0].focus(); };
        sources.forEach(source => { source.addEventListener('change', state.change); source.addEventListener('invalid', state.invalidHandler); });
        const candidate = initial !== undefined ? initial : config.range ? preserved ?? config.value : (preserved ?? config.value)[0];
        set(state, candidate);
    }
    function destroy(state) {
        state.sources.forEach(source => { source.removeEventListener('change', state.change); source.removeEventListener('invalid', state.invalidHandler); source.hidden = false; delete source.dataset.sliderEnhanced; source.setCustomValidity(''); });
        delete state.model.value; state.ui.replaceChildren(); states.delete(state.root);
    }
    function scan() {
        for (const state of states.values()) if (!state.root.isConnected) destroy(state);
        document.querySelectorAll('[data-sir-slider]').forEach(initialize);
    }
    document.addEventListener('click', event => {
        const label = event.target.closest?.('label[for]');
        for (const state of states.values()) if (label?.htmlFor === state.sources[0].id) { event.preventDefault(); state.buttons[0].focus(); }
    });
    document.addEventListener('reset', event => setTimeout(() => {
        if (event.defaultPrevented) return;
        for (const state of states.values()) if (state.sources[0].form === event.target) { set(state, state.config.range ? state.config.value : state.config.value[0]); emit(state, 'input'); emit(state, 'change'); }
    }));
    let pending = false;
    new MutationObserver(records => {
        if (!records.some(record => !record.target.closest?.('[data-slider-ui]'))) return;
        if (!pending) { pending = true; queueMicrotask(() => { pending = false; scan(); }); }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-slider-config', 'readonly', 'disabled', 'aria-describedby', 'aria-invalid', 'aria-label', 'aria-labelledby', 'tabindex'] });
    document.addEventListener('livewire:navigated', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
})();
