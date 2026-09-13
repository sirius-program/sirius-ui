(() => {
    const owner = Symbol.for('sirius.ui.currency');
    if (window[owner]) return;
    window[owner] = true;
    const states = new WeakMap();
    const selector = '[data-sir-currency-display]';

    // Decimal comparison deliberately never converts an amount into a JS Number.
    function compare(left, right) {
        const parts = value => {
            const negative = value.startsWith('-');
            const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
            const integer = whole.replace(/^0+(?=\d)/, '');
            return { negative: negative && /[1-9]/.test(integer + fraction), integer, fraction };
        };
        const a = parts(left), b = parts(right);
        if (a.negative !== b.negative) return a.negative ? -1 : 1;
        const width = Math.max(a.fraction.length, b.fraction.length);
        const first = a.integer + '.' + a.fraction.padEnd(width, '0');
        const second = b.integer + '.' + b.fraction.padEnd(width, '0');
        const result = a.integer.length !== b.integer.length
            ? (a.integer.length > b.integer.length ? 1 : -1)
            : first === second ? 0 : first > second ? 1 : -1;
        return a.negative ? -result : result;
    }

    function format(canonical, input) {
        if (!/^-?\d+(?:\.\d*)?$/.test(canonical)) return canonical;
        const [whole, fraction] = canonical.split('.');
        return whole.replace(/\B(?=(\d{3})+(?!\d))/g, input.dataset.thousands)
            + (fraction === undefined ? '' : input.dataset.decimal + fraction);
    }

    function parse(text, input, strict = false) {
        if (text === '') return { canonical: '', display: '' };
        if (text === '-' && input.dataset.negative === 'true') return { canonical: '', display: '-' };
        const negative = text.startsWith('-');
        if (negative && input.dataset.negative !== 'true') return null;
        const unsigned = negative ? text.slice(1) : text;
        const pieces = unsigned.split(input.dataset.decimal);
        if (pieces.length > 2) return null;
        let whole = pieces[0];
        if (strict && whole.includes(input.dataset.thousands)) {
            const groups = whole.split(input.dataset.thousands);
            if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return null;
        }
        whole = whole.split(input.dataset.thousands).join('');
        if (!/^\d*$/.test(whole) || (pieces[1] !== undefined && !/^\d*$/.test(pieces[1]))) return null;
        if (whole === '' && pieces.length === 1) return null;
        whole = (whole || '0').replace(/^0+(?=\d)/, '');
        const canonical = (negative ? '-' : '') + whole + (pieces[1] ? '.' + pieces[1] : '');
        return { canonical, display: format(canonical, input) + (pieces[1] === '' ? input.dataset.decimal : '') };
    }

    function validity(input, canonical) {
        let message = input.value === '-' ? 'Complete the amount.' : '';
        if (canonical !== '') {
            if (!/^-?\d+(?:\.\d+)?$/.test(canonical)) message = 'Enter a valid decimal amount.';
            else if (canonical.startsWith('-') && input.dataset.negative !== 'true') message = 'Negative amounts are not allowed.';
            else if ((canonical.split('.')[1] || '').length > Number(input.dataset.precision)) message = `Use at most ${input.dataset.precision} decimal places.`;
            else if (input.hasAttribute('min') && compare(canonical, input.getAttribute('min')) < 0) message = `The amount must be at least ${input.getAttribute('min')}.`;
            else if (input.hasAttribute('max') && compare(canonical, input.getAttribute('max')) > 0) message = `The amount must not exceed ${input.getAttribute('max')}.`;
        }
        input.setCustomValidity(message);
        const invalid = message !== '' || input.dataset.sirServerInvalid === 'true';
        if (input.getAttribute('aria-invalid') !== String(invalid)) input.setAttribute('aria-invalid', String(invalid));
    }

    function initialize(input) {
        if (!input.isConnected) return null;
        const hidden = input.closest('[data-sir-currency]').querySelector('[data-sir-currency-value]');
        if (!hidden) return null;
        let state = states.get(input);
        if (!state || state.hidden !== hidden) {
            state = { hidden, canonical: null, display: '', initial: input.defaultValue, selection: [0, 0] };
            states.set(input, state);
        }
        // The hidden value property reflects its attribute, including Alpine/Livewire writes.
        const configuration = [input.dataset.thousands, input.dataset.decimal].join('|');
        if (state.canonical !== hidden.value || state.configuration !== configuration) {
            state.configuration = configuration;
            state.canonical = hidden.value;
            state.display = format(hidden.value, input);
        }
        if (input.value !== state.display) input.value = state.display;
        if (state.morphSelection && document.activeElement === input) {
            input.setSelectionRange(...state.morphSelection);
        }
        state.morphSelection = null;
        if (input.hasAttribute('name')) {
            hidden.name = input.name;
            input.removeAttribute('name');
        }
        if (hidden.getAttribute('form') !== input.getAttribute('form')) {
            if (input.hasAttribute('form')) hidden.setAttribute('form', input.getAttribute('form'));
            else hidden.removeAttribute('form');
        }
        if (hidden.disabled !== input.disabled) hidden.disabled = input.disabled;
        validity(input, state.canonical);
        return state;
    }

    function scan(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        if (root.matches?.(selector)) initialize(root);
        root.querySelectorAll(selector).forEach(initialize);
    }

    function commit(input, parsed, caret, emit = true) {
        const state = states.get(input);
        if (!state) return;
        let before = input.value.slice(0, caret).split(input.dataset.thousands).join('').length;
        if (input.value.replace(/^-/, '').startsWith(input.dataset.decimal) && caret > 0) before++;
        input.value = parsed.display;
        state.display = parsed.display;
        state.canonical = parsed.canonical;
        state.hidden.value = parsed.canonical;
        if (document.activeElement === input) {
            let position = 0, count = 0;
            while (position < input.value.length && count < before) {
                if (input.value[position] !== input.dataset.thousands) count++;
                position++;
            }
            input.setSelectionRange(position, position);
        }
        validity(input, parsed.canonical);
        if (emit) state.hidden.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function edit(input, strict = false) {
        const state = states.get(input);
        if (!state) return;
        if (input.disabled || input.readOnly) {
            input.value = state.display;
            return;
        }
        const parsed = parse(input.value, input, strict);
        if (!parsed) {
            input.value = state.display;
            input.setSelectionRange(...state.selection);
            return;
        }
        commit(input, parsed, input.selectionStart ?? input.value.length);
    }

    document.addEventListener('beforeinput', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.matches(selector)) return;
        const state = states.get(input) || initialize(input);
        if (!state) return;
        const start = input.selectionStart ?? 0, end = input.selectionEnd ?? start;
        state.selection = [start, end];
        if (input.readOnly || input.disabled) { event.preventDefault(); return; }
        // Deleting at a grouping boundary removes a digit rather than trapping the caret.
        if (start === end && event.inputType === 'deleteContentBackward' && input.value[start - 1] === input.dataset.thousands) {
            event.preventDefault();
            input.setRangeText('', Math.max(0, start - 2), start, 'end');
            edit(input);
        } else if (start === end && event.inputType === 'deleteContentForward' && input.value[start] === input.dataset.thousands) {
            event.preventDefault();
            input.setRangeText('', start, start + 2, 'end');
            edit(input);
        }
    }, true);

    document.addEventListener('input', event => {
        if (event.target.matches?.(selector) && !event.isComposing) edit(event.target, event.inputType === 'insertFromDrop');
    }, true);
    document.addEventListener('compositionend', event => {
        if (event.target.matches?.(selector)) edit(event.target);
    }, true);
    document.addEventListener('paste', event => {
        const input = event.target;
        if (!input.matches?.(selector)) return;
        event.preventDefault();
        if (input.disabled || input.readOnly) return;
        const pasted = event.clipboardData?.getData('text/plain').trim() ?? '';
        if (!parse(pasted, input, true)) return;
        const start = input.selectionStart ?? 0, end = input.selectionEnd ?? start;
        const candidate = input.value.slice(0, start) + pasted + input.value.slice(end);
        const parsed = parse(candidate, input);
        if (!parsed) return;
        input.value = candidate;
        commit(input, parsed, start + pasted.length);
    }, true);
    for (const type of ['change', 'blur']) {
        document.addEventListener(type, event => {
            const input = event.target;
            if (!input.matches?.(selector)) return;
            const state = states.get(input);
            if (!state) return;
            if (type === 'blur') {
                input.value = state.display = format(state.canonical, input);
                validity(input, state.canonical);
            }
            state.hidden.dispatchEvent(new Event(type, { bubbles: type === 'change' }));
        }, true);
    }
    document.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || !event.target.matches?.(selector)) return;
        states.get(event.target)?.hidden.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }, true);
    document.addEventListener('reset', event => {
        // Run after the browser's default reset action, including externally associated inputs.
        setTimeout(() => {
            if (event.defaultPrevented) return;
            document.querySelectorAll(selector).forEach(input => {
                if (input.form !== event.target) return;
                const state = states.get(input);
                if (!state) return;
                state.hidden.value = state.initial;
                initialize(input);
                state.hidden.dispatchEvent(new Event('input', { bubbles: true }));
                state.hidden.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    });
    new MutationObserver(records => {
        const affected = new Set();
        for (const record of records) {
            const wrapper = record.target.closest?.('[data-sir-currency]');
            if (wrapper) {
                const input = wrapper.querySelector(selector);
                if (input) affected.add(input);
            }
            if (record.type === 'childList') record.addedNodes.forEach(scan);
        }
        affected.forEach(initialize);
    }).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['value', 'form', 'disabled', 'readonly', 'min', 'max', 'data-thousands', 'data-decimal', 'data-precision', 'data-negative', 'data-sir-server-invalid'],
    });
    // Bound canonical inputs are owned by Alpine/Livewire's model, not SSR value attributes.
    // Morph the visible field normally (errors/readonly/etc.), then restore its current draft.
    let livewireHooksInstalled = false;
    function connectLivewire() {
        if (livewireHooksInstalled || !window.Livewire?.hook) return;
        livewireHooksInstalled = true;
        window.Livewire.hook('morph', ({ el }) => {
            const input = document.activeElement;
            if (input?.matches?.(selector) && el.contains(input)) {
                const state = states.get(input);
                if (state) state.morphSelection = [input.selectionStart, input.selectionEnd];
            }
        });
        window.Livewire.hook('morphed', ({ el }) => scan(el));
    }
    document.addEventListener('livewire:init', connectLivewire);
    connectLivewire();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
    else scan(document);
})();
