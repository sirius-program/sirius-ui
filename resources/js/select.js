const key = Symbol.for('sirius.ui.select');
if (!window[key]) {
    window[key] = true;
    const states = new Map();
    const selector = '[data-sir-select]';
    const list = value => value == null || value === '' ? [] : (Array.isArray(value) ? value : [value]).map(String);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function status(state, message) {
        state.message = message;
        const target = state.root.closest('.sir-field')?.querySelector('[data-sir-label-status]');
        if (target && target.textContent !== message) target.textContent = message;
    }
    function records(source) {
        return [...source.options].filter(o => o.value !== '').map(o => ({ value: o.value, label: o.textContent, disabled: o.disabled || o.parentElement.disabled === true, group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '' }));
    }
    function add(state, rows) {
        for (const row of rows) {
            if (row.group) state.tom.addOptionGroup(row.group, { value: row.group, label: row.group });
            const option = { ...row, optgroup: row.group || '' };
            if (state.tom.options[row.value]) state.tom.updateOption(row.value, option);
            else state.tom.addOption(option);
        }
    }
    function write(state, emit = false) {
        const values = state.values;
        for (const value of values) {
            if (![...state.source.options].some(o => o.value === value)) state.source.add(new Option(state.tom.options[value]?.label || value, value));
        }
        for (const option of state.source.options) option.selected = values.includes(option.value);
        if (!state.config.multiple && values.length === 0) state.source.value = '';
        state.signature = JSON.stringify(records(state.source));
        state.clear.hidden = !state.config.clearable || values.length === 0;
        state.clear.disabled = state.source.disabled || state.source.hasAttribute('readonly');
        if (emit) {
            state.model.dispatchEvent(new Event('input', { bubbles: true }));
            state.model.dispatchEvent(new Event('change', { bubbles: true }));
            state.emitting = true;
            try {
                state.source.dispatchEvent(new Event('input', { bubbles: true }));
                state.source.dispatchEvent(new Event('change', { bubbles: true }));
            } finally { state.emitting = false; }
        }
    }
    function set(state, value, resolve = true) {
        const values = list(value);
        if (same(values, state.values)) return;
        state.values = state.config.multiple ? values : values.slice(0, 1);
        add(state, state.values.filter(v => !state.tom.options[v]).map(v => ({ value: v, label: v })));
        state.tom.setValue(state.values, true);
        write(state);
        if (resolve && state.config.url && state.values.length) resolveLabels(state);
    }
    function validRows(data) {
        if (!data || !Array.isArray(data.options) || typeof data.hasMore !== 'boolean') throw new Error('Invalid response');
        const seen = new Set();
        return data.options.map(row => {
            if (!row || !['string', 'number'].includes(typeof row.value) || String(row.value) === '' || typeof row.label !== 'string' || (row.disabled != null && typeof row.disabled !== 'boolean') || (row.group != null && typeof row.group !== 'string') || seen.has(String(row.value))) throw new Error('Invalid option');
            seen.add(String(row.value));
            return { ...row, value: String(row.value) };
        });
    }
    async function fetchOptions(state, params, signal) {
        const url = new URL(state.config.url, document.baseURI);
        if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Use a same-origin search endpoint');
        for (const [name, value] of params) url.searchParams.append(name, value);
        const response = await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        return { rows: validRows(data), more: data.hasMore };
    }
    async function resolveLabels(state) {
        const values = [...state.values];
        state.resolveAbort?.abort();
        const controller = state.resolveAbort = new AbortController();
        try {
            const { rows } = await fetchOptions(state, values.map(v => ['values[]', v]), controller.signal);
            if (!state.root.isConnected || controller.signal.aborted || !same(values, state.values)) return;
            add(state, rows.filter(row => values.includes(row.value)));
            state.tom.refreshItems();
        } catch (error) {
            if (error.name !== 'AbortError' && state.root.isConnected) { status(state, state.config.messages.labels_error); state.retry.hidden = false; state.retryLabels = true; }
        }
    }
    function schedule(state, query) {
        clearTimeout(state.timer);
        state.abort?.abort();
        state.sequence++;
        state.query = query;
        state.more.hidden = true;
        status(state, query.length < state.config.minimum ? state.config.messages.minimum.replace(':count', state.config.minimum) : '');
        if (query.length >= state.config.minimum) state.timer = setTimeout(() => search(state, 1), state.config.debounce);
    }
    async function search(state, page) {
        if (state.source.disabled || state.source.hasAttribute('readonly')) return;
        const sequence = ++state.sequence;
        state.abort?.abort();
        const controller = state.abort = new AbortController();
        status(state, state.config.messages.loading);
        state.more.disabled = true;
        state.retry.hidden = true;
        state.tom.control_input.setAttribute('aria-busy', 'true');
        try {
            const { rows, more } = await fetchOptions(state, [['q', state.query], ['page', String(page)]], controller.signal);
            if (sequence !== state.sequence || !state.root.isConnected) return;
            if (page === 1) state.tom.clearOptions(); // Tom Select retains selected options.
            add(state, rows);
            state.tom.refreshOptions(state.tom.isFocused);
            state.page = page;
            state.more.hidden = !more;
            status(state, rows.length ? '' : state.config.messages.empty);
        } catch (error) {
            if (error.name === 'AbortError' || sequence !== state.sequence) return;
            status(state, state.config.messages.error); state.retryLabels = false;
            state.retry.hidden = false;
            state.retryPage = page;
        } finally {
            if (sequence === state.sequence) {
                state.more.disabled = false;
                state.tom.control_input.removeAttribute('aria-busy');
            }
        }
    }
    function sync(state) {
        const source = state.source;
        source.hidden = true;
        status(state, state.message || '');
        const locked = source.disabled || source.hasAttribute('readonly');
        if (source.disabled) state.tom.disable();
        else state.tom.enable();
        state.tom.setReadOnly(source.hasAttribute('readonly'));
        state.tom.control_input.readOnly = source.hasAttribute('readonly') || !state.config.searchable;
        for (const name of ['aria-describedby', 'aria-invalid', 'aria-label', 'aria-labelledby']) {
            const value = source.getAttribute(name);
            if (value !== null) state.tom.control_input.setAttribute(name, value);
            else if (name !== 'aria-label') state.tom.control_input.removeAttribute(name);
        }
        state.tom.control_input.setAttribute('aria-required', String(source.required));
        state.tom.control_input.setAttribute('aria-readonly', String(source.hasAttribute('readonly')));
        state.more.disabled = state.retry.disabled = locked;
        write(state);
    }
    function initialize(root) {
        if (!root.isConnected) return;
        const source = root.querySelector('[data-select-source]');
        const model = root.querySelector('[data-select-model]');
        const ui = root.querySelector('[data-select-ui]');
        const config = JSON.parse(root.dataset.selectConfig);
        let state = states.get(root);
        if (state && (state.source !== source || state.model !== model || !same(state.config, config))) {
            const previous = !same(state.config.values, config.values) ? (config.multiple ? config.values : config.values[0] ?? null) : model.value;
            destroy(state);
            if (previous !== undefined) model.value = previous;
            state = null;
        }
        if (!state) {
            const initial = model.value ?? (config.multiple ? config.values : config.values[0] ?? null);
            const clone = document.createElement('select');
            clone.multiple = config.multiple;

            ui.replaceChildren(clone);
            state = { root, source, model, ui, config, values: list(initial), initial: config.values, sequence: 0, query: '', page: 1 };
            states.set(root, state);
            const tom = state.tom = new TomSelect(clone, {
                valueField: 'value', labelField: 'label', searchField: config.url ? [] : ['label'],
                options: records(source), optgroupField: 'group',
                optgroups: [...new Set(records(source).map(row => row.group).filter(Boolean))].map(group => ({value: group, label: group})),
                items: state.values, maxItems: config.multiple ? config.maxItems : 1,
                placeholder: config.placeholder, create: false, refreshThrottle: 0, maxOptions: null,
                plugins: config.multiple && config.clearable ? { remove_button: { title: config.messages.remove } } : [],
                render: { no_results: (data, escape) => `<div class="no-results">${escape(config.messages.empty)}</div>` },
                onDelete: () => config.clearable && !source.disabled && !source.hasAttribute('readonly'),
                onChange() {
                    if (!state.tom) return;
                    state.values = [...this.items]; write(state, true);
                },
                onType(query) { if (config.url) schedule(state, query); },
                onFocus() { if (config.url && !state.clearing) schedule(state, this.control_input.value); },
                onBlur() { model.dispatchEvent(new Event('blur')); },
            });
            tom.control_input.id = source.id + '-search';
            tom.control_input.setAttribute('aria-label', source.labels?.[0]?.textContent?.trim() || config.placeholder);
            if (!config.searchable) tom.control_input.readOnly = true;
            const button = (text, handler) => {
                const element = document.createElement('button'); element.type = 'button'; element.className = 'sir-select-action'; element.textContent = text; element.hidden = true; element.addEventListener('click', handler); ui.append(element); return element;
            };
            state.clear = button(config.messages.clear, () => { if (!state.clear.disabled) { state.clearing = true; tom.settings.openOnFocus = false; tom.clear(); tom.focus();
                setTimeout(() => { tom.close(); tom.settings.openOnFocus = true; state.clearing = false; }); } });
            state.clear.dataset.selectClear = '';
            state.more = button(config.messages.load_more, () => search(state, state.page + 1));
            state.retry = button(config.messages.retry, () => {
                if (state.retryLabels) { state.retry.hidden = true; status(state, ''); resolveLabels(state); }
                else search(state, state.retryPage || 1);
            });
            const shell = document.createElement('div'); shell.className = 'sir-input-shell sir-select-shell';
            for (const [name, action] of [['clear', state.clear], ['retry', state.retry]]) {
                action.className = 'sir-adornment sir-select-suffix';
                action.setAttribute('aria-label', action.textContent); action.title = action.textContent;
                const icon = root.querySelector('[data-select-icons]').content.querySelector(`[data-select-icon="${name}"] svg`).cloneNode(true);
                icon.classList.add('sir-icon'); action.replaceChildren(icon);
            }
            shell.append(tom.wrapper, state.clear, state.retry); ui.prepend(shell);
            const actions = document.createElement('div'); actions.className = 'sir-select-pagination';
            actions.addEventListener('mousedown', event => event.preventDefault());
            actions.append(state.more); tom.dropdown.append(actions);

            Object.defineProperty(model, 'value', { configurable: true, get: () => config.multiple ? [...state.values] : state.values[0] ?? null, set: value => set(state, value) });
            source.hidden = true;
            source.dataset.selectEnhanced = 'true';
            source.addEventListener('invalid', state.invalid = event => { event.preventDefault(); tom.focus(); });
            source.addEventListener('change', state.change = () => {
                if (state.emitting) return;
                set(state, [...source.selectedOptions].map(o => o.value).filter(v => v !== ''));
                model.dispatchEvent(new Event('input', { bubbles: true }));
                model.dispatchEvent(new Event('change', { bubbles: true }));
            });
            write(state);
            if (config.url && state.values.length) resolveLabels(state);
        } else {
            const signature = JSON.stringify(records(source));
            if (signature !== state.signature) {
                const current = records(source);
                if (!config.url) state.tom.clearOptions();
                add(state, current);
                state.tom.refreshOptions(false);
            }
        }
        sync(state);
    }
    function destroy(state) {
        clearTimeout(state.timer); state.abort?.abort(); state.resolveAbort?.abort();
        state.source.removeEventListener('invalid', state.invalid);
        state.source.removeEventListener('change', state.change);
        state.tom.destroy(); state.ui.replaceChildren(); delete state.model.value;
        state.source.hidden = false; delete state.source.dataset.selectEnhanced;
        status(state, '');
        states.delete(state.root);
    }
    function scan() {
        for (const [root, state] of states) if (!root.isConnected) destroy(state);
        document.querySelectorAll(selector).forEach(initialize);
    }
    document.addEventListener('click', event => {
        const label = event.target.closest?.('label[for]');
        if (!label) return;
        for (const state of states.values()) if (state.source.id === label.htmlFor) { event.preventDefault(); state.tom.focus(); }
    });
    document.addEventListener('reset', event => setTimeout(() => {
        if (event.defaultPrevented) return;
        for (const state of states.values()) if (state.source.form === event.target) { set(state, state.initial); write(state, true); }
    }));
    // Observe only server-owned elements, avoiding feedback from Tom Select's generated DOM.
    let pending = false;
    new MutationObserver(records => {
        if (!records.some(r => !r.target.closest?.('[data-select-ui]') && !r.target.matches?.('[data-select-source]') || r.target.closest?.('[data-select-source]'))) return;
        if (!pending) { pending = true; queueMicrotask(() => { pending = false; scan(); }); }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-select-config', 'disabled', 'readonly', 'aria-invalid', 'aria-describedby', 'required', 'label', 'value', 'selected'] });
    document.addEventListener('livewire:navigated', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
    else scan();
}
