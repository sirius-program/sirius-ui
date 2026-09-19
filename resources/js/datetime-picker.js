const selector = '[data-sir-date-display]';
const states = new Map();

function parse(value, format, state) {
    if (!value) return null;
    const date = state.picker ? state.picker.parseDate(value, format) : flatpickr.parseDate(value, format);
    return date && flatpickr.formatDate(date, format, state.locale) === value ? date : null;
}

function allowed(date, state) {
    const { options, canonical, type } = state.config;
    const value = flatpickr.formatDate(date, canonical);
    const time = flatpickr.formatDate(date, 'H:i');
    return (!options.minDate || value >= options.minDate)
        && (!options.maxDate || value <= options.maxDate)
        && (!options.minTime || time >= options.minTime)
        && (!options.maxTime || time <= options.maxTime)
        && (type === 'time' || !(options.disable || []).includes(flatpickr.formatDate(date, 'Y-m-d')));
}

function validity(state, valid) {
    state.input.setCustomValidity(valid ? '' : 'Enter an available date or time in the displayed format.');
    const invalid = !valid || state.input.dataset.sirServerInvalid === 'true';
    if (state.input.getAttribute('aria-invalid') !== String(invalid)) state.input.setAttribute('aria-invalid', String(invalid));
    state.valid = valid;
}

function publish(state, value, change = false) {
    const changed = state.hidden.value !== value;
    state.canonical = value;
    state.hidden.value = value;
    if (changed) state.hidden.dispatchEvent(new Event('input', { bubbles: true }));
    if (change) state.hidden.dispatchEvent(new Event('change', { bubbles: true }));
}

function edit(state, change = false) {
    const { input, config } = state;
    if (input.disabled || input.readOnly) { input.value = state.display; return; }
    state.display = input.value;
    const date = parse(input.value, config.format, state);
    const valid = input.value === '' || !!date && allowed(date, state);
    validity(state, valid);
    // Invalid text remains visible and reaches server validation; never roll invalid dates forward.
    publish(state, date && valid ? flatpickr.formatDate(date, config.canonical) : input.value, change);
    if (change && valid && state.proxy.value !== input.value) {
        state.picker.setDate(date || [], false);
        state.display = input.value;
    }
}

function destroy(state) {
    state.picker.destroy();
    states.delete(state.input);
}

function initialize(input) {
    if (!input.isConnected) return;
    const wrapper = input.closest('[data-sir-datetime-picker]');
    const hidden = wrapper.querySelector('[data-sir-date-value]');
    if (!hidden) return;
    const signature = input.dataset.sirDateConfig;
    let state = states.get(input);
    if (state && (state.signature !== signature || state.hidden !== hidden)) { destroy(state); state = null; }
    if (!state) {
        const config = JSON.parse(signature);
        const locale = locales[config.options.locale];
        if (!locale) {
            input.setCustomValidity('Unsupported datetime picker locale.');
            return;
        }
        state = { input, hidden, config, locale, signature, initial: input.defaultValue, canonical: null, display: input.value, valid: true };
        states.set(input, state);
        const options = { ...config.options };
        // Bounds are canonical; the widget input itself uses the separate display format.
        for (const key of ['minDate', 'maxDate']) {
            if (options[key]) options[key] = flatpickr.parseDate(options[key], config.canonical);
        }
        if (options.disable) options.disable = options.disable.map(day => flatpickr.parseDate(day, 'Y-m-d'));
        input.value = '';
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
        const now = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
        state.proxy = document.createElement('input');
        state.picker = flatpickr(state.proxy, {
            ...options, now,
            locale: { ...locale, ...(config.weekStart === null ? {} : { firstDayOfWeek: Number(config.weekStart) }) },
            dateFormat: config.format, enableTime: config.type !== 'date', noCalendar: config.type === 'time',
            enableSeconds: config.type === 'datetime', mode: 'single', altInput: false,
            allowInput: false, disableMobile: true, clickOpens: false, positionElement: input,
            errorHandler: () => {},
            onReady: (_, __, picker) => {
                picker.calendarContainer.classList.add('sir-date-calendar');
                picker.calendarContainer.id = input.id + '-calendar';
                picker.calendarContainer.setAttribute('role', 'dialog');
                picker.calendarContainer.setAttribute('aria-label', input.labels?.[0]?.textContent || input.getAttribute('aria-label') || 'Choose a date or time');
                picker.calendarContainer.setAttribute('wire:ignore', '');
                picker.calendarContainer.setAttribute('data-sir-date-calendar', input.id);
            },
            onOpen: () => input.setAttribute('aria-expanded', 'true'),
            onClose: () => input.setAttribute('aria-expanded', 'false'),
            onChange: dates => {
                if (input.disabled || input.readOnly) return;
                input.value = dates.length ? flatpickr.formatDate(dates[0], config.format, state.locale) : '';
                state.display = input.value;
                validity(state, !dates.length || allowed(dates[0], state));
                publish(state, dates.length ? flatpickr.formatDate(dates[0], config.canonical) : '', true);
                if (config.type === 'date') queueMicrotask(() => input.focus());
            },
        });
    }
    if (input.hasAttribute('name')) { hidden.name = input.name; input.removeAttribute('name'); }
    if (hidden.getAttribute('form') !== input.getAttribute('form')) {
        if (input.hasAttribute('form')) hidden.setAttribute('form', input.getAttribute('form'));
        else hidden.removeAttribute('form');
    }
    if (hidden.disabled !== input.disabled) hidden.disabled = input.disabled;
    if (state.canonical !== hidden.value) {
        state.canonical = hidden.value;
        const date = parse(hidden.value, state.config.canonical, state);
        const valid = hidden.value === '' || !!date && allowed(date, state);
        if (valid) {
            state.picker.setDate(date || [], false);
            input.value = date ? flatpickr.formatDate(date, state.config.format, state.locale) : '';
        } else input.value = hidden.value;
        state.display = input.value;
        validity(state, valid);
    }
    if (input.value !== state.display) input.value = state.display;
    validity(state, state.valid);
    const interactive = !input.disabled && !input.readOnly;
    if (!interactive) state.picker.close();
    const clear = wrapper.querySelector('[data-sir-date-clear]');
    if (clear) { clear.hidden = false; if (clear.disabled !== !interactive) clear.disabled = !interactive; }
    input.classList.add('flatpickr-input');
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('aria-controls', state.picker.calendarContainer.id);
    input.setAttribute('aria-expanded', String(state.picker.isOpen));
    if (state.selection && document.activeElement === input) input.setSelectionRange(...state.selection);
    state.selection = null;
}

function scan(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root.matches?.(selector)) initialize(root);
    root.querySelectorAll(selector).forEach(initialize);
    for (const state of states.values()) if (!state.input.isConnected) destroy(state);
}

document.addEventListener('input', event => {
    const state = states.get(event.target);
    if (state && !event.isComposing) edit(state);
}, true);
document.addEventListener('compositionend', event => { const state = states.get(event.target); if (state) edit(state); }, true);
document.addEventListener('change', event => {
    const state = states.get(event.target);
    if (state) edit(state, true);
}, true);
document.addEventListener('blur', event => {
    const state = states.get(event.target);
    if (!state) return;
    edit(state, true);
    state.hidden.dispatchEvent(new FocusEvent('blur'));
    if (!state.picker.calendarContainer.contains(event.relatedTarget)) state.picker.close();
}, true);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        for (const current of states.values()) {
            if (current.picker.calendarContainer.contains(event.target)) {
                event.preventDefault(); current.picker.close(); current.input.focus(); return;
            }
        }
    }
    const state = states.get(event.target);
    if (!state || state.input.disabled || state.input.readOnly) return;
    if (event.key === 'Escape') { state.picker.close(); return; }
    if (event.key === 'ArrowDown') {
        event.preventDefault(); state.picker.open();
        (state.picker.selectedDateElem || state.picker.todayDateElem || state.picker.hourElement || state.picker.daysContainer?.querySelector('.flatpickr-day:not(.flatpickr-disabled)'))?.focus();
        return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    edit(state, true);
    state.picker.close();
    state.hidden.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
}, true);
document.addEventListener('click', event => {
    const focused = states.get(event.target);
    if (focused && !focused.input.disabled && !focused.input.readOnly) focused.picker.open();
    const clear = event.target.closest?.('[data-sir-date-clear]');
    if (!clear || clear.disabled) return;
    const input = clear.closest('[data-sir-datetime-picker]').querySelector(selector);
    const state = states.get(input);
    input.value = '';
    edit(state, true);
    input.focus();
    state.picker.close();
});
document.addEventListener('reset', event => {
    setTimeout(() => {
        if (event.defaultPrevented) return;
        for (const state of states.values()) {
            if (state.input.form !== event.target) continue;
            state.hidden.value = state.initial;
            state.canonical = null;
            initialize(state.input);
            state.hidden.dispatchEvent(new Event('input', { bubbles: true }));
            state.hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
});
new MutationObserver(records => {
    const affected = new Set();
    for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(scan);
        const input = record.target.closest?.('[data-sir-datetime-picker]')?.querySelector(selector);
        if (input) affected.add(input);
    }
    affected.forEach(initialize);
    for (const state of states.values()) if (!state.input.isConnected) destroy(state);
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['value', 'disabled', 'readonly', 'form', 'data-sir-date-config', 'data-sir-server-invalid'] });
let hooked = false;
function connectLivewire() {
    if (hooked || !window.Livewire?.hook) return;
    hooked = true;
    window.Livewire.hook('morph', ({ el }) => {
        const input = document.activeElement;
        const state = states.get(input);
        if (state && el.contains(input)) state.selection = [input.selectionStart, input.selectionEnd];
    });
    window.Livewire.hook('morphed', ({ el }) => scan(el));
}
document.addEventListener('livewire:init', connectLivewire);
document.addEventListener('livewire:navigating', () => { for (const state of states.values()) destroy(state); });
document.addEventListener('livewire:navigated', () => scan(document));
connectLivewire();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
else scan(document);
