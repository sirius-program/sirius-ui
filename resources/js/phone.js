const owner = Symbol.for('sirius.ui.phone');
if (!window[owner]) {
    window[owner] = true;
    const states = new WeakMap();
    let pointerActive = false;
    const deferredFeedback = new Set();
    document.addEventListener('pointerdown', () => { pointerActive = true; }, true);
    for (const event of ['pointerup', 'pointercancel']) document.addEventListener(event, () => {
        setTimeout(() => {
            pointerActive = false;
            deferredFeedback.forEach(state => { state.deferFeedback = false; if (state.input.isConnected) presentation(state); });
            deferredFeedback.clear();
        });
    }, true);
    const selector = '[data-sir-phone-display]';
    const { AsYouType, parsePhoneNumberFromString, getCountryCallingCode } = phoneLibrary;

    function parse(state, text) {
        if (!text.trim()) return { value: null, display: '', country: state.country, message: '' };
        if (!/^\+?[\d\s().-]+$/.test(text)) return { value: null, display: text, country: state.country, message: state.config.invalidMessage };
        const international = text.trim().startsWith('+');
        const number = parsePhoneNumberFromString(text, { defaultCountry: international ? undefined : state.country, extract: false });
        if (number?.isValid() && !number.ext && number.country && state.config.countries.includes(number.country)
            && (international || number.country === state.country)) {
            const groups = number.formatInternational().replace(/^\+\d+\s*/, '').match(/\d+/g) || [];
            return { value: number.number, display: groups.join(state.config.delimiter), country: number.country, message: '' };
        }
        // Keep international drafts intact until a country can be identified without guessing.
        const formatted = international ? text : new AsYouType(state.country).input(text);
        return { value: null, display: international ? text : (formatted.match(/\d+/g) || []).join(state.config.delimiter), country: state.country, message: state.config.invalidMessage };
    }

    function presentation(state) {
        const { input, wrapper, hidden, config } = state;
        if (input.value !== state.display) input.value = state.display;
        if (state.select) {
            state.select.value = state.country;
            if (state.select.disabled !== (input.disabled || input.readOnly)) state.select.disabled = input.disabled || input.readOnly;
        }
        hidden.value = state.value ?? '';
        if (hidden.disabled !== input.disabled) hidden.disabled = input.disabled;
        if (state.draft) {
            state.draft.value = JSON.stringify({ text: state.display, country: state.country });
            if (state.draft.disabled !== input.disabled) state.draft.disabled = input.disabled;
        }
        input.setCustomValidity(state.message || '');
        const showError = state.touched && !state.deferFeedback && !!state.message && !input.disabled && !input.readOnly;
        const error = wrapper.querySelector('[data-phone-error]');
        if (error.textContent !== (showError ? state.message : '')) error.textContent = showError ? state.message : '';
        error.hidden = !showError;
        const invalid = showError || input.dataset.sirServerInvalid === 'true';
        if (input.getAttribute('aria-invalid') !== String(invalid)) input.setAttribute('aria-invalid', String(invalid));
        const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== error.id);
        if (showError) ids.push(error.id);
        const describedBy = ids.join(' ');
        if (describedBy !== (input.getAttribute('aria-describedby') || '')) {
            if (describedBy) input.setAttribute('aria-describedby', describedBy);
            else input.removeAttribute('aria-describedby');
        }
    }

    function apply(state, text, emit = false, keepCaret = false) {
        const original = state.input.value;
        const start = state.input.selectionStart ?? original.length;
        const end = state.input.selectionEnd ?? start;
        const result = parse(state, text);
        state.value = result.value;
        state.display = result.display;
        state.country = result.country;
        state.message = result.message;
        presentation(state);
        if (keepCaret && document.activeElement === state.input) {
            const offset = Math.max(0, (original.match(/\d/g) || []).length - (state.display.match(/\d/g) || []).length);
            const locate = position => {
                const wanted = Math.max(0, (original.slice(0, position).match(/\d/g) || []).length - offset);
                let index = 0, digits = 0;
                while (index < state.display.length && digits < wanted) { if (/\d/.test(state.display[index])) digits++; index++; }
                return index;
            };
            state.input.setSelectionRange(locate(start), locate(end));
        }
        if (emit) notify(state, 'input');
    }

    function notify(state, type) {
        // A non-input model bridge can hold null without coercing it to the HTML string "".
        state.model.dispatchEvent(new Event(type, { bubbles: type !== 'blur' }));
        state.hidden.dispatchEvent(new CustomEvent('phone:change', { bubbles: true, detail: { value: state.value, country: state.country } }));
    }

    function initialize(input) {
        if (!input.isConnected) return;
        const wrapper = input.closest('[data-sir-phone]');
        const config = JSON.parse(wrapper.dataset.phoneConfig);
        const model = wrapper.querySelector('[data-sir-phone-model]');
        let state = states.get(input);
        if (!state || state.model !== model) {
            const initial = model.value ?? model.dataset.initial ?? '';
            state = { input, wrapper, model, config, value: null, country: config.initial, display: '', message: '', touched: false,
                hidden: wrapper.querySelector('[data-sir-phone-value]'), select: wrapper.querySelector('[data-phone-country]'),
                draft: wrapper.querySelector('[data-phone-draft]'), initial, reset: config.reset };
            states.set(input, state);
            // Alpine/Livewire write model updates to .value and read nullable values on forwarded events.
            Object.defineProperty(model, 'value', { configurable: true,
                get: () => state.value,
                set: value => {
                    const next = value == null || value === '' ? null : String(value);
                    if (next === state.value) return;
                    state.touched = false;
                    apply(state, next ?? '');
                },
            });
            if (config.draft) {
                state.country = config.draft.country;
                apply(state, config.draft.text);
            } else apply(state, initial);
            input.dataset.phoneReady = 'true';
        } else {
            const changed = JSON.stringify([config.countries, config.initial, config.delimiter]) !== JSON.stringify([state.config.countries, state.config.initial, state.config.delimiter]);
            state.config = config;
            state.hidden = wrapper.querySelector('[data-sir-phone-value]');
            state.select = wrapper.querySelector('[data-phone-country]');
            state.draft = wrapper.querySelector('[data-phone-draft]');
            if (state.reset !== config.reset) {
                state.reset = config.reset;
                state.touched = false;
                state.country = config.initial;
                apply(state, model.value ?? '');
            } else if (changed) {
                if (!config.countries.includes(state.country)) state.country = config.initial;
                apply(state, state.value ?? state.display);
            }
            presentation(state);
        }
        if (state.selection && document.activeElement === input) input.setSelectionRange(...state.selection);
        state.selection = null;
        return state;
    }
    function scan(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        if (root.matches?.(selector)) initialize(root);
        root.querySelectorAll(selector).forEach(initialize);
    }
    document.addEventListener('input', event => {
        const input = event.target;
        if (!input.matches?.(selector) || event.isComposing) return;
        const state = states.get(input) || initialize(input);
        if (input.disabled || input.readOnly) { presentation(state); return; }
        state.touched = false;
        apply(state, input.value, true, true);
    }, true);
    document.addEventListener('compositionend', event => {
        if (event.target.matches?.(selector)) event.target.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.addEventListener('beforeinput', event => {
        const input = event.target;
        if (!input.matches?.(selector)) return;
        const state = states.get(input);
        if (!state) return;
        if (input.disabled || input.readOnly) { event.preventDefault(); return; }
        const start = input.selectionStart, end = input.selectionEnd;
        if (start !== end) return;
        if (event.inputType === 'deleteContentBackward' && start > 0 && /[ .-]/.test(input.value[start - 1])) {
            event.preventDefault(); input.setRangeText('', Math.max(0, start - 2), start, 'end'); apply(state, input.value, true, true);
        } else if (event.inputType === 'deleteContentForward' && /[ .-]/.test(input.value[start] || '')) {
            event.preventDefault(); input.setRangeText('', start, start + 2, 'end'); apply(state, input.value, true, true);
        }
    }, true);
    document.addEventListener('paste', event => {
        const input = event.target;
        if (!input.matches?.(selector)) return;
        event.preventDefault();
        if (input.disabled || input.readOnly) return;
        const state = states.get(input) || initialize(input);
        const text = event.clipboardData?.getData('text/plain').trim() ?? '';
        input.setRangeText(text, input.selectionStart ?? 0, input.selectionEnd ?? input.value.length, 'end');
        state.touched = false;
        apply(state, input.value, true, true);
    }, true);
    document.addEventListener('change', event => {
        const select = event.target;
        if (!select.matches?.('[data-phone-country]')) return;
        const state = states.get(select.closest('[data-sir-phone]').querySelector(selector));
        if (!state || state.input.readOnly || state.input.disabled) { if (state) presentation(state); return; }
        const previous = state.value ? parsePhoneNumberFromString(state.value)?.nationalNumber : state.display.replace(/\D/g, '');
        state.country = select.value;
        state.touched = true;
        apply(state, previous ?? '', true);
        notify(state, 'change');
    }, true);
    for (const type of ['blur', 'change']) document.addEventListener(type, event => {
        if (!event.target.matches?.(selector)) return;
        const state = states.get(event.target);
        if (!state) return;
        state.touched = true;
        // Do not move a clicked button between pointerdown and click when blur reveals feedback.
        if (pointerActive) { state.deferFeedback = true; deferredFeedback.add(state); }
        else presentation(state);
        notify(state, type);
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches?.(selector)) {
            const state = states.get(event.target);
            if (state) { state.touched = true; presentation(state); state.model.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
        }
    }, true);
    for (const type of ['submit', 'invalid']) document.addEventListener(type, event => {
        document.querySelectorAll(selector).forEach(input => {
            if (input.form !== event.target && input !== event.target) return;
            const state = states.get(input);
            if (state) { state.touched = true; presentation(state); }
        });
    }, true);
    document.addEventListener('reset', event => {
        setTimeout(() => {
            if (event.defaultPrevented) return;
            document.querySelectorAll(selector).forEach(input => {
                if (input.form !== event.target) return;
                const state = states.get(input);
                if (!state) return;
                state.country = state.config.initial;
                state.touched = false;
                apply(state, state.initial, true);
                notify(state, 'change');
            });
        });
    });
    new MutationObserver(records => {
        const affected = new Set();
        for (const record of records) {
            const wrapper = record.target.closest?.('[data-sir-phone]');
            const input = wrapper?.querySelector(selector);
            if (input) affected.add(input);
            if (record.type === 'childList') record.addedNodes.forEach(scan);
        }
        affected.forEach(initialize);
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-phone-config', 'disabled', 'readonly', 'data-sir-server-invalid', 'aria-describedby'] });
    let connected = false;
    function connectLivewire() {
        if (connected || !window.Livewire?.hook) return;
        connected = true;
        window.Livewire.hook('morph', ({ el }) => {
            const input = document.activeElement;
            if (input?.matches?.(selector) && el.contains(input)) {
                const state = states.get(input);
                if (state) state.selection = [input.selectionStart, input.selectionEnd];
            }
        });
        window.Livewire.hook('morphed', ({ el }) => scan(el));
    }
    document.addEventListener('livewire:init', connectLivewire);
    document.addEventListener('livewire:navigated', () => scan(document));
    connectLivewire();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
    else scan(document);
}
