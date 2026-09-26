// One document-level owner supports plain Blade, Livewire morphs, and navigation.
const owner = Symbol.for('sirius.ui.controls');

if (!window[owner]) {
    window[owner] = true;
    const visiblePasswords = new WeakSet();

    function syncPassword(input) {
        const visible = visiblePasswords.has(input);
        const type = visible ? 'text' : 'password';
        if (input.type !== type) input.type = type;
        document.querySelectorAll('[data-sir-password-toggle]').forEach(button => {
            if (button.dataset.sirPasswordToggle !== input.id) return;
            button.hidden = false;
            button.setAttribute('aria-pressed', String(visible));
            const label = visible ? button.dataset.hideLabel : button.dataset.showLabel;
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        });
    }

    function initialize(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        if (root.matches?.('[data-sir-password-toggle]')) {
            const input = document.getElementById(root.dataset.sirPasswordToggle);
            if (input) syncPassword(input);
        }
        const inputs = root.matches?.('[data-sir-choice], [data-sir-password]') ? [root] : [];
        inputs.push(...root.querySelectorAll('[data-sir-choice], [data-sir-password]'));
        inputs.forEach(input => {
            if (input.hasAttribute('data-sir-password')) syncPassword(input);
            if (input.hasAttribute('data-sir-indeterminate')) {
                input.indeterminate = input.dataset.sirIndeterminate === 'true';
            }
        });
    }

    function locked(input) {
        if (!input.matches('[data-sir-choice]')) return false;
        if (input.hasAttribute('data-sir-readonly')) return true;
        if (input.type !== 'radio' || !input.name) return false;
        // A readonly option locks its whole native radio group, including arrow navigation.
        return Array.from(document.querySelectorAll('input[type="radio"][data-sir-readonly]'))
            .some(peer => peer.name === input.name && peer.form === input.form);
    }

    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        if (locked(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const button = event.target.closest('[data-sir-password-toggle]');
        if (!button || button.disabled) return;
        const input = document.getElementById(button.dataset.sirPasswordToggle);
        if (!input || input.disabled) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (visiblePasswords.has(input)) visiblePasswords.delete(input);
        else visiblePasswords.add(input);
        syncPassword(input);
        input.focus({ preventScroll: true });
        if (start !== null && end !== null) input.setSelectionRange(start, end);
    }, true);

    document.addEventListener('keydown', event => {
        if (!(event.target instanceof Element) || !locked(event.target)) return;
        if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener('reset', event => {
        queueMicrotask(() => {
            if (event.defaultPrevented) return;
            event.target.querySelectorAll('[data-sir-password]').forEach(input => visiblePasswords.delete(input));
            initialize(event.target);
        });
    });

    new MutationObserver(records => {
        records.forEach(record => {
            if (record.type === 'childList') record.addedNodes.forEach(initialize);
            else initialize(record.target);
        });
    }).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-sir-indeterminate', 'type', 'data-sir-password', 'hidden', 'data-show-label', 'data-hide-label'],
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initialize(document), { once: true });
    else initialize(document);
}

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

(() => {
if (window[Symbol.for('sirius.ui.datetime-picker')]) return;
window[Symbol.for('sirius.ui.datetime-picker')] = true;
const flatpickr = (function () { const module = { exports: {} }; const exports = module.exports;
/* flatpickr v4.6.13,, @license MIT */
!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):(e="undefined"!=typeof globalThis?globalThis:e||self).flatpickr=n()}(this,(function(){"use strict";var e=function(){return(e=Object.assign||function(e){for(var n,t=1,a=arguments.length;t<a;t++)for(var i in n=arguments[t])Object.prototype.hasOwnProperty.call(n,i)&&(e[i]=n[i]);return e}).apply(this,arguments)};function n(){for(var e=0,n=0,t=arguments.length;n<t;n++)e+=arguments[n].length;var a=Array(e),i=0;for(n=0;n<t;n++)for(var o=arguments[n],r=0,l=o.length;r<l;r++,i++)a[i]=o[r];return a}var t=["onChange","onClose","onDayCreate","onDestroy","onKeyDown","onMonthChange","onOpen","onParseConfig","onReady","onValueUpdate","onYearChange","onPreCalendarPosition"],a={_disable:[],allowInput:!1,allowInvalidPreload:!1,altFormat:"F j, Y",altInput:!1,altInputClass:"form-control input",animate:"object"==typeof window&&-1===window.navigator.userAgent.indexOf("MSIE"),ariaDateFormat:"F j, Y",autoFillDefaultTime:!0,clickOpens:!0,closeOnSelect:!0,conjunction:", ",dateFormat:"Y-m-d",defaultHour:12,defaultMinute:0,defaultSeconds:0,disable:[],disableMobile:!1,enableSeconds:!1,enableTime:!1,errorHandler:function(e){return"undefined"!=typeof console&&console.warn(e)},getWeek:function(e){var n=new Date(e.getTime());n.setHours(0,0,0,0),n.setDate(n.getDate()+3-(n.getDay()+6)%7);var t=new Date(n.getFullYear(),0,4);return 1+Math.round(((n.getTime()-t.getTime())/864e5-3+(t.getDay()+6)%7)/7)},hourIncrement:1,ignoredFocusElements:[],inline:!1,locale:"default",minuteIncrement:5,mode:"single",monthSelectorType:"dropdown",nextArrow:"<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z' /></svg>",noCalendar:!1,now:new Date,onChange:[],onClose:[],onDayCreate:[],onDestroy:[],onKeyDown:[],onMonthChange:[],onOpen:[],onParseConfig:[],onReady:[],onValueUpdate:[],onYearChange:[],onPreCalendarPosition:[],plugins:[],position:"auto",positionElement:void 0,prevArrow:"<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z' /></svg>",shorthandCurrentMonth:!1,showMonths:1,static:!1,time_24hr:!1,weekNumbers:!1,wrap:!1},i={weekdays:{shorthand:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],longhand:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},months:{shorthand:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],longhand:["January","February","March","April","May","June","July","August","September","October","November","December"]},daysInMonth:[31,28,31,30,31,30,31,31,30,31,30,31],firstDayOfWeek:0,ordinal:function(e){var n=e%100;if(n>3&&n<21)return"th";switch(n%10){case 1:return"st";case 2:return"nd";case 3:return"rd";default:return"th"}},rangeSeparator:" to ",weekAbbreviation:"Wk",scrollTitle:"Scroll to increment",toggleTitle:"Click to toggle",amPM:["AM","PM"],yearAriaLabel:"Year",monthAriaLabel:"Month",hourAriaLabel:"Hour",minuteAriaLabel:"Minute",time_24hr:!1},o=function(e,n){return void 0===n&&(n=2),("000"+e).slice(-1*n)},r=function(e){return!0===e?1:0};function l(e,n){var t;return function(){var a=this,i=arguments;clearTimeout(t),t=setTimeout((function(){return e.apply(a,i)}),n)}}var c=function(e){return e instanceof Array?e:[e]};function s(e,n,t){if(!0===t)return e.classList.add(n);e.classList.remove(n)}function d(e,n,t){var a=window.document.createElement(e);return n=n||"",t=t||"",a.className=n,void 0!==t&&(a.textContent=t),a}function u(e){for(;e.firstChild;)e.removeChild(e.firstChild)}function f(e,n){return n(e)?e:e.parentNode?f(e.parentNode,n):void 0}function m(e,n){var t=d("div","numInputWrapper"),a=d("input","numInput "+e),i=d("span","arrowUp"),o=d("span","arrowDown");if(-1===navigator.userAgent.indexOf("MSIE 9.0")?a.type="number":(a.type="text",a.pattern="\\d*"),void 0!==n)for(var r in n)a.setAttribute(r,n[r]);return t.appendChild(a),t.appendChild(i),t.appendChild(o),t}function g(e){try{return"function"==typeof e.composedPath?e.composedPath()[0]:e.target}catch(n){return e.target}}var p=function(){},h=function(e,n,t){return t.months[n?"shorthand":"longhand"][e]},v={D:p,F:function(e,n,t){e.setMonth(t.months.longhand.indexOf(n))},G:function(e,n){e.setHours((e.getHours()>=12?12:0)+parseFloat(n))},H:function(e,n){e.setHours(parseFloat(n))},J:function(e,n){e.setDate(parseFloat(n))},K:function(e,n,t){e.setHours(e.getHours()%12+12*r(new RegExp(t.amPM[1],"i").test(n)))},M:function(e,n,t){e.setMonth(t.months.shorthand.indexOf(n))},S:function(e,n){e.setSeconds(parseFloat(n))},U:function(e,n){return new Date(1e3*parseFloat(n))},W:function(e,n,t){var a=parseInt(n),i=new Date(e.getFullYear(),0,2+7*(a-1),0,0,0,0);return i.setDate(i.getDate()-i.getDay()+t.firstDayOfWeek),i},Y:function(e,n){e.setFullYear(parseFloat(n))},Z:function(e,n){return new Date(n)},d:function(e,n){e.setDate(parseFloat(n))},h:function(e,n){e.setHours((e.getHours()>=12?12:0)+parseFloat(n))},i:function(e,n){e.setMinutes(parseFloat(n))},j:function(e,n){e.setDate(parseFloat(n))},l:p,m:function(e,n){e.setMonth(parseFloat(n)-1)},n:function(e,n){e.setMonth(parseFloat(n)-1)},s:function(e,n){e.setSeconds(parseFloat(n))},u:function(e,n){return new Date(parseFloat(n))},w:p,y:function(e,n){e.setFullYear(2e3+parseFloat(n))}},D={D:"",F:"",G:"(\\d\\d|\\d)",H:"(\\d\\d|\\d)",J:"(\\d\\d|\\d)\\w+",K:"",M:"",S:"(\\d\\d|\\d)",U:"(.+)",W:"(\\d\\d|\\d)",Y:"(\\d{4})",Z:"(.+)",d:"(\\d\\d|\\d)",h:"(\\d\\d|\\d)",i:"(\\d\\d|\\d)",j:"(\\d\\d|\\d)",l:"",m:"(\\d\\d|\\d)",n:"(\\d\\d|\\d)",s:"(\\d\\d|\\d)",u:"(.+)",w:"(\\d\\d|\\d)",y:"(\\d{2})"},w={Z:function(e){return e.toISOString()},D:function(e,n,t){return n.weekdays.shorthand[w.w(e,n,t)]},F:function(e,n,t){return h(w.n(e,n,t)-1,!1,n)},G:function(e,n,t){return o(w.h(e,n,t))},H:function(e){return o(e.getHours())},J:function(e,n){return void 0!==n.ordinal?e.getDate()+n.ordinal(e.getDate()):e.getDate()},K:function(e,n){return n.amPM[r(e.getHours()>11)]},M:function(e,n){return h(e.getMonth(),!0,n)},S:function(e){return o(e.getSeconds())},U:function(e){return e.getTime()/1e3},W:function(e,n,t){return t.getWeek(e)},Y:function(e){return o(e.getFullYear(),4)},d:function(e){return o(e.getDate())},h:function(e){return e.getHours()%12?e.getHours()%12:12},i:function(e){return o(e.getMinutes())},j:function(e){return e.getDate()},l:function(e,n){return n.weekdays.longhand[e.getDay()]},m:function(e){return o(e.getMonth()+1)},n:function(e){return e.getMonth()+1},s:function(e){return e.getSeconds()},u:function(e){return e.getTime()},w:function(e){return e.getDay()},y:function(e){return String(e.getFullYear()).substring(2)}},b=function(e){var n=e.config,t=void 0===n?a:n,o=e.l10n,r=void 0===o?i:o,l=e.isMobile,c=void 0!==l&&l;return function(e,n,a){var i=a||r;return void 0===t.formatDate||c?n.split("").map((function(n,a,o){return w[n]&&"\\"!==o[a-1]?w[n](e,i,t):"\\"!==n?n:""})).join(""):t.formatDate(e,n,i)}},C=function(e){var n=e.config,t=void 0===n?a:n,o=e.l10n,r=void 0===o?i:o;return function(e,n,i,o){if(0===e||e){var l,c=o||r,s=e;if(e instanceof Date)l=new Date(e.getTime());else if("string"!=typeof e&&void 0!==e.toFixed)l=new Date(e);else if("string"==typeof e){var d=n||(t||a).dateFormat,u=String(e).trim();if("today"===u)l=new Date,i=!0;else if(t&&t.parseDate)l=t.parseDate(e,d);else if(/Z$/.test(u)||/GMT$/.test(u))l=new Date(e);else{for(var f=void 0,m=[],g=0,p=0,h="";g<d.length;g++){var w=d[g],b="\\"===w,C="\\"===d[g-1]||b;if(D[w]&&!C){h+=D[w];var M=new RegExp(h).exec(e);M&&(f=!0)&&m["Y"!==w?"push":"unshift"]({fn:v[w],val:M[++p]})}else b||(h+=".")}l=t&&t.noCalendar?new Date((new Date).setHours(0,0,0,0)):new Date((new Date).getFullYear(),0,1,0,0,0,0),m.forEach((function(e){var n=e.fn,t=e.val;return l=n(l,t,c)||l})),l=f?l:void 0}}if(l instanceof Date&&!isNaN(l.getTime()))return!0===i&&l.setHours(0,0,0,0),l;t.errorHandler(new Error("Invalid date provided: "+s))}}};function M(e,n,t){return void 0===t&&(t=!0),!1!==t?new Date(e.getTime()).setHours(0,0,0,0)-new Date(n.getTime()).setHours(0,0,0,0):e.getTime()-n.getTime()}var y=function(e,n,t){return 3600*e+60*n+t},x=864e5;function E(e){var n=e.defaultHour,t=e.defaultMinute,a=e.defaultSeconds;if(void 0!==e.minDate){var i=e.minDate.getHours(),o=e.minDate.getMinutes(),r=e.minDate.getSeconds();n<i&&(n=i),n===i&&t<o&&(t=o),n===i&&t===o&&a<r&&(a=e.minDate.getSeconds())}if(void 0!==e.maxDate){var l=e.maxDate.getHours(),c=e.maxDate.getMinutes();(n=Math.min(n,l))===l&&(t=Math.min(c,t)),n===l&&t===c&&(a=e.maxDate.getSeconds())}return{hours:n,minutes:t,seconds:a}}"function"!=typeof Object.assign&&(Object.assign=function(e){for(var n=[],t=1;t<arguments.length;t++)n[t-1]=arguments[t];if(!e)throw TypeError("Cannot convert undefined or null to object");for(var a=function(n){n&&Object.keys(n).forEach((function(t){return e[t]=n[t]}))},i=0,o=n;i<o.length;i++){var r=o[i];a(r)}return e});function k(p,v){var w={config:e(e({},a),I.defaultConfig),l10n:i};function k(){var e;return(null===(e=w.calendarContainer)||void 0===e?void 0:e.getRootNode()).activeElement||document.activeElement}function T(e){return e.bind(w)}function S(){var e=w.config;!1===e.weekNumbers&&1===e.showMonths||!0!==e.noCalendar&&window.requestAnimationFrame((function(){if(void 0!==w.calendarContainer&&(w.calendarContainer.style.visibility="hidden",w.calendarContainer.style.display="block"),void 0!==w.daysContainer){var n=(w.days.offsetWidth+1)*e.showMonths;w.daysContainer.style.width=n+"px",w.calendarContainer.style.width=n+(void 0!==w.weekWrapper?w.weekWrapper.offsetWidth:0)+"px",w.calendarContainer.style.removeProperty("visibility"),w.calendarContainer.style.removeProperty("display")}}))}function _(e){if(0===w.selectedDates.length){var n=void 0===w.config.minDate||M(new Date,w.config.minDate)>=0?new Date:new Date(w.config.minDate.getTime()),t=E(w.config);n.setHours(t.hours,t.minutes,t.seconds,n.getMilliseconds()),w.selectedDates=[n],w.latestSelectedDateObj=n}void 0!==e&&"blur"!==e.type&&function(e){e.preventDefault();var n="keydown"===e.type,t=g(e),a=t;void 0!==w.amPM&&t===w.amPM&&(w.amPM.textContent=w.l10n.amPM[r(w.amPM.textContent===w.l10n.amPM[0])]);var i=parseFloat(a.getAttribute("min")),l=parseFloat(a.getAttribute("max")),c=parseFloat(a.getAttribute("step")),s=parseInt(a.value,10),d=e.delta||(n?38===e.which?1:-1:0),u=s+c*d;if(void 0!==a.value&&2===a.value.length){var f=a===w.hourElement,m=a===w.minuteElement;u<i?(u=l+u+r(!f)+(r(f)&&r(!w.amPM)),m&&L(void 0,-1,w.hourElement)):u>l&&(u=a===w.hourElement?u-l-r(!w.amPM):i,m&&L(void 0,1,w.hourElement)),w.amPM&&f&&(1===c?u+s===23:Math.abs(u-s)>c)&&(w.amPM.textContent=w.l10n.amPM[r(w.amPM.textContent===w.l10n.amPM[0])]),a.value=o(u)}}(e);var a=w._input.value;O(),ye(),w._input.value!==a&&w._debouncedChange()}function O(){if(void 0!==w.hourElement&&void 0!==w.minuteElement){var e,n,t=(parseInt(w.hourElement.value.slice(-2),10)||0)%24,a=(parseInt(w.minuteElement.value,10)||0)%60,i=void 0!==w.secondElement?(parseInt(w.secondElement.value,10)||0)%60:0;void 0!==w.amPM&&(e=t,n=w.amPM.textContent,t=e%12+12*r(n===w.l10n.amPM[1]));var o=void 0!==w.config.minTime||w.config.minDate&&w.minDateHasTime&&w.latestSelectedDateObj&&0===M(w.latestSelectedDateObj,w.config.minDate,!0),l=void 0!==w.config.maxTime||w.config.maxDate&&w.maxDateHasTime&&w.latestSelectedDateObj&&0===M(w.latestSelectedDateObj,w.config.maxDate,!0);if(void 0!==w.config.maxTime&&void 0!==w.config.minTime&&w.config.minTime>w.config.maxTime){var c=y(w.config.minTime.getHours(),w.config.minTime.getMinutes(),w.config.minTime.getSeconds()),s=y(w.config.maxTime.getHours(),w.config.maxTime.getMinutes(),w.config.maxTime.getSeconds()),d=y(t,a,i);if(d>s&&d<c){var u=function(e){var n=Math.floor(e/3600),t=(e-3600*n)/60;return[n,t,e-3600*n-60*t]}(c);t=u[0],a=u[1],i=u[2]}}else{if(l){var f=void 0!==w.config.maxTime?w.config.maxTime:w.config.maxDate;(t=Math.min(t,f.getHours()))===f.getHours()&&(a=Math.min(a,f.getMinutes())),a===f.getMinutes()&&(i=Math.min(i,f.getSeconds()))}if(o){var m=void 0!==w.config.minTime?w.config.minTime:w.config.minDate;(t=Math.max(t,m.getHours()))===m.getHours()&&a<m.getMinutes()&&(a=m.getMinutes()),a===m.getMinutes()&&(i=Math.max(i,m.getSeconds()))}}A(t,a,i)}}function F(e){var n=e||w.latestSelectedDateObj;n&&n instanceof Date&&A(n.getHours(),n.getMinutes(),n.getSeconds())}function A(e,n,t){void 0!==w.latestSelectedDateObj&&w.latestSelectedDateObj.setHours(e%24,n,t||0,0),w.hourElement&&w.minuteElement&&!w.isMobile&&(w.hourElement.value=o(w.config.time_24hr?e:(12+e)%12+12*r(e%12==0)),w.minuteElement.value=o(n),void 0!==w.amPM&&(w.amPM.textContent=w.l10n.amPM[r(e>=12)]),void 0!==w.secondElement&&(w.secondElement.value=o(t)))}function N(e){var n=g(e),t=parseInt(n.value)+(e.delta||0);(t/1e3>1||"Enter"===e.key&&!/[^\d]/.test(t.toString()))&&ee(t)}function P(e,n,t,a){return n instanceof Array?n.forEach((function(n){return P(e,n,t,a)})):e instanceof Array?e.forEach((function(e){return P(e,n,t,a)})):(e.addEventListener(n,t,a),void w._handlers.push({remove:function(){return e.removeEventListener(n,t,a)}}))}function Y(){De("onChange")}function j(e,n){var t=void 0!==e?w.parseDate(e):w.latestSelectedDateObj||(w.config.minDate&&w.config.minDate>w.now?w.config.minDate:w.config.maxDate&&w.config.maxDate<w.now?w.config.maxDate:w.now),a=w.currentYear,i=w.currentMonth;try{void 0!==t&&(w.currentYear=t.getFullYear(),w.currentMonth=t.getMonth())}catch(e){e.message="Invalid date supplied: "+t,w.config.errorHandler(e)}n&&w.currentYear!==a&&(De("onYearChange"),q()),!n||w.currentYear===a&&w.currentMonth===i||De("onMonthChange"),w.redraw()}function H(e){var n=g(e);~n.className.indexOf("arrow")&&L(e,n.classList.contains("arrowUp")?1:-1)}function L(e,n,t){var a=e&&g(e),i=t||a&&a.parentNode&&a.parentNode.firstChild,o=we("increment");o.delta=n,i&&i.dispatchEvent(o)}function R(e,n,t,a){var i=ne(n,!0),o=d("span",e,n.getDate().toString());return o.dateObj=n,o.$i=a,o.setAttribute("aria-label",w.formatDate(n,w.config.ariaDateFormat)),-1===e.indexOf("hidden")&&0===M(n,w.now)&&(w.todayDateElem=o,o.classList.add("today"),o.setAttribute("aria-current","date")),i?(o.tabIndex=-1,be(n)&&(o.classList.add("selected"),w.selectedDateElem=o,"range"===w.config.mode&&(s(o,"startRange",w.selectedDates[0]&&0===M(n,w.selectedDates[0],!0)),s(o,"endRange",w.selectedDates[1]&&0===M(n,w.selectedDates[1],!0)),"nextMonthDay"===e&&o.classList.add("inRange")))):o.classList.add("flatpickr-disabled"),"range"===w.config.mode&&function(e){return!("range"!==w.config.mode||w.selectedDates.length<2)&&(M(e,w.selectedDates[0])>=0&&M(e,w.selectedDates[1])<=0)}(n)&&!be(n)&&o.classList.add("inRange"),w.weekNumbers&&1===w.config.showMonths&&"prevMonthDay"!==e&&a%7==6&&w.weekNumbers.insertAdjacentHTML("beforeend","<span class='flatpickr-day'>"+w.config.getWeek(n)+"</span>"),De("onDayCreate",o),o}function W(e){e.focus(),"range"===w.config.mode&&oe(e)}function B(e){for(var n=e>0?0:w.config.showMonths-1,t=e>0?w.config.showMonths:-1,a=n;a!=t;a+=e)for(var i=w.daysContainer.children[a],o=e>0?0:i.children.length-1,r=e>0?i.children.length:-1,l=o;l!=r;l+=e){var c=i.children[l];if(-1===c.className.indexOf("hidden")&&ne(c.dateObj))return c}}function J(e,n){var t=k(),a=te(t||document.body),i=void 0!==e?e:a?t:void 0!==w.selectedDateElem&&te(w.selectedDateElem)?w.selectedDateElem:void 0!==w.todayDateElem&&te(w.todayDateElem)?w.todayDateElem:B(n>0?1:-1);void 0===i?w._input.focus():a?function(e,n){for(var t=-1===e.className.indexOf("Month")?e.dateObj.getMonth():w.currentMonth,a=n>0?w.config.showMonths:-1,i=n>0?1:-1,o=t-w.currentMonth;o!=a;o+=i)for(var r=w.daysContainer.children[o],l=t-w.currentMonth===o?e.$i+n:n<0?r.children.length-1:0,c=r.children.length,s=l;s>=0&&s<c&&s!=(n>0?c:-1);s+=i){var d=r.children[s];if(-1===d.className.indexOf("hidden")&&ne(d.dateObj)&&Math.abs(e.$i-s)>=Math.abs(n))return W(d)}w.changeMonth(i),J(B(i),0)}(i,n):W(i)}function K(e,n){for(var t=(new Date(e,n,1).getDay()-w.l10n.firstDayOfWeek+7)%7,a=w.utils.getDaysInMonth((n-1+12)%12,e),i=w.utils.getDaysInMonth(n,e),o=window.document.createDocumentFragment(),r=w.config.showMonths>1,l=r?"prevMonthDay hidden":"prevMonthDay",c=r?"nextMonthDay hidden":"nextMonthDay",s=a+1-t,u=0;s<=a;s++,u++)o.appendChild(R("flatpickr-day "+l,new Date(e,n-1,s),0,u));for(s=1;s<=i;s++,u++)o.appendChild(R("flatpickr-day",new Date(e,n,s),0,u));for(var f=i+1;f<=42-t&&(1===w.config.showMonths||u%7!=0);f++,u++)o.appendChild(R("flatpickr-day "+c,new Date(e,n+1,f%i),0,u));var m=d("div","dayContainer");return m.appendChild(o),m}function U(){if(void 0!==w.daysContainer){u(w.daysContainer),w.weekNumbers&&u(w.weekNumbers);for(var e=document.createDocumentFragment(),n=0;n<w.config.showMonths;n++){var t=new Date(w.currentYear,w.currentMonth,1);t.setMonth(w.currentMonth+n),e.appendChild(K(t.getFullYear(),t.getMonth()))}w.daysContainer.appendChild(e),w.days=w.daysContainer.firstChild,"range"===w.config.mode&&1===w.selectedDates.length&&oe()}}function q(){if(!(w.config.showMonths>1||"dropdown"!==w.config.monthSelectorType)){var e=function(e){return!(void 0!==w.config.minDate&&w.currentYear===w.config.minDate.getFullYear()&&e<w.config.minDate.getMonth())&&!(void 0!==w.config.maxDate&&w.currentYear===w.config.maxDate.getFullYear()&&e>w.config.maxDate.getMonth())};w.monthsDropdownContainer.tabIndex=-1,w.monthsDropdownContainer.innerHTML="";for(var n=0;n<12;n++)if(e(n)){var t=d("option","flatpickr-monthDropdown-month");t.value=new Date(w.currentYear,n).getMonth().toString(),t.textContent=h(n,w.config.shorthandCurrentMonth,w.l10n),t.tabIndex=-1,w.currentMonth===n&&(t.selected=!0),w.monthsDropdownContainer.appendChild(t)}}}function $(){var e,n=d("div","flatpickr-month"),t=window.document.createDocumentFragment();w.config.showMonths>1||"static"===w.config.monthSelectorType?e=d("span","cur-month"):(w.monthsDropdownContainer=d("select","flatpickr-monthDropdown-months"),w.monthsDropdownContainer.setAttribute("aria-label",w.l10n.monthAriaLabel),P(w.monthsDropdownContainer,"change",(function(e){var n=g(e),t=parseInt(n.value,10);w.changeMonth(t-w.currentMonth),De("onMonthChange")})),q(),e=w.monthsDropdownContainer);var a=m("cur-year",{tabindex:"-1"}),i=a.getElementsByTagName("input")[0];i.setAttribute("aria-label",w.l10n.yearAriaLabel),w.config.minDate&&i.setAttribute("min",w.config.minDate.getFullYear().toString()),w.config.maxDate&&(i.setAttribute("max",w.config.maxDate.getFullYear().toString()),i.disabled=!!w.config.minDate&&w.config.minDate.getFullYear()===w.config.maxDate.getFullYear());var o=d("div","flatpickr-current-month");return o.appendChild(e),o.appendChild(a),t.appendChild(o),n.appendChild(t),{container:n,yearElement:i,monthElement:e}}function V(){u(w.monthNav),w.monthNav.appendChild(w.prevMonthNav),w.config.showMonths&&(w.yearElements=[],w.monthElements=[]);for(var e=w.config.showMonths;e--;){var n=$();w.yearElements.push(n.yearElement),w.monthElements.push(n.monthElement),w.monthNav.appendChild(n.container)}w.monthNav.appendChild(w.nextMonthNav)}function z(){w.weekdayContainer?u(w.weekdayContainer):w.weekdayContainer=d("div","flatpickr-weekdays");for(var e=w.config.showMonths;e--;){var n=d("div","flatpickr-weekdaycontainer");w.weekdayContainer.appendChild(n)}return G(),w.weekdayContainer}function G(){if(w.weekdayContainer){var e=w.l10n.firstDayOfWeek,t=n(w.l10n.weekdays.shorthand);e>0&&e<t.length&&(t=n(t.splice(e,t.length),t.splice(0,e)));for(var a=w.config.showMonths;a--;)w.weekdayContainer.children[a].innerHTML="\n      <span class='flatpickr-weekday'>\n        "+t.join("</span><span class='flatpickr-weekday'>")+"\n      </span>\n      "}}function Z(e,n){void 0===n&&(n=!0);var t=n?e:e-w.currentMonth;t<0&&!0===w._hidePrevMonthArrow||t>0&&!0===w._hideNextMonthArrow||(w.currentMonth+=t,(w.currentMonth<0||w.currentMonth>11)&&(w.currentYear+=w.currentMonth>11?1:-1,w.currentMonth=(w.currentMonth+12)%12,De("onYearChange"),q()),U(),De("onMonthChange"),Ce())}function Q(e){return w.calendarContainer.contains(e)}function X(e){if(w.isOpen&&!w.config.inline){var n=g(e),t=Q(n),a=!(n===w.input||n===w.altInput||w.element.contains(n)||e.path&&e.path.indexOf&&(~e.path.indexOf(w.input)||~e.path.indexOf(w.altInput)))&&!t&&!Q(e.relatedTarget),i=!w.config.ignoredFocusElements.some((function(e){return e.contains(n)}));a&&i&&(w.config.allowInput&&w.setDate(w._input.value,!1,w.config.altInput?w.config.altFormat:w.config.dateFormat),void 0!==w.timeContainer&&void 0!==w.minuteElement&&void 0!==w.hourElement&&""!==w.input.value&&void 0!==w.input.value&&_(),w.close(),w.config&&"range"===w.config.mode&&1===w.selectedDates.length&&w.clear(!1))}}function ee(e){if(!(!e||w.config.minDate&&e<w.config.minDate.getFullYear()||w.config.maxDate&&e>w.config.maxDate.getFullYear())){var n=e,t=w.currentYear!==n;w.currentYear=n||w.currentYear,w.config.maxDate&&w.currentYear===w.config.maxDate.getFullYear()?w.currentMonth=Math.min(w.config.maxDate.getMonth(),w.currentMonth):w.config.minDate&&w.currentYear===w.config.minDate.getFullYear()&&(w.currentMonth=Math.max(w.config.minDate.getMonth(),w.currentMonth)),t&&(w.redraw(),De("onYearChange"),q())}}function ne(e,n){var t;void 0===n&&(n=!0);var a=w.parseDate(e,void 0,n);if(w.config.minDate&&a&&M(a,w.config.minDate,void 0!==n?n:!w.minDateHasTime)<0||w.config.maxDate&&a&&M(a,w.config.maxDate,void 0!==n?n:!w.maxDateHasTime)>0)return!1;if(!w.config.enable&&0===w.config.disable.length)return!0;if(void 0===a)return!1;for(var i=!!w.config.enable,o=null!==(t=w.config.enable)&&void 0!==t?t:w.config.disable,r=0,l=void 0;r<o.length;r++){if("function"==typeof(l=o[r])&&l(a))return i;if(l instanceof Date&&void 0!==a&&l.getTime()===a.getTime())return i;if("string"==typeof l){var c=w.parseDate(l,void 0,!0);return c&&c.getTime()===a.getTime()?i:!i}if("object"==typeof l&&void 0!==a&&l.from&&l.to&&a.getTime()>=l.from.getTime()&&a.getTime()<=l.to.getTime())return i}return!i}function te(e){return void 0!==w.daysContainer&&(-1===e.className.indexOf("hidden")&&-1===e.className.indexOf("flatpickr-disabled")&&w.daysContainer.contains(e))}function ae(e){var n=e.target===w._input,t=w._input.value.trimEnd()!==Me();!n||!t||e.relatedTarget&&Q(e.relatedTarget)||w.setDate(w._input.value,!0,e.target===w.altInput?w.config.altFormat:w.config.dateFormat)}function ie(e){var n=g(e),t=w.config.wrap?p.contains(n):n===w._input,a=w.config.allowInput,i=w.isOpen&&(!a||!t),o=w.config.inline&&t&&!a;if(13===e.keyCode&&t){if(a)return w.setDate(w._input.value,!0,n===w.altInput?w.config.altFormat:w.config.dateFormat),w.close(),n.blur();w.open()}else if(Q(n)||i||o){var r=!!w.timeContainer&&w.timeContainer.contains(n);switch(e.keyCode){case 13:r?(e.preventDefault(),_(),fe()):me(e);break;case 27:e.preventDefault(),fe();break;case 8:case 46:t&&!w.config.allowInput&&(e.preventDefault(),w.clear());break;case 37:case 39:if(r||t)w.hourElement&&w.hourElement.focus();else{e.preventDefault();var l=k();if(void 0!==w.daysContainer&&(!1===a||l&&te(l))){var c=39===e.keyCode?1:-1;e.ctrlKey?(e.stopPropagation(),Z(c),J(B(1),0)):J(void 0,c)}}break;case 38:case 40:e.preventDefault();var s=40===e.keyCode?1:-1;w.daysContainer&&void 0!==n.$i||n===w.input||n===w.altInput?e.ctrlKey?(e.stopPropagation(),ee(w.currentYear-s),J(B(1),0)):r||J(void 0,7*s):n===w.currentYearElement?ee(w.currentYear-s):w.config.enableTime&&(!r&&w.hourElement&&w.hourElement.focus(),_(e),w._debouncedChange());break;case 9:if(r){var d=[w.hourElement,w.minuteElement,w.secondElement,w.amPM].concat(w.pluginElements).filter((function(e){return e})),u=d.indexOf(n);if(-1!==u){var f=d[u+(e.shiftKey?-1:1)];e.preventDefault(),(f||w._input).focus()}}else!w.config.noCalendar&&w.daysContainer&&w.daysContainer.contains(n)&&e.shiftKey&&(e.preventDefault(),w._input.focus())}}if(void 0!==w.amPM&&n===w.amPM)switch(e.key){case w.l10n.amPM[0].charAt(0):case w.l10n.amPM[0].charAt(0).toLowerCase():w.amPM.textContent=w.l10n.amPM[0],O(),ye();break;case w.l10n.amPM[1].charAt(0):case w.l10n.amPM[1].charAt(0).toLowerCase():w.amPM.textContent=w.l10n.amPM[1],O(),ye()}(t||Q(n))&&De("onKeyDown",e)}function oe(e,n){if(void 0===n&&(n="flatpickr-day"),1===w.selectedDates.length&&(!e||e.classList.contains(n)&&!e.classList.contains("flatpickr-disabled"))){for(var t=e?e.dateObj.getTime():w.days.firstElementChild.dateObj.getTime(),a=w.parseDate(w.selectedDates[0],void 0,!0).getTime(),i=Math.min(t,w.selectedDates[0].getTime()),o=Math.max(t,w.selectedDates[0].getTime()),r=!1,l=0,c=0,s=i;s<o;s+=x)ne(new Date(s),!0)||(r=r||s>i&&s<o,s<a&&(!l||s>l)?l=s:s>a&&(!c||s<c)&&(c=s));Array.from(w.rContainer.querySelectorAll("*:nth-child(-n+"+w.config.showMonths+") > ."+n)).forEach((function(n){var i,o,s,d=n.dateObj.getTime(),u=l>0&&d<l||c>0&&d>c;if(u)return n.classList.add("notAllowed"),void["inRange","startRange","endRange"].forEach((function(e){n.classList.remove(e)}));r&&!u||(["startRange","inRange","endRange","notAllowed"].forEach((function(e){n.classList.remove(e)})),void 0!==e&&(e.classList.add(t<=w.selectedDates[0].getTime()?"startRange":"endRange"),a<t&&d===a?n.classList.add("startRange"):a>t&&d===a&&n.classList.add("endRange"),d>=l&&(0===c||d<=c)&&(o=a,s=t,(i=d)>Math.min(o,s)&&i<Math.max(o,s))&&n.classList.add("inRange")))}))}}function re(){!w.isOpen||w.config.static||w.config.inline||de()}function le(e){return function(n){var t=w.config["_"+e+"Date"]=w.parseDate(n,w.config.dateFormat),a=w.config["_"+("min"===e?"max":"min")+"Date"];void 0!==t&&(w["min"===e?"minDateHasTime":"maxDateHasTime"]=t.getHours()>0||t.getMinutes()>0||t.getSeconds()>0),w.selectedDates&&(w.selectedDates=w.selectedDates.filter((function(e){return ne(e)})),w.selectedDates.length||"min"!==e||F(t),ye()),w.daysContainer&&(ue(),void 0!==t?w.currentYearElement[e]=t.getFullYear().toString():w.currentYearElement.removeAttribute(e),w.currentYearElement.disabled=!!a&&void 0!==t&&a.getFullYear()===t.getFullYear())}}function ce(){return w.config.wrap?p.querySelector("[data-input]"):p}function se(){"object"!=typeof w.config.locale&&void 0===I.l10ns[w.config.locale]&&w.config.errorHandler(new Error("flatpickr: invalid locale "+w.config.locale)),w.l10n=e(e({},I.l10ns.default),"object"==typeof w.config.locale?w.config.locale:"default"!==w.config.locale?I.l10ns[w.config.locale]:void 0),D.D="("+w.l10n.weekdays.shorthand.join("|")+")",D.l="("+w.l10n.weekdays.longhand.join("|")+")",D.M="("+w.l10n.months.shorthand.join("|")+")",D.F="("+w.l10n.months.longhand.join("|")+")",D.K="("+w.l10n.amPM[0]+"|"+w.l10n.amPM[1]+"|"+w.l10n.amPM[0].toLowerCase()+"|"+w.l10n.amPM[1].toLowerCase()+")",void 0===e(e({},v),JSON.parse(JSON.stringify(p.dataset||{}))).time_24hr&&void 0===I.defaultConfig.time_24hr&&(w.config.time_24hr=w.l10n.time_24hr),w.formatDate=b(w),w.parseDate=C({config:w.config,l10n:w.l10n})}function de(e){if("function"!=typeof w.config.position){if(void 0!==w.calendarContainer){De("onPreCalendarPosition");var n=e||w._positionElement,t=Array.prototype.reduce.call(w.calendarContainer.children,(function(e,n){return e+n.offsetHeight}),0),a=w.calendarContainer.offsetWidth,i=w.config.position.split(" "),o=i[0],r=i.length>1?i[1]:null,l=n.getBoundingClientRect(),c=window.innerHeight-l.bottom,d="above"===o||"below"!==o&&c<t&&l.top>t,u=window.pageYOffset+l.top+(d?-t-2:n.offsetHeight+2);if(s(w.calendarContainer,"arrowTop",!d),s(w.calendarContainer,"arrowBottom",d),!w.config.inline){var f=window.pageXOffset+l.left,m=!1,g=!1;"center"===r?(f-=(a-l.width)/2,m=!0):"right"===r&&(f-=a-l.width,g=!0),s(w.calendarContainer,"arrowLeft",!m&&!g),s(w.calendarContainer,"arrowCenter",m),s(w.calendarContainer,"arrowRight",g);var p=window.document.body.offsetWidth-(window.pageXOffset+l.right),h=f+a>window.document.body.offsetWidth,v=p+a>window.document.body.offsetWidth;if(s(w.calendarContainer,"rightMost",h),!w.config.static)if(w.calendarContainer.style.top=u+"px",h)if(v){var D=function(){for(var e=null,n=0;n<document.styleSheets.length;n++){var t=document.styleSheets[n];if(t.cssRules){try{t.cssRules}catch(e){continue}e=t;break}}return null!=e?e:(a=document.createElement("style"),document.head.appendChild(a),a.sheet);var a}();if(void 0===D)return;var b=window.document.body.offsetWidth,C=Math.max(0,b/2-a/2),M=D.cssRules.length,y="{left:"+l.left+"px;right:auto;}";s(w.calendarContainer,"rightMost",!1),s(w.calendarContainer,"centerMost",!0),D.insertRule(".flatpickr-calendar.centerMost:before,.flatpickr-calendar.centerMost:after"+y,M),w.calendarContainer.style.left=C+"px",w.calendarContainer.style.right="auto"}else w.calendarContainer.style.left="auto",w.calendarContainer.style.right=p+"px";else w.calendarContainer.style.left=f+"px",w.calendarContainer.style.right="auto"}}}else w.config.position(w,e)}function ue(){w.config.noCalendar||w.isMobile||(q(),Ce(),U())}function fe(){w._input.focus(),-1!==window.navigator.userAgent.indexOf("MSIE")||void 0!==navigator.msMaxTouchPoints?setTimeout(w.close,0):w.close()}function me(e){e.preventDefault(),e.stopPropagation();var n=f(g(e),(function(e){return e.classList&&e.classList.contains("flatpickr-day")&&!e.classList.contains("flatpickr-disabled")&&!e.classList.contains("notAllowed")}));if(void 0!==n){var t=n,a=w.latestSelectedDateObj=new Date(t.dateObj.getTime()),i=(a.getMonth()<w.currentMonth||a.getMonth()>w.currentMonth+w.config.showMonths-1)&&"range"!==w.config.mode;if(w.selectedDateElem=t,"single"===w.config.mode)w.selectedDates=[a];else if("multiple"===w.config.mode){var o=be(a);o?w.selectedDates.splice(parseInt(o),1):w.selectedDates.push(a)}else"range"===w.config.mode&&(2===w.selectedDates.length&&w.clear(!1,!1),w.latestSelectedDateObj=a,w.selectedDates.push(a),0!==M(a,w.selectedDates[0],!0)&&w.selectedDates.sort((function(e,n){return e.getTime()-n.getTime()})));if(O(),i){var r=w.currentYear!==a.getFullYear();w.currentYear=a.getFullYear(),w.currentMonth=a.getMonth(),r&&(De("onYearChange"),q()),De("onMonthChange")}if(Ce(),U(),ye(),i||"range"===w.config.mode||1!==w.config.showMonths?void 0!==w.selectedDateElem&&void 0===w.hourElement&&w.selectedDateElem&&w.selectedDateElem.focus():W(t),void 0!==w.hourElement&&void 0!==w.hourElement&&w.hourElement.focus(),w.config.closeOnSelect){var l="single"===w.config.mode&&!w.config.enableTime,c="range"===w.config.mode&&2===w.selectedDates.length&&!w.config.enableTime;(l||c)&&fe()}Y()}}w.parseDate=C({config:w.config,l10n:w.l10n}),w._handlers=[],w.pluginElements=[],w.loadedPlugins=[],w._bind=P,w._setHoursFromDate=F,w._positionCalendar=de,w.changeMonth=Z,w.changeYear=ee,w.clear=function(e,n){void 0===e&&(e=!0);void 0===n&&(n=!0);w.input.value="",void 0!==w.altInput&&(w.altInput.value="");void 0!==w.mobileInput&&(w.mobileInput.value="");w.selectedDates=[],w.latestSelectedDateObj=void 0,!0===n&&(w.currentYear=w._initialDate.getFullYear(),w.currentMonth=w._initialDate.getMonth());if(!0===w.config.enableTime){var t=E(w.config),a=t.hours,i=t.minutes,o=t.seconds;A(a,i,o)}w.redraw(),e&&De("onChange")},w.close=function(){w.isOpen=!1,w.isMobile||(void 0!==w.calendarContainer&&w.calendarContainer.classList.remove("open"),void 0!==w._input&&w._input.classList.remove("active"));De("onClose")},w.onMouseOver=oe,w._createElement=d,w.createDay=R,w.destroy=function(){void 0!==w.config&&De("onDestroy");for(var e=w._handlers.length;e--;)w._handlers[e].remove();if(w._handlers=[],w.mobileInput)w.mobileInput.parentNode&&w.mobileInput.parentNode.removeChild(w.mobileInput),w.mobileInput=void 0;else if(w.calendarContainer&&w.calendarContainer.parentNode)if(w.config.static&&w.calendarContainer.parentNode){var n=w.calendarContainer.parentNode;if(n.lastChild&&n.removeChild(n.lastChild),n.parentNode){for(;n.firstChild;)n.parentNode.insertBefore(n.firstChild,n);n.parentNode.removeChild(n)}}else w.calendarContainer.parentNode.removeChild(w.calendarContainer);w.altInput&&(w.input.type="text",w.altInput.parentNode&&w.altInput.parentNode.removeChild(w.altInput),delete w.altInput);w.input&&(w.input.type=w.input._type,w.input.classList.remove("flatpickr-input"),w.input.removeAttribute("readonly"));["_showTimeInput","latestSelectedDateObj","_hideNextMonthArrow","_hidePrevMonthArrow","__hideNextMonthArrow","__hidePrevMonthArrow","isMobile","isOpen","selectedDateElem","minDateHasTime","maxDateHasTime","days","daysContainer","_input","_positionElement","innerContainer","rContainer","monthNav","todayDateElem","calendarContainer","weekdayContainer","prevMonthNav","nextMonthNav","monthsDropdownContainer","currentMonthElement","currentYearElement","navigationCurrentMonth","selectedDateElem","config"].forEach((function(e){try{delete w[e]}catch(e){}}))},w.isEnabled=ne,w.jumpToDate=j,w.updateValue=ye,w.open=function(e,n){void 0===n&&(n=w._positionElement);if(!0===w.isMobile){if(e){e.preventDefault();var t=g(e);t&&t.blur()}return void 0!==w.mobileInput&&(w.mobileInput.focus(),w.mobileInput.click()),void De("onOpen")}if(w._input.disabled||w.config.inline)return;var a=w.isOpen;w.isOpen=!0,a||(w.calendarContainer.classList.add("open"),w._input.classList.add("active"),De("onOpen"),de(n));!0===w.config.enableTime&&!0===w.config.noCalendar&&(!1!==w.config.allowInput||void 0!==e&&w.timeContainer.contains(e.relatedTarget)||setTimeout((function(){return w.hourElement.select()}),50))},w.redraw=ue,w.set=function(e,n){if(null!==e&&"object"==typeof e)for(var a in Object.assign(w.config,e),e)void 0!==ge[a]&&ge[a].forEach((function(e){return e()}));else w.config[e]=n,void 0!==ge[e]?ge[e].forEach((function(e){return e()})):t.indexOf(e)>-1&&(w.config[e]=c(n));w.redraw(),ye(!0)},w.setDate=function(e,n,t){void 0===n&&(n=!1);void 0===t&&(t=w.config.dateFormat);if(0!==e&&!e||e instanceof Array&&0===e.length)return w.clear(n);pe(e,t),w.latestSelectedDateObj=w.selectedDates[w.selectedDates.length-1],w.redraw(),j(void 0,n),F(),0===w.selectedDates.length&&w.clear(!1);ye(n),n&&De("onChange")},w.toggle=function(e){if(!0===w.isOpen)return w.close();w.open(e)};var ge={locale:[se,G],showMonths:[V,S,z],minDate:[j],maxDate:[j],positionElement:[ve],clickOpens:[function(){!0===w.config.clickOpens?(P(w._input,"focus",w.open),P(w._input,"click",w.open)):(w._input.removeEventListener("focus",w.open),w._input.removeEventListener("click",w.open))}]};function pe(e,n){var t=[];if(e instanceof Array)t=e.map((function(e){return w.parseDate(e,n)}));else if(e instanceof Date||"number"==typeof e)t=[w.parseDate(e,n)];else if("string"==typeof e)switch(w.config.mode){case"single":case"time":t=[w.parseDate(e,n)];break;case"multiple":t=e.split(w.config.conjunction).map((function(e){return w.parseDate(e,n)}));break;case"range":t=e.split(w.l10n.rangeSeparator).map((function(e){return w.parseDate(e,n)}))}else w.config.errorHandler(new Error("Invalid date supplied: "+JSON.stringify(e)));w.selectedDates=w.config.allowInvalidPreload?t:t.filter((function(e){return e instanceof Date&&ne(e,!1)})),"range"===w.config.mode&&w.selectedDates.sort((function(e,n){return e.getTime()-n.getTime()}))}function he(e){return e.slice().map((function(e){return"string"==typeof e||"number"==typeof e||e instanceof Date?w.parseDate(e,void 0,!0):e&&"object"==typeof e&&e.from&&e.to?{from:w.parseDate(e.from,void 0),to:w.parseDate(e.to,void 0)}:e})).filter((function(e){return e}))}function ve(){w._positionElement=w.config.positionElement||w._input}function De(e,n){if(void 0!==w.config){var t=w.config[e];if(void 0!==t&&t.length>0)for(var a=0;t[a]&&a<t.length;a++)t[a](w.selectedDates,w.input.value,w,n);"onChange"===e&&(w.input.dispatchEvent(we("change")),w.input.dispatchEvent(we("input")))}}function we(e){var n=document.createEvent("Event");return n.initEvent(e,!0,!0),n}function be(e){for(var n=0;n<w.selectedDates.length;n++){var t=w.selectedDates[n];if(t instanceof Date&&0===M(t,e))return""+n}return!1}function Ce(){w.config.noCalendar||w.isMobile||!w.monthNav||(w.yearElements.forEach((function(e,n){var t=new Date(w.currentYear,w.currentMonth,1);t.setMonth(w.currentMonth+n),w.config.showMonths>1||"static"===w.config.monthSelectorType?w.monthElements[n].textContent=h(t.getMonth(),w.config.shorthandCurrentMonth,w.l10n)+" ":w.monthsDropdownContainer.value=t.getMonth().toString(),e.value=t.getFullYear().toString()})),w._hidePrevMonthArrow=void 0!==w.config.minDate&&(w.currentYear===w.config.minDate.getFullYear()?w.currentMonth<=w.config.minDate.getMonth():w.currentYear<w.config.minDate.getFullYear()),w._hideNextMonthArrow=void 0!==w.config.maxDate&&(w.currentYear===w.config.maxDate.getFullYear()?w.currentMonth+1>w.config.maxDate.getMonth():w.currentYear>w.config.maxDate.getFullYear()))}function Me(e){var n=e||(w.config.altInput?w.config.altFormat:w.config.dateFormat);return w.selectedDates.map((function(e){return w.formatDate(e,n)})).filter((function(e,n,t){return"range"!==w.config.mode||w.config.enableTime||t.indexOf(e)===n})).join("range"!==w.config.mode?w.config.conjunction:w.l10n.rangeSeparator)}function ye(e){void 0===e&&(e=!0),void 0!==w.mobileInput&&w.mobileFormatStr&&(w.mobileInput.value=void 0!==w.latestSelectedDateObj?w.formatDate(w.latestSelectedDateObj,w.mobileFormatStr):""),w.input.value=Me(w.config.dateFormat),void 0!==w.altInput&&(w.altInput.value=Me(w.config.altFormat)),!1!==e&&De("onValueUpdate")}function xe(e){var n=g(e),t=w.prevMonthNav.contains(n),a=w.nextMonthNav.contains(n);t||a?Z(t?-1:1):w.yearElements.indexOf(n)>=0?n.select():n.classList.contains("arrowUp")?w.changeYear(w.currentYear+1):n.classList.contains("arrowDown")&&w.changeYear(w.currentYear-1)}return function(){w.element=w.input=p,w.isOpen=!1,function(){var n=["wrap","weekNumbers","allowInput","allowInvalidPreload","clickOpens","time_24hr","enableTime","noCalendar","altInput","shorthandCurrentMonth","inline","static","enableSeconds","disableMobile"],i=e(e({},JSON.parse(JSON.stringify(p.dataset||{}))),v),o={};w.config.parseDate=i.parseDate,w.config.formatDate=i.formatDate,Object.defineProperty(w.config,"enable",{get:function(){return w.config._enable},set:function(e){w.config._enable=he(e)}}),Object.defineProperty(w.config,"disable",{get:function(){return w.config._disable},set:function(e){w.config._disable=he(e)}});var r="time"===i.mode;if(!i.dateFormat&&(i.enableTime||r)){var l=I.defaultConfig.dateFormat||a.dateFormat;o.dateFormat=i.noCalendar||r?"H:i"+(i.enableSeconds?":S":""):l+" H:i"+(i.enableSeconds?":S":"")}if(i.altInput&&(i.enableTime||r)&&!i.altFormat){var s=I.defaultConfig.altFormat||a.altFormat;o.altFormat=i.noCalendar||r?"h:i"+(i.enableSeconds?":S K":" K"):s+" h:i"+(i.enableSeconds?":S":"")+" K"}Object.defineProperty(w.config,"minDate",{get:function(){return w.config._minDate},set:le("min")}),Object.defineProperty(w.config,"maxDate",{get:function(){return w.config._maxDate},set:le("max")});var d=function(e){return function(n){w.config["min"===e?"_minTime":"_maxTime"]=w.parseDate(n,"H:i:S")}};Object.defineProperty(w.config,"minTime",{get:function(){return w.config._minTime},set:d("min")}),Object.defineProperty(w.config,"maxTime",{get:function(){return w.config._maxTime},set:d("max")}),"time"===i.mode&&(w.config.noCalendar=!0,w.config.enableTime=!0);Object.assign(w.config,o,i);for(var u=0;u<n.length;u++)w.config[n[u]]=!0===w.config[n[u]]||"true"===w.config[n[u]];t.filter((function(e){return void 0!==w.config[e]})).forEach((function(e){w.config[e]=c(w.config[e]||[]).map(T)})),w.isMobile=!w.config.disableMobile&&!w.config.inline&&"single"===w.config.mode&&!w.config.disable.length&&!w.config.enable&&!w.config.weekNumbers&&/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);for(u=0;u<w.config.plugins.length;u++){var f=w.config.plugins[u](w)||{};for(var m in f)t.indexOf(m)>-1?w.config[m]=c(f[m]).map(T).concat(w.config[m]):void 0===i[m]&&(w.config[m]=f[m])}i.altInputClass||(w.config.altInputClass=ce().className+" "+w.config.altInputClass);De("onParseConfig")}(),se(),function(){if(w.input=ce(),!w.input)return void w.config.errorHandler(new Error("Invalid input element specified"));w.input._type=w.input.type,w.input.type="text",w.input.classList.add("flatpickr-input"),w._input=w.input,w.config.altInput&&(w.altInput=d(w.input.nodeName,w.config.altInputClass),w._input=w.altInput,w.altInput.placeholder=w.input.placeholder,w.altInput.disabled=w.input.disabled,w.altInput.required=w.input.required,w.altInput.tabIndex=w.input.tabIndex,w.altInput.type="text",w.input.setAttribute("type","hidden"),!w.config.static&&w.input.parentNode&&w.input.parentNode.insertBefore(w.altInput,w.input.nextSibling));w.config.allowInput||w._input.setAttribute("readonly","readonly");ve()}(),function(){w.selectedDates=[],w.now=w.parseDate(w.config.now)||new Date;var e=w.config.defaultDate||("INPUT"!==w.input.nodeName&&"TEXTAREA"!==w.input.nodeName||!w.input.placeholder||w.input.value!==w.input.placeholder?w.input.value:null);e&&pe(e,w.config.dateFormat);w._initialDate=w.selectedDates.length>0?w.selectedDates[0]:w.config.minDate&&w.config.minDate.getTime()>w.now.getTime()?w.config.minDate:w.config.maxDate&&w.config.maxDate.getTime()<w.now.getTime()?w.config.maxDate:w.now,w.currentYear=w._initialDate.getFullYear(),w.currentMonth=w._initialDate.getMonth(),w.selectedDates.length>0&&(w.latestSelectedDateObj=w.selectedDates[0]);void 0!==w.config.minTime&&(w.config.minTime=w.parseDate(w.config.minTime,"H:i"));void 0!==w.config.maxTime&&(w.config.maxTime=w.parseDate(w.config.maxTime,"H:i"));w.minDateHasTime=!!w.config.minDate&&(w.config.minDate.getHours()>0||w.config.minDate.getMinutes()>0||w.config.minDate.getSeconds()>0),w.maxDateHasTime=!!w.config.maxDate&&(w.config.maxDate.getHours()>0||w.config.maxDate.getMinutes()>0||w.config.maxDate.getSeconds()>0)}(),w.utils={getDaysInMonth:function(e,n){return void 0===e&&(e=w.currentMonth),void 0===n&&(n=w.currentYear),1===e&&(n%4==0&&n%100!=0||n%400==0)?29:w.l10n.daysInMonth[e]}},w.isMobile||function(){var e=window.document.createDocumentFragment();if(w.calendarContainer=d("div","flatpickr-calendar"),w.calendarContainer.tabIndex=-1,!w.config.noCalendar){if(e.appendChild((w.monthNav=d("div","flatpickr-months"),w.yearElements=[],w.monthElements=[],w.prevMonthNav=d("span","flatpickr-prev-month"),w.prevMonthNav.innerHTML=w.config.prevArrow,w.nextMonthNav=d("span","flatpickr-next-month"),w.nextMonthNav.innerHTML=w.config.nextArrow,V(),Object.defineProperty(w,"_hidePrevMonthArrow",{get:function(){return w.__hidePrevMonthArrow},set:function(e){w.__hidePrevMonthArrow!==e&&(s(w.prevMonthNav,"flatpickr-disabled",e),w.__hidePrevMonthArrow=e)}}),Object.defineProperty(w,"_hideNextMonthArrow",{get:function(){return w.__hideNextMonthArrow},set:function(e){w.__hideNextMonthArrow!==e&&(s(w.nextMonthNav,"flatpickr-disabled",e),w.__hideNextMonthArrow=e)}}),w.currentYearElement=w.yearElements[0],Ce(),w.monthNav)),w.innerContainer=d("div","flatpickr-innerContainer"),w.config.weekNumbers){var n=function(){w.calendarContainer.classList.add("hasWeeks");var e=d("div","flatpickr-weekwrapper");e.appendChild(d("span","flatpickr-weekday",w.l10n.weekAbbreviation));var n=d("div","flatpickr-weeks");return e.appendChild(n),{weekWrapper:e,weekNumbers:n}}(),t=n.weekWrapper,a=n.weekNumbers;w.innerContainer.appendChild(t),w.weekNumbers=a,w.weekWrapper=t}w.rContainer=d("div","flatpickr-rContainer"),w.rContainer.appendChild(z()),w.daysContainer||(w.daysContainer=d("div","flatpickr-days"),w.daysContainer.tabIndex=-1),U(),w.rContainer.appendChild(w.daysContainer),w.innerContainer.appendChild(w.rContainer),e.appendChild(w.innerContainer)}w.config.enableTime&&e.appendChild(function(){w.calendarContainer.classList.add("hasTime"),w.config.noCalendar&&w.calendarContainer.classList.add("noCalendar");var e=E(w.config);w.timeContainer=d("div","flatpickr-time"),w.timeContainer.tabIndex=-1;var n=d("span","flatpickr-time-separator",":"),t=m("flatpickr-hour",{"aria-label":w.l10n.hourAriaLabel});w.hourElement=t.getElementsByTagName("input")[0];var a=m("flatpickr-minute",{"aria-label":w.l10n.minuteAriaLabel});w.minuteElement=a.getElementsByTagName("input")[0],w.hourElement.tabIndex=w.minuteElement.tabIndex=-1,w.hourElement.value=o(w.latestSelectedDateObj?w.latestSelectedDateObj.getHours():w.config.time_24hr?e.hours:function(e){switch(e%24){case 0:case 12:return 12;default:return e%12}}(e.hours)),w.minuteElement.value=o(w.latestSelectedDateObj?w.latestSelectedDateObj.getMinutes():e.minutes),w.hourElement.setAttribute("step",w.config.hourIncrement.toString()),w.minuteElement.setAttribute("step",w.config.minuteIncrement.toString()),w.hourElement.setAttribute("min",w.config.time_24hr?"0":"1"),w.hourElement.setAttribute("max",w.config.time_24hr?"23":"12"),w.hourElement.setAttribute("maxlength","2"),w.minuteElement.setAttribute("min","0"),w.minuteElement.setAttribute("max","59"),w.minuteElement.setAttribute("maxlength","2"),w.timeContainer.appendChild(t),w.timeContainer.appendChild(n),w.timeContainer.appendChild(a),w.config.time_24hr&&w.timeContainer.classList.add("time24hr");if(w.config.enableSeconds){w.timeContainer.classList.add("hasSeconds");var i=m("flatpickr-second");w.secondElement=i.getElementsByTagName("input")[0],w.secondElement.value=o(w.latestSelectedDateObj?w.latestSelectedDateObj.getSeconds():e.seconds),w.secondElement.setAttribute("step",w.minuteElement.getAttribute("step")),w.secondElement.setAttribute("min","0"),w.secondElement.setAttribute("max","59"),w.secondElement.setAttribute("maxlength","2"),w.timeContainer.appendChild(d("span","flatpickr-time-separator",":")),w.timeContainer.appendChild(i)}w.config.time_24hr||(w.amPM=d("span","flatpickr-am-pm",w.l10n.amPM[r((w.latestSelectedDateObj?w.hourElement.value:w.config.defaultHour)>11)]),w.amPM.title=w.l10n.toggleTitle,w.amPM.tabIndex=-1,w.timeContainer.appendChild(w.amPM));return w.timeContainer}());s(w.calendarContainer,"rangeMode","range"===w.config.mode),s(w.calendarContainer,"animate",!0===w.config.animate),s(w.calendarContainer,"multiMonth",w.config.showMonths>1),w.calendarContainer.appendChild(e);var i=void 0!==w.config.appendTo&&void 0!==w.config.appendTo.nodeType;if((w.config.inline||w.config.static)&&(w.calendarContainer.classList.add(w.config.inline?"inline":"static"),w.config.inline&&(!i&&w.element.parentNode?w.element.parentNode.insertBefore(w.calendarContainer,w._input.nextSibling):void 0!==w.config.appendTo&&w.config.appendTo.appendChild(w.calendarContainer)),w.config.static)){var l=d("div","flatpickr-wrapper");w.element.parentNode&&w.element.parentNode.insertBefore(l,w.element),l.appendChild(w.element),w.altInput&&l.appendChild(w.altInput),l.appendChild(w.calendarContainer)}w.config.static||w.config.inline||(void 0!==w.config.appendTo?w.config.appendTo:window.document.body).appendChild(w.calendarContainer)}(),function(){w.config.wrap&&["open","close","toggle","clear"].forEach((function(e){Array.prototype.forEach.call(w.element.querySelectorAll("[data-"+e+"]"),(function(n){return P(n,"click",w[e])}))}));if(w.isMobile)return void function(){var e=w.config.enableTime?w.config.noCalendar?"time":"datetime-local":"date";w.mobileInput=d("input",w.input.className+" flatpickr-mobile"),w.mobileInput.tabIndex=1,w.mobileInput.type=e,w.mobileInput.disabled=w.input.disabled,w.mobileInput.required=w.input.required,w.mobileInput.placeholder=w.input.placeholder,w.mobileFormatStr="datetime-local"===e?"Y-m-d\\TH:i:S":"date"===e?"Y-m-d":"H:i:S",w.selectedDates.length>0&&(w.mobileInput.defaultValue=w.mobileInput.value=w.formatDate(w.selectedDates[0],w.mobileFormatStr));w.config.minDate&&(w.mobileInput.min=w.formatDate(w.config.minDate,"Y-m-d"));w.config.maxDate&&(w.mobileInput.max=w.formatDate(w.config.maxDate,"Y-m-d"));w.input.getAttribute("step")&&(w.mobileInput.step=String(w.input.getAttribute("step")));w.input.type="hidden",void 0!==w.altInput&&(w.altInput.type="hidden");try{w.input.parentNode&&w.input.parentNode.insertBefore(w.mobileInput,w.input.nextSibling)}catch(e){}P(w.mobileInput,"change",(function(e){w.setDate(g(e).value,!1,w.mobileFormatStr),De("onChange"),De("onClose")}))}();var e=l(re,50);w._debouncedChange=l(Y,300),w.daysContainer&&!/iPhone|iPad|iPod/i.test(navigator.userAgent)&&P(w.daysContainer,"mouseover",(function(e){"range"===w.config.mode&&oe(g(e))}));P(w._input,"keydown",ie),void 0!==w.calendarContainer&&P(w.calendarContainer,"keydown",ie);w.config.inline||w.config.static||P(window,"resize",e);void 0!==window.ontouchstart?P(window.document,"touchstart",X):P(window.document,"mousedown",X);P(window.document,"focus",X,{capture:!0}),!0===w.config.clickOpens&&(P(w._input,"focus",w.open),P(w._input,"click",w.open));void 0!==w.daysContainer&&(P(w.monthNav,"click",xe),P(w.monthNav,["keyup","increment"],N),P(w.daysContainer,"click",me));if(void 0!==w.timeContainer&&void 0!==w.minuteElement&&void 0!==w.hourElement){var n=function(e){return g(e).select()};P(w.timeContainer,["increment"],_),P(w.timeContainer,"blur",_,{capture:!0}),P(w.timeContainer,"click",H),P([w.hourElement,w.minuteElement],["focus","click"],n),void 0!==w.secondElement&&P(w.secondElement,"focus",(function(){return w.secondElement&&w.secondElement.select()})),void 0!==w.amPM&&P(w.amPM,"click",(function(e){_(e)}))}w.config.allowInput&&P(w._input,"blur",ae)}(),(w.selectedDates.length||w.config.noCalendar)&&(w.config.enableTime&&F(w.config.noCalendar?w.latestSelectedDateObj:void 0),ye(!1)),S();var n=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);!w.isMobile&&n&&de(),De("onReady")}(),w}function T(e,n){for(var t=Array.prototype.slice.call(e).filter((function(e){return e instanceof HTMLElement})),a=[],i=0;i<t.length;i++){var o=t[i];try{if(null!==o.getAttribute("data-fp-omit"))continue;void 0!==o._flatpickr&&(o._flatpickr.destroy(),o._flatpickr=void 0),o._flatpickr=k(o,n||{}),a.push(o._flatpickr)}catch(e){console.error(e)}}return 1===a.length?a[0]:a}"undefined"!=typeof HTMLElement&&"undefined"!=typeof HTMLCollection&&"undefined"!=typeof NodeList&&(HTMLCollection.prototype.flatpickr=NodeList.prototype.flatpickr=function(e){return T(this,e)},HTMLElement.prototype.flatpickr=function(e){return T([this],e)});var I=function(e,n){return"string"==typeof e?T(window.document.querySelectorAll(e),n):e instanceof Node?T([e],n):T(e,n)};return I.defaultConfig={},I.l10ns={en:e({},i),default:e({},i)},I.localize=function(n){I.l10ns.default=e(e({},I.l10ns.default),n)},I.setDefaults=function(n){I.defaultConfig=e(e({},I.defaultConfig),n)},I.parseDate=C({}),I.formatDate=b({}),I.compareDates=M,"undefined"!=typeof jQuery&&void 0!==jQuery.fn&&(jQuery.fn.flatpickr=function(e){return T(this,e)}),Date.prototype.fp_incr=function(e){return new Date(this.getFullYear(),this.getMonth(),this.getDate()+("string"==typeof e?parseInt(e,10):e))},"undefined"!=typeof window&&(window.flatpickr=I),I}));
return module.exports; })();
const locales = (function () { const module = { exports: {} }; const exports = module.exports;
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.index = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    var fp = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Arabic = {
        weekdays: {
            shorthand: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
            longhand: [
                "الأحد",
                "الاثنين",
                "الثلاثاء",
                "الأربعاء",
                "الخميس",
                "الجمعة",
                "السبت",
            ],
        },
        months: {
            shorthand: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
            longhand: [
                "يناير",
                "فبراير",
                "مارس",
                "أبريل",
                "مايو",
                "يونيو",
                "يوليو",
                "أغسطس",
                "سبتمبر",
                "أكتوبر",
                "نوفمبر",
                "ديسمبر",
            ],
        },
        firstDayOfWeek: 6,
        rangeSeparator: " إلى ",
        weekAbbreviation: "Wk",
        scrollTitle: "قم بالتمرير للزيادة",
        toggleTitle: "اضغط للتبديل",
        amPM: ["ص", "م"],
        yearAriaLabel: "سنة",
        monthAriaLabel: "شهر",
        hourAriaLabel: "ساعة",
        minuteAriaLabel: "دقيقة",
        time_24hr: false,
    };
    fp.l10ns.ar = Arabic;
    fp.l10ns;

    var fp$1 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Austria = {
        weekdays: {
            shorthand: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
            longhand: [
                "Sonntag",
                "Montag",
                "Dienstag",
                "Mittwoch",
                "Donnerstag",
                "Freitag",
                "Samstag",
            ],
        },
        months: {
            shorthand: [
                "Jän",
                "Feb",
                "Mär",
                "Apr",
                "Mai",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Dez",
            ],
            longhand: [
                "Jänner",
                "Februar",
                "März",
                "April",
                "Mai",
                "Juni",
                "Juli",
                "August",
                "September",
                "Oktober",
                "November",
                "Dezember",
            ],
        },
        firstDayOfWeek: 1,
        weekAbbreviation: "KW",
        rangeSeparator: " bis ",
        scrollTitle: "Zum Ändern scrollen",
        toggleTitle: "Zum Umschalten klicken",
        time_24hr: true,
    };
    fp$1.l10ns.at = Austria;
    fp$1.l10ns;

    var fp$2 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Azerbaijan = {
        weekdays: {
            shorthand: ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."],
            longhand: [
                "Bazar",
                "Bazar ertəsi",
                "Çərşənbə axşamı",
                "Çərşənbə",
                "Cümə axşamı",
                "Cümə",
                "Şənbə",
            ],
        },
        months: {
            shorthand: [
                "Yan",
                "Fev",
                "Mar",
                "Apr",
                "May",
                "İyn",
                "İyl",
                "Avq",
                "Sen",
                "Okt",
                "Noy",
                "Dek",
            ],
            longhand: [
                "Yanvar",
                "Fevral",
                "Mart",
                "Aprel",
                "May",
                "İyun",
                "İyul",
                "Avqust",
                "Sentyabr",
                "Oktyabr",
                "Noyabr",
                "Dekabr",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return ".";
        },
        rangeSeparator: " - ",
        weekAbbreviation: "Hf",
        scrollTitle: "Artırmaq üçün sürüşdürün",
        toggleTitle: "Aç / Bağla",
        amPM: ["GƏ", "GS"],
        time_24hr: true,
    };
    fp$2.l10ns.az = Azerbaijan;
    fp$2.l10ns;

    var fp$3 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Belarusian = {
        weekdays: {
            shorthand: ["Нд", "Пн", "Аў", "Ср", "Чц", "Пт", "Сб"],
            longhand: [
                "Нядзеля",
                "Панядзелак",
                "Аўторак",
                "Серада",
                "Чацвер",
                "Пятніца",
                "Субота",
            ],
        },
        months: {
            shorthand: [
                "Сту",
                "Лют",
                "Сак",
                "Кра",
                "Тра",
                "Чэр",
                "Ліп",
                "Жні",
                "Вер",
                "Кас",
                "Ліс",
                "Сне",
            ],
            longhand: [
                "Студзень",
                "Люты",
                "Сакавік",
                "Красавік",
                "Травень",
                "Чэрвень",
                "Ліпень",
                "Жнівень",
                "Верасень",
                "Кастрычнік",
                "Лістапад",
                "Снежань",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "Тыд.",
        scrollTitle: "Пракруціце для павелічэння",
        toggleTitle: "Націсніце для пераключэння",
        amPM: ["ДП", "ПП"],
        yearAriaLabel: "Год",
        time_24hr: true,
    };
    fp$3.l10ns.be = Belarusian;
    fp$3.l10ns;

    var fp$4 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Bosnian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"],
            longhand: [
                "Nedjelja",
                "Ponedjeljak",
                "Utorak",
                "Srijeda",
                "Četvrtak",
                "Petak",
                "Subota",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Maj",
                "Jun",
                "Jul",
                "Avg",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Mart",
                "April",
                "Maj",
                "Juni",
                "Juli",
                "Avgust",
                "Septembar",
                "Oktobar",
                "Novembar",
                "Decembar",
            ],
        },
        time_24hr: true,
    };
    fp$4.l10ns.bs = Bosnian;
    fp$4.l10ns;

    var fp$5 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Bulgarian = {
        weekdays: {
            shorthand: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
            longhand: [
                "Неделя",
                "Понеделник",
                "Вторник",
                "Сряда",
                "Четвъртък",
                "Петък",
                "Събота",
            ],
        },
        months: {
            shorthand: [
                "Яну",
                "Фев",
                "Март",
                "Апр",
                "Май",
                "Юни",
                "Юли",
                "Авг",
                "Сеп",
                "Окт",
                "Ное",
                "Дек",
            ],
            longhand: [
                "Януари",
                "Февруари",
                "Март",
                "Април",
                "Май",
                "Юни",
                "Юли",
                "Август",
                "Септември",
                "Октомври",
                "Ноември",
                "Декември",
            ],
        },
        time_24hr: true,
        firstDayOfWeek: 1,
    };
    fp$5.l10ns.bg = Bulgarian;
    fp$5.l10ns;

    var fp$6 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Bangla = {
        weekdays: {
            shorthand: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"],
            longhand: [
                "রবিবার",
                "সোমবার",
                "মঙ্গলবার",
                "বুধবার",
                "বৃহস্পতিবার",
                "শুক্রবার",
                "শনিবার",
            ],
        },
        months: {
            shorthand: [
                "জানু",
                "ফেব্রু",
                "মার্চ",
                "এপ্রিল",
                "মে",
                "জুন",
                "জুলাই",
                "আগ",
                "সেপ্টে",
                "অক্টো",
                "নভে",
                "ডিসে",
            ],
            longhand: [
                "জানুয়ারী",
                "ফেব্রুয়ারী",
                "মার্চ",
                "এপ্রিল",
                "মে",
                "জুন",
                "জুলাই",
                "আগস্ট",
                "সেপ্টেম্বর",
                "অক্টোবর",
                "নভেম্বর",
                "ডিসেম্বর",
            ],
        },
    };
    fp$6.l10ns.bn = Bangla;
    fp$6.l10ns;

    var fp$7 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Catalan = {
        weekdays: {
            shorthand: ["Dg", "Dl", "Dt", "Dc", "Dj", "Dv", "Ds"],
            longhand: [
                "Diumenge",
                "Dilluns",
                "Dimarts",
                "Dimecres",
                "Dijous",
                "Divendres",
                "Dissabte",
            ],
        },
        months: {
            shorthand: [
                "Gen",
                "Febr",
                "Març",
                "Abr",
                "Maig",
                "Juny",
                "Jul",
                "Ag",
                "Set",
                "Oct",
                "Nov",
                "Des",
            ],
            longhand: [
                "Gener",
                "Febrer",
                "Març",
                "Abril",
                "Maig",
                "Juny",
                "Juliol",
                "Agost",
                "Setembre",
                "Octubre",
                "Novembre",
                "Desembre",
            ],
        },
        ordinal: function (nth) {
            var s = nth % 100;
            if (s > 3 && s < 21)
                return "è";
            switch (s % 10) {
                case 1:
                    return "r";
                case 2:
                    return "n";
                case 3:
                    return "r";
                case 4:
                    return "t";
                default:
                    return "è";
            }
        },
        firstDayOfWeek: 1,
        rangeSeparator: " a ",
        time_24hr: true,
    };
    fp$7.l10ns.cat = fp$7.l10ns.ca = Catalan;
    fp$7.l10ns;

    var fp$8 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Kurdish = {
        weekdays: {
            shorthand: [
                "یەکشەممە",
                "دووشەممە",
                "سێشەممە",
                "چوارشەممە",
                "پێنجشەممە",
                "هەینی",
                "شەممە",
            ],
            longhand: [
                "یەکشەممە",
                "دووشەممە",
                "سێشەممە",
                "چوارشەممە",
                "پێنجشەممە",
                "هەینی",
                "شەممە",
            ],
        },
        months: {
            shorthand: [
                "ڕێبەندان",
                "ڕەشەمە",
                "نەورۆز",
                "گوڵان",
                "جۆزەردان",
                "پووشپەڕ",
                "گەلاوێژ",
                "خەرمانان",
                "ڕەزبەر",
                "گەڵاڕێزان",
                "سەرماوەز",
                "بەفرانبار",
            ],
            longhand: [
                "ڕێبەندان",
                "ڕەشەمە",
                "نەورۆز",
                "گوڵان",
                "جۆزەردان",
                "پووشپەڕ",
                "گەلاوێژ",
                "خەرمانان",
                "ڕەزبەر",
                "گەڵاڕێزان",
                "سەرماوەز",
                "بەفرانبار",
            ],
        },
        firstDayOfWeek: 6,
        ordinal: function () {
            return "";
        },
    };
    fp$8.l10ns.ckb = Kurdish;
    fp$8.l10ns;

    var fp$9 = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Czech = {
        weekdays: {
            shorthand: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
            longhand: [
                "Neděle",
                "Pondělí",
                "Úterý",
                "Středa",
                "Čtvrtek",
                "Pátek",
                "Sobota",
            ],
        },
        months: {
            shorthand: [
                "Led",
                "Ún",
                "Bře",
                "Dub",
                "Kvě",
                "Čer",
                "Čvc",
                "Srp",
                "Zář",
                "Říj",
                "Lis",
                "Pro",
            ],
            longhand: [
                "Leden",
                "Únor",
                "Březen",
                "Duben",
                "Květen",
                "Červen",
                "Červenec",
                "Srpen",
                "Září",
                "Říjen",
                "Listopad",
                "Prosinec",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return ".";
        },
        rangeSeparator: " do ",
        weekAbbreviation: "Týd.",
        scrollTitle: "Rolujte pro změnu",
        toggleTitle: "Přepnout dopoledne/odpoledne",
        amPM: ["dop.", "odp."],
        yearAriaLabel: "Rok",
        time_24hr: true,
    };
    fp$9.l10ns.cs = Czech;
    fp$9.l10ns;

    var fp$a = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Welsh = {
        weekdays: {
            shorthand: ["Sul", "Llun", "Maw", "Mer", "Iau", "Gwe", "Sad"],
            longhand: [
                "Dydd Sul",
                "Dydd Llun",
                "Dydd Mawrth",
                "Dydd Mercher",
                "Dydd Iau",
                "Dydd Gwener",
                "Dydd Sadwrn",
            ],
        },
        months: {
            shorthand: [
                "Ion",
                "Chwef",
                "Maw",
                "Ebr",
                "Mai",
                "Meh",
                "Gorff",
                "Awst",
                "Medi",
                "Hyd",
                "Tach",
                "Rhag",
            ],
            longhand: [
                "Ionawr",
                "Chwefror",
                "Mawrth",
                "Ebrill",
                "Mai",
                "Mehefin",
                "Gorffennaf",
                "Awst",
                "Medi",
                "Hydref",
                "Tachwedd",
                "Rhagfyr",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function (nth) {
            if (nth === 1)
                return "af";
            if (nth === 2)
                return "ail";
            if (nth === 3 || nth === 4)
                return "ydd";
            if (nth === 5 || nth === 6)
                return "ed";
            if ((nth >= 7 && nth <= 10) ||
                nth == 12 ||
                nth == 15 ||
                nth == 18 ||
                nth == 20)
                return "fed";
            if (nth == 11 ||
                nth == 13 ||
                nth == 14 ||
                nth == 16 ||
                nth == 17 ||
                nth == 19)
                return "eg";
            if (nth >= 21 && nth <= 39)
                return "ain";
            // Inconclusive.
            return "";
        },
        time_24hr: true,
    };
    fp$a.l10ns.cy = Welsh;
    fp$a.l10ns;

    var fp$b = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Danish = {
        weekdays: {
            shorthand: ["søn", "man", "tir", "ons", "tors", "fre", "lør"],
            longhand: [
                "søndag",
                "mandag",
                "tirsdag",
                "onsdag",
                "torsdag",
                "fredag",
                "lørdag",
            ],
        },
        months: {
            shorthand: [
                "jan",
                "feb",
                "mar",
                "apr",
                "maj",
                "jun",
                "jul",
                "aug",
                "sep",
                "okt",
                "nov",
                "dec",
            ],
            longhand: [
                "januar",
                "februar",
                "marts",
                "april",
                "maj",
                "juni",
                "juli",
                "august",
                "september",
                "oktober",
                "november",
                "december",
            ],
        },
        ordinal: function () {
            return ".";
        },
        firstDayOfWeek: 1,
        rangeSeparator: " til ",
        weekAbbreviation: "uge",
        time_24hr: true,
    };
    fp$b.l10ns.da = Danish;
    fp$b.l10ns;

    var fp$c = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var German = {
        weekdays: {
            shorthand: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
            longhand: [
                "Sonntag",
                "Montag",
                "Dienstag",
                "Mittwoch",
                "Donnerstag",
                "Freitag",
                "Samstag",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mär",
                "Apr",
                "Mai",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Dez",
            ],
            longhand: [
                "Januar",
                "Februar",
                "März",
                "April",
                "Mai",
                "Juni",
                "Juli",
                "August",
                "September",
                "Oktober",
                "November",
                "Dezember",
            ],
        },
        firstDayOfWeek: 1,
        weekAbbreviation: "KW",
        rangeSeparator: " bis ",
        scrollTitle: "Zum Ändern scrollen",
        toggleTitle: "Zum Umschalten klicken",
        time_24hr: true,
    };
    fp$c.l10ns.de = German;
    fp$c.l10ns;

    var english = {
        weekdays: {
            shorthand: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            longhand: [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
            ],
            longhand: [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ],
        },
        daysInMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        firstDayOfWeek: 0,
        ordinal: function (nth) {
            var s = nth % 100;
            if (s > 3 && s < 21)
                return "th";
            switch (s % 10) {
                case 1:
                    return "st";
                case 2:
                    return "nd";
                case 3:
                    return "rd";
                default:
                    return "th";
            }
        },
        rangeSeparator: " to ",
        weekAbbreviation: "Wk",
        scrollTitle: "Scroll to increment",
        toggleTitle: "Click to toggle",
        amPM: ["AM", "PM"],
        yearAriaLabel: "Year",
        monthAriaLabel: "Month",
        hourAriaLabel: "Hour",
        minuteAriaLabel: "Minute",
        time_24hr: false,
    };

    var fp$d = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Esperanto = {
        firstDayOfWeek: 1,
        rangeSeparator: " ĝis ",
        weekAbbreviation: "Sem",
        scrollTitle: "Rulumu por pligrandigi la valoron",
        toggleTitle: "Klaku por ŝalti",
        weekdays: {
            shorthand: ["Dim", "Lun", "Mar", "Mer", "Ĵaŭ", "Ven", "Sab"],
            longhand: [
                "dimanĉo",
                "lundo",
                "mardo",
                "merkredo",
                "ĵaŭdo",
                "vendredo",
                "sabato",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Maj",
                "Jun",
                "Jul",
                "Aŭg",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "januaro",
                "februaro",
                "marto",
                "aprilo",
                "majo",
                "junio",
                "julio",
                "aŭgusto",
                "septembro",
                "oktobro",
                "novembro",
                "decembro",
            ],
        },
        ordinal: function () {
            return "-a";
        },
        time_24hr: true,
    };
    fp$d.l10ns.eo = Esperanto;
    fp$d.l10ns;

    var fp$e = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Spanish = {
        weekdays: {
            shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
            longhand: [
                "Domingo",
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
            ],
        },
        months: {
            shorthand: [
                "Ene",
                "Feb",
                "Mar",
                "Abr",
                "May",
                "Jun",
                "Jul",
                "Ago",
                "Sep",
                "Oct",
                "Nov",
                "Dic",
            ],
            longhand: [
                "Enero",
                "Febrero",
                "Marzo",
                "Abril",
                "Mayo",
                "Junio",
                "Julio",
                "Agosto",
                "Septiembre",
                "Octubre",
                "Noviembre",
                "Diciembre",
            ],
        },
        ordinal: function () {
            return "º";
        },
        firstDayOfWeek: 1,
        rangeSeparator: " a ",
        time_24hr: true,
    };
    fp$e.l10ns.es = Spanish;
    fp$e.l10ns;

    var fp$f = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Estonian = {
        weekdays: {
            shorthand: ["P", "E", "T", "K", "N", "R", "L"],
            longhand: [
                "Pühapäev",
                "Esmaspäev",
                "Teisipäev",
                "Kolmapäev",
                "Neljapäev",
                "Reede",
                "Laupäev",
            ],
        },
        months: {
            shorthand: [
                "Jaan",
                "Veebr",
                "Märts",
                "Apr",
                "Mai",
                "Juuni",
                "Juuli",
                "Aug",
                "Sept",
                "Okt",
                "Nov",
                "Dets",
            ],
            longhand: [
                "Jaanuar",
                "Veebruar",
                "Märts",
                "Aprill",
                "Mai",
                "Juuni",
                "Juuli",
                "August",
                "September",
                "Oktoober",
                "November",
                "Detsember",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return ".";
        },
        weekAbbreviation: "Näd",
        rangeSeparator: " kuni ",
        scrollTitle: "Keri, et suurendada",
        toggleTitle: "Klõpsa, et vahetada",
        time_24hr: true,
    };
    fp$f.l10ns.et = Estonian;
    fp$f.l10ns;

    var fp$g = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Persian = {
        weekdays: {
            shorthand: ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"],
            longhand: [
                "یک‌شنبه",
                "دوشنبه",
                "سه‌شنبه",
                "چهارشنبه",
                "پنچ‌شنبه",
                "جمعه",
                "شنبه",
            ],
        },
        months: {
            shorthand: [
                "ژانویه",
                "فوریه",
                "مارس",
                "آوریل",
                "مه",
                "ژوئن",
                "ژوئیه",
                "اوت",
                "سپتامبر",
                "اکتبر",
                "نوامبر",
                "دسامبر",
            ],
            longhand: [
                "ژانویه",
                "فوریه",
                "مارس",
                "آوریل",
                "مه",
                "ژوئن",
                "ژوئیه",
                "اوت",
                "سپتامبر",
                "اکتبر",
                "نوامبر",
                "دسامبر",
            ],
        },
        firstDayOfWeek: 6,
        ordinal: function () {
            return "";
        },
    };
    fp$g.l10ns.fa = Persian;
    fp$g.l10ns;

    var fp$h = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Finnish = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["su", "ma", "ti", "ke", "to", "pe", "la"],
            longhand: [
                "sunnuntai",
                "maanantai",
                "tiistai",
                "keskiviikko",
                "torstai",
                "perjantai",
                "lauantai",
            ],
        },
        months: {
            shorthand: [
                "tammi",
                "helmi",
                "maalis",
                "huhti",
                "touko",
                "kesä",
                "heinä",
                "elo",
                "syys",
                "loka",
                "marras",
                "joulu",
            ],
            longhand: [
                "tammikuu",
                "helmikuu",
                "maaliskuu",
                "huhtikuu",
                "toukokuu",
                "kesäkuu",
                "heinäkuu",
                "elokuu",
                "syyskuu",
                "lokakuu",
                "marraskuu",
                "joulukuu",
            ],
        },
        ordinal: function () {
            return ".";
        },
        time_24hr: true,
    };
    fp$h.l10ns.fi = Finnish;
    fp$h.l10ns;

    var fp$i = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Faroese = {
        weekdays: {
            shorthand: ["Sun", "Mán", "Týs", "Mik", "Hós", "Frí", "Ley"],
            longhand: [
                "Sunnudagur",
                "Mánadagur",
                "Týsdagur",
                "Mikudagur",
                "Hósdagur",
                "Fríggjadagur",
                "Leygardagur",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Mai",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Des",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Mars",
                "Apríl",
                "Mai",
                "Juni",
                "Juli",
                "August",
                "Septembur",
                "Oktobur",
                "Novembur",
                "Desembur",
            ],
        },
        ordinal: function () {
            return ".";
        },
        firstDayOfWeek: 1,
        rangeSeparator: " til ",
        weekAbbreviation: "vika",
        scrollTitle: "Rulla fyri at broyta",
        toggleTitle: "Trýst fyri at skifta",
        yearAriaLabel: "Ár",
        time_24hr: true,
    };
    fp$i.l10ns.fo = Faroese;
    fp$i.l10ns;

    var fp$j = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var French = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
            longhand: [
                "dimanche",
                "lundi",
                "mardi",
                "mercredi",
                "jeudi",
                "vendredi",
                "samedi",
            ],
        },
        months: {
            shorthand: [
                "janv",
                "févr",
                "mars",
                "avr",
                "mai",
                "juin",
                "juil",
                "août",
                "sept",
                "oct",
                "nov",
                "déc",
            ],
            longhand: [
                "janvier",
                "février",
                "mars",
                "avril",
                "mai",
                "juin",
                "juillet",
                "août",
                "septembre",
                "octobre",
                "novembre",
                "décembre",
            ],
        },
        ordinal: function (nth) {
            if (nth > 1)
                return "";
            return "er";
        },
        rangeSeparator: " au ",
        weekAbbreviation: "Sem",
        scrollTitle: "Défiler pour augmenter la valeur",
        toggleTitle: "Cliquer pour basculer",
        time_24hr: true,
    };
    fp$j.l10ns.fr = French;
    fp$j.l10ns;

    var fp$k = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Greek = {
        weekdays: {
            shorthand: ["Κυ", "Δε", "Τρ", "Τε", "Πέ", "Πα", "Σά"],
            longhand: [
                "Κυριακή",
                "Δευτέρα",
                "Τρίτη",
                "Τετάρτη",
                "Πέμπτη",
                "Παρασκευή",
                "Σάββατο",
            ],
        },
        months: {
            shorthand: [
                "Ιαν",
                "Φεβ",
                "Μάρ",
                "Απρ",
                "Μάι",
                "Ιούν",
                "Ιούλ",
                "Αύγ",
                "Σεπ",
                "Οκτ",
                "Νοέ",
                "Δεκ",
            ],
            longhand: [
                "Ιανουάριος",
                "Φεβρουάριος",
                "Μάρτιος",
                "Απρίλιος",
                "Μάιος",
                "Ιούνιος",
                "Ιούλιος",
                "Αύγουστος",
                "Σεπτέμβριος",
                "Οκτώβριος",
                "Νοέμβριος",
                "Δεκέμβριος",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        weekAbbreviation: "Εβδ",
        rangeSeparator: " έως ",
        scrollTitle: "Μετακυλήστε για προσαύξηση",
        toggleTitle: "Κάντε κλικ για αλλαγή",
        amPM: ["ΠΜ", "ΜΜ"],
        yearAriaLabel: "χρόνος",
        monthAriaLabel: "μήνας",
        hourAriaLabel: "ώρα",
        minuteAriaLabel: "λεπτό",
    };
    fp$k.l10ns.gr = Greek;
    fp$k.l10ns;

    var fp$l = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Hebrew = {
        weekdays: {
            shorthand: ["א", "ב", "ג", "ד", "ה", "ו", "ש"],
            longhand: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
        },
        months: {
            shorthand: [
                "ינו׳",
                "פבר׳",
                "מרץ",
                "אפר׳",
                "מאי",
                "יוני",
                "יולי",
                "אוג׳",
                "ספט׳",
                "אוק׳",
                "נוב׳",
                "דצמ׳",
            ],
            longhand: [
                "ינואר",
                "פברואר",
                "מרץ",
                "אפריל",
                "מאי",
                "יוני",
                "יולי",
                "אוגוסט",
                "ספטמבר",
                "אוקטובר",
                "נובמבר",
                "דצמבר",
            ],
        },
        rangeSeparator: " אל ",
        time_24hr: true,
    };
    fp$l.l10ns.he = Hebrew;
    fp$l.l10ns;

    var fp$m = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Hindi = {
        weekdays: {
            shorthand: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
            longhand: [
                "रविवार",
                "सोमवार",
                "मंगलवार",
                "बुधवार",
                "गुरुवार",
                "शुक्रवार",
                "शनिवार",
            ],
        },
        months: {
            shorthand: [
                "जन",
                "फर",
                "मार्च",
                "अप्रेल",
                "मई",
                "जून",
                "जूलाई",
                "अग",
                "सित",
                "अक्ट",
                "नव",
                "दि",
            ],
            longhand: [
                "जनवरी ",
                "फरवरी",
                "मार्च",
                "अप्रेल",
                "मई",
                "जून",
                "जूलाई",
                "अगस्त ",
                "सितम्बर",
                "अक्टूबर",
                "नवम्बर",
                "दिसम्बर",
            ],
        },
    };
    fp$m.l10ns.hi = Hindi;
    fp$m.l10ns;

    var fp$n = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Croatian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"],
            longhand: [
                "Nedjelja",
                "Ponedjeljak",
                "Utorak",
                "Srijeda",
                "Četvrtak",
                "Petak",
                "Subota",
            ],
        },
        months: {
            shorthand: [
                "Sij",
                "Velj",
                "Ožu",
                "Tra",
                "Svi",
                "Lip",
                "Srp",
                "Kol",
                "Ruj",
                "Lis",
                "Stu",
                "Pro",
            ],
            longhand: [
                "Siječanj",
                "Veljača",
                "Ožujak",
                "Travanj",
                "Svibanj",
                "Lipanj",
                "Srpanj",
                "Kolovoz",
                "Rujan",
                "Listopad",
                "Studeni",
                "Prosinac",
            ],
        },
        time_24hr: true,
    };
    fp$n.l10ns.hr = Croatian;
    fp$n.l10ns;

    var fp$o = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Hungarian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["V", "H", "K", "Sz", "Cs", "P", "Szo"],
            longhand: [
                "Vasárnap",
                "Hétfő",
                "Kedd",
                "Szerda",
                "Csütörtök",
                "Péntek",
                "Szombat",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Már",
                "Ápr",
                "Máj",
                "Jún",
                "Júl",
                "Aug",
                "Szep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Január",
                "Február",
                "Március",
                "Április",
                "Május",
                "Június",
                "Július",
                "Augusztus",
                "Szeptember",
                "Október",
                "November",
                "December",
            ],
        },
        ordinal: function () {
            return ".";
        },
        weekAbbreviation: "Hét",
        scrollTitle: "Görgessen",
        toggleTitle: "Kattintson a váltáshoz",
        rangeSeparator: " - ",
        time_24hr: true,
    };
    fp$o.l10ns.hu = Hungarian;
    fp$o.l10ns;

    var fp$p = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Armenian = {
        weekdays: {
            shorthand: ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"],
            longhand: [
                "Կիրակի",
                "Եկուշաբթի",
                "Երեքշաբթի",
                "Չորեքշաբթի",
                "Հինգշաբթի",
                "Ուրբաթ",
                "Շաբաթ",
            ],
        },
        months: {
            shorthand: [
                "Հնվ",
                "Փտր",
                "Մար",
                "Ապր",
                "Մայ",
                "Հնս",
                "Հլս",
                "Օգս",
                "Սեպ",
                "Հոկ",
                "Նմբ",
                "Դեկ",
            ],
            longhand: [
                "Հունվար",
                "Փետրվար",
                "Մարտ",
                "Ապրիլ",
                "Մայիս",
                "Հունիս",
                "Հուլիս",
                "Օգոստոս",
                "Սեպտեմբեր",
                "Հոկտեմբեր",
                "Նոյեմբեր",
                "Դեկտեմբեր",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "ՇԲՏ",
        scrollTitle: "Ոլորեք՝ մեծացնելու համար",
        toggleTitle: "Սեղմեք՝ փոխելու համար",
        amPM: ["ՄԿ", "ԿՀ"],
        yearAriaLabel: "Տարի",
        monthAriaLabel: "Ամիս",
        hourAriaLabel: "Ժամ",
        minuteAriaLabel: "Րոպե",
        time_24hr: true,
    };
    fp$p.l10ns.hy = Armenian;
    fp$p.l10ns;

    var fp$q = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Indonesian = {
        weekdays: {
            shorthand: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
            longhand: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Mei",
                "Jun",
                "Jul",
                "Agu",
                "Sep",
                "Okt",
                "Nov",
                "Des",
            ],
            longhand: [
                "Januari",
                "Februari",
                "Maret",
                "April",
                "Mei",
                "Juni",
                "Juli",
                "Agustus",
                "September",
                "Oktober",
                "November",
                "Desember",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        time_24hr: true,
        rangeSeparator: " - ",
    };
    fp$q.l10ns.id = Indonesian;
    fp$q.l10ns;

    var fp$r = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Icelandic = {
        weekdays: {
            shorthand: ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"],
            longhand: [
                "Sunnudagur",
                "Mánudagur",
                "Þriðjudagur",
                "Miðvikudagur",
                "Fimmtudagur",
                "Föstudagur",
                "Laugardagur",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Maí",
                "Jún",
                "Júl",
                "Ágú",
                "Sep",
                "Okt",
                "Nóv",
                "Des",
            ],
            longhand: [
                "Janúar",
                "Febrúar",
                "Mars",
                "Apríl",
                "Maí",
                "Júní",
                "Júlí",
                "Ágúst",
                "September",
                "Október",
                "Nóvember",
                "Desember",
            ],
        },
        ordinal: function () {
            return ".";
        },
        firstDayOfWeek: 1,
        rangeSeparator: " til ",
        weekAbbreviation: "vika",
        yearAriaLabel: "Ár",
        time_24hr: true,
    };
    fp$r.l10ns.is = Icelandic;
    fp$r.l10ns;

    var fp$s = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Italian = {
        weekdays: {
            shorthand: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
            longhand: [
                "Domenica",
                "Lunedì",
                "Martedì",
                "Mercoledì",
                "Giovedì",
                "Venerdì",
                "Sabato",
            ],
        },
        months: {
            shorthand: [
                "Gen",
                "Feb",
                "Mar",
                "Apr",
                "Mag",
                "Giu",
                "Lug",
                "Ago",
                "Set",
                "Ott",
                "Nov",
                "Dic",
            ],
            longhand: [
                "Gennaio",
                "Febbraio",
                "Marzo",
                "Aprile",
                "Maggio",
                "Giugno",
                "Luglio",
                "Agosto",
                "Settembre",
                "Ottobre",
                "Novembre",
                "Dicembre",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () { return "°"; },
        rangeSeparator: " al ",
        weekAbbreviation: "Se",
        scrollTitle: "Scrolla per aumentare",
        toggleTitle: "Clicca per cambiare",
        time_24hr: true,
    };
    fp$s.l10ns.it = Italian;
    fp$s.l10ns;

    var fp$t = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Japanese = {
        weekdays: {
            shorthand: ["日", "月", "火", "水", "木", "金", "土"],
            longhand: [
                "日曜日",
                "月曜日",
                "火曜日",
                "水曜日",
                "木曜日",
                "金曜日",
                "土曜日",
            ],
        },
        months: {
            shorthand: [
                "1月",
                "2月",
                "3月",
                "4月",
                "5月",
                "6月",
                "7月",
                "8月",
                "9月",
                "10月",
                "11月",
                "12月",
            ],
            longhand: [
                "1月",
                "2月",
                "3月",
                "4月",
                "5月",
                "6月",
                "7月",
                "8月",
                "9月",
                "10月",
                "11月",
                "12月",
            ],
        },
        time_24hr: true,
        rangeSeparator: " から ",
        monthAriaLabel: "月",
        amPM: ["午前", "午後"],
        yearAriaLabel: "年",
        hourAriaLabel: "時間",
        minuteAriaLabel: "分",
    };
    fp$t.l10ns.ja = Japanese;
    fp$t.l10ns;

    var fp$u = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Georgian = {
        weekdays: {
            shorthand: ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"],
            longhand: [
                "კვირა",
                "ორშაბათი",
                "სამშაბათი",
                "ოთხშაბათი",
                "ხუთშაბათი",
                "პარასკევი",
                "შაბათი",
            ],
        },
        months: {
            shorthand: [
                "იან",
                "თებ",
                "მარ",
                "აპრ",
                "მაი",
                "ივნ",
                "ივლ",
                "აგვ",
                "სექ",
                "ოქტ",
                "ნოე",
                "დეკ",
            ],
            longhand: [
                "იანვარი",
                "თებერვალი",
                "მარტი",
                "აპრილი",
                "მაისი",
                "ივნისი",
                "ივლისი",
                "აგვისტო",
                "სექტემბერი",
                "ოქტომბერი",
                "ნოემბერი",
                "დეკემბერი",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "კვ.",
        scrollTitle: "დასქროლეთ გასადიდებლად",
        toggleTitle: "დააკლიკეთ გადართვისთვის",
        amPM: ["AM", "PM"],
        yearAriaLabel: "წელი",
        time_24hr: true,
    };
    fp$u.l10ns.ka = Georgian;
    fp$u.l10ns;

    var fp$v = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Korean = {
        weekdays: {
            shorthand: ["일", "월", "화", "수", "목", "금", "토"],
            longhand: [
                "일요일",
                "월요일",
                "화요일",
                "수요일",
                "목요일",
                "금요일",
                "토요일",
            ],
        },
        months: {
            shorthand: [
                "1월",
                "2월",
                "3월",
                "4월",
                "5월",
                "6월",
                "7월",
                "8월",
                "9월",
                "10월",
                "11월",
                "12월",
            ],
            longhand: [
                "1월",
                "2월",
                "3월",
                "4월",
                "5월",
                "6월",
                "7월",
                "8월",
                "9월",
                "10월",
                "11월",
                "12월",
            ],
        },
        ordinal: function () {
            return "일";
        },
        rangeSeparator: " ~ ",
        amPM: ["오전", "오후"],
    };
    fp$v.l10ns.ko = Korean;
    fp$v.l10ns;

    var fp$w = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Khmer = {
        weekdays: {
            shorthand: ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស.", "សុក្រ", "សៅរ៍"],
            longhand: [
                "អាទិត្យ",
                "ចន្ទ",
                "អង្គារ",
                "ពុធ",
                "ព្រហស្បតិ៍",
                "សុក្រ",
                "សៅរ៍",
            ],
        },
        months: {
            shorthand: [
                "មករា",
                "កុម្ភះ",
                "មីនា",
                "មេសា",
                "ឧសភា",
                "មិថុនា",
                "កក្កដា",
                "សីហា",
                "កញ្ញា",
                "តុលា",
                "វិច្ឆិកា",
                "ធ្នូ",
            ],
            longhand: [
                "មករា",
                "កុម្ភះ",
                "មីនា",
                "មេសា",
                "ឧសភា",
                "មិថុនា",
                "កក្កដា",
                "សីហា",
                "កញ្ញា",
                "តុលា",
                "វិច្ឆិកា",
                "ធ្នូ",
            ],
        },
        ordinal: function () {
            return "";
        },
        firstDayOfWeek: 1,
        rangeSeparator: " ដល់ ",
        weekAbbreviation: "សប្តាហ៍",
        scrollTitle: "រំកិលដើម្បីបង្កើន",
        toggleTitle: "ចុចដើម្បីផ្លាស់ប្ដូរ",
        yearAriaLabel: "ឆ្នាំ",
        time_24hr: true,
    };
    fp$w.l10ns.km = Khmer;
    fp$w.l10ns;

    var fp$x = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Kazakh = {
        weekdays: {
            shorthand: ["Жс", "Дс", "Сc", "Ср", "Бс", "Жм", "Сб"],
            longhand: [
                "Жексенбi",
                "Дүйсенбi",
                "Сейсенбi",
                "Сәрсенбi",
                "Бейсенбi",
                "Жұма",
                "Сенбi",
            ],
        },
        months: {
            shorthand: [
                "Қаң",
                "Ақп",
                "Нау",
                "Сәу",
                "Мам",
                "Мау",
                "Шiл",
                "Там",
                "Қыр",
                "Қаз",
                "Қар",
                "Жел",
            ],
            longhand: [
                "Қаңтар",
                "Ақпан",
                "Наурыз",
                "Сәуiр",
                "Мамыр",
                "Маусым",
                "Шiлде",
                "Тамыз",
                "Қыркүйек",
                "Қазан",
                "Қараша",
                "Желтоқсан",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "Апта",
        scrollTitle: "Үлкейту үшін айналдырыңыз",
        toggleTitle: "Ауыстыру үшін басыңыз",
        amPM: ["ТД", "ТК"],
        yearAriaLabel: "Жыл",
    };
    fp$x.l10ns.kz = Kazakh;
    fp$x.l10ns;

    var fp$y = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Lithuanian = {
        weekdays: {
            shorthand: ["S", "Pr", "A", "T", "K", "Pn", "Š"],
            longhand: [
                "Sekmadienis",
                "Pirmadienis",
                "Antradienis",
                "Trečiadienis",
                "Ketvirtadienis",
                "Penktadienis",
                "Šeštadienis",
            ],
        },
        months: {
            shorthand: [
                "Sau",
                "Vas",
                "Kov",
                "Bal",
                "Geg",
                "Bir",
                "Lie",
                "Rgp",
                "Rgs",
                "Spl",
                "Lap",
                "Grd",
            ],
            longhand: [
                "Sausis",
                "Vasaris",
                "Kovas",
                "Balandis",
                "Gegužė",
                "Birželis",
                "Liepa",
                "Rugpjūtis",
                "Rugsėjis",
                "Spalis",
                "Lapkritis",
                "Gruodis",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "-a";
        },
        rangeSeparator: " iki ",
        weekAbbreviation: "Sav",
        scrollTitle: "Keisti laiką pelės rateliu",
        toggleTitle: "Perjungti laiko formatą",
        time_24hr: true,
    };
    fp$y.l10ns.lt = Lithuanian;
    fp$y.l10ns;

    var fp$z = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Latvian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["Sv", "Pr", "Ot", "Tr", "Ce", "Pk", "Se"],
            longhand: [
                "Svētdiena",
                "Pirmdiena",
                "Otrdiena",
                "Trešdiena",
                "Ceturtdiena",
                "Piektdiena",
                "Sestdiena",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Mai",
                "Jūn",
                "Jūl",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Janvāris",
                "Februāris",
                "Marts",
                "Aprīlis",
                "Maijs",
                "Jūnijs",
                "Jūlijs",
                "Augusts",
                "Septembris",
                "Oktobris",
                "Novembris",
                "Decembris",
            ],
        },
        rangeSeparator: " līdz ",
        time_24hr: true,
    };
    fp$z.l10ns.lv = Latvian;
    fp$z.l10ns;

    var fp$A = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Macedonian = {
        weekdays: {
            shorthand: ["Не", "По", "Вт", "Ср", "Че", "Пе", "Са"],
            longhand: [
                "Недела",
                "Понеделник",
                "Вторник",
                "Среда",
                "Четврток",
                "Петок",
                "Сабота",
            ],
        },
        months: {
            shorthand: [
                "Јан",
                "Фев",
                "Мар",
                "Апр",
                "Мај",
                "Јун",
                "Јул",
                "Авг",
                "Сеп",
                "Окт",
                "Ное",
                "Дек",
            ],
            longhand: [
                "Јануари",
                "Февруари",
                "Март",
                "Април",
                "Мај",
                "Јуни",
                "Јули",
                "Август",
                "Септември",
                "Октомври",
                "Ноември",
                "Декември",
            ],
        },
        firstDayOfWeek: 1,
        weekAbbreviation: "Нед.",
        rangeSeparator: " до ",
        time_24hr: true,
    };
    fp$A.l10ns.mk = Macedonian;
    fp$A.l10ns;

    var fp$B = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Mongolian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"],
            longhand: ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"],
        },
        months: {
            shorthand: [
                "1-р сар",
                "2-р сар",
                "3-р сар",
                "4-р сар",
                "5-р сар",
                "6-р сар",
                "7-р сар",
                "8-р сар",
                "9-р сар",
                "10-р сар",
                "11-р сар",
                "12-р сар",
            ],
            longhand: [
                "Нэгдүгээр сар",
                "Хоёрдугаар сар",
                "Гуравдугаар сар",
                "Дөрөвдүгээр сар",
                "Тавдугаар сар",
                "Зургаадугаар сар",
                "Долдугаар сар",
                "Наймдугаар сар",
                "Есдүгээр сар",
                "Аравдугаар сар",
                "Арваннэгдүгээр сар",
                "Арванхоёрдугаар сар",
            ],
        },
        rangeSeparator: "-с ",
        time_24hr: true,
    };
    fp$B.l10ns.mn = Mongolian;
    fp$B.l10ns;

    var fp$C = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Malaysian = {
        weekdays: {
            shorthand: ["Aha", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"],
            longhand: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mac",
                "Apr",
                "Mei",
                "Jun",
                "Jul",
                "Ogo",
                "Sep",
                "Okt",
                "Nov",
                "Dis",
            ],
            longhand: [
                "Januari",
                "Februari",
                "Mac",
                "April",
                "Mei",
                "Jun",
                "Julai",
                "Ogos",
                "September",
                "Oktober",
                "November",
                "Disember",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
    };
    fp$C.l10ns;

    var fp$D = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Burmese = {
        weekdays: {
            shorthand: ["နွေ", "လာ", "ဂါ", "ဟူး", "ကြာ", "သော", "နေ"],
            longhand: [
                "တနင်္ဂနွေ",
                "တနင်္လာ",
                "အင်္ဂါ",
                "ဗုဒ္ဓဟူး",
                "ကြာသပတေး",
                "သောကြာ",
                "စနေ",
            ],
        },
        months: {
            shorthand: [
                "ဇန်",
                "ဖေ",
                "မတ်",
                "ပြီ",
                "မေ",
                "ဇွန်",
                "လိုင်",
                "သြ",
                "စက်",
                "အောက်",
                "နို",
                "ဒီ",
            ],
            longhand: [
                "ဇန်နဝါရီ",
                "ဖေဖော်ဝါရီ",
                "မတ်",
                "ဧပြီ",
                "မေ",
                "ဇွန်",
                "ဇူလိုင်",
                "သြဂုတ်",
                "စက်တင်ဘာ",
                "အောက်တိုဘာ",
                "နိုဝင်ဘာ",
                "ဒီဇင်ဘာ",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        time_24hr: true,
    };
    fp$D.l10ns.my = Burmese;
    fp$D.l10ns;

    var fp$E = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Dutch = {
        weekdays: {
            shorthand: ["zo", "ma", "di", "wo", "do", "vr", "za"],
            longhand: [
                "zondag",
                "maandag",
                "dinsdag",
                "woensdag",
                "donderdag",
                "vrijdag",
                "zaterdag",
            ],
        },
        months: {
            shorthand: [
                "jan",
                "feb",
                "mrt",
                "apr",
                "mei",
                "jun",
                "jul",
                "aug",
                "sept",
                "okt",
                "nov",
                "dec",
            ],
            longhand: [
                "januari",
                "februari",
                "maart",
                "april",
                "mei",
                "juni",
                "juli",
                "augustus",
                "september",
                "oktober",
                "november",
                "december",
            ],
        },
        firstDayOfWeek: 1,
        weekAbbreviation: "wk",
        rangeSeparator: " t/m ",
        scrollTitle: "Scroll voor volgende / vorige",
        toggleTitle: "Klik om te wisselen",
        time_24hr: true,
        ordinal: function (nth) {
            if (nth === 1 || nth === 8 || nth >= 20)
                return "ste";
            return "de";
        },
    };
    fp$E.l10ns.nl = Dutch;
    fp$E.l10ns;

    var fp$F = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var NorwegianNynorsk = {
        weekdays: {
            shorthand: ["Sø.", "Må.", "Ty.", "On.", "To.", "Fr.", "La."],
            longhand: [
                "Søndag",
                "Måndag",
                "Tysdag",
                "Onsdag",
                "Torsdag",
                "Fredag",
                "Laurdag",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mars",
                "Apr",
                "Mai",
                "Juni",
                "Juli",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Des",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Mars",
                "April",
                "Mai",
                "Juni",
                "Juli",
                "August",
                "September",
                "Oktober",
                "November",
                "Desember",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " til ",
        weekAbbreviation: "Veke",
        scrollTitle: "Scroll for å endre",
        toggleTitle: "Klikk for å veksle",
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$F.l10ns.nn = NorwegianNynorsk;
    fp$F.l10ns;

    var fp$G = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Norwegian = {
        weekdays: {
            shorthand: ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"],
            longhand: [
                "Søndag",
                "Mandag",
                "Tirsdag",
                "Onsdag",
                "Torsdag",
                "Fredag",
                "Lørdag",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Mai",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Des",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Mars",
                "April",
                "Mai",
                "Juni",
                "Juli",
                "August",
                "September",
                "Oktober",
                "November",
                "Desember",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " til ",
        weekAbbreviation: "Uke",
        scrollTitle: "Scroll for å endre",
        toggleTitle: "Klikk for å veksle",
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$G.l10ns.no = Norwegian;
    fp$G.l10ns;

    var fp$H = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Punjabi = {
        weekdays: {
            shorthand: ["ਐਤ", "ਸੋਮ", "ਮੰਗਲ", "ਬੁੱਧ", "ਵੀਰ", "ਸ਼ੁੱਕਰ", "ਸ਼ਨਿੱਚਰ"],
            longhand: [
                "ਐਤਵਾਰ",
                "ਸੋਮਵਾਰ",
                "ਮੰਗਲਵਾਰ",
                "ਬੁੱਧਵਾਰ",
                "ਵੀਰਵਾਰ",
                "ਸ਼ੁੱਕਰਵਾਰ",
                "ਸ਼ਨਿੱਚਰਵਾਰ",
            ],
        },
        months: {
            shorthand: [
                "ਜਨ",
                "ਫ਼ਰ",
                "ਮਾਰ",
                "ਅਪ੍ਰੈ",
                "ਮਈ",
                "ਜੂਨ",
                "ਜੁਲਾ",
                "ਅਗ",
                "ਸਤੰ",
                "ਅਕ",
                "ਨਵੰ",
                "ਦਸੰ",
            ],
            longhand: [
                "ਜਨਵਰੀ",
                "ਫ਼ਰਵਰੀ",
                "ਮਾਰਚ",
                "ਅਪ੍ਰੈਲ",
                "ਮਈ",
                "ਜੂਨ",
                "ਜੁਲਾਈ",
                "ਅਗਸਤ",
                "ਸਤੰਬਰ",
                "ਅਕਤੂਬਰ",
                "ਨਵੰਬਰ",
                "ਦਸੰਬਰ",
            ],
        },
        time_24hr: true,
    };
    fp$H.l10ns.pa = Punjabi;
    fp$H.l10ns;

    var fp$I = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Polish = {
        weekdays: {
            shorthand: ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"],
            longhand: [
                "Niedziela",
                "Poniedziałek",
                "Wtorek",
                "Środa",
                "Czwartek",
                "Piątek",
                "Sobota",
            ],
        },
        months: {
            shorthand: [
                "Sty",
                "Lut",
                "Mar",
                "Kwi",
                "Maj",
                "Cze",
                "Lip",
                "Sie",
                "Wrz",
                "Paź",
                "Lis",
                "Gru",
            ],
            longhand: [
                "Styczeń",
                "Luty",
                "Marzec",
                "Kwiecień",
                "Maj",
                "Czerwiec",
                "Lipiec",
                "Sierpień",
                "Wrzesień",
                "Październik",
                "Listopad",
                "Grudzień",
            ],
        },
        rangeSeparator: " do ",
        weekAbbreviation: "tydz.",
        scrollTitle: "Przewiń, aby zwiększyć",
        toggleTitle: "Kliknij, aby przełączyć",
        firstDayOfWeek: 1,
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$I.l10ns.pl = Polish;
    fp$I.l10ns;

    var fp$J = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Portuguese = {
        weekdays: {
            shorthand: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
            longhand: [
                "Domingo",
                "Segunda-feira",
                "Terça-feira",
                "Quarta-feira",
                "Quinta-feira",
                "Sexta-feira",
                "Sábado",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Fev",
                "Mar",
                "Abr",
                "Mai",
                "Jun",
                "Jul",
                "Ago",
                "Set",
                "Out",
                "Nov",
                "Dez",
            ],
            longhand: [
                "Janeiro",
                "Fevereiro",
                "Março",
                "Abril",
                "Maio",
                "Junho",
                "Julho",
                "Agosto",
                "Setembro",
                "Outubro",
                "Novembro",
                "Dezembro",
            ],
        },
        rangeSeparator: " até ",
        time_24hr: true,
    };
    fp$J.l10ns.pt = Portuguese;
    fp$J.l10ns;

    var fp$K = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Romanian = {
        weekdays: {
            shorthand: ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"],
            longhand: [
                "Duminică",
                "Luni",
                "Marți",
                "Miercuri",
                "Joi",
                "Vineri",
                "Sâmbătă",
            ],
        },
        months: {
            shorthand: [
                "Ian",
                "Feb",
                "Mar",
                "Apr",
                "Mai",
                "Iun",
                "Iul",
                "Aug",
                "Sep",
                "Oct",
                "Noi",
                "Dec",
            ],
            longhand: [
                "Ianuarie",
                "Februarie",
                "Martie",
                "Aprilie",
                "Mai",
                "Iunie",
                "Iulie",
                "August",
                "Septembrie",
                "Octombrie",
                "Noiembrie",
                "Decembrie",
            ],
        },
        firstDayOfWeek: 1,
        time_24hr: true,
        ordinal: function () {
            return "";
        },
    };
    fp$K.l10ns.ro = Romanian;
    fp$K.l10ns;

    var fp$L = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Russian = {
        weekdays: {
            shorthand: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
            longhand: [
                "Воскресенье",
                "Понедельник",
                "Вторник",
                "Среда",
                "Четверг",
                "Пятница",
                "Суббота",
            ],
        },
        months: {
            shorthand: [
                "Янв",
                "Фев",
                "Март",
                "Апр",
                "Май",
                "Июнь",
                "Июль",
                "Авг",
                "Сен",
                "Окт",
                "Ноя",
                "Дек",
            ],
            longhand: [
                "Январь",
                "Февраль",
                "Март",
                "Апрель",
                "Май",
                "Июнь",
                "Июль",
                "Август",
                "Сентябрь",
                "Октябрь",
                "Ноябрь",
                "Декабрь",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "Нед.",
        scrollTitle: "Прокрутите для увеличения",
        toggleTitle: "Нажмите для переключения",
        amPM: ["ДП", "ПП"],
        yearAriaLabel: "Год",
        time_24hr: true,
    };
    fp$L.l10ns.ru = Russian;
    fp$L.l10ns;

    var fp$M = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Sinhala = {
        weekdays: {
            shorthand: ["ඉ", "ස", "අ", "බ", "බ්‍ර", "සි", "සෙ"],
            longhand: [
                "ඉරිදා",
                "සඳුදා",
                "අඟහරුවාදා",
                "බදාදා",
                "බ්‍රහස්පතින්දා",
                "සිකුරාදා",
                "සෙනසුරාදා",
            ],
        },
        months: {
            shorthand: [
                "ජන",
                "පෙබ",
                "මාර්",
                "අප්‍රේ",
                "මැයි",
                "ජුනි",
                "ජූලි",
                "අගෝ",
                "සැප්",
                "ඔක්",
                "නොවැ",
                "දෙසැ",
            ],
            longhand: [
                "ජනවාරි",
                "පෙබරවාරි",
                "මාර්තු",
                "අප්‍රේල්",
                "මැයි",
                "ජුනි",
                "ජූලි",
                "අගෝස්තු",
                "සැප්තැම්බර්",
                "ඔක්තෝබර්",
                "නොවැම්බර්",
                "දෙසැම්බර්",
            ],
        },
        time_24hr: true,
    };
    fp$M.l10ns.si = Sinhala;
    fp$M.l10ns;

    var fp$N = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Slovak = {
        weekdays: {
            shorthand: ["Ned", "Pon", "Ut", "Str", "Štv", "Pia", "Sob"],
            longhand: [
                "Nedeľa",
                "Pondelok",
                "Utorok",
                "Streda",
                "Štvrtok",
                "Piatok",
                "Sobota",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Máj",
                "Jún",
                "Júl",
                "Aug",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Január",
                "Február",
                "Marec",
                "Apríl",
                "Máj",
                "Jún",
                "Júl",
                "August",
                "September",
                "Október",
                "November",
                "December",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " do ",
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$N.l10ns.sk = Slovak;
    fp$N.l10ns;

    var fp$O = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Slovenian = {
        weekdays: {
            shorthand: ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"],
            longhand: [
                "Nedelja",
                "Ponedeljek",
                "Torek",
                "Sreda",
                "Četrtek",
                "Petek",
                "Sobota",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Maj",
                "Jun",
                "Jul",
                "Avg",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Marec",
                "April",
                "Maj",
                "Junij",
                "Julij",
                "Avgust",
                "September",
                "Oktober",
                "November",
                "December",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " do ",
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$O.l10ns.sl = Slovenian;
    fp$O.l10ns;

    var fp$P = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Albanian = {
        weekdays: {
            shorthand: ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"],
            longhand: [
                "E Diel",
                "E Hënë",
                "E Martë",
                "E Mërkurë",
                "E Enjte",
                "E Premte",
                "E Shtunë",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Shk",
                "Mar",
                "Pri",
                "Maj",
                "Qer",
                "Kor",
                "Gus",
                "Sht",
                "Tet",
                "Nën",
                "Dhj",
            ],
            longhand: [
                "Janar",
                "Shkurt",
                "Mars",
                "Prill",
                "Maj",
                "Qershor",
                "Korrik",
                "Gusht",
                "Shtator",
                "Tetor",
                "Nëntor",
                "Dhjetor",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " deri ",
        weekAbbreviation: "Java",
        yearAriaLabel: "Viti",
        monthAriaLabel: "Muaji",
        hourAriaLabel: "Ora",
        minuteAriaLabel: "Minuta",
        time_24hr: true,
    };
    fp$P.l10ns.sq = Albanian;
    fp$P.l10ns;

    var fp$Q = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Serbian = {
        weekdays: {
            shorthand: ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"],
            longhand: [
                "Nedelja",
                "Ponedeljak",
                "Utorak",
                "Sreda",
                "Četvrtak",
                "Petak",
                "Subota",
            ],
        },
        months: {
            shorthand: [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "Maj",
                "Jun",
                "Jul",
                "Avg",
                "Sep",
                "Okt",
                "Nov",
                "Dec",
            ],
            longhand: [
                "Januar",
                "Februar",
                "Mart",
                "April",
                "Maj",
                "Jun",
                "Jul",
                "Avgust",
                "Septembar",
                "Oktobar",
                "Novembar",
                "Decembar",
            ],
        },
        firstDayOfWeek: 1,
        weekAbbreviation: "Ned.",
        rangeSeparator: " do ",
        time_24hr: true,
    };
    fp$Q.l10ns.sr = Serbian;
    fp$Q.l10ns;

    var fp$R = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Swedish = {
        firstDayOfWeek: 1,
        weekAbbreviation: "v",
        weekdays: {
            shorthand: ["sön", "mån", "tis", "ons", "tor", "fre", "lör"],
            longhand: [
                "söndag",
                "måndag",
                "tisdag",
                "onsdag",
                "torsdag",
                "fredag",
                "lördag",
            ],
        },
        months: {
            shorthand: [
                "jan",
                "feb",
                "mar",
                "apr",
                "maj",
                "jun",
                "jul",
                "aug",
                "sep",
                "okt",
                "nov",
                "dec",
            ],
            longhand: [
                "januari",
                "februari",
                "mars",
                "april",
                "maj",
                "juni",
                "juli",
                "augusti",
                "september",
                "oktober",
                "november",
                "december",
            ],
        },
        rangeSeparator: " till ",
        time_24hr: true,
        ordinal: function () {
            return ".";
        },
    };
    fp$R.l10ns.sv = Swedish;
    fp$R.l10ns;

    var fp$S = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Thai = {
        weekdays: {
            shorthand: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
            longhand: [
                "อาทิตย์",
                "จันทร์",
                "อังคาร",
                "พุธ",
                "พฤหัสบดี",
                "ศุกร์",
                "เสาร์",
            ],
        },
        months: {
            shorthand: [
                "ม.ค.",
                "ก.พ.",
                "มี.ค.",
                "เม.ย.",
                "พ.ค.",
                "มิ.ย.",
                "ก.ค.",
                "ส.ค.",
                "ก.ย.",
                "ต.ค.",
                "พ.ย.",
                "ธ.ค.",
            ],
            longhand: [
                "มกราคม",
                "กุมภาพันธ์",
                "มีนาคม",
                "เมษายน",
                "พฤษภาคม",
                "มิถุนายน",
                "กรกฎาคม",
                "สิงหาคม",
                "กันยายน",
                "ตุลาคม",
                "พฤศจิกายน",
                "ธันวาคม",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " ถึง ",
        scrollTitle: "เลื่อนเพื่อเพิ่มหรือลด",
        toggleTitle: "คลิกเพื่อเปลี่ยน",
        time_24hr: true,
        ordinal: function () {
            return "";
        },
    };
    fp$S.l10ns.th = Thai;
    fp$S.l10ns;

    var fp$T = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Turkish = {
        weekdays: {
            shorthand: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
            longhand: [
                "Pazar",
                "Pazartesi",
                "Salı",
                "Çarşamba",
                "Perşembe",
                "Cuma",
                "Cumartesi",
            ],
        },
        months: {
            shorthand: [
                "Oca",
                "Şub",
                "Mar",
                "Nis",
                "May",
                "Haz",
                "Tem",
                "Ağu",
                "Eyl",
                "Eki",
                "Kas",
                "Ara",
            ],
            longhand: [
                "Ocak",
                "Şubat",
                "Mart",
                "Nisan",
                "Mayıs",
                "Haziran",
                "Temmuz",
                "Ağustos",
                "Eylül",
                "Ekim",
                "Kasım",
                "Aralık",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return ".";
        },
        rangeSeparator: " - ",
        weekAbbreviation: "Hf",
        scrollTitle: "Artırmak için kaydırın",
        toggleTitle: "Aç/Kapa",
        amPM: ["ÖÖ", "ÖS"],
        time_24hr: true,
    };
    fp$T.l10ns.tr = Turkish;
    fp$T.l10ns;

    var fp$U = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Ukrainian = {
        firstDayOfWeek: 1,
        weekdays: {
            shorthand: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
            longhand: [
                "Неділя",
                "Понеділок",
                "Вівторок",
                "Середа",
                "Четвер",
                "П'ятниця",
                "Субота",
            ],
        },
        months: {
            shorthand: [
                "Січ",
                "Лют",
                "Бер",
                "Кві",
                "Тра",
                "Чер",
                "Лип",
                "Сер",
                "Вер",
                "Жов",
                "Лис",
                "Гру",
            ],
            longhand: [
                "Січень",
                "Лютий",
                "Березень",
                "Квітень",
                "Травень",
                "Червень",
                "Липень",
                "Серпень",
                "Вересень",
                "Жовтень",
                "Листопад",
                "Грудень",
            ],
        },
        time_24hr: true,
    };
    fp$U.l10ns.uk = Ukrainian;
    fp$U.l10ns;

    var fp$V = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Uzbek = {
        weekdays: {
            shorthand: ["Якш", "Душ", "Сеш", "Чор", "Пай", "Жум", "Шан"],
            longhand: [
                "Якшанба",
                "Душанба",
                "Сешанба",
                "Чоршанба",
                "Пайшанба",
                "Жума",
                "Шанба",
            ],
        },
        months: {
            shorthand: [
                "Янв",
                "Фев",
                "Мар",
                "Апр",
                "Май",
                "Июн",
                "Июл",
                "Авг",
                "Сен",
                "Окт",
                "Ноя",
                "Дек",
            ],
            longhand: [
                "Январ",
                "Феврал",
                "Март",
                "Апрел",
                "Май",
                "Июн",
                "Июл",
                "Август",
                "Сентябр",
                "Октябр",
                "Ноябр",
                "Декабр",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "Ҳафта",
        scrollTitle: "Катталаштириш учун айлантиринг",
        toggleTitle: "Ўтиш учун босинг",
        amPM: ["AM", "PM"],
        yearAriaLabel: "Йил",
        time_24hr: true,
    };
    fp$V.l10ns.uz = Uzbek;
    fp$V.l10ns;

    var fp$W = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var UzbekLatin = {
        weekdays: {
            shorthand: ["Ya", "Du", "Se", "Cho", "Pa", "Ju", "Sha"],
            longhand: [
                "Yakshanba",
                "Dushanba",
                "Seshanba",
                "Chorshanba",
                "Payshanba",
                "Juma",
                "Shanba",
            ],
        },
        months: {
            shorthand: [
                "Yan",
                "Fev",
                "Mar",
                "Apr",
                "May",
                "Iyun",
                "Iyul",
                "Avg",
                "Sen",
                "Okt",
                "Noy",
                "Dek",
            ],
            longhand: [
                "Yanvar",
                "Fevral",
                "Mart",
                "Aprel",
                "May",
                "Iyun",
                "Iyul",
                "Avgust",
                "Sentabr",
                "Oktabr",
                "Noyabr",
                "Dekabr",
            ],
        },
        firstDayOfWeek: 1,
        ordinal: function () {
            return "";
        },
        rangeSeparator: " — ",
        weekAbbreviation: "Hafta",
        scrollTitle: "Kattalashtirish uchun aylantiring",
        toggleTitle: "O‘tish uchun bosing",
        amPM: ["AM", "PM"],
        yearAriaLabel: "Yil",
        time_24hr: true,
    };
    fp$W.l10ns["uz_latn"] = UzbekLatin;
    fp$W.l10ns;

    var fp$X = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Vietnamese = {
        weekdays: {
            shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
            longhand: [
                "Chủ nhật",
                "Thứ hai",
                "Thứ ba",
                "Thứ tư",
                "Thứ năm",
                "Thứ sáu",
                "Thứ bảy",
            ],
        },
        months: {
            shorthand: [
                "Th1",
                "Th2",
                "Th3",
                "Th4",
                "Th5",
                "Th6",
                "Th7",
                "Th8",
                "Th9",
                "Th10",
                "Th11",
                "Th12",
            ],
            longhand: [
                "Tháng một",
                "Tháng hai",
                "Tháng ba",
                "Tháng tư",
                "Tháng năm",
                "Tháng sáu",
                "Tháng bảy",
                "Tháng tám",
                "Tháng chín",
                "Tháng mười",
                "Tháng mười một",
                "Tháng mười hai",
            ],
        },
        firstDayOfWeek: 1,
        rangeSeparator: " đến ",
    };
    fp$X.l10ns.vn = Vietnamese;
    fp$X.l10ns;

    var fp$Y = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var Mandarin = {
        weekdays: {
            shorthand: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
            longhand: [
                "星期日",
                "星期一",
                "星期二",
                "星期三",
                "星期四",
                "星期五",
                "星期六",
            ],
        },
        months: {
            shorthand: [
                "一月",
                "二月",
                "三月",
                "四月",
                "五月",
                "六月",
                "七月",
                "八月",
                "九月",
                "十月",
                "十一月",
                "十二月",
            ],
            longhand: [
                "一月",
                "二月",
                "三月",
                "四月",
                "五月",
                "六月",
                "七月",
                "八月",
                "九月",
                "十月",
                "十一月",
                "十二月",
            ],
        },
        rangeSeparator: " 至 ",
        weekAbbreviation: "周",
        scrollTitle: "滚动切换",
        toggleTitle: "点击切换 12/24 小时时制",
    };
    fp$Y.l10ns.zh = Mandarin;
    fp$Y.l10ns;

    var fp$Z = typeof window !== "undefined" && window.flatpickr !== undefined
        ? window.flatpickr
        : {
            l10ns: {},
        };
    var MandarinTraditional = {
        weekdays: {
            shorthand: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"],
            longhand: [
                "星期日",
                "星期一",
                "星期二",
                "星期三",
                "星期四",
                "星期五",
                "星期六",
            ],
        },
        months: {
            shorthand: [
                "一月",
                "二月",
                "三月",
                "四月",
                "五月",
                "六月",
                "七月",
                "八月",
                "九月",
                "十月",
                "十一月",
                "十二月",
            ],
            longhand: [
                "一月",
                "二月",
                "三月",
                "四月",
                "五月",
                "六月",
                "七月",
                "八月",
                "九月",
                "十月",
                "十一月",
                "十二月",
            ],
        },
        rangeSeparator: " 至 ",
        weekAbbreviation: "週",
        scrollTitle: "滾動切換",
        toggleTitle: "點擊切換 12/24 小時時制",
    };
    fp$Z.l10ns.zh_tw = MandarinTraditional;
    fp$Z.l10ns;

    var l10n = {
        ar: Arabic,
        at: Austria,
        az: Azerbaijan,
        be: Belarusian,
        bg: Bulgarian,
        bn: Bangla,
        bs: Bosnian,
        ca: Catalan,
        ckb: Kurdish,
        cat: Catalan,
        cs: Czech,
        cy: Welsh,
        da: Danish,
        de: German,
        default: __assign({}, english),
        en: english,
        eo: Esperanto,
        es: Spanish,
        et: Estonian,
        fa: Persian,
        fi: Finnish,
        fo: Faroese,
        fr: French,
        gr: Greek,
        he: Hebrew,
        hi: Hindi,
        hr: Croatian,
        hu: Hungarian,
        hy: Armenian,
        id: Indonesian,
        is: Icelandic,
        it: Italian,
        ja: Japanese,
        ka: Georgian,
        ko: Korean,
        km: Khmer,
        kz: Kazakh,
        lt: Lithuanian,
        lv: Latvian,
        mk: Macedonian,
        mn: Mongolian,
        ms: Malaysian,
        my: Burmese,
        nl: Dutch,
        nn: NorwegianNynorsk,
        no: Norwegian,
        pa: Punjabi,
        pl: Polish,
        pt: Portuguese,
        ro: Romanian,
        ru: Russian,
        si: Sinhala,
        sk: Slovak,
        sl: Slovenian,
        sq: Albanian,
        sr: Serbian,
        sv: Swedish,
        th: Thai,
        tr: Turkish,
        uk: Ukrainian,
        vn: Vietnamese,
        zh: Mandarin,
        zh_tw: MandarinTraditional,
        uz: Uzbek,
        uz_latn: UzbekLatin,
    };

    exports.default = l10n;

    Object.defineProperty(exports, '__esModule', { value: true });

})));

return module.exports.default; })();
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

})();
(() => {
const module = { exports: {} }; const exports = module.exports;
!function(d,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((d="undefined"!=typeof globalThis?globalThis:d||self).libphonenumber={})}(this,function(d){"use strict";var t={version:4,country_calling_codes:{1:["US","AG","AI","AS","BB","BM","BS","CA","DM","DO","GD","GU","JM","KN","KY","LC","MP","MS","PR","SX","TC","TT","VC","VG","VI"],7:["RU","KZ"],20:["EG"],27:["ZA"],30:["GR"],31:["NL"],32:["BE"],33:["FR"],34:["ES"],36:["HU"],39:["IT","VA"],40:["RO"],41:["CH"],43:["AT"],44:["GB","GG","IM","JE"],45:["DK"],46:["SE"],47:["NO","SJ"],48:["PL"],49:["DE"],51:["PE"],52:["MX"],53:["CU"],54:["AR"],55:["BR"],56:["CL"],57:["CO"],58:["VE"],60:["MY"],61:["AU","CC","CX"],62:["ID"],63:["PH"],64:["NZ"],65:["SG"],66:["TH"],81:["JP"],82:["KR"],84:["VN"],86:["CN"],90:["TR"],91:["IN"],92:["PK"],93:["AF"],94:["LK"],95:["MM"],98:["IR"],211:["SS"],212:["MA","EH"],213:["DZ"],216:["TN"],218:["LY"],220:["GM"],221:["SN"],222:["MR"],223:["ML"],224:["GN"],225:["CI"],226:["BF"],227:["NE"],228:["TG"],229:["BJ"],230:["MU"],231:["LR"],232:["SL"],233:["GH"],234:["NG"],235:["TD"],236:["CF"],237:["CM"],238:["CV"],239:["ST"],240:["GQ"],241:["GA"],242:["CG"],243:["CD"],244:["AO"],245:["GW"],246:["IO"],247:["AC"],248:["SC"],249:["SD"],250:["RW"],251:["ET"],252:["SO"],253:["DJ"],254:["KE"],255:["TZ"],256:["UG"],257:["BI"],258:["MZ"],260:["ZM"],261:["MG"],262:["RE","YT"],263:["ZW"],264:["NA"],265:["MW"],266:["LS"],267:["BW"],268:["SZ"],269:["KM"],290:["SH","TA"],291:["ER"],297:["AW"],298:["FO"],299:["GL"],350:["GI"],351:["PT"],352:["LU"],353:["IE"],354:["IS"],355:["AL"],356:["MT"],357:["CY"],358:["FI","AX"],359:["BG"],370:["LT"],371:["LV"],372:["EE"],373:["MD"],374:["AM"],375:["BY"],376:["AD"],377:["MC"],378:["SM"],380:["UA"],381:["RS"],382:["ME"],383:["XK"],385:["HR"],386:["SI"],387:["BA"],389:["MK"],420:["CZ"],421:["SK"],423:["LI"],500:["FK"],501:["BZ"],502:["GT"],503:["SV"],504:["HN"],505:["NI"],506:["CR"],507:["PA"],508:["PM"],509:["HT"],590:["GP","BL","MF"],591:["BO"],592:["GY"],593:["EC"],594:["GF"],595:["PY"],596:["MQ"],597:["SR"],598:["UY"],599:["CW","BQ"],670:["TL"],672:["NF"],673:["BN"],674:["NR"],675:["PG"],676:["TO"],677:["SB"],678:["VU"],679:["FJ"],680:["PW"],681:["WF"],682:["CK"],683:["NU"],685:["WS"],686:["KI"],687:["NC"],688:["TV"],689:["PF"],690:["TK"],691:["FM"],692:["MH"],850:["KP"],852:["HK"],853:["MO"],855:["KH"],856:["LA"],880:["BD"],886:["TW"],960:["MV"],961:["LB"],962:["JO"],963:["SY"],964:["IQ"],965:["KW"],966:["SA"],967:["YE"],968:["OM"],970:["PS"],971:["AE"],972:["IL"],973:["BH"],974:["QA"],975:["BT"],976:["MN"],977:["NP"],992:["TJ"],993:["TM"],994:["AZ"],995:["GE"],996:["KG"],998:["UZ"]},countries:{AC:["247","00","(?:[01589]\\d|[2-467])\\d{4}",[5,6],0,0,0,0,0,0,0,[["6\\d{4}",[5]],["[2-47]\\d{4}",[5]],0,0,0,0,["(?:0[1-9]|[1589]\\d)\\d{4}",[6]]]],AD:["376","00","(?:1|6\\d)\\d{7}|[135-9]\\d{5}",[6,8,9],[["(\\d{3})(\\d{3})","$1 $2",["[135-9]"]],["(\\d{4})(\\d{4})","$1 $2",["1"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["6"]]],0,0,0,0,0,0,[["[78]\\d{5}",[6]],["690\\d{6}|[356]\\d{5}",[6,9]],["180[02]\\d{4}",[8]],["[19]\\d{5}",[6]]]],AE:["971","00","(?:[4-7]\\d|9[0-689])\\d{7}|800\\d{2,9}|[2-4679]\\d{7}",[5,6,7,8,9,10,11,12],[["(\\d{3})(\\d{2,9})","$1 $2",["60|8"]],["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["[236]|[479][2-8]"],"0$1"],["(\\d{3})(\\d)(\\d{5})","$1 $2 $3",["[479]"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["5"],"0$1"]],"0",0,0,0,0,0,[["[2-4679][2-8]\\d{6}",[8]],["5[02-68]\\d{7}",[9]],["400\\d{6}|800\\d{2,9}"],["900[02]\\d{5}",[9]],0,0,["600[25]\\d{5}",[9]],0,0,["700[05]\\d{5}",[9]]]],AF:["93","00","[2-7]\\d{8}",[9],[["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[2-7]"],"0$1"]],"0",0,0,0,0,0,[["(?:[25][0-8]|[34][0-4]|6[0-5])[2-9]\\d{6}"],["7\\d{8}"]]],AG:["1","011","(?:268|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([457]\\d{6})$|1","268$1",0,"268",[["268(?:4(?:6[0-38]|84)|56[0-2])\\d{4}"],["268(?:464|7(?:1[3-9]|[28]\\d|3[0246]|64|7[0-689]))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,0,["26840[69]\\d{4}"],["26848[01]\\d{4}"]]],AI:["1","011","(?:264|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2457]\\d{6})$|1","264$1",0,"264",[["264(?:292|4(?:6[12]|9[78]))\\d{4}"],["264(?:235|4(?:69|7[67])|5(?:3[6-9]|8[1-4])|7(?:29|72))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,0,["264724\\d{4}"]]],AL:["355","00","(?:700\\d\\d|900)\\d{3}|8\\d{5,7}|(?:[2-5]|6\\d)\\d{7}",[6,7,8,9],[["(\\d{3})(\\d{3,4})","$1 $2",["80|9"],"0$1"],["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["4[2-6]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[2358][2-5]|4"],"0$1"],["(\\d{3})(\\d{5})","$1 $2",["[23578]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["6"],"0$1"]],"0",0,0,0,0,0,[["4505[0-2]\\d{3}|(?:[2358][16-9]\\d[2-9]|4410)\\d{4}|(?:[2358][2-5][2-9]|4(?:[2-57-9][2-9]|6\\d))\\d{5}",[8]],["6(?:[78][2-9]|9\\d)\\d{6}",[9]],["800\\d{4}",[7]],["900[1-9]\\d\\d",[6]],["700[2-9]\\d{4}",[8]],0,0,0,0,["808[1-9]\\d\\d",[6]]]],AM:["374","00","(?:[1-489]\\d|55|60|77)\\d{6}",[8],[["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["[89]0"],"0 $1"],["(\\d{3})(\\d{5})","$1 $2",["2|3[12]"],"(0$1)"],["(\\d{2})(\\d{6})","$1 $2",["1|47"],"(0$1)"],["(\\d{2})(\\d{6})","$1 $2",["[3-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:(?:1[0-25]|47)\\d|2(?:2[2-46]|3[1-8]|4[2-69]|5[2-7]|6[1-9]|8[1-7])|3[12]2)\\d{5}"],["(?:33|4[1349]|55|77|88|9[13-9])\\d{6}"],["800\\d{5}"],["90[016]\\d{5}"],0,0,0,0,["60(?:2[78]|3[5-9]|4[02-9]|5[0-46-9]|[6-8]\\d|9[0-2])\\d{4}"],["80[1-4]\\d{5}"]]],AO:["244","00","[29]\\d{8}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[29]"]]],0,0,0,0,0,0,[["2\\d(?:[0134][25-9]|[25-9]\\d)\\d{5}"],["9[1-79]\\d{7}"]]],AR:["54","00","(?:11|[89]\\d\\d)\\d{8}|[2368]\\d{9}",[10,11],[["(\\d{4})(\\d{2})(\\d{4})","$1 $2-$3",["2(?:2[024-9]|3[0-59]|47|6[245]|9[02-8])|3(?:3[28]|4[03-9]|5[2-46-8]|7[1-578]|8[2-9])","2(?:[23]02|6(?:[25]|4[6-8])|9(?:[02356]|4[02568]|72|8[23]))|3(?:3[28]|4(?:[04679]|3[5-8]|5[4-68]|8[2379])|5(?:[2467]|3[237]|8[2-5])|7[1-578]|8(?:[2469]|3[2578]|5[4-8]|7[36-8]|8[5-8]))|2(?:2[24-9]|3[1-59]|47)","2(?:[23]02|6(?:[25]|4(?:64|[78]))|9(?:[02356]|4(?:[0268]|5[2-6])|72|8[23]))|3(?:3[28]|4(?:[04679]|3[78]|5(?:4[46]|8)|8[2379])|5(?:[2467]|3[237]|8[23])|7[1-578]|8(?:[2469]|3[278]|5[56][46]|86[3-6]))|2(?:2[24-9]|3[1-59]|47)|38(?:[58][78]|7[378])|3(?:4[35][56]|58[45]|8(?:[38]5|54|76))[4-6]","2(?:[23]02|6(?:[25]|4(?:64|[78]))|9(?:[02356]|4(?:[0268]|5[2-6])|72|8[23]))|3(?:3[28]|4(?:[04679]|3(?:5(?:4[0-25689]|[56])|[78])|58|8[2379])|5(?:[2467]|3[237]|8(?:[23]|4(?:[45]|60)|5(?:4[0-39]|5|64)))|7[1-578]|8(?:[2469]|3[278]|54(?:4|5[13-7]|6[89])|86[3-6]))|2(?:2[24-9]|3[1-59]|47)|38(?:[58][78]|7[378])|3(?:454|85[56])[46]|3(?:4(?:36|5[56])|8(?:[38]5|76))[4-6]"],"0$1",1],["(\\d{2})(\\d{4})(\\d{4})","$1 $2-$3",["1"],"0$1",1],["(\\d{3})(\\d{3})(\\d{4})","$1-$2-$3",["[68]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2-$3",["[23]"],"0$1",1],["(\\d)(\\d{4})(\\d{2})(\\d{4})","$2 15-$3-$4",["9(?:2[2-469]|3[3-578])","9(?:2(?:2[024-9]|3[0-59]|47|6[245]|9[02-8])|3(?:3[28]|4[03-9]|5[2-46-8]|7[1-578]|8[2-9]))","9(?:2(?:[23]02|6(?:[25]|4[6-8])|9(?:[02356]|4[02568]|72|8[23]))|3(?:3[28]|4(?:[04679]|3[5-8]|5[4-68]|8[2379])|5(?:[2467]|3[237]|8[2-5])|7[1-578]|8(?:[2469]|3[2578]|5[4-8]|7[36-8]|8[5-8])))|92(?:2[24-9]|3[1-59]|47)","9(?:2(?:[23]02|6(?:[25]|4(?:64|[78]))|9(?:[02356]|4(?:[0268]|5[2-6])|72|8[23]))|3(?:3[28]|4(?:[04679]|3[78]|5(?:4[46]|8)|8[2379])|5(?:[2467]|3[237]|8[23])|7[1-578]|8(?:[2469]|3[278]|5(?:[56][46]|[78])|7[378]|8(?:6[3-6]|[78]))))|92(?:2[24-9]|3[1-59]|47)|93(?:4[35][56]|58[45]|8(?:[38]5|54|76))[4-6]","9(?:2(?:[23]02|6(?:[25]|4(?:64|[78]))|9(?:[02356]|4(?:[0268]|5[2-6])|72|8[23]))|3(?:3[28]|4(?:[04679]|3(?:5(?:4[0-25689]|[56])|[78])|5(?:4[46]|8)|8[2379])|5(?:[2467]|3[237]|8(?:[23]|4(?:[45]|60)|5(?:4[0-39]|5|64)))|7[1-578]|8(?:[2469]|3[278]|5(?:4(?:4|5[13-7]|6[89])|[56][46]|[78])|7[378]|8(?:6[3-6]|[78]))))|92(?:2[24-9]|3[1-59]|47)|93(?:4(?:36|5[56])|8(?:[38]5|76))[4-6]"],"0$1",0,"$1 $2 $3-$4"],["(\\d)(\\d{2})(\\d{4})(\\d{4})","$2 15-$3-$4",["91"],"0$1",0,"$1 $2 $3-$4"],["(\\d{3})(\\d{3})(\\d{5})","$1-$2-$3",["8"],"0$1"],["(\\d)(\\d{3})(\\d{3})(\\d{4})","$2 15-$3-$4",["9"],"0$1",0,"$1 $2 $3-$4"]],"0",0,"0?(?:(11|2(?:2(?:02?|[13]|2[13-79]|4[1-6]|5[2457]|6[124-8]|7[1-4]|8[13-6]|9[1267])|3(?:02?|1[467]|2[03-6]|3[13-8]|[49][2-6]|5[2-8]|[67])|4(?:7[3-578]|9)|6(?:[0136]|2[24-6]|4[6-8]?|5[15-8])|80|9(?:0[1-3]|[19]|2\\d|3[1-6]|4[02568]?|5[2-4]|6[2-46]|72?|8[23]?))|3(?:3(?:2[79]|6|8[2578])|4(?:0[0-24-9]|[12]|3[5-8]?|4[24-7]|5[4-68]?|6[02-9]|7[126]|8[2379]?|9[1-36-8])|5(?:1|2[1245]|3[237]?|4[1-46-9]|6[2-4]|7[1-6]|8[2-5]?)|6[24]|7(?:[069]|1[1568]|2[15]|3[145]|4[13]|5[14-8]|7[2-57]|8[126])|8(?:[01]|2[15-7]|3[2578]?|4[13-6]|5[4-8]?|6[1-357-9]|7[36-8]?|8[5-8]?|9[124])))15)?","9$1",0,0,[["3(?:7(?:1[15]|81)|8(?:21|4[16]|69|9[12]))[46]\\d{5}|(?:2(?:2(?:2[59]|44|52)|3(?:26|44)|47[35]|9(?:[07]2|2[26]|34|46))|3327)[45]\\d{5}|(?:2(?:657|9(?:54|66))|3(?:48[27]|7(?:55|77)|8(?:65|78)))[2-8]\\d{5}|(?:2(?:284|3(?:02|23)|477|622|920)|3(?:4(?:46|89|92)|541))[2-7]\\d{5}|(?:(?:11[0-8]|670)\\d|2(?:2(?:0[45]|1[2-6]|3[3-6])|3(?:[06]4|7[45])|494|6(?:04|1[2-8]|[36][45]|4[3-6])|80[45]|9(?:[17][4-6]|[48][45]|9[3-6]))|3(?:364|4(?:1[2-8]|[25][4-6]|3[3-6]|84)|5(?:1[2-9]|[38][4-6])|6(?:2[45]|44)|7[069][45]|8(?:0[45]|1[2-7]|3[4-6]|5[3-6]|7[2-6]|8[3-68])))\\d{6}|(?:2(?:2(?:62|81)|320|9(?:42|83))|3(?:329|4(?:62|7[16])|5(?:43|64)|7(?:18|5[17])))[2-6]\\d{5}|2(?:2(?:21|4[23]|6[145]|7[1-4]|8[356]|9[267])|3(?:16|3[13-8]|43|5[346-8]|9[3-5])|6(?:2[46]|4[78]|5[1568])|9(?:03|2[1457-9]|3[1356]|4[08]|[56][23]|82))4\\d{5}|(?:2(?:257|3(?:24|46|92)|9(?:01|23|64))|3(?:4(?:42|64)|5(?:25|37|4[47]|71)|7(?:35|72)|825))[3-6]\\d{5}|(?:2(?:2(?:02|2[3467]|4[156]|5[45]|6[6-8]|91)|3(?:1[47]|25|[45][25]|96)|47[48]|625|932)|3(?:38[2578]|4(?:0[0-24-9]|3[78]|4[457]|58|6[035-9]|72|83|9[136-8])|5(?:2[124]|[368][23]|4[2689]|7[2-6])|7(?:16|2[15]|3[14]|4[13]|5[468]|7[3-5]|8[26])|8(?:2[67]|3[278]|4[3-5]|5[78]|6[1-378]|[78]7|94)))[4-6]\\d{5}",[10]],["93(?:7(?:1[15]|81)|8(?:21|4[16]|69|9[12]))[46]\\d{5}|9(?:2(?:2(?:2[59]|44|52)|3(?:26|44)|47[35]|9(?:[07]2|2[26]|34|46))|3327)[45]\\d{5}|9(?:2(?:657|9(?:54|66))|3(?:48[27]|7(?:55|77)|8(?:65|78)))[2-8]\\d{5}|9(?:2(?:284|3(?:02|23)|477|622|920)|3(?:4(?:46|89|92)|541))[2-7]\\d{5}|(?:675\\d|9(?:11[0-8]\\d|2(?:2(?:0[45]|1[2-6]|3[3-6])|3(?:[06]4|7[45])|494|6(?:04|1[2-8]|[36][45]|4[3-6])|80[45]|9(?:[17][4-6]|[48][45]|9[3-6]))|3(?:364|4(?:1[2-8]|[25][4-6]|3[3-6]|84)|5(?:1[2-9]|[38][4-6])|6(?:2[45]|44)|7[069][45]|8(?:0[45]|1[2-7]|3[4-6]|5[3-6]|7[2-6]|8[3-68]))))\\d{6}|9(?:2(?:2(?:62|81)|320|9(?:42|83))|3(?:329|4(?:62|7[16])|5(?:43|64)|7(?:18|5[17])))[2-6]\\d{5}|92(?:2(?:21|4[23]|6[145]|7[1-4]|8[356]|9[267])|3(?:16|3[13-8]|43|5[346-8]|9[3-5])|6(?:2[46]|4[78]|5[1568])|9(?:03|2[1457-9]|3[1356]|4[08]|[56][23]|82))4\\d{5}|9(?:2(?:257|3(?:24|46|92)|9(?:01|23|64))|3(?:4(?:42|64)|5(?:25|37|4[47]|71)|7(?:35|72)|825))[3-6]\\d{5}|9(?:2(?:2(?:02|2[3467]|4[156]|5[45]|6[6-8]|91)|3(?:1[47]|25|[45][25]|96)|47[48]|625|932)|3(?:38[2578]|4(?:0[0-24-9]|3[78]|4[457]|58|6[035-9]|72|83|9[136-8])|5(?:2[124]|[368][23]|4[2689]|7[2-6])|7(?:16|2[15]|3[14]|4[13]|5[468]|7[3-5]|8[26])|8(?:2[67]|3[278]|4[3-5]|5[78]|6[1-378]|[78]7|94)))[4-6]\\d{5}"],["800\\d{7,8}"],["60[04579]\\d{7}",[10]],0,0,["810\\d{7}",[10]]]],AS:["1","011","(?:[58]\\d\\d|684|900)\\d{7}",[10],0,"1",0,"([267]\\d{6})$|1","684$1",0,"684",[["684(?:274|6(?:22|33|44|55|77|88|9[19]))\\d{4}"],["684(?:2(?:48|5[2468]|7[246])|7(?:3[13]|70|82))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],AT:["43","00","1\\d{3,12}|2\\d{6,12}|43(?:(?:0\\d|5[02-9])\\d{3,9}|2\\d{4,5}|[3467]\\d{4}|8\\d{4,6}|9\\d{4,7})|5\\d{4,12}|8\\d{7,12}|9\\d{8,12}|(?:[367]\\d|4[0-24-9])\\d{4,11}",[4,5,6,7,8,9,10,11,12,13],[["(\\d)(\\d{3,12})","$1 $2",["1(?:11|[2-9])"],"0$1"],["(\\d{3})(\\d{2})","$1 $2",["517"],"0$1"],["(\\d{2})(\\d{3,5})","$1 $2",["5[079]"],"0$1"],["(\\d{3})(\\d{3,10})","$1 $2",["(?:31|4)6|51|6(?:48|5[0-3579]|[6-9])|7(?:20|32|8)|[89]","(?:31|4)6|51|6(?:485|5[0-3579]|[6-9])|7(?:20|32|8)|[89]"],"0$1"],["(\\d{4})(\\d{3,9})","$1 $2",["[2-467]|5[2-6]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["5"],"0$1"],["(\\d{2})(\\d{4})(\\d{4,7})","$1 $2 $3",["5"],"0$1"]],"0",0,0,0,0,0,[["1(?:11\\d|[2-9]\\d{3,11})|(?:316|463)\\d{3,10}|648[34]\\d{3,9}|(?:51|66|73)2\\d{3,10}|(?:2(?:1[467]|2[13-8]|5[2357]|6[1-46-8]|7[1-8]|8[124-7]|9[1458])|3(?:1[1-578]|3[23568]|4[5-7]|5[1378]|6[1-38]|8[3-68])|4(?:2[1-8]|35|7[1368]|8[2457])|5(?:2[1-8]|3[357]|4[147]|5[12578]|6[37])|6(?:13|2[1-47]|4[135-7]|5[468])|7(?:2[1-8]|35|4[13478]|5[68]|6[16-8]|7[1-6]|9[45]))\\d{4,10}"],["6(?:485|(?:5[0-3579]|6[013-9]|[7-9]\\d)\\d)\\d{3,9}",[7,8,9,10,11,12,13]],["800\\d{6,10}",[9,10,11,12,13]],["(?:8[69][2-68]|9(?:0[01]|3[019]))\\d{6,10}",[9,10,11,12,13]],0,0,0,0,["5(?:0[1-9]|17|[79]\\d)\\d{2,10}|7[28]0\\d{6,10}",[5,6,7,8,9,10,11,12,13]],["8(?:10|2[018])\\d{6,10}|828\\d{5}",[8,9,10,11,12,13]]]],AU:["61","001[14-689]|14(?:1[14]|34|4[17]|[56]6|7[47]|88)0011","1(?:[0-79]\\d{7}(?:\\d(?:\\d{2})?)?|8[0-24-9]\\d{7})|[2-478]\\d{8}|1\\d{4,7}",[5,6,7,8,9,10,12],[["(\\d{2})(\\d{3,4})","$1 $2",["16"],"0$1"],["(\\d{2})(\\d{3})(\\d{2,4})","$1 $2 $3",["16"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["14|4"],"0$1"],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["[2378]"],"(0$1)"],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1(?:30|[89])"]]],"0",0,"(183[12])|0",0,0,0,[["(?:(?:241|349)0\\d\\d|8(?:51(?:0(?:0[03-9]|[12479]\\d|3[2-9]|5[0-8]|6[1-9]|8[0-7])|1(?:[0235689]\\d|1[0-69]|4[0-589]|7[0-47-9])|2(?:0[0-79]|[18][13579]|2[14-9]|3[0-46-9]|[4-6]\\d|7[89]|9[0-4])|[34]\\d\\d)|91(?:(?:[0-58]\\d|6[0135-9])\\d|7(?:0[0-24-9]|[1-9]\\d)|9(?:[0-46-9]\\d|5[0-79]))))\\d{3}|(?:2(?:[0-26-9]\\d|3[0-8]|4[02-9]|5[0135-9])|3(?:[0-3589]\\d|4[0-578]|6[1-9]|7[0-35-9])|7(?:[013-57-9]\\d|2[0-8])|8(?:55|6[0-8]|[78]\\d|9[02-9]))\\d{6}",[9]],["4(?:79[01]|83[0-36-9]|95[0-3])\\d{5}|4(?:[0-36]\\d|4[047-9]|[58][0-24-9]|7[02-8]|9[0-47-9])\\d{6}",[9]],["180(?:0\\d{3}|2)\\d{3}",[7,10]],["190[0-26]\\d{6}",[10]],0,0,0,["163\\d{2,6}",[5,6,7,8,9]],["14(?:5(?:1[0458]|[23][458])|71\\d)\\d{4}",[9]],["13(?:00\\d{6}(?:\\d{2})?|45[0-4]\\d{3})|13\\d{4}",[6,8,10,12]]],"0011"],AW:["297","00","(?:[25-79]\\d\\d|800)\\d{4}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[25-9]"]]],0,0,0,0,0,0,[["5(?:2\\d|8[1-9])\\d{4}"],["(?:290|5[69]\\d|6(?:[03]0|22|4[0-2]|[69]\\d)|7(?:[34]\\d|7[07])|9(?:6[45]|9[4-8]))\\d{4}"],["800\\d{4}"],["900\\d{4}"],0,0,0,0,["(?:28\\d|501)\\d{4}"]]],AX:["358","00|99(?:[01469]|5(?:[14]1|3[23]|5[59]|77|88|9[09]))","2\\d{4,9}|35\\d{4,5}|(?:60\\d\\d|800)\\d{4,6}|7\\d{5,11}|(?:[14]\\d|3[0-46-9]|50)\\d{4,8}",[5,6,7,8,9,10,11,12],0,"0",0,0,0,0,"18",[["18[1-8]\\d{3,6}",[6,7,8,9]],["4946\\d{2,6}|(?:4[0-8]|50)\\d{4,8}",[6,7,8,9,10]],["800\\d{4,6}",[7,8,9]],["[67]00\\d{5,6}",[8,9]],0,0,["20\\d{4,8}|60[12]\\d{5,6}|7(?:099\\d{4,5}|5[03-9]\\d{3,7})|20[2-59]\\d\\d|(?:606|7(?:0[78]|1|3\\d))\\d{7}|(?:10|29|3[09]|70[1-5]\\d)\\d{4,8}"]],"00"],AZ:["994","00","365\\d{6}|(?:[124579]\\d|60|88)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["90"],"0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["1[28]|2|365|46","1[28]|2|365[45]|46","1[28]|2|365(?:4|5[02])|46"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[13-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:2[12]428|3655[02])\\d{4}|(?:2(?:22[0-79]|63[0-28])|3654)\\d{5}|(?:(?:1[28]|46)\\d|2(?:[014-6]2|[23]3))\\d{6}"],["36554\\d{4}|(?:[16]0|4[04]|5[015]|7[07]|99)\\d{7}"],["88\\d{7}"],["900200\\d{3}"]]],BA:["387","00","6\\d{8}|(?:[35689]\\d|49|70)\\d{6}",[8,9],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["6[1-3]|[7-9]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2-$3",["[3-5]|6[56]"],"0$1"],["(\\d{2})(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3 $4",["6"],"0$1"]],"0",0,0,0,0,0,[["(?:3(?:[05-79][2-9]|1[4579]|[23][24-9]|4[2-4689]|8[2457-9])|49[2-579]|5(?:0[2-49]|[13][2-9]|[268][2-4679]|4[4689]|5[2-79]|7[2-69]|9[2-4689]))\\d{5}",[8]],["6040\\d{5}|6(?:03|[1-356]|44|7\\d)\\d{6}"],["8[08]\\d{6}",[8]],["9[0246]\\d{6}",[8]],0,0,["703[235]0\\d{3}|70(?:2[0-5]|3[0146]|[56]0)\\d{4}",[8]],0,0,["8[12]\\d{6}",[8]]]],BB:["1","011","(?:246|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","246$1",0,"246",[["246521[0369]\\d{3}|246(?:2(?:2[78]|7[0-4])|4(?:1[024-6]|2\\d|3[2-9])|5(?:20|[34]\\d|54|7[1-3])|6(?:2\\d|38)|7[35]7|9(?:1[89]|63))\\d{4}"],["246(?:(?:2(?:[3568]\\d|4[0-57-9])|3(?:5[2-9]|6[0-6])|4(?:46|5\\d)|69[5-7]|8(?:[2-5]\\d|83))\\d|52(?:1[147]|20))\\d{3}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["(?:246976|900[2-9]\\d\\d)\\d{4}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,["246(?:292|367|4(?:1[7-9]|3[01]|4[47-9]|67)|7(?:1[2-9]|2\\d|3[016]|53))\\d{4}"],0,["24631\\d{5}"]]],BD:["880","00","[1-469]\\d{9}|8[0-79]\\d{7,8}|[2-79]\\d{8}|[2-9]\\d{7}|[3-9]\\d{6}|[57-9]\\d{5}",[6,7,8,9,10],[["(\\d{2})(\\d{4,6})","$1-$2",["31[5-8]|[459]1"],"0$1"],["(\\d{3})(\\d{3,7})","$1-$2",["3(?:[67]|8[013-9])|4(?:6[168]|7|[89][18])|5(?:6[128]|9)|6(?:[15]|28|4[14])|7[2-589]|8(?:0[014-9]|[12])|9[358]|(?:3[2-5]|4[235]|5[2-578]|6[0389]|76|8[3-7]|9[24])1|(?:44|66)[01346-9]"],"0$1"],["(\\d{4})(\\d{3,6})","$1-$2",["[13-9]|2[23]"],"0$1"],["(\\d)(\\d{7,8})","$1-$2",["2"],"0$1"]],"0",0,0,0,0,0,[["(?:4(?:31\\d\\d|423)|5222)\\d{3}(?:\\d{2})?|8332[6-9]\\d\\d|(?:3(?:03[56]|224)|4(?:22[25]|653))\\d{3,4}|(?:3(?:42[47]|529|823)|4(?:027|525|65(?:28|8))|562|6257|7(?:1(?:5[3-5]|6[12]|7[156]|89)|22[589]56|32|42675|52(?:[25689](?:56|8)|[347]8)|71(?:6[1267]|75|89)|92374)|82(?:2[59]|32)56|9(?:03[23]56|23(?:256|373)|31|5(?:1|2[4589]56)))\\d{3}|(?:3(?:02[348]|22[35]|324|422)|4(?:22[67]|32[236-9]|6(?:2[46]|5[57])|953)|5526|6(?:024|6655)|81)\\d{4,5}|(?:2(?:7(?:1[0-267]|2[0-289]|3[0-29]|4[01]|5[1-3]|6[013]|7[0178]|91)|8(?:0[125]|1[1-6]|2[0157-9]|3[1-69]|41|6[1-35]|7[1-5]|8[1-8]|9[0-6])|9(?:0[0-2]|1[0-4]|2[568]|3[3-6]|5[5-7]|6[0136-9]|7[0-7]|8[014-9]))|3(?:0(?:2[025-79]|3[2-4])|181|22[12]|32[2356]|824)|4(?:02[09]|22[348]|32[045]|523|6(?:27|54))|666(?:22|53)|7(?:22[57-9]|42[56]|82[35])8|8(?:0[124-9]|2(?:181|2[02-4679]8)|4[12]|[5-7]2)|9(?:[04]2|2(?:2|328)|81))\\d{4}|(?:2(?:[23]\\d|[45])\\d\\d|3(?:1(?:2[5-7]|[5-7])|425|822)|4(?:033|1\\d|[257]1|332|4(?:2[246]|5[25])|6(?:2[35]|56|62)|8(?:23|54)|92[2-5])|5(?:02[03489]|22[457]|32[35-79]|42[46]|6(?:[18]|53)|724|826)|6(?:023|2(?:2[2-5]|5[3-5]|8)|32[3478]|42[34]|52[47]|6(?:[18]|6(?:2[34]|5[24]))|[78]2[2-5]|92[2-6])|7(?:02|21\\d|[3-589]1|6[12]|72[24])|8(?:217|3[12]|[5-7]1)|9[24]1)\\d{5}|(?:(?:3[2-8]|5[2-57-9]|6[03-589])1|4[4689][18])\\d{5}|[59]1\\d{5}"],["(?:1[13-9]\\d|644)\\d{7}|(?:3[78]|44|66)[02-9]\\d{7}",[10]],["80[03]\\d{7}",[10]],0,0,0,0,0,["96(?:0[1-69]|1[0-479]|2[278]|3[13-9]|4[0-47-9]|54|6[69]|7[78]|88)\\d{6}",[10]]]],BE:["32","00","4\\d{8}|[1-9]\\d{7}",[8,9],[["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["(?:80|9)0"],"0$1"],["(\\d)(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[239]|4[23]"],"0$1"],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[15-8]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["4"],"0$1"]],"0",0,0,0,0,0,[["80[2-8]\\d{5}|(?:1[0-69]|[23][2-8]|4[23]|5\\d|6[013-57-9]|71|8[1-79]|9[2-4])\\d{6}",[8]],["4[5-9]\\d{7}",[9]],["800[1-9]\\d{4}",[8]],["(?:70(?:2[0-57]|3[04-7]|44|6[04-69]|7[0579])|90\\d\\d)\\d{4}",[8]],0,0,["78(?:0[578]|1[014-8]|2[25]|3[15-8]|48|5[05]|60|7[06-8]|9\\d)\\d{4}",[8]],0,0,["7879\\d{4}",[8]]]],BF:["226","00","[024-7]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[024-7]"]]],0,0,0,0,0,0,[["2(?:0(?:49|5[23]|6[5-7]|9[016-9])|4(?:4[569]|5[4-6]|6[5-7]|7[0179])|5(?:[34]\\d|50|6[5-8]))\\d{4}"],["(?:0[1-7]|4[4-6]|5[0-8]|[67]\\d)\\d{6}"]]],BG:["359","00","00800\\d{7}|[2-7]\\d{6,7}|[89]\\d{6,8}|2\\d{5}",[6,7,8,9,12],[["(\\d)(\\d)(\\d{2})(\\d{2})","$1 $2 $3 $4",["2"],"0$1"],["(\\d{3})(\\d{4})","$1 $2",["43[1-6]|70[1-9]"],"0$1"],["(\\d)(\\d{3})(\\d{3,4})","$1 $2 $3",["2"],"0$1"],["(\\d{2})(\\d{3})(\\d{2,3})","$1 $2 $3",["[356]|4[124-7]|7[1-9]|8[1-6]|9[1-7]"],"0$1"],["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["(?:70|8)0"],"0$1"],["(\\d{3})(\\d{3})(\\d{2})","$1 $2 $3",["43[1-7]|7"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[48]|9[08]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["9"],"0$1"]],"0",0,0,0,0,0,[["2\\d{5,7}|(?:43[1-6]|70[1-9])\\d{4,5}|(?:[36]\\d|4[124-7]|[57][1-9]|8[1-6]|9[1-7])\\d{5,6}",[6,7,8]],["(?:43[07-9]|99[69]\\d)\\d{5}|(?:8[7-9]|98)\\d{7}",[8,9]],["(?:00800\\d\\d|800)\\d{5}",[8,12]],["90\\d{6}",[8]],0,0,0,0,0,["700\\d{5}",[8]]]],BH:["973","00","[136-9]\\d{7}",[8],[["(\\d{4})(\\d{4})","$1 $2",["[13679]|8[02-4679]"]]],0,0,0,0,0,0,[["(?:1(?:3[1356]|6[0156]|7\\d)\\d|6(?:1[16]\\d|500|6(?:0\\d|3[12]|44|55|7[7-9]|88)|9[69][69])|7(?:[07]\\d\\d|1(?:11|78)))\\d{4}"],["(?:3(?:[0-79]\\d|8[0-57-9])\\d|6(?:3(?:00|33|6[16])|441|6(?:3[03-9]|[69]\\d|7[0-689])))\\d{4}"],["8[02369]\\d{6}"],["(?:87|9[0-8])\\d{6}"],0,0,0,0,0,["84\\d{6}"]]],BI:["257","00","(?:[267]\\d|31)\\d{6}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2367]"]]],0,0,0,0,0,0,[["(?:22|31)\\d{6}"],["(?:29|6[1-9]|7[125-9])\\d{6}"]]],BJ:["229","00","(?:01\\d|8)\\d{7}",[8,10],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["0"]]],0,0,0,0,0,0,[["012\\d{7}",[10]],["01(?:2[5-9]|[4-69]\\d)\\d{6}",[10]],0,0,0,0,["81\\d{6}",[8]],0,["857[58]\\d{4}",[8]]]],BL:["590","00","7090\\d{5}|(?:[56]9|[89]\\d)\\d{7}",[9],0,"0",0,0,0,0,0,[["(?:59(?:0(?:2[7-9]|3[3-7]|5[12]|87)|87\\d)|80[6-9]\\d\\d)\\d{4}"],["(?:69(?:0\\d\\d|1(?:2[2-9]|3[0-5]))|7090[0-4])\\d{4}"],["80[0-5]\\d{6}"],["8[129]\\d{7}"],0,0,0,0,["9(?:(?:39[5-7]|76[018])\\d|475[0-6])\\d{4}"]]],BM:["1","011","(?:441|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","441$1",0,"441",[["441(?:[46]\\d\\d|5(?:4\\d|60|89))\\d{4}"],["441(?:[2378]\\d|5[0-39]|9[02])\\d{5}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],BN:["673","00","[2-578]\\d{6}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[2-578]"]]],0,0,0,0,0,0,[["22[0-7]\\d{4}|(?:2[013-9]|[34]\\d|5[0-25-9])\\d{5}"],["(?:22[89]|[78]\\d\\d)\\d{4}"],0,0,0,0,0,0,["5[34]\\d{5}"]]],BO:["591","00(?:1\\d)?","(?:[2-7]\\d\\d|8001)\\d{5}",[8,9],[["(\\d)(\\d{7})","$1 $2",["[23]|4[46]|50"]],["(\\d{8})","$1",["[5-7]"]],["(\\d{3})(\\d{2})(\\d{4})","$1 $2 $3",["8"]]],"0",0,"0(1\\d)?",0,0,0,[["(?:2(?:2\\d\\d|5(?:11|[258]\\d|9[67])|6(?:12|2\\d|9[34])|8(?:2[34]|39|62))|3(?:3\\d\\d|4(?:6\\d|8[24])|8(?:25|42|5[257]|86|9[25])|9(?:[27]\\d|3[2-4]|4[248]|5[24]|6[2-6]))|4(?:4\\d\\d|6(?:11|[24689]\\d|72)))\\d{4}",[8]],["(?:57|[67]\\d)\\d{6}",[8]],["8001[07]\\d{4}",[9]],0,0,0,0,0,["50\\d{6}",[8]]]],BQ:["599","00","(?:[34]1|7\\d)\\d{5}",[7],0,0,0,0,0,0,"[347]",[["(?:318[023]|41(?:6[023]|70)|7(?:1[578]|2[05]|50)\\d)\\d{3}"],["(?:31(?:8[14-8]|9[14578])|416[14-9]|7(?:0[01]|7[07]|8\\d|9[056])\\d)\\d{3}"]]],BR:["55","00(?:1[245]|2[1-35]|31|4[13]|[56]5|99)","[1-467]\\d{9,10}|55[0-46-9]\\d{8}|[34]\\d{7}|55\\d{7,8}|(?:5[0-46-9]|[89]\\d)\\d{7,9}",[8,9,10,11],[["(\\d{4})(\\d{4})","$1-$2",["300|4(?:0[02]|37|86)","300|4(?:0(?:0|20)|370|864)"]],["(\\d{3})(\\d{2,3})(\\d{4})","$1 $2 $3",["(?:[358]|90)0"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1 $2-$3",["(?:[14689][1-9]|2[12478]|3[1-578]|5[13-5]|7[13-579])[2-57]"],"($1)"],["(\\d{2})(\\d{5})(\\d{4})","$1 $2-$3",["[16][1-9]|[2-57-9]"],"($1)"]],"0",0,"(?:0|90)(?:(1[245]|2[1-35]|31|4[13]|[56]5|99)(\\d{10,11}))?","$2",0,0,[["(?:[14689][1-9]|2[12478]|3[1-578]|5[13-5]|7[13-579])[2-5]\\d{7}",[10]],["(?:[14689][1-9]|2[12478]|3[1-578]|5[13-5]|7[13-579])(?:7|9\\d)\\d{7}",[10,11]],["800\\d{6,7}",[9,10]],["[59]00\\d{6,7}",[9,10]],0,0,0,0,0,["(?:30[03]\\d{3}|4(?:0(?:0\\d|20)|370|864))\\d{4}|300\\d{5}",[8,10]]]],BS:["1","011","(?:242|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([3-8]\\d{6})$|1","242$1",0,"242",[["242(?:3(?:02|[236][1-9]|4[0-24-9]|5[0-68]|7[347]|8[0-4]|9[2-467])|461|502|6(?:0[1-5]|12|2[013]|[45]0|7[67]|8[78]|9[89])|7(?:02|88))\\d{4}"],["242(?:3(?:5[79]|7[56]|95)|4(?:[23][1-9]|4[1-35-9]|5[1-8]|6[2-8]|7\\d|81)|5(?:2[45]|3[35]|44|5[1-46-9]|65|77)|6[34]6|7(?:27|38)|8(?:0[1-9]|1[02-9]|2\\d|3[0-4]|[89]9))\\d{4}"],["242300\\d{4}|8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,["242225\\d{4}"]]],BT:["975","00","[178]\\d{7}|[2-8]\\d{6}",[7,8],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["[2-6]|7[246]|8[2-4]"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["1[67]|[78]"]]],0,0,0,0,0,0,[["(?:2[3-6]|[34][5-7]|5[236]|6[2-46]|7[246]|8[2-4])\\d{5}",[7]],["(?:1[67]|[78]7)\\d{6}",[8]]]],BW:["267","00","(?:0800|(?:[37]|800)\\d)\\d{6}|(?:[2-6]\\d|90)\\d{5}",[7,8,10],[["(\\d{2})(\\d{5})","$1 $2",["90"]],["(\\d{3})(\\d{4})","$1 $2",["[24-6]|3[15-9]"]],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[37]"]],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["0"]],["(\\d{3})(\\d{4})(\\d{3})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["(?:2(?:4[0-48]|6[0-24]|9[0578])|3(?:1[0-35-9]|55|[69]\\d|7[013]|81)|4(?:6[03]|7[1267]|9[0-5])|5(?:3[03489]|4[0489]|7[1-47]|88|9[0-49])|6(?:2[1-35]|5[149]|8[013467]))\\d{4}",[7]],["(?:321|7(?:[1-8]\\d|9[03]))\\d{5}",[8]],["(?:0800|800\\d)\\d{6}",[10]],["90\\d{5}",[7]],0,0,0,0,["79(?:1(?:[0-2]\\d|3[0-8])|2[0-7]\\d)\\d{3}",[8]]]],BY:["375","810","(?:[12]\\d|33|44|902)\\d{7}|8(?:0[0-79]\\d{5,7}|[1-7]\\d{9})|8(?:1[0-489]|[5-79]\\d)\\d{7}|8[1-79]\\d{6,7}|8[0-79]\\d{5}|8\\d{5}",[6,7,8,9,10,11],[["(\\d{3})(\\d{3})","$1 $2",["800"],"8 $1"],["(\\d{3})(\\d{2})(\\d{2,4})","$1 $2 $3",["800"],"8 $1"],["(\\d{4})(\\d{2})(\\d{3})","$1 $2-$3",["1(?:5[169]|6[3-5]|7[179])|2(?:1[35]|2[34]|3[3-5])","1(?:5[169]|6(?:3[1-3]|4|5[125])|7(?:1[3-9]|7[0-24-6]|9[2-7]))|2(?:1[35]|2[34]|3[3-5])"],"8 0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2-$3-$4",["1(?:[56]|7[467])|2[1-3]"],"8 0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2-$3-$4",["[1-4]"],"8 0$1"],["(\\d{3})(\\d{3,4})(\\d{4})","$1 $2 $3",["[89]"],"8 $1"]],"8",0,"0|80?",0,0,0,[["(?:1(?:5(?:1[1-5]|[24]\\d|6[2-4]|9[1-7])|6(?:[235]\\d|4[1-7])|7\\d\\d)|2(?:1(?:[246]\\d|3[0-35-9]|5[1-9])|2(?:[235]\\d|4[0-8])|3(?:[26]\\d|3[02-79]|4[024-7]|5[03-7])))\\d{5}",[9]],["(?:2(?:5[5-79]|9[1-9])|(?:33|44)\\d)\\d{6}",[9]],["800\\d{3,7}|8(?:0[13]|20\\d)\\d{7}"],["(?:810|902)\\d{7}",[10]],0,0,0,0,["249\\d{6}",[9]]],"8~10"],BZ:["501","00","(?:0800\\d|[2-8])\\d{6}",[7,11],[["(\\d{3})(\\d{4})","$1-$2",["[2-8]"]],["(\\d)(\\d{3})(\\d{4})(\\d{3})","$1-$2-$3-$4",["0"]]],0,0,0,0,0,0,[["(?:2(?:[02]\\d|36|[68]0)|[3-58](?:[02]\\d|[68]0)|7(?:[02]\\d|32|[68]0))\\d{4}",[7]],["6[0-35-7]\\d{5}",[7]],["0800\\d{7}",[11]]]],CA:["1","011","[2-9]\\d{9}|3\\d{6}",[7,10],0,"1",0,0,0,0,0,[["(?:2(?:04|[23]6|[48]9|5[07]|63)|3(?:06|43|54|6[578]|82)|4(?:03|1[68]|[26]8|3[178]|50|74)|5(?:06|1[49]|48|79|8[147])|6(?:04|[18]3|39|47|72)|7(?:0[59]|42|53|78|8[02])|8(?:[06]7|19|25|7[39])|9(?:0[25]|42))[2-9]\\d{6}",[10]],["",[10]],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}",[10]],["900[2-9]\\d{6}",[10]],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|(?:5(?:2[125-9]|3[23]|44|66|77|88)|6(?:22|33))[2-9]\\d{6}",[10]],0,["310\\d{4}",[7]],0,["600[2-9]\\d{6}",[10]]]],CC:["61","001[14-689]|14(?:1[14]|34|4[17]|[56]6|7[47]|88)0011","1(?:[0-79]\\d{8}(?:\\d{2})?|8[0-24-9]\\d{7})|[148]\\d{8}|1\\d{5,7}",[6,7,8,9,10,12],0,"0",0,"([59]\\d{7})$|0","8$1",0,0,[["8(?:51(?:0(?:02|31|60|89)|1(?:18|76)|223)|91(?:0(?:1[0-2]|29)|1(?:[28]2|50|79)|2(?:10|64)|3(?:[06]8|22)|4[29]8|62\\d|70[23]|959))\\d{3}",[9]],["4(?:79[01]|83[0-36-9]|95[0-3])\\d{5}|4(?:[0-36]\\d|4[047-9]|[58][0-24-9]|7[02-8]|9[0-47-9])\\d{6}",[9]],["180(?:0\\d{3}|2)\\d{3}",[7,10]],["190[0-26]\\d{6}",[10]],0,0,0,0,["14(?:5(?:1[0458]|[23][458])|71\\d)\\d{4}",[9]],["13(?:00\\d{6}(?:\\d{2})?|45[0-4]\\d{3})|13\\d{4}",[6,8,10,12]]],"0011"],CD:["243","00","(?:(?:[189]|5\\d)\\d|2)\\d{7}|[1-68]\\d{6}",[7,8,9,10],[["(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3",["88"],"0$1"],["(\\d{2})(\\d{5})","$1 $2",["[1-6]"],"0$1"],["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["2"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["1"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[89]"],"0$1"],["(\\d{2})(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3 $4",["5"],"0$1"]],"0",0,0,0,0,0,[["(?:(?:12|573)\\d\\d|276)\\d{5}|[1-6]\\d{6}"],["88\\d{5}|(?:8[0-69]|9[016-9])\\d{7}",[7,9]]]],CF:["236","00","8776\\d{4}|(?:[27]\\d|61)\\d{6}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[26-8]"]]],0,0,0,0,0,0,[["(?:2[12]|61)\\d{6}"],["7[02-7]\\d{6}"],0,["8776\\d{4}"]]],CG:["242","00","222\\d{6}|(?:0\\d|80)\\d{7}",[9],[["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["8"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[02]"]]],0,0,0,0,0,0,[["222[1-589]\\d{5}"],["026(?:1[0-5]|6[6-9])\\d{4}|0(?:[14-6]\\d\\d|2(?:40|5[5-8]|6[07-9]))\\d{5}"],0,["80[0-2]\\d{6}"]]],CH:["41","00","8\\d{11}|[2-9]\\d{8}",[9,12],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["8[047]|90"],"0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2-79]|81"],"0$1"],["(\\d{3})(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:2[12467]|3[1-4]|4[134]|5[256]|6[12]|[7-9]1)\\d{7}",[9]],["(?:6[89]|7[235-9])\\d{7}",[9]],["800\\d{6}",[9]],["90[016]\\d{6}",[9]],["878\\d{6}",[9]],["860\\d{9}",[12]],["5[18]\\d{7}",[9]],["74[0248]\\d{6}",[9]],0,["84[0248]\\d{6}",[9]]]],CI:["225","00","[02]\\d{9}",[10],[["(\\d{2})(\\d{2})(\\d)(\\d{5})","$1 $2 $3 $4",["2"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3 $4",["0"]]],0,0,0,0,0,0,[["2(?:[15]\\d{3}|7(?:2(?:0[23]|1[2357]|2[245]|3[45]|4[3-5])|3(?:06|1[69]|[2-6]7)))\\d{5}"],["0[157]\\d{8}"]]],CK:["682","00","[2-578]\\d{4}",[5],[["(\\d{2})(\\d{3})","$1 $2",["[2-578]"]]],0,0,0,0,0,0,[["(?:2\\d|3[13-7]|4[1-5])\\d{3}"],["[578]\\d{4}"]]],CL:["56","(?:0|1(?:1[0-69]|2[02-5]|5[13-58]|69|7[0167]|8[018]))0","12300\\d{6}|6\\d{9,10}|[2-9]\\d{8}",[9,10,11],[["(\\d{5})(\\d{4})","$1 $2",["219","2196"],"($1)"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["60|809"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["44"]],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["2[1-36]"],"($1)"],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["9(?:10|[2-9])"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["3[2-5]|[47]|5[1-3578]|6[13-57]|8(?:0[1-8]|[1-9])"],"($1)"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["60|8"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["1"]],["(\\d{3})(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3 $4",["60"]]],0,0,0,0,0,0,[["2(?:1982[0-6]|3314[05-9])\\d{3}|(?:2(?:1(?:160|962)|3(?:(?:[24]\\d|50)\\d|3(?:[0346-9]\\d|1[0-35-9]|2[1-9]|5[0-24-9])|600)|646[59])|(?:600|80[1-9])\\d\\d|9(?:(?:10[0-2]|7[1-9]\\d)\\d|3(?:[0-57-9]\\d\\d|6(?:0[02-9]|[1-9]\\d))|6(?:[0-8]\\d\\d|9(?:[02-79]\\d|1[05-9]))|9(?:[03-9]\\d\\d|1(?:[0235-9]\\d|4[0-24-9])|2(?:[0-79]\\d|8[0-46-9]))))\\d{4}|(?:22|3[2-5]|[47][1-35]|5[1-3578]|6[13-57]|8[1-9]|9[2458])\\d{7}",[9]],["2(?:1982[0-6]|3314[05-9])\\d{3}|(?:2(?:1(?:160|962)|3(?:(?:[24]\\d|50)\\d|3(?:[0346-9]\\d|1[0-35-9]|2[1-9]|5[0-24-9])|600)|646[59])|80[1-8]\\d\\d|9(?:(?:10[0-2]|7[1-9]\\d)\\d|3(?:[0-57-9]\\d\\d|6(?:0[02-9]|[1-9]\\d))|6(?:[0-8]\\d\\d|9(?:[02-79]\\d|1[05-9]))|9(?:[03-9]\\d\\d|1(?:[0235-9]\\d|4[0-24-9])|2(?:[0-79]\\d|8[0-46-9]))))\\d{4}|(?:22|3[2-5]|[47][1-35]|5[1-3578]|6[13-57]|8[1-9]|9[2458])\\d{7}",[9]],["(?:123|8)00\\d{6}",[9,11]],0,0,0,0,0,["44\\d{7}",[9]],["600\\d{7,8}",[10,11]]]],CM:["237","00","[26]\\d{8}|88\\d{6,7}",[8,9],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["88"]],["(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["[26]|88"]]],0,0,0,0,0,0,[["2(?:22|33)\\d{6}",[9]],["(?:24[23]|6(?:[25-9]\\d|4[0-2]))\\d{6}",[9]],["88\\d{6,7}"]]],CN:["86","00|1(?:[12]\\d|79)\\d\\d00","(?:(?:1[03-689]|2\\d)\\d\\d|6)\\d{8}|1\\d{10}|[126]\\d{6}(?:\\d(?:\\d{2})?)?|86\\d{5,6}|(?:[3-579]\\d|8[0-57-9])\\d{5,9}",[7,8,9,10,11,12],[["(\\d{2})(\\d{5,6})","$1 $2",["(?:10|2[0-57-9])[19]|3(?:[157]|35|49|9[1-68])|4(?:1[124-9]|2[179]|6[47-9]|7|8[23])|5(?:[1357]|2[37]|4[36]|6[1-46]|80)|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:07|1[236-8]|2[5-7]|[37]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|3|4[13]|5[1-5]|7[0-79]|9[0-35-9])|(?:4[35]|59|85)[1-9]","(?:10|2[0-57-9])(?:1[02]|9[56])|8078|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:1[124-9]|2[179]|[35][1-9]|6[47-9]|7\\d|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[1-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|3\\d|4[13]|5[1-5]|7[0-79]|9[0-35-9]))1","10(?:1(?:0|23)|9[56])|2[0-57-9](?:1(?:00|23)|9[56])|80781|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:1[124-9]|2[179]|[35][1-9]|6[47-9]|7\\d|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[1-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|3\\d|4[13]|5[1-5]|7[0-79]|9[0-35-9]))12","10(?:1(?:0|23)|9[56])|2[0-57-9](?:1(?:00|23)|9[56])|807812|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:1[124-9]|2[179]|[35][1-9]|6[47-9]|7\\d|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[1-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|3\\d|4[13]|5[1-5]|7[0-79]|9[0-35-9]))123","10(?:1(?:0|23)|9[56])|2[0-57-9](?:1(?:00|23)|9[56])|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:1[124-9]|2[179]|[35][1-9]|6[47-9]|7\\d|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:078|1[236-8]|2[5-7]|[37]\\d|5[1-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|3\\d|4[13]|5[1-5]|7[0-79]|9[0-35-9]))123"],"0$1"],["(\\d{3})(\\d{5,6})","$1 $2",["3(?:[157]|35|49|9[1-68])|4(?:[17]|2[179]|6[47-9]|8[23])|5(?:[1357]|2[37]|4[36]|6[1-46]|80)|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]|4[13]|5[1-5])|(?:4[35]|59|85)[1-9]","(?:3(?:[157]\\d|35|49|9[1-68])|4(?:[17]\\d|2[179]|[35][1-9]|6[47-9]|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[1-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))[19]","85[23](?:10|95)|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:[17]\\d|2[179]|[35][1-9]|6[47-9]|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[14-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))(?:10|9[56])","85[23](?:100|95)|(?:3(?:[157]\\d|35|49|9[1-68])|4(?:[17]\\d|2[179]|[35][1-9]|6[47-9]|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[14-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))(?:100|9[56])"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["(?:4|80)0"]],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["10|2(?:[02-57-9]|1[1-9])","10|2(?:[02-57-9]|1[1-9])","10[0-79]|2(?:[02-57-9]|1[1-79])|(?:10|21)8(?:0[1-9]|[1-9])"],"0$1",1],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["3(?:[3-59]|7[02-68])|4(?:[26-8]|3[3-9]|5[2-9])|5(?:3[03-9]|[468]|7[028]|9[2-46-9])|6|7(?:[0-247]|3[04-9]|5[0-4689]|6[2368])|8(?:[1-358]|9[1-7])|9(?:[013479]|5[1-5])|(?:[34]1|55|79|87)[02-9]"],"0$1",1],["(\\d{3})(\\d{7,8})","$1 $2",["9"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["80"],"0$1",1],["(\\d{3})(\\d{4})(\\d{4})","$1 $2 $3",["[3-578]"],"0$1",1],["(\\d{3})(\\d{4})(\\d{4})","$1 $2 $3",["1[3-9]"]],["(\\d{2})(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3 $4",["[12]"],"0$1",1]],"0",0,"(1(?:[12]\\d|79)\\d\\d)|0",0,0,0,[["(?:10(?:[02-79]\\d\\d|[18](?:0[1-9]|[1-9]\\d))|2(?:[02-57-9]\\d{3}|1(?:[18](?:0[1-9]|[1-9]\\d)|[2-79]\\d\\d))|(?:41[03]|8078|9(?:78|94))\\d\\d)\\d{5}|(?:10|2[0-57-9])(?:1(?:00|23)\\d\\d|95\\d{3,4})|(?:41[03]|9(?:78|94))(?:100\\d\\d|95\\d{3,4})|8078123|(?:43[35]|754|851)\\d{7,8}|(?:43[35]|754|851)(?:1(?:00\\d|23)\\d|95\\d{3,4})|(?:3(?:11|7[179])|4(?:[15]1|3[12])|5(?:1\\d|2[37]|3[12]|51|7[13-79]|9[15])|7(?:[39]1|5[57]|6[09])|8(?:71|98))(?:[02-8]\\d{7}|1(?:0(?:0\\d\\d(?:\\d{3})?|[1-9]\\d{5})|[13-9]\\d{6}|2(?:[0-24-9]\\d{5}|3\\d(?:\\d{4})?))|9(?:[0-46-9]\\d{6}|5\\d{3}(?:\\d(?:\\d{2})?)?))|(?:3(?:1[02-9]|35|49|5\\d|7[02-68]|9[1-68])|4(?:1[24-9]|2[179]|3[46-9]|5[2-9]|6[47-9]|7\\d|8[23])|5(?:3[03-9]|4[36]|5[02-9]|6[1-46]|7[028]|80|9[2-46-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[17]\\d|2[248]|3[04-9]|4[3-6]|5[0-3689]|6[2368]|9[02-9])|8(?:1[236-8]|2[5-7]|3\\d|5[2-9]|7[02-9]|8[36-8]|9[1-7])|9(?:0[1-3689]|1[1-79]|3\\d|4[13]|5[1-5]|7[0-79]|9[0-35-9]))(?:[02-8]\\d{6}|1(?:0(?:0\\d\\d(?:\\d{2})?|[1-9]\\d{4})|[13-9]\\d{5}|2(?:[0-24-9]\\d{4}|3\\d(?:\\d{3})?))|9(?:[0-46-9]\\d{5}|5\\d{3,5}))",[7,8,9,10,11]],["1(?:610\\d|740[0-5])\\d{6}|1(?:[38]\\d|4[57]|[59][0-35-9]|6[25-7]|7[0-35-8])\\d{8}",[11]],["(?:(?:10|21)8|8)00\\d{7}",[10,12]],["16[08]\\d{5}",[8]],0,0,0,0,0,["10(?:10\\d{4}|96\\d{3,4})|400\\d{7}|950\\d{7,8}|(?:2[0-57-9]|3(?:[157]\\d|35|49|9[1-68])|4(?:[17]\\d|2[179]|[35][1-9]|6[47-9]|8[23])|5(?:[1357]\\d|2[37]|4[36]|6[1-46]|80|9[1-9])|6(?:3[1-5]|6[0238]|9[12])|7(?:01|[1579]\\d|2[248]|3[014-9]|4[3-6]|6[023689])|8(?:1[236-8]|2[5-7]|[37]\\d|5[14-9]|8[36-8]|9[1-8])|9(?:0[1-3689]|1[1-79]|[379]\\d|4[13]|5[1-5]))96\\d{3,4}",[7,8,9,10,11]]],"00"],CO:["57","00(?:4(?:[14]4|56)|[579])","(?:46|60\\d\\d)\\d{6}|(?:1\\d|[39])\\d{9}",[8,10,11],[["(\\d{4})(\\d{4})","$1 $2",["46"]],["(\\d{3})(\\d{7})","$1 $2",["6|90"],"($1)"],["(\\d{3})(\\d{7})","$1 $2",["3[0-357]|9[14]"]],["(\\d)(\\d{3})(\\d{7})","$1-$2-$3",["1"],"0$1",0,"$1 $2 $3"]],"0",0,"0([3579]|4(?:[14]4|56))?",0,0,0,[["601055(?:[0-4]\\d|50)\\d\\d|6010(?:[0-4]\\d|5[0-4])\\d{4}|(?:46|60(?:[18][1-9]|[24-7][2-9]))\\d{6}",[8,10]],["333301[0-5]\\d{3}|3333(?:00|2[5-9]|[3-9]\\d)\\d{4}|(?:3(?:(?:0[0-5]|1\\d|5[01]|70)\\d|2(?:[0-3]\\d|4[1-9])|3(?:00|3[0-24-9]))|9(?:101|408))\\d{6}",[10]],["1800\\d{7}",[11]],["(?:19(?:0[01]|4[78])|901)\\d{7}",[10,11]]]],CR:["506","00","(?:8\\d|90)\\d{8}|(?:[24-8]\\d{3}|3005)\\d{4}",[8,10],[["(\\d{4})(\\d{4})","$1 $2",["[2-7]|8[3-9]"]],["(\\d{3})(\\d{3})(\\d{4})","$1-$2-$3",["[89]"]]],0,0,"(19(?:0[0-2468]|1[09]|20|66|77|99))",0,0,0,[["210[7-9]\\d{4}|2(?:[024-7]\\d|1[1-9])\\d{5}",[8]],["(?:3005\\d|6500[01])\\d{3}|(?:5[07]|6[0-4]|7[0-3]|8[3-9])\\d{6}",[8]],["800\\d{7}",[10]],["90[059]\\d{7}",[10]],0,0,0,0,["(?:210[0-6]|4\\d{3}|5100)\\d{4}",[8]]]],CU:["53","119","(?:[2-7]|8\\d\\d)\\d{7}|[2-47]\\d{6}|[34]\\d{5}",[6,7,8,10],[["(\\d{2})(\\d{4,6})","$1 $2",["2[1-4]|[34]"],"(0$1)"],["(\\d)(\\d{6,7})","$1 $2",["7"],"(0$1)"],["(\\d)(\\d{7})","$1 $2",["[56]"],"0$1"],["(\\d{3})(\\d{7})","$1 $2",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:3[23]|4[89])\\d{4,6}|(?:31|4[36]|8(?:0[25]|78)\\d)\\d{6}|(?:2[1-4]|4[1257]|7\\d)\\d{5,6}"],["(?:5\\d|6[2-4])\\d{6}",[8]],["800\\d{7}",[10]],0,0,0,0,0,0,["807\\d{7}",[10]]]],CV:["238","0","(?:[2-59]\\d\\d|800)\\d{4}",[7],[["(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3",["[2-589]"]]],0,0,0,0,0,0,[["2(?:2[1-7]|3[0-8]|4[12]|5[1256]|6\\d|7[1-3]|8[1-5])\\d{4}"],["(?:36|5[1-389]|9\\d)\\d{5}"],["800\\d{4}"],0,0,0,0,0,["(?:3[3-5]|4[356])\\d{5}"]]],CW:["599","00","(?:[34]1|60|(?:7|9\\d)\\d)\\d{5}",[7,8],[["(\\d{3})(\\d{4})","$1 $2",["[3467]"]],["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["9[4-8]"]]],0,0,0,0,0,"[69]",[["9(?:4(?:3[0-5]|4[14]|6\\d)|50\\d|7(?:2[014]|3[02-9]|4[4-9]|6[357]|77|8[7-9])|8(?:3[39]|[46]\\d|7[01]|8[57-9]))\\d{4}"],["953[01]\\d{4}|9(?:5[12467]|6[5-9])\\d{5}"],0,0,0,0,0,["955\\d{5}",[8]],0,["60[0-2]\\d{4}",[7]]]],CX:["61","001[14-689]|14(?:1[14]|34|4[17]|[56]6|7[47]|88)0011","1(?:[0-79]\\d{8}(?:\\d{2})?|8[0-24-9]\\d{7})|[148]\\d{8}|1\\d{5,7}",[6,7,8,9,10,12],0,"0",0,"([59]\\d{7})$|0","8$1",0,0,[["8(?:51(?:0(?:01|30|59|88)|1(?:17|46|75)|2(?:22|35))|91(?:00[6-9]|1(?:[28]1|49|78)|2(?:09|63)|3(?:12|26|75)|4(?:56|97)|64\\d|7(?:0[01]|1[0-2])|958))\\d{3}",[9]],["4(?:79[01]|83[0-36-9]|95[0-3])\\d{5}|4(?:[0-36]\\d|4[047-9]|[58][0-24-9]|7[02-8]|9[0-47-9])\\d{6}",[9]],["180(?:0\\d{3}|2)\\d{3}",[7,10]],["190[0-26]\\d{6}",[10]],0,0,0,0,["14(?:5(?:1[0458]|[23][458])|71\\d)\\d{4}",[9]],["13(?:00\\d{6}(?:\\d{2})?|45[0-4]\\d{3})|13\\d{4}",[6,8,10,12]]],"0011"],CY:["357","00","(?:[279]\\d|[58]0)\\d{6}",[8],[["(\\d{2})(\\d{6})","$1 $2",["[257-9]"]]],0,0,0,0,0,0,[["2[2-6]\\d{6}"],["9(?:10|[4-79]\\d)\\d{5}"],["800\\d{5}"],["90[09]\\d{5}"],["700\\d{5}"],0,["(?:50|77)\\d{6}"],0,0,["80[1-9]\\d{5}"]]],CZ:["420","00","(?:[2-578]\\d|60)\\d{7}|9\\d{8,11}",[9,10,11,12],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[2-8]|9[015-7]"]],["(\\d{2})(\\d{3})(\\d{3})(\\d{2})","$1 $2 $3 $4",["96"]],["(\\d{2})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["9"]],["(\\d{3})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["9"]]],0,0,0,0,0,0,[["(?:2\\d|3[1257-9]|4[16-9]|5[13-9])\\d{7}",[9]],["7060\\d{5}|(?:60[1-8]|7(?:0[2-5]|19|[2379]\\d))\\d{6}",[9]],["800\\d{6}",[9]],["9(?:0[05689]|76)\\d{6}",[9]],["70[01]\\d{6}",[9]],["9(?:3\\d{9}|6\\d{7,10})"],["9(?:5\\d|7[2-4])\\d{6}",[9]],0,["9[17]0\\d{6}",[9]],["8[134]\\d{7}",[9]]]],DE:["49","00","[2579]\\d{5,14}|49(?:[34]0|69|8\\d)\\d\\d?|49(?:37|49|60|7[089]|9\\d)\\d{1,3}|49(?:2[024-9]|3[2-689]|7[1-7])\\d{1,8}|(?:1|[368]\\d|4[0-8])\\d{3,13}|49(?:[015]\\d|2[13]|31|[46][1-8])\\d{1,9}",[4,5,6,7,8,9,10,11,12,13,14,15],[["(\\d{2})(\\d{3,13})","$1 $2",["3[02]|40|[68]9"],"0$1"],["(\\d{3})(\\d{3,12})","$1 $2",["2(?:0[1-389]|1[124]|2[18]|3[14])|3(?:[35-9][15]|4[015])|906|(?:2[4-9]|4[2-9]|[579][1-9]|[68][1-8])1","2(?:0[1-389]|12[0-8])|3(?:[35-9][15]|4[015])|906|2(?:[13][14]|2[18])|(?:2[4-9]|4[2-9]|[579][1-9]|[68][1-8])1"],"0$1"],["(\\d{4})(\\d{2,11})","$1 $2",["[24-6]|3(?:[3569][02-46-9]|4[2-4679]|7[2-467]|8[2-46-8])|70[2-8]|8(?:0[2-9]|[1-8])|90[7-9]|[79][1-9]","[24-6]|3(?:3(?:0[1-467]|2[127-9]|3[124578]|7[1257-9]|8[1256]|9[145])|4(?:2[135]|4[13578]|9[1346])|5(?:0[14]|2[1-3589]|6[1-4]|7[13468]|8[13568])|6(?:2[1-489]|3[124-6]|6[13]|7[12579]|8[1-356]|9[135])|7(?:2[1-7]|4[145]|6[1-5]|7[1-4])|8(?:21|3[1468]|6|7[1467]|8[136])|9(?:0[12479]|2[1358]|4[134679]|6[1-9]|7[136]|8[147]|9[1468]))|70[2-8]|8(?:0[2-9]|[1-8])|90[7-9]|[79][1-9]|3[68]4[1347]|3(?:47|60)[1356]|3(?:3[46]|46|5[49])[1246]|3[4579]3[1357]"],"0$1"],["(\\d{3})(\\d{4})","$1 $2",["138"],"0$1"],["(\\d{5})(\\d{2,10})","$1 $2",["3"],"0$1"],["(\\d{3})(\\d{5,11})","$1 $2",["181"],"0$1"],["(\\d{3})(\\d)(\\d{4,10})","$1 $2 $3",["1(?:3|80)|9"],"0$1"],["(\\d{3})(\\d{7,8})","$1 $2",["1[67]"],"0$1"],["(\\d{3})(\\d{7,12})","$1 $2",["8"],"0$1"],["(\\d{5})(\\d{6})","$1 $2",["185","1850","18500"],"0$1"],["(\\d{3})(\\d{4})(\\d{4})","$1 $2 $3",["7"],"0$1"],["(\\d{4})(\\d{7})","$1 $2",["18[68]"],"0$1"],["(\\d{4})(\\d{7})","$1 $2",["15[1279]"],"0$1"],["(\\d{5})(\\d{6})","$1 $2",["15[03568]","15(?:[0568]|3[13])"],"0$1"],["(\\d{3})(\\d{8})","$1 $2",["18"],"0$1"],["(\\d{3})(\\d{2})(\\d{7,8})","$1 $2 $3",["1(?:6[023]|7)"],"0$1"],["(\\d{4})(\\d{2})(\\d{7})","$1 $2 $3",["15[279]"],"0$1"],["(\\d{3})(\\d{2})(\\d{8})","$1 $2 $3",["15"],"0$1"]],"0",0,0,0,0,0,[["32\\d{9,11}|49[1-6]\\d{10}|322\\d{6}|49[0-7]\\d{3,9}|(?:[34]0|[68]9)\\d{3,13}|(?:2(?:0[1-689]|[1-3569]\\d|4[0-8]|7[1-7]|8[0-7])|3(?:[3569]\\d|4[0-79]|7[1-7]|8[1-8])|4(?:1[02-9]|[2-48]\\d|5[0-6]|6[0-8]|7[0-79])|5(?:0[2-8]|[124-6]\\d|[38][0-8]|[79][0-7])|6(?:0[02-9]|[1-358]\\d|[47][0-8]|6[1-9])|7(?:0[2-8]|1[1-9]|[27][0-7]|3\\d|[4-6][0-8]|8[0-5]|9[013-7])|8(?:0[2-9]|1[0-79]|2\\d|3[0-46-9]|4[0-6]|5[013-9]|6[1-8]|7[0-8]|8[0-24-6])|9(?:0[6-9]|[1-4]\\d|[589][0-7]|6[0-8]|7[0-467]))\\d{3,12}",[5,6,7,8,9,10,11,12,13,14,15]],["1(?:6[023]|7\\d)\\d{7,8}|15(?:[0-25-9]\\d\\d|3(?:10|33))\\d{6}",[10,11]],["800\\d{7,12}",[10,11,12,13,14,15]],["(?:137[7-9]|900(?:[135]|9\\d))\\d{6}",[10,11]],["700\\d{8}",[11]],["1(?:6(?:013|255|399)|7(?:(?:[015]1|[69]3)3|[2-4]55|[78]99))\\d{7,8}|15(?:(?:[03-68]00|113)\\d|2\\d55|7\\d99|9\\d33)\\d{7}",[12,13]],["18(?:1\\d{5,11}|[2-9]\\d{8})",[8,9,10,11,12,13,14]],["16(?:4\\d{1,10}|[89]\\d{1,11})",[4,5,6,7,8,9,10,11,12,13,14]],0,["180\\d{5,11}|13(?:7[1-6]\\d\\d|8)\\d{4}",[7,8,9,10,11,12,13,14]]]],DJ:["253","00","(?:2\\d|77)\\d{6}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[27]"]]],0,0,0,0,0,0,[["2(?:1[2-5]|7[45])\\d{5}"],["77\\d{6}"]]],DK:["45","00","[2-9]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2-9]"]]],0,0,0,0,0,0,[["(?:2(?:[0-59][1-9]|[6-8]\\d)|3(?:[0-3][1-9]|4[13]|5[1-58]|6[1347-9]|7\\d|8[1-8]|9[1-79])|4(?:[0-25][1-9]|[34][2-9]|6[13-579]|7[13579]|8[1-47]|9[127])|5(?:[0-36][1-9]|4[146-9]|5[3-57-9]|7[568]|8[1-358]|9[1-69])|6(?:[0135][1-9]|2[1-68]|4[2-8]|6[1689]|[78]\\d|9[15689])|7(?:[0-69][1-9]|7[3-9]|8[147])|8(?:[16-9][1-9]|2[1-58])|9(?:[1-47-9][1-9]|6\\d))\\d{5}"],["(?:2[6-8]|37|6[78]|96)\\d{6}|(?:2[0-59]|3[0-689]|[457]\\d|6[0-69]|8[126-9]|9[1-47-9])[1-9]\\d{5}"],["80\\d{6}"],["90\\d{6}"]]],DM:["1","011","(?:[58]\\d\\d|767|900)\\d{7}",[10],0,"1",0,"([2-7]\\d{6})$|1","767$1",0,"767",[["767(?:2(?:55|66)|4(?:2[01]|4[0-25-9])|50[0-4])\\d{4}"],["767(?:2(?:[2-4689]5|7[5-7])|31[5-7]|61[1-8]|70[1-6])\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],DO:["1","011","(?:[58]\\d\\d|900)\\d{7}",[10],0,"1",0,0,0,0,"8001|8[024]9",[["8(?:[04]9[2-9]\\d\\d|29(?:2(?:[0-59]\\d|6[04-9]|7[0-27]|8[0237-9])|3(?:[0-35-9]\\d|4[7-9])|[45]\\d\\d|6(?:[0-27-9]\\d|[3-5][1-9]|6[0135-8])|7(?:0[013-9]|[1-37]\\d|4[1-35689]|5[1-4689]|6[1-57-9]|8[1-79]|9[1-8])|8(?:0[146-9]|1[0-48]|[248]\\d|3[1-79]|5[01589]|6[013-68]|7[124-8]|9[0-8])|9(?:[0-24]\\d|3[02-46-9]|5[0-79]|60|7[0169]|8[57-9]|9[02-9])))\\d{4}"],["8[024]9[2-9]\\d{6}"],["800(?:14|[2-9]\\d)\\d{5}|8[024]9[01]\\d{6}|8(?:33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],DZ:["213","00","(?:[1-4]|[5-79]\\d|80)\\d{7}",[8,9],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[1-4]"],"0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["9"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[5-8]"],"0$1"]],"0",0,0,0,0,0,[["9619\\d{5}|(?:[1-3]\\d|4[013-689])\\d{6}"],["5(?:4[0-29]|6[0-4])\\d{6}|(?:55|6\\d|7[7-9])\\d{7}",[9]],["800\\d{6}",[9]],["80[3-689]1\\d{5}",[9]],0,0,0,0,["98[23]\\d{6}",[9]],["80[12]1\\d{5}",[9]]]],EC:["593","00","1\\d{9,10}|(?:[2-7]|9\\d)\\d{7}",[8,9,10,11],[["(\\d)(\\d{3})(\\d{4})","$1 $2-$3",["[2-7]"],"(0$1)",0,"$1-$2-$3"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["9"],"0$1"],["(\\d{4})(\\d{3})(\\d{3,4})","$1 $2 $3",["1"]]],"0",0,0,0,0,0,[["[2-7][2-7]\\d{6}",[8]],["964[0-2]\\d{5}|9(?:39|[57][89]|6[0-36-9]|[89]\\d)\\d{6}",[9]],["1800\\d{7}|1[78]00\\d{6}",[10,11]],0,0,0,0,0,["[2-7]890\\d{4}",[8]]]],EE:["372","00","8\\d{9}|[4578]\\d{7}|(?:[3-8]\\d|90)\\d{5}",[7,8,10],[["(\\d{3})(\\d{4})","$1 $2",["[369]|4[3-8]|5(?:[0-2]|5[0-478]|6[45])|7[1-9]|88","[369]|4[3-8]|5(?:[02]|1(?:[0-8]|95)|5[0-478]|6(?:4[0-4]|5[1-589]))|7[1-9]|88"]],["(\\d{4})(\\d{3,4})","$1 $2",["[45]|8(?:00|[1-49])","[45]|8(?:00[1-9]|[1-49])"]],["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["7"]],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["(?:3[23589]|4[3-8]|6\\d|7[1-9]|88)\\d{5}",[7]],["(?:5\\d{5}|8(?:1(?:0(?:0(?:00|[178]\\d)|[3-9]\\d\\d)|(?:1(?:0[2-6]|1\\d)|[2-79]\\d\\d)\\d)|2(?:0(?:0(?:00|4\\d)|(?:19|[2-7]\\d)\\d)|(?:(?:[124-69]\\d|3[5-9])\\d|7(?:[0-79]\\d|8[013-9])|8(?:[2-6]\\d|7[01]))\\d)|[349]\\d{4}))\\d\\d|5(?:(?:[02]\\d|5[0-478])\\d|1(?:[0-8]\\d|95)|6(?:4[0-4]|5[1-589]))\\d{3}",[7,8]],["800(?:(?:0\\d\\d|1)\\d|[2-9])\\d{3}"],["(?:40\\d\\d|900)\\d{4}",[7,8]],["70[0-2]\\d{5}",[8]]]],EG:["20","00","[189]\\d{8,9}|[24-6]\\d{8}|[135]\\d{7}",[8,9,10],[["(\\d)(\\d{7,8})","$1 $2",["[23]"],"0$1"],["(\\d{2})(\\d{6,7})","$1 $2",["1[35]|[4-6]|8[2468]|9[235-7]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[89]"],"0$1"],["(\\d{2})(\\d{8})","$1 $2",["1"],"0$1"]],"0",0,0,0,0,0,[["13[23]\\d{6}|(?:15|57)\\d{6,7}|(?:2\\d|3|4[05-8]|5[05]|6[24-689]|8[2468]|9[235-7])\\d{7}",[8,9]],["1[0-25]\\d{8}",[10]],["800\\d{7}",[10]],["900\\d{7}",[10]]]],EH:["212","00","[5-8]\\d{8}",[9],0,"0",0,0,0,0,0,[["528[89]\\d{5}"],["(?:6(?:[0-79]\\d|8[0-247-9])|7(?:[016-8]\\d|2[0-8]|3[01]|5[0-5]))\\d{6}"],["80[0-7]\\d{6}"],["89\\d{7}"],0,0,0,0,["(?:592(?:4[0-2]|93)|80[89]\\d\\d)\\d{4}"]]],ER:["291","00","[178]\\d{6}",[7],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["[178]"],"0$1"]],"0",0,0,0,0,0,[["(?:1(?:1[12568]|[24]0|55|6[146])|8\\d\\d)\\d{4}"],["(?:17[1-3]|7\\d\\d)\\d{4}"]]],ES:["34","00","(?:400|[5-9]\\d\\d)\\d{6}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[89]00"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[4-9]"]]],0,0,0,0,0,0,[["96906(?:0[0-8]|1[1-9]|[2-9]\\d)\\d\\d|9(?:69(?:0[0-57-9]|[1-9]\\d)|73(?:[0-8]\\d|9[1-9]))\\d{4}|(?:400|8(?:[1356]\\d|[28][0-8]|[47][1-9])|9(?:[135]\\d|[268][0-8]|4[1-9]|7[124-9]))\\d{6}"],["96906(?:09|10)\\d\\d|(?:590(?:10[0-2]|600)|97390\\d)\\d{3}|(?:6\\d|7[1-48])\\d{7}"],["[89]00\\d{6}"],["80[367]\\d{6}"],["70\\d{7}"],0,["51\\d{7}"],0,0,["90[12]\\d{6}"]]],ET:["251","00","(?:11|[2-57-9]\\d)\\d{7}",[9],[["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[1-57-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:11(?:[124]\\d\\d|3(?:[0-79]\\d|8[0-7])|5(?:[02-9]\\d|1[0-57-9])|6(?:[02-79]\\d|1[0-57-9]|8[0-8]))|2(?:2(?:11[1-9]|22[0-7]|33\\d|44[1467]|66[1-68])|5(?:11[124-6]|33[2-8]|44[1467]|55[14]|66[1-3679]|77[124-79]|880))|3(?:3(?:11[0-46-8]|(?:22|55)[0-6]|33[0134689]|44[04]|66[01467])|4(?:44[0-8]|55[0-69]|66[0-3]|77[1-5]))|4(?:6(?:119|22[0-24-7]|33[1-5]|44[13-69]|55[14-689]|660|88[1-4])|7(?:(?:11|22)[1-9]|33[13-7]|44[13-6]|55[1-689]))|5(?:7(?:227|55[05]|(?:66|77)[14-8])|8(?:11[149]|22[013-79]|33[0-68]|44[013-8]|550|66[1-5]|77\\d)))\\d{4}"],["700[1-9]\\d{5}|(?:7(?:0[1-9]|1[0-8]|2[1-35-79]|3\\d|77|86|99)|(?:8[01]|9\\d)\\d)\\d{6}"]]],FI:["358","00|99(?:[01469]|5(?:[14]1|3[23]|5[59]|77|88|9[09]))","[1-35689]\\d{4}|7\\d{10,11}|(?:[124-7]\\d|3[0-46-9])\\d{8}|[1-9]\\d{5,8}",[5,6,7,8,9,10,11,12],[["(\\d{5})","$1",["20[2-59]"],"0$1"],["(\\d{3})(\\d{3,7})","$1 $2",["(?:[1-3]0|[68])0|70[07-9]"],"0$1"],["(\\d{2})(\\d{4,8})","$1 $2",["[14]|2[09]|50|7[135]"],"0$1"],["(\\d{2})(\\d{6,10})","$1 $2",["7"],"0$1"],["(\\d)(\\d{4,9})","$1 $2",["(?:19|[2568])[1-8]|3(?:0[1-9]|[1-9])|9"],"0$1"]],"0",0,0,0,0,"1[03-79]|[2-9]",[["1[3-7][1-8]\\d{3,6}|(?:19[1-8]|[23568][1-8]\\d|9(?:00|[1-8]\\d))\\d{2,6}",[5,6,7,8,9]],["4946\\d{2,6}|(?:4[0-8]|50)\\d{4,8}",[6,7,8,9,10]],["800\\d{4,6}",[7,8,9]],["[67]00\\d{5,6}",[8,9]],0,0,["20\\d{4,8}|60[12]\\d{5,6}|7(?:099\\d{4,5}|5[03-9]\\d{3,7})|20[2-59]\\d\\d|(?:606|7(?:0[78]|1|3\\d))\\d{7}|(?:10|29|3[09]|70[1-5]\\d)\\d{4,8}"]],"00"],FJ:["679","0(?:0|52)","45\\d{5}|(?:0800\\d|[235-9])\\d{6}",[7,11],[["(\\d{3})(\\d{4})","$1 $2",["[235-9]|45"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["0"]]],0,0,0,0,0,0,[["603\\d{4}|(?:3[0-6]|6[25-7]|8[58])\\d{5}",[7]],["(?:[279]\\d|45|5[01568]|8[034679])\\d{5}",[7]],["0800\\d{7}",[11]]],"00"],FK:["500","00","[2-7]\\d{4}",[5],0,0,0,0,0,0,0,[["[2-47]\\d{4}"],["[56]\\d{4}"]]],FM:["691","00","(?:[39]\\d\\d|820)\\d{4}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[389]"]]],0,0,0,0,0,0,[["31(?:00[67]|208|309)\\d\\d|(?:3(?:[2357]0[1-9]|602|804|905)|(?:820|9[2-6]\\d)\\d)\\d{3}"],["31(?:00[67]|208|309)\\d\\d|(?:3(?:[2357]0[1-9]|602|804|905)|(?:820|9[2-7]\\d)\\d)\\d{3}"]]],FO:["298","00","[2-9]\\d{5}",[6],[["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["[2-9]"]]],0,0,"(10(?:01|[12]0|88))",0,0,0,[["(?:20|[34]\\d|8[19])\\d{4}"],["(?:[27][1-9]|5\\d|9[16])\\d{4}"],["80[257-9]\\d{3}"],["90(?:[13-5][15-7]|2[125-7]|9\\d)\\d\\d"],0,0,0,0,["6[0-36]\\d{4}"]]],FR:["33","00","[1-9]\\d{8}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"],"0 $1"],["(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["[1-79]"],"0$1"]],"0",0,0,0,0,0,[["(?:26[013-9]|59[1-35-9])\\d{6}|(?:[13]\\d|2[0-57-9]|4[1-9]|5[0-8])\\d{7}"],["(?:6(?:[0-24-8]\\d|3[0-8]|9[589])|7[3-9]\\d)\\d{6}"],["80[0-5]\\d{6}"],["836(?:0[0-36-9]|[1-9]\\d)\\d{4}|8(?:1[2-9]|2[2-47-9]|3[0-57-9]|[569]\\d|8[0-35-9])\\d{6}"],0,0,["80[6-9]\\d{6}"],0,["9\\d{8}"],["8(?:1[01]|2[0156]|4[024]|84)\\d{6}"]]],GA:["241","00","(?:[067]\\d|11)\\d{6}|[2-7]\\d{6}",[7,8],[["(\\d)(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2-7]"],"0$1"],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["0"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["11|[67]"],"0$1"]],0,0,"0(11\\d{6}|60\\d{6}|61\\d{6}|6[256]\\d{6}|7[467]\\d{6})","$1",0,0,[["[01]1\\d{6}",[8]],["(?:(?:0[2-7]|7[467])\\d|6(?:0[0-4]|10|[256]\\d))\\d{5}|[2-7]\\d{6}"]]],GB:["44","00","[1-357-9]\\d{9}|[18]\\d{8}|8\\d{6}",[7,9,10],[["(\\d{3})(\\d{4})","$1 $2",["800","8001","80011","800111","8001111"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3",["845","8454","84546","845464"],"0$1"],["(\\d{3})(\\d{6})","$1 $2",["800"],"0$1"],["(\\d{5})(\\d{4,5})","$1 $2",["1(?:38|5[23]|69|76|94)","1(?:(?:38|69)7|5(?:24|39)|768|946)","1(?:3873|5(?:242|39[4-6])|(?:697|768)[347]|9467)"],"0$1"],["(\\d{4})(\\d{5,6})","$1 $2",["1(?:[2-69][02-9]|[78])"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["[25]|7(?:0|6[02-9])","[25]|7(?:0|6(?:[03-9]|2[356]))"],"0$1"],["(\\d{4})(\\d{6})","$1 $2",["7"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[1389]"],"0$1"]],"0",0,"0|180020",0,0,0,[["(?:1(?:1(?:3(?:[0-58]\\d\\d|73[0-5])|4(?:(?:[0-5]\\d|70)\\d|69[7-9])|(?:(?:5[0-26-9]|[78][0-49])\\d|6(?:[0-4]\\d|5[01]))\\d)|(?:2(?:(?:0[024-9]|2[3-9]|3[3-79]|4[1-689]|[58][02-9]|6[0-47-9]|7[013-9]|9\\d)\\d|1(?:[0-7]\\d|8[0-3]))|(?:3(?:0\\d|1[0-8]|[25][02-9]|3[02-579]|[468][0-46-9]|7[1-35-79]|9[2-578])|4(?:0[03-9]|[137]\\d|[28][02-57-9]|4[02-69]|5[0-8]|[69][0-79])|5(?:0[1-35-9]|[16]\\d|2[024-9]|3[015689]|4[02-9]|5[03-9]|7[0-35-9]|8[0-468]|9[0-57-9])|6(?:0[034689]|1\\d|2[0-35689]|[38][013-9]|4[1-467]|5[0-69]|6[13-9]|7[0-8]|9[0-24578])|7(?:0[0246-9]|2\\d|3[0236-8]|4[03-9]|5[0-46-9]|6[013-9]|7[0-35-9]|8[024-9]|9[02-9])|8(?:0[35-9]|2[1-57-9]|3[02-578]|4[0-578]|5[124-9]|6[2-69]|7\\d|8[02-9]|9[02569])|9(?:0[02-589]|[18]\\d|2[02-689]|3[1-57-9]|4[2-9]|5[0-579]|6[2-47-9]|7[0-24578]|9[2-57]))\\d)\\d)|2(?:0[013478]|3[0189]|4[017]|8[0-46-9]|9[0-2])\\d{3})\\d{4}|1(?:2(?:0(?:46[1-4]|87[2-9])|545[1-79]|76(?:2\\d|3[1-8]|6[1-6])|9(?:7(?:2[0-4]|3[2-5])|8(?:2[2-8]|7[0-47-9]|8[3-5])))|3(?:6(?:38[2-5]|47[23])|8(?:47[04-9]|64[0157-9]))|4(?:044[1-7]|20(?:2[23]|8\\d)|6(?:0(?:30|5[2-57]|6[1-8]|7[2-8])|140)|8(?:052|87[1-3]))|5(?:2(?:4(?:3[2-79]|6\\d)|76\\d)|6(?:26[06-9]|686))|6(?:06(?:4\\d|7[4-79])|295[5-7]|35[34]\\d|47(?:24|61)|59(?:5[08]|6[67]|74)|9(?:55[0-4]|77[23]))|7(?:26(?:6[13-9]|7[0-7])|(?:442|688)\\d|50(?:2[0-3]|[3-68]2|76))|8(?:27[56]\\d|37(?:5[2-5]|8[239])|843[2-58])|9(?:0(?:0(?:6[1-8]|85)|52\\d)|3583|4(?:66[1-8]|9(?:2[01]|81))|63(?:23|3[1-4])|9561))\\d{3}",[9,10]],["7(?:457[0-57-9]|700[01]|911[028])\\d{5}|7(?:[1-3]\\d\\d|4(?:[0-46-9]\\d|5[0-689])|5(?:0[0-8]|[13-9]\\d|2[0-35-9])|7(?:0[1-9]|[1-7]\\d|8[02-9]|9[0-689])|8(?:[014-9]\\d|[23][0-8])|9(?:[024-9]\\d|1[02-9]|3[0-689]))\\d{6}",[10]],["80[08]\\d{7}|800\\d{6}|8001111"],["(?:8(?:4[2-5]|7[0-3])|9(?:[01]\\d|8[2-49]))\\d{7}|845464\\d",[7,10]],["70\\d{8}",[10]],0,["(?:3[0347]|55)\\d{8}",[10]],["76(?:464|652)\\d{5}|76(?:0[0-28]|2[356]|34|4[01347]|5[49]|6[0-369]|77|8[14]|9[139])\\d{6}",[10]],["56\\d{8}",[10]]],0," x"],GD:["1","011","(?:473|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","473$1",0,"473",[["473(?:2(?:3[0-2]|69)|3(?:2[89]|86)|4(?:[06]8|3[5-9]|4[0-4]|5[59]|73|90)|63[68]|7(?:58|84)|800|938)\\d{4}"],["473(?:4(?:0[2-79]|1[04-9]|2[0-5]|49|5[6-8])|5(?:2[01]|3[3-8])|901)\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],GE:["995","00","(?:[3-57]\\d\\d|800)\\d{6}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["70"],"0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["32"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[57]"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[348]"],"0$1"]],"0",0,0,0,0,0,[["(?:3(?:[256]\\d|4[124-9]|7[0-4])|4(?:1\\d|2[2-7]|3[1-79]|4[2-8]|7[239]|9[1-7]))\\d{6}"],["5(?:(?:(?:0555|1(?:[17]77|555))[5-9]|757(?:7[7-9]|8[01]))\\d|22252[0-4])\\d\\d|5(?:0(?:0(?:1[09]|70)|505)|1(?:0[01]0|1(?:07|33|51))|2(?:0[02]0|2[25]2)|3(?:0[03]0|3[35]3)|4(?:0[04]0|411)|5222|9000)[0-4]\\d{3}|(?:5(?:0(?:0(?:0\\d|1[12]|2[02]|3[0-6]|4[04]|5[05]|77|88|9[09])|(?:[14]\\d|77)\\d|22[02])|1(?:1(?:[03][01]|[124]\\d|5[02-6]|7[0-6])|4\\d\\d)|2(?:228|555)|3555|4(?:4(?:[02-9]\\d|14)|555)|5(?:[0157-9]\\d\\d|200|333|4(?:44|55))|6[89]\\d\\d|7(?:(?:[0147-9]\\d|22)\\d|5(?:00|[57]5))|8(?:0(?:[018]\\d|2[0-4])|5(?:55|8[89])|8(?:55|88))|9(?:090|[1-35-9]\\d\\d))|790\\d\\d)\\d{4}"],["800\\d{6}"],0,0,0,0,0,["70[67]\\d{6}"]]],GF:["594","00","(?:694\\d|7093)\\d{5}|(?:59|[89]\\d)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[5-7]|80[6-9]|9[47]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[89]"],"0$1"]],"0",0,0,0,0,0,[["(?:59(?:4(?:[02-49]\\d|1[0-5]|5[6-9]|6[0-3]|80)|88\\d)|80[6-9]\\d\\d)\\d{4}"],["(?:694(?:[0-249]\\d|3[0-8])|7093[0-3])\\d{4}"],["80[0-5]\\d{6}"],["8[129]\\d{7}"],0,0,0,0,["9(?:(?:396|76\\d)\\d|476[0-6])\\d{4}"]]],GG:["44","00","(?:1481|[357-9]\\d{3})\\d{6}|8\\d{6}(?:\\d{2})?",[7,9,10],0,"0",0,"([25-9]\\d{5})$|0|180020","1481$1",0,0,[["1481[25-9]\\d{5}",[10]],["7(?:(?:781|839)\\d|911[17])\\d{5}",[10]],["80[08]\\d{7}|800\\d{6}|8001111"],["(?:8(?:4[2-5]|7[0-3])|9(?:[01]\\d|8[0-3]))\\d{7}|845464\\d",[7,10]],["70\\d{8}",[10]],0,["(?:3[0347]|55)\\d{8}",[10]],["76(?:464|652)\\d{5}|76(?:0[0-28]|2[356]|34|4[01347]|5[49]|6[0-369]|77|8[14]|9[139])\\d{6}",[10]],["56\\d{8}",[10]]]],GH:["233","00","[235]\\d{8}|800\\d{5,6}",[8,9],[["(\\d{3})(\\d{5})","$1 $2",["8"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[2358]"],"0$1"]],"0",0,0,0,0,0,[["3082[0-5]\\d{4}|3(?:0(?:[237]\\d|8[01])|[167](?:2[0-6]|7\\d|80)|2(?:2[0-5]|7\\d|80)|3(?:2[0-3]|7\\d|80)|4(?:2[013-9]|3[01]|7\\d|80)|5(?:2[0-7]|7\\d|80)|8(?:2[0-2]|7\\d|80)|9(?:[28]0|7\\d))\\d{5}",[9]],["(?:2(?:[0346-9]\\d|5[67])|5(?:[03-7]\\d|9[1-9]))\\d{6}",[9]],["800\\d{5,6}"]]],GI:["350","00","(?:[25]\\d|60)\\d{6}",[8],[["(\\d{3})(\\d{5})","$1 $2",["2"]]],0,0,0,0,0,0,[["2190[0-2]\\d{3}|2(?:0(?:[02]\\d|3[01])|16[24-9]|2[2-5]\\d)\\d{4}"],["5251[0-4]\\d{3}|(?:5(?:[146-8]\\d\\d|250)|60(?:1[01]|6\\d))\\d{4}"]]],GL:["299","00","(?:19|[2-689]\\d|70)\\d{4}",[6],[["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["19|[2-9]"]]],0,0,0,0,0,0,[["(?:19|3[1-7]|[68][1-9]|70|9\\d)\\d{4}"],["[245]\\d{5}"],["80\\d{4}"],0,0,0,0,0,["3[89]\\d{4}"]]],GM:["220","00","[48]\\d{8}|[2-9]\\d{6}",[7,9],[["(\\d{3})(\\d{4})","$1 $2",["[235-9]|4(?:[0-35]|4[16-9])"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[48]"]]],0,0,0,0,0,0,[["(?:4(?:[23]\\d\\d|4(?:1[024679]|(?:4(?:[237-9]\\d|4[14-9])|8[0-389]\\d)\\d|5(?:5(?:3\\d|4[0-7])|[67]\\d\\d)))|5(?:5(?:3\\d|4[0-7])|6[67]\\d|7(?:1[04]|2[035]|3[58]|48))|8[0-389]\\d\\d)\\d{3}|44[6-9]\\d{4}"],["(?:(?:[23679]\\d|4[015]|8(?:(?:3[35]|6[68]|99)\\d|7(?:[27]\\d|4[015])))\\d|5(?:[0-489]\\d|56))\\d{4}|8[4-7]\\d{5}"]]],GN:["224","00","722\\d{6}|(?:3|6\\d)\\d{7}",[8,9],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["3"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[67]"]]],0,0,0,0,0,0,[["3(?:0(?:24|3[12]|4[1-35-7]|5[13]|6[189]|[78]1|9[1478])|1\\d\\d)\\d{4}",[8]],["6[0-356]\\d{7}",[9]],0,0,0,0,0,0,["722\\d{6}",[9]]]],GP:["590","00","7090\\d{5}|(?:[56]9|[89]\\d)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[5-79]|80[6-9]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:59(?:0(?:0[1-68]|[14][0-24-9]|2[0-68]|3[1-9]|5[3-579]|[68][0-689]|7[08]|9\\d)|87\\d)|80[6-9]\\d\\d)\\d{4}"],["(?:69(?:0\\d\\d|1(?:2[2-9]|3[0-5]))|7090[0-4])\\d{4}"],["80[0-5]\\d{6}"],["8[129]\\d{7}"],0,0,0,0,["9(?:(?:39[5-7]|76[018])\\d|475[0-6])\\d{4}"]]],GQ:["240","00","222\\d{6}|(?:3\\d|55|[89]0)\\d{7}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[235]"]],["(\\d{3})(\\d{6})","$1 $2",["[89]"]]],0,0,0,0,0,0,[["33[0-24-9]\\d[46]\\d{4}|3(?:33|5\\d)\\d[7-9]\\d{4}"],["(?:222|55\\d)\\d{6}"],["80\\d[1-9]\\d{5}"],["90\\d[1-9]\\d{5}"]]],GR:["30","00","5005000\\d{3}|8\\d{9,11}|(?:[269]\\d|70)\\d{8}",[10,11,12],[["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["21|7"]],["(\\d{4})(\\d{6})","$1 $2",["2(?:2|3[2-57-9]|4[2-469]|5[2-59]|6[2-9]|7[2-69]|8[2-49])|5"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[2689]"]],["(\\d{3})(\\d{3,4})(\\d{5})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["2(?:1\\d\\d|2(?:2[1-46-9]|[36][1-8]|4[1-7]|5[1-4]|7[1-5]|[89][1-9])|3(?:1\\d|2[1-57]|[35][1-3]|4[13]|7[1-7]|8[124-6]|9[1-79])|4(?:1\\d|2[1-8]|3[1-4]|4[13-5]|6[1-578]|9[1-5])|5(?:1\\d|[29][1-4]|3[1-5]|4[124]|5[1-6])|6(?:1\\d|[269][1-6]|3[1245]|4[1-7]|5[13-9]|7[14]|8[1-5])|7(?:1\\d|2[1-5]|3[1-6]|4[1-7]|5[1-57]|6[135]|9[125-7])|8(?:1\\d|2[1-5]|[34][1-4]|9[1-57]))\\d{6}",[10]],["68[57-9]\\d{7}|(?:69|94)\\d{8}",[10]],["800\\d{7,9}"],["90[19]\\d{7}",[10]],["70\\d{8}",[10]],0,["5005000\\d{3}",[10]],0,0,["8(?:0[16]|12|[27]5|50)\\d{7}",[10]]]],GT:["502","00","80\\d{6}|(?:1\\d{3}|[2-7])\\d{7}",[8,11],[["(\\d{4})(\\d{4})","$1 $2",["[2-8]"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["1"]]],0,0,0,0,0,0,[["[267][2-9]\\d{6}",[8]],["(?:[3-5]\\d\\d|80[0-4])\\d{5}",[8]],["18[01]\\d{8}",[11]],["19\\d{9}",[11]]]],GU:["1","011","(?:[58]\\d\\d|671|900)\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","671$1",0,"671",[["671(?:2\\d\\d|3(?:00|3[39]|4[349]|55|6[26])|4(?:00|56|7[1-9]|8[02-9])|5(?:55|6[2-5]|88)|6(?:3[2-578]|4[24-9]|5[34]|78|8[235-9])|7(?:[0479]7|2[0167]|3[45]|8[7-9])|8(?:[2-57-9]8|6[478])|9(?:2[29]|6[79]|7[1279]|8[7-9]|9[16-9]))\\d{4}"],[""],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],GW:["245","00","[49]\\d{8}|4\\d{6}",[7,9],[["(\\d{3})(\\d{4})","$1 $2",["40"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[49]"]]],0,0,0,0,0,0,[["443\\d{6}",[9]],["9(?:5\\d|6[569]|77)\\d{6}",[9]],0,0,0,0,0,0,["40\\d{5}",[7]]]],GY:["592","001","(?:[2-8]\\d{3}|9008)\\d{3}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[2-9]"]]],0,0,0,0,0,0,[["(?:2(?:1[6-9]|2[0-35-9]|3[1-4]|5[3-9]|6\\d|7[0-79])|3(?:2[25-9]|3\\d)|4(?:4[0-24]|5[56])|50[0-6]|77[1-57])\\d{4}"],["(?:51[01]|6\\d\\d|7(?:[0-5]\\d|6[0-79]|70|8[067]))\\d{4}"],["(?:289|8(?:00|6[28]|88|99))\\d{4}"],["9008\\d{3}"],0,0,0,0,["515\\d{4}"]]],HK:["852","00(?:30|5[09]|[126-9]?)","8[0-46-9]\\d{6,7}|9\\d{4,7}|(?:[2-7]|9\\d{3})\\d{7}",[5,6,7,8,9,11],[["(\\d{3})(\\d{2,5})","$1 $2",["900","9003"]],["(\\d{4})(\\d{4})","$1 $2",["[2-7]|8[1-4]|9(?:0[1-9]|[1-8])"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["8"]],["(\\d{3})(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3 $4",["9"]]],0,0,0,0,0,0,[["(?:2(?:[13-9]\\d|2[013-9])\\d|3(?:(?:[1569][0-24-9]|4[0-246-9]|7[0-24-69])\\d|8(?:4[0-8]|[579]\\d|6[0-5]))|58(?:0[1-9]|1[2-9]))\\d{4}",[8]],["(?:4(?:0(?:6[0-3]|9[3-6])|24[3-6]|44[0-35-9]|6(?:4[0-57-9]|6[0-6])|7(?:4[0-48]|6[0-5]))|5(?:25[3-7]|35[4-8]|73[0-6]|95[0-8])|6(?:26[013-8]|(?:66|78)[0-5])|7(?:0(?:7[1-8]|8[0-8])|10[1-4])|84(?:4[0-2]|8[0-35-9])|9(?:29[013-9]|39[014-9]|59[0-467]|899))\\d{4}|(?:4(?:4[0-35-9]|6[0-357-9]|7[0-35])|5(?:[1-59][0-46-9]|6[0-4689]|7[0-246-9])|6(?:0[1-9]|[13-59]\\d|[268][0-57-9]|7[0-79])|70[1-59]|84[0-39]|9(?:0[1-9]|1[02-9]|[2358][0-8]|[467]\\d))\\d{5}",[8]],["800\\d{6}",[9]],["900(?:[0-24-9]\\d{7}|3\\d{1,4})",[5,6,7,8,11]],["8(?:1[0-4679]\\d|2(?:[0-36]\\d|7[0-4])|3(?:[034]\\d|2[09]|70))\\d{4}",[8]],0,["30(?:0[1-9]|[15-7]\\d|2[047]|89)\\d{4}",[8]],["7(?:1(?:0[08]|1[0-3679]|3[013]|69|9[0136])|2(?:[02389]\\d|1[18]|7[27-9])|3(?:[0-38]\\d|7[0-369]|9[2357-9])|47\\d|5(?:[178]\\d|5[0-5])|6(?:0[0-7]|2[236-9]|[35]\\d)|7(?:[27]\\d|8[7-9])|8(?:[23689]\\d|7[1-9])|9(?:[025]\\d|6[0-246-8]|7[0-36-9]|8[238]))\\d{4}",[8]]],"00"],HN:["504","00","8\\d{10}|[237-9]\\d{7}",[8,11],[["(\\d{4})(\\d{4})","$1-$2",["[237-9]"]]],0,0,0,0,0,0,[["2(?:2(?:0[0-59]|1[1-9]|[23]\\d|4[02-8]|5[57]|6[2458]|7[0135689]|8[01346-9]|9[0-2])|4(?:0[578]|2[3-59]|3[13-9]|4[0-68]|5[1-3589]|80)|5(?:0[2357-9]|1[1-6]|4[03-58]|5\\d|6[014-69]|7[04]|80)|6(?:[056]\\d|17|2[067]|3[047]|4[0-378]|[78][0-8]|9[01])|7(?:0[5-79]|2[01]|6[46-9]|7[02-9]|8[034]|91)|8(?:79|8[0-357-9]|9[1-57-9]))\\d{4}",[8]],["[37-9]\\d{7}",[8]],["8002\\d{7}",[11]]]],HR:["385","00","[2-69]\\d{8}|80\\d{5,7}|[1-79]\\d{7}|6\\d{6}",[7,8,9],[["(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3",["6[01]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2,3})","$1 $2 $3",["8"],"0$1"],["(\\d)(\\d{4})(\\d{3})","$1 $2 $3",["1"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["6|7[245]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["9"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[2-57]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["8"],"0$1"]],"0",0,0,0,0,0,[["1\\d{7}|(?:2[0-3]|3[1-5]|4[02-47-9]|5[1-3])\\d{6,7}",[8,9]],["9(?:(?:0[1-9]|[12589]\\d)\\d\\d|7(?:[0679]\\d\\d|5(?:[01]\\d|44|55|77|9[5-79])))\\d{4}|98\\d{6}",[8,9]],["80\\d{5,7}"],["6[01459]\\d{6}|6[01]\\d{5}",[7,8]],["7[45]\\d{6}",[8]],0,["62\\d{6,7}|72\\d{6}",[8,9]]]],HT:["509","00","[2-589]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["[2-589]"]]],0,0,0,0,0,0,[["2(?:2\\d|5[1-5]|81|9[149])\\d{5}"],["(?:[34]\\d|5[568])\\d{6}"],["8\\d{7}"],0,0,0,0,0,["9(?:[67][0-4]|8[0-3589]|9\\d)\\d{5}"]]],HU:["36","00","[235-7]\\d{8}|[1-9]\\d{7}",[8,9],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["1"],"(06 $1)"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[27][2-9]|3[2-7]|4[24-9]|5[2-79]|6|8[2-57-9]|9[2-69]"],"(06 $1)"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[2-9]"],"06 $1"]],"06",0,0,0,0,0,[["(?:1\\d|[27][2-9]|3[2-7]|4[24-9]|5[2-79]|6[23689]|8[2-57-9]|9[2-69])\\d{6}",[8]],["(?:[257]0|3[01])\\d{7}",[9]],["(?:[48]0\\d|680[29])\\d{5}"],["9[01]\\d{6}",[8]],0,0,["38\\d{7}",[9]],0,["21\\d{7}",[9]]]],ID:["62","00[89]","00[1-9]\\d{9,14}|(?:[1-36]|8\\d{5})\\d{6}|00\\d{9}|[1-9]\\d{8,10}|[2-9]\\d{7}",[7,8,9,10,11,12,13,14,15,16,17],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["15"]],["(\\d{2})(\\d{5,9})","$1 $2",["2[124]|[36]1"],"(0$1)"],["(\\d{3})(\\d{5,7})","$1 $2",["800"],"0$1"],["(\\d{3})(\\d{5,8})","$1 $2",["[2-79]"],"(0$1)"],["(\\d{3})(\\d{3,4})(\\d{3})","$1-$2-$3",["8[1-35-9]"],"0$1"],["(\\d{3})(\\d{6,8})","$1 $2",["1"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["804"],"0$1"],["(\\d{3})(\\d)(\\d{3})(\\d{3})","$1 $2 $3 $4",["80"],"0$1"],["(\\d{3})(\\d{4})(\\d{4,5})","$1-$2-$3",["8"],"0$1"]],"0",0,0,0,0,0,[["2[124]\\d{7,8}|619\\d{8}|2(?:1(?:14|500)|2\\d{3})\\d{3}|61\\d{5,8}|(?:2(?:[35][1-4]|6[0-8]|7[1-6]|8\\d|9[1-8])|3(?:1|[25][1-8]|3[1-68]|4[1-3]|6[1-3568]|7[0-469]|8\\d)|4(?:0[1-589]|1[01347-9]|2[0-36-8]|3[0-24-68]|43|5[1-378]|6[1-5]|7[134]|8[1245])|5(?:1[1-35-9]|2[25-8]|3[124-9]|4[1-3589]|5[1-46]|6[1-8])|6(?:[25]\\d|3[1-69]|4[1-6])|7(?:02|[125][1-9]|[36]\\d|4[1-8]|7[0-36-9])|9(?:0[12]|1[013-8]|2[0-479]|5[125-8]|6[23679]|7[159]|8[01346]))\\d{5,8}",[7,8,9,10,11]],["8[1-35-9]\\d{7,10}",[9,10,11,12]],["00(?:1803\\d{5,11}|7803\\d{7})|(?:177\\d|800)\\d{5,7}",[8,9,10,11,12,13,14,15,16,17]],["809\\d{7}",[10]],0,0,["(?:1500|8071\\d{3})\\d{3}",[7,10]],0,0,["804\\d{7}",[10]]]],IE:["353","00","(?:1\\d|[2569])\\d{6,8}|4\\d{6,9}|7\\d{8}|8\\d{8,9}",[7,8,9,10],[["(\\d{2})(\\d{5})","$1 $2",["2[24-9]|47|58|6[237-9]|9[35-9]"],"(0$1)"],["(\\d{3})(\\d{5})","$1 $2",["[45]0"],"(0$1)"],["(\\d)(\\d{3,4})(\\d{4})","$1 $2 $3",["1"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[2569]|4[1-69]|7[14]"],"(0$1)"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["70"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["81"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[78]"],"0$1"],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1"]],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["4"],"(0$1)"],["(\\d{2})(\\d)(\\d{3})(\\d{4})","$1 $2 $3 $4",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:1\\d|21)\\d{6,7}|(?:2[24-9]|4(?:0[24]|5\\d|7)|5(?:0[45]|1\\d|8)|6(?:1\\d|[237-9])|9(?:1\\d|[35-9]))\\d{5}|(?:23|4(?:[1-469]|8\\d)|5[23679]|6[4-6]|7[14]|9[04])\\d{7}"],["8(?:22|[35-9]\\d)\\d{6}",[9]],["1800\\d{6}",[10]],["15(?:1[2-8]|[2-8]0|9[089])\\d{6}",[10]],["700\\d{6}",[9]],["88210[1-9]\\d{4}|8(?:[35-79]5\\d\\d|8(?:[013-9]\\d\\d|2(?:[01][1-9]|[2-9]\\d)))\\d{5}",[10]],["818\\d{6}",[9]],0,["76\\d{7}",[9]],["18[59]0\\d{6}",[10]]]],IL:["972","0(?:0|1(?:05|[2-9]))","1\\d{6}(?:\\d{3,5})?|[57]\\d{8}|[1-489]\\d{7}",[7,8,9,10,11,12],[["(\\d{4})(\\d{3})","$1-$2",["125"]],["(\\d{4})(\\d{2})(\\d{2})","$1-$2-$3",["121"]],["(\\d)(\\d{3})(\\d{4})","$1-$2-$3",["[2-489]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1-$2-$3",["[57]"],"0$1"],["(\\d{4})(\\d{3})(\\d{3})","$1-$2-$3",["12"]],["(\\d{4})(\\d{6})","$1-$2",["159"]],["(\\d)(\\d{3})(\\d{3})(\\d{3})","$1-$2-$3-$4",["1[7-9]"]],["(\\d{3})(\\d{1,2})(\\d{3})(\\d{4})","$1-$2 $3-$4",["15"]]],"0",0,0,0,0,0,[["153\\d{8,9}|29[1-9]\\d{5}|(?:2[0-8]|[3489]\\d)\\d{6}",[8,11,12]],["55(?:4(?:0[0-3]|10|6[015-9])|57[0-289]|8[06][0-2])\\d{4}|5(?:(?:[0-2][02-9]|[36]\\d|[49][2-9]|8[3-7])\\d|5(?:01|2\\d|3[0-3]|4[3-5]|5[0-25689]|6[6-8]|7[0-267]|8[7-9]|9[1-9]))\\d{5}",[9]],["1(?:255|80[019]\\d{3})\\d{3}",[7,10]],["1212\\d{4}|1(?:200|9(?:0[0-2]|19|9\\d))\\d{6}",[8,10]],0,["151\\d{8,9}",[11,12]],["1599\\d{6}",[10]],0,["7(?:280[01]|38(?:[05]\\d|8[01358])|8(?:33|55|77|81)\\d)\\d{4}|7(?:18|2[23]|3[237]|47|6[258]|7\\d|82|9[2-9])\\d{6}",[9]],["1700\\d{6}",[10]]]],IM:["44","00","1624\\d{6}|(?:[3578]\\d|90)\\d{8}",[10],0,"0",0,"([25-8]\\d{5})$|0|180020","1624$1",0,"74576|(?:16|7[56])24",[["1624(?:230|[5-8]\\d\\d)\\d{3}"],["76245[06]\\d{4}|7(?:4576|[59]24\\d|624[0-4689])\\d{5}"],["808162\\d{4}"],["8(?:440[49]06|72299\\d)\\d{3}|(?:8(?:45|70)|90[0167])624\\d{4}"],["70\\d{8}"],0,["3440[49]06\\d{3}|(?:3(?:08162|3\\d{4}|45624|7(?:0624|2299))|55\\d{4})\\d{4}"],0,["56\\d{8}"]]],IN:["91","00","(?:000800|[2-9]\\d\\d)\\d{7}|1\\d{7,12}",[8,9,10,11,12,13],[["(\\d{8})","$1",["5(?:0|2[23]|3[03]|[67]1|88)","5(?:0|2(?:21|3)|3(?:0|3[23])|616|717|888)","5(?:0|2(?:21|3)|3(?:0|3[23])|616|717|8888)"],0,1],["(\\d{4})(\\d{4,5})","$1 $2",["180","1800"],0,1],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["140"],0,1],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["11|2[02]|33|4[04]|79[1-6]|80[2-46]","11|2[02]|33|4[04]|79[1-6]|80(?:[2-4]|6[0-589])","11|2[02]|33|4[04]|79(?:[124-6]|3(?:[02-9]|1[0-24-9]))|80(?:[2-4]|6[0-589])"],"0$1",1],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["1(?:2[0-249]|3[0-25]|4[145]|[68]|7[1257])|2(?:1[257]|3[013]|4[01]|5[0137]|6[0158]|78|8[1568])|3(?:26|4[1-3]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|5[12]|6[0-26-9]|7[0-24-9]|8[013-57]|9[014-7])|5(?:1[025]|22|[36][25]|4[28]|5[12]|[78]1)|6(?:12|[2-4]1|5[17]|6[13]|80)|7(?:12|3[134]|61|88)|8(?:16|2[014]|3[126]|6[136]|7[078]|8[34]|91)|(?:43|59|75)[15]|(?:1[59]|29|67)[14]","1(?:2[0-24]|3[0-25]|4[145]|[59][14]|6[1-9]|7[1257]|8[1-57-9])|2(?:1[257]|3[013]|4[01]|5[0137]|6[058]|78|8[1568]|9[14])|3(?:26|4[1-3]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|3[15]|5[12]|6[0-26-9]|7[0-24-9]|8[013-57]|9[014-7])|5(?:1[025]|22|[36][25]|4[28]|[578]1|9[15])|674|7(?:(?:3[34]|5[15])[2-6]|61[346]|88[0-8])|8(?:70[2-6]|84[235-7]|91[3-7])|(?:1(?:29|60|8[06])|261|552|6(?:12|[2-47]1|5[17]|6[13]|80)|7(?:12|31)|8(?:16|2[014]|3[126]|6[136]|7[78]|83))[2-7]","1(?:2[0-24]|3[0-25]|4[145]|[59][14]|6[1-9]|7[1257]|8[1-57-9])|2(?:1[257]|3[013]|4[01]|5[0137]|6[058]|78|8[1568]|9[14])|3(?:26|4[1-3]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|3[15]|5[12]|6[0-26-9]|7[0-24-9]|8[013-57]|9[014-7])|5(?:1[025]|22|[36][25]|4[28]|[578]1|9[15])|6(?:12(?:[2-6]|7[0-8])|74[2-7])|7(?:3171|5[15][2-6]|61[346]|88(?:[2-7]|82))|8(?:70[2-6]|84(?:[2356]|7[19])|91(?:[3-6]|7[19]))|73[134][2-6]|8(?:16|2[014]|3[126]|6[136]|7[78]|83)(?:[2-6]|7[19])|(?:1(?:29|60|8[06])|261|552|6(?:[2-4]1|5[17]|6[13]|7(?:1|4[0189])|80)|7(?:12|88[01]))[2-7]"],"0$1",1],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1(?:[2-479]|5[0235-9])|[2-5]|6(?:1[1358]|2[2457-9]|3[2-5]|4[235-7]|5[2-689]|6[24578]|7[235689]|8[1-6])|7(?:1[013-9]|3[129]|5[29]|6[02-5]|70)|807","1(?:[2-479]|5[0235-9])|[2-5]|6(?:1[1358]|2(?:[2457]|84|95)|3(?:[2-4]|55)|4[235-7]|5[2-689]|6[24578]|7(?:[23569]|8[0-57-9])|8[1-6])|7(?:1(?:[013-8]|9[6-9])|3(?:17|2[0-49]|9[2-57])|5(?:2[1-3]|9[0-6])|6(?:0[5689]|2[5-9]|3[02-8]|4|5[0-367])|70[13-7])|807[19]","1(?:[2-479]|5(?:[0236-9]|5[013-9]))|[2-5]|6(?:2(?:84|95)|355|8(?:28[235-7]|3))|73179|807(?:1|9[1-3])|(?:1552|6(?:(?:1[1358]|2[2457]|3[2-4]|4[235-7]|5[2-689]|6[24578])\\d|7(?:[23569]\\d|8[0-57-9])|8(?:[14-6]\\d|2[0-79]))|7(?:1(?:[013-8]\\d|9[6-9])|3(?:2[0-49]|9[2-57])|5(?:2[1-3]|9[0-6])|6(?:0[5689]|2[5-9]|3[02-8]|4\\d|5[0-367])|70[13-7]))[2-7]"],"0$1",1],["(\\d{5})(\\d{5})","$1 $2",["16|[6-9]"],"0$1",1],["(\\d{4})(\\d{2,4})(\\d{4})","$1 $2 $3",["18[06]","18[06]0"],0,1],["(\\d{4})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["18"],0,1]],"0",0,0,0,0,0,[["(?:2717(?:[2-7]\\d|95)|6828[235-7]\\d)\\d{4}|(?:170[24]|280[13468]|4(?:20[24]|72[2-8])|552[1-7])\\d{6}|(?:271[0-689]|682[0-79]|782[0-6])[2-7]\\d{5}|(?:2(?:[02][2-79]|90)|3(?:23|80)|683|79[1-6])\\d{7}|(?:11|33|4[04]|80)[2-7]\\d{7}|(?:342|674|788)(?:[0189][2-7]|[2-7]\\d)\\d{5}|(?:1(?:2[0-249]|3[0-25]|4[145]|[59][14]|6[014]|7[1257]|8[01346])|2(?:1[257]|3[013]|4[01]|5[0137]|6[0158]|78|8[1568]|9[14])|3(?:26|4[13]|5[34]|6[01489]|7[02-46]|8[159])|4(?:1[36]|2[1-47]|3[15]|5[12]|6[0-26-9]|7[014-9]|8[013-57]|9[014-7])|5(?:1[025]|22|[36][25]|4[28]|[578]1|9[15])|6(?:12|[2-47]1|5[17]|6[13]|80)|7(?:12|2[14]|3[134]|4[47]|5[15]|[67]1)|8(?:16|2[014]|3[126]|6[136]|7[078]|8[34]|91))[2-7]\\d{6}|(?:1(?:2[35-8]|3[346-9]|4[236-9]|[59][0235-9]|6[235-9]|7[34689]|8[257-9])|2(?:1[134689]|3[24-8]|4[2-8]|5[25689]|6[2-4679]|7[3-79]|8[2-479]|9[235-9])|3(?:01|1[79]|2[1245]|4[5-8]|5[125689]|6[235-7]|7[157-9]|8[2-46-8])|4(?:1[14578]|2[5689]|3[2-467]|5[4-7]|6[35]|73|8[2689]|9[2389])|5(?:[16][146-9]|2[14-8]|3[1346]|4[14-69]|5[46]|7[2-4]|8[2-8]|9[246])|6(?:1[1358]|2[2457]|3[2-4]|4[235-7]|5[2-689]|6[24578]|7[235689]|8[14-6])|7(?:1[013-9]|2[0235-9]|3[2679]|4[1-35689]|5[2-46-9]|[67][02-9]|8[013-7]|90)|8(?:1[1357-9]|2[235-8]|3[03-57-9]|4[0-24-9]|5\\d|6[2457-9]|7[1-6]|8[1256]|9[2-4]))\\d[2-7]\\d{5}",[10]],["(?:6(?:1279|828[01489])|7(?:887[02-9]|9313)|8(?:079[04-9]|(?:84|91)7[02-8]))\\d{5}|(?:160[01]|6(?:(?:12|[2-4]1|5[17]|6[13]|80)[0189]|7(?:1[0189]|86))|7(?:1(?:2[0189]|9[0-5])|3(?:2[5-8]|[34][017-9]|9[016-9])|5(?:[15][017-9]|2[04-9]|9[7-9])|6(?:0[0-47]|1[0-257-9]|2[0-4]|3[19]|5[4589])|70[0289]|88[089])|8(?:0(?:6[67]|7[02-8])|70[017-9]|84[01489]|91[0-289]))\\d{6}|(?:731|8(?:16|2[014]|3[126]|6[136]|7[78]|83))(?:[0189]\\d|7[02-8])\\d{5}|(?:6(?:(?:1[1358]|2[2457]|3[2-4]|4[235-7]|5[2-689]|6[24578])\\d|7(?:[23569]\\d|4[0189]|8[0-57-9])|8(?:[14-6]\\d|2[0-79]))|7(?:1(?:[013-8]\\d|9[6-9])|3(?:2[0-49]|9[2-5])|5(?:2[1-3]|9[0-6])|6(?:0[5689]|2[5-9]|3[02-8]|4\\d|5[0-367])|70[13-7]|881))[0189]\\d{5}|(?:6(?:[09]\\d|1[04679]|2[03689]|3[05-9]|4[0489]|50|6[069]|7[07]|8[7-9])|7(?:[024]\\d|3[05-8]|5[0346-8]|6[6-9]|7[1-9]|8[0-79]|9[07-9])|8(?:0[01589]|1[0-57-9]|2[235-9]|3[03-57-9]|[45]\\d|6[02457-9]|7[1-69]|8[0-25-9]|9[02-9])|9\\d\\d)\\d{7}",[10]],["000800\\d{7}|180(?:0\\d{4,9}|3\\d{9})"],["186[12]\\d{9}",[13]],0,0,["140\\d{7}",[10]],0,0,["1860\\d{7}",[11]]]],IO:["246","00","3\\d{6}",[7],[["(\\d{3})(\\d{4})","$1 $2",["3"]]],0,0,0,0,0,0,[["37\\d{5}"],["38\\d{5}"]]],IQ:["964","00","(?:1|7\\d\\d)\\d{7}|[2-6]\\d{7,8}",[8,9,10],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["1"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[2-6]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["7"],"0$1"]],"0",0,0,0,0,0,[["1\\d{7}|(?:2[13-5]|3[02367]|4[023]|5[03]|6[026])\\d{6,7}",[8,9]],["7[3-9]\\d{8}",[10]]]],IR:["98","00","[1-9]\\d{9}|(?:[1-8]\\d\\d|9)\\d{3,4}",[4,5,6,7,10],[["(\\d{4,5})","$1",["96"],"0$1"],["(\\d{2})(\\d{4,5})","$1 $2",["(?:1[137]|2[13-68]|3[1458]|4[145]|5[1468]|6[16]|7[1467]|8[13467])[12689]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["9"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["[1-8]"],"0$1"]],"0",0,0,0,0,0,[["(?:1[137]|2[13-68]|3[1458]|4[145]|5[1468]|6[16]|7[1467]|8[13467])(?:[03-57]\\d{7}|[16]\\d{3}(?:\\d{4})?|[289]\\d{3}(?:\\d(?:\\d{3})?)?)|94(?:000[09]|(?:12\\d|30[0-2])\\d|2(?:[02689]0\\d|121)|4(?:111|40\\d))\\d{4}",[6,7,10]],["9(?:(?:0[0-5]|[13]\\d|2[0-3])\\d\\d|9(?:[0-46]\\d\\d|5(?:10|5\\d)|8(?:[12]\\d|3[0-2]|88)|9(?:[01359]\\d|21|69|77|8[7-9])))\\d{5}",[10]],0,0,0,0,["96(?:0[12]|2[16-8]|3(?:08|[14]5|[23]|66)|4(?:0|80)|5[01]|6[89]|86|9[19])",[4,5]]]],IS:["354","00|1(?:0(?:01|[12]0)|100)","(?:38\\d|[4-9])\\d{6}",[7,9],[["(\\d{3})(\\d{4})","$1 $2",["[4-9]"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["3"]]],0,0,0,0,0,0,[["(?:4(?:1[0-24-69]|2[0-7]|[37][0-8]|4[0-24589]|5[0-68]|6\\d|8[0-36-8])|5(?:05|[156]\\d|2[02578]|3[0-579]|4[03-7]|7[0-2578]|8[0-35-9]|9[013-689])|872)\\d{4}",[7]],["(?:38[589]\\d\\d|6(?:1[1-8]|2[0-6]|3[026-9]|4[014679]|5[0159]|6[0-69]|70|8[06-8]|9\\d)|7(?:5[057]|[6-9]\\d)|8(?:2[0-59]|[3-69]\\d|8[238]))\\d{4}"],["80[0-8]\\d{4}",[7]],["90(?:0\\d|1[5-79]|2[015-79]|3[135-79]|4[125-7]|5[25-79]|7[1-37]|8[0-35-7])\\d{3}",[7]],0,["(?:689|8(?:7[18]|80)|95[48])\\d{4}",[7]],["809\\d{4}",[7]],0,["49[0-24-79]\\d{4}",[7]]],"00"],IT:["39","00","0\\d{5,11}|1\\d{8,10}|3(?:[0-8]\\d{7,10}|9\\d{7,8})|(?:43|55|70)\\d{8}|8\\d{5}(?:\\d{2,4})?",[6,7,8,9,10,11,12],[["(\\d{2})(\\d{4,6})","$1 $2",["0[26]"]],["(\\d{3})(\\d{3,6})","$1 $2",["0[13-57-9][0159]|8(?:03|4[17]|9[2-5])","0[13-57-9][0159]|8(?:03|4[17]|9(?:2|3[04]|[45][0-4]))"]],["(\\d{4})(\\d{2,6})","$1 $2",["0(?:[13-579][2-46-8]|8[236-8])"]],["(\\d{4})(\\d{4})","$1 $2",["894"]],["(\\d{2})(\\d{3,4})(\\d{4})","$1 $2 $3",["0[26]|5"]],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["1(?:44|[679])|[378]|43"]],["(\\d{3})(\\d{3,4})(\\d{4})","$1 $2 $3",["0[13-57-9][0159]|14"]],["(\\d{2})(\\d{4})(\\d{5})","$1 $2 $3",["0[26]"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["0"]],["(\\d{3})(\\d{4})(\\d{4,5})","$1 $2 $3",["[03]"]]],0,0,0,0,0,0,[["0(?:669[0-79]\\d{1,6}|831\\d{2,8})|0(?:1(?:[0159]\\d|[27][1-5]|31|4[1-4]|6[1356]|8[2-57])|2\\d\\d|3(?:[0159]\\d|2[1-4]|3[12]|[48][1-6]|6[2-59]|7[1-7])|4(?:[0159]\\d|[23][1-9]|4[245]|6[1-5]|7[1-4]|81)|5(?:[0159]\\d|2[1-5]|3[2-6]|4[1-79]|6[4-6]|7[1-578]|8[3-8])|6(?:[0-57-9]\\d|6[0-8])|7(?:[0159]\\d|2[12]|3[1-7]|4[2-46]|6[13569]|7[13-6]|8[1-59])|8(?:[0159]\\d|2[3-578]|3[2356]|[6-8][1-5])|9(?:[0159]\\d|[238][1-5]|4[12]|6[1-8]|7[1-6]))\\d{2,7}"],["3[2-9]\\d{7,8}|(?:31|43)\\d{8}",[9,10]],["80(?:0\\d{3}|3)\\d{3}",[6,9]],["(?:0878\\d{3}|89(?:2\\d|3[04]|4(?:[0-4]|[5-9]\\d\\d)|5[0-4]))\\d\\d|(?:1(?:44|6[346])|89(?:38|5[5-9]|9))\\d{6}",[6,8,9,10]],["1(?:78\\d|99)\\d{6}",[9,10]],["3[2-8]\\d{9,10}",[11,12]],0,0,["55\\d{8}",[10]],["84(?:[08]\\d{3}|[17])\\d{3}",[6,9]]]],JE:["44","00","1534\\d{6}|(?:[3578]\\d|90)\\d{8}",[10],0,"0",0,"([0-24-8]\\d{5})$|0|180020","1534$1",0,0,[["1534[0-24-8]\\d{5}"],["7(?:(?:(?:50|82)9|937)\\d|7(?:00[378]|97\\d))\\d{5}"],["80(?:07(?:35|81)|8901)\\d{4}"],["(?:8(?:4(?:4(?:4(?:05|42|69)|703)|5(?:041|800))|7(?:0002|1206))|90(?:066[59]|1810|71(?:07|55)))\\d{4}"],["701511\\d{4}"],0,["(?:3(?:0(?:07(?:35|81)|8901)|3\\d{4}|4(?:4(?:4(?:05|42|69)|703)|5(?:041|800))|7(?:0002|1206))|55\\d{4})\\d{4}"],["76(?:464|652)\\d{5}|76(?:0[0-28]|2[356]|34|4[01347]|5[49]|6[0-369]|77|8[14]|9[139])\\d{6}"],["56\\d{8}"]]],JM:["1","011","(?:[58]\\d\\d|658|900)\\d{7}",[10],0,"1",0,0,0,0,"658|876",[["8766060\\d{3}|(?:658(?:2(?:[5-8]\\d|9[0-46-9])|[3-9]\\d\\d)|876(?:52[35]|6(?:0[1-3579]|1[0235-9]|[23]\\d|40|5[06]|6[2-589]|7[0-25-9]|8[04]|9[4-9])|7(?:0[2-689]|[1-6]\\d|8[056]|9[45])|9(?:0[1-8]|1[02378]|[2-8]\\d|9[2-468])))\\d{4}"],["(?:6582(?:[0-4]\\d|95)|876(?:2(?:0[1-9]|[13-9]\\d|2[013-9])|[348]\\d\\d|5(?:0[1-9]|[1-9]\\d)|6(?:4[89]|6[67])|7(?:0[07]|7\\d|8[1-47-9]|9[0-36-9])|9(?:[01]9|9[0579])))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],JO:["962","00","(?:(?:[2689]|7\\d)\\d|32|427|53)\\d{6}",[8,9],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["[2356]|87"],"(0$1)"],["(\\d{3})(\\d{5,6})","$1 $2",["[89]"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["70"],"0$1"],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["[47]"],"0$1"]],"0",0,0,0,0,0,[["87(?:000|90[01])\\d{3}|(?:2(?:6(?:2[0-35-9]|3[0-578]|4[24-7]|5[0-24-8]|[6-8][023]|9[0-3])|7(?:0[1-79]|10|2[014-7]|3[0-689]|4[019]|5[0-3578]))|32(?:0[1-69]|1[1-35-7]|2[024-7]|3\\d|4[0-3]|[5-7][023])|53(?:0[0-3]|[13][023]|2[0-59]|49|5[0-35-9]|6[15]|7[45]|8[1-6]|9[0-36-9])|6(?:2(?:[05]0|22)|3(?:00|33)|4(?:0[0-25]|1[2-7]|2[0569]|[38][07-9]|4[025689]|6[0-589]|7\\d|9[0-2])|5(?:[01][056]|2[034]|3[0-57-9]|4[178]|5[0-69]|6[0-35-9]|7[1-379]|8[0-68]|9[0239]))|87(?:20|7[078]|99))\\d{4}",[8]],["(?:427|7(?:11|[29]\\d|[78][0-25-9]))\\d{6}",[9]],["80\\d{6}",[8]],["9\\d{7}",[8]],["70\\d{7}",[9]],0,["8(?:10|8\\d)\\d{5}",[8]],["74(?:66|77)\\d{5}",[9]],0,["85\\d{6}",[8]]]],JP:["81","010","00[1-9]\\d{6,14}|[25-9]\\d{9}|(?:00|[1-9]\\d\\d)\\d{6}",[8,9,10,11,12,13,14,15,16,17],[["(\\d{3})(\\d{3})(\\d{3})","$1-$2-$3",["(?:12|57|99)0"],"0$1"],["(\\d{4})(\\d)(\\d{4})","$1-$2-$3",["1(?:26|3[79]|4[56]|5[4-68]|6[3-5])|499|5(?:76|97)|746|8(?:3[89]|47|51)|9(?:80|9[16])","1(?:267|3(?:7[247]|9[278])|466|5(?:47|58|64)|6(?:3[245]|48|5[4-68]))|499[2468]|5(?:76|97)9|7468|8(?:3(?:8[7-9]|96)|477|51[2-9])|9(?:802|9(?:1[23]|69))|1(?:45|58)[67]","1(?:267|3(?:7[247]|9[278])|466|5(?:47|58|64)|6(?:3[245]|48|5[4-68]))|499[2468]|5(?:769|979[2-69])|7468|8(?:3(?:8[7-9]|96[2457-9])|477|51[2-9])|9(?:802|9(?:1[23]|69))|1(?:45|58)[67]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1-$2-$3",["60"],"0$1"],["(\\d)(\\d{4})(\\d{4})","$1-$2-$3",["3|4(?:2[09]|7[01])|6[1-9]","3|4(?:2(?:0|9[02-69])|7(?:0[019]|1))|6[1-9]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1-$2-$3",["1(?:1|5[45]|77|88|9[69])|2(?:2[1-37]|3[0-269]|4[59]|5|6[24]|7[1-358]|8[1369]|9[0-38])|4(?:[28][1-9]|3[0-57]|[45]|6[248]|7[2-579]|9[29])|5(?:2|3[0459]|4[0-369]|5[29]|8[02389]|9[0-389])|7(?:2[02-46-9]|34|[58]|6[0249]|7[57]|9[2-6])|8(?:2[124589]|3[26-9]|49|51|6|7[0-468]|8[68]|9[019])|9(?:[23][1-9]|4[15]|5[138]|6[1-3]|7[156]|8[189]|9[1-489])","1(?:1|5(?:4[018]|5[017])|77|88|9[69])|2(?:2(?:[127]|3[014-9])|3[0-269]|4[59]|5(?:[1-3]|5[0-69]|9[19])|62|7(?:[1-35]|8[0189])|8(?:[16]|3[0134]|9[0-5])|9(?:[028]|17))|4(?:2(?:[13-79]|8[014-6])|3[0-57]|[45]|6[248]|7[2-47]|8[1-9]|9[29])|5(?:2|3(?:[045]|9[0-8])|4[0-369]|5[29]|8[02389]|9[0-3])|7(?:2[02-46-9]|34|[58]|6[0249]|7[57]|9(?:[23]|4[0-59]|5[01569]|6[0167]))|8(?:2(?:[1258]|4[0-39]|9[0-2469])|3(?:[29]|60)|49|51|6(?:[0-24]|36|5[0-3589]|7[23]|9[01459])|7[0-468]|8[68])|9(?:[23][1-9]|4[15]|5[138]|6[1-3]|7[156]|8[189]|9(?:[1289]|3[34]|4[0178]))|(?:264|837)[016-9]|2(?:57|93)[015-9]|(?:25[0468]|422|838)[01]|(?:47[59]|59[89]|8(?:6[68]|9))[019]","1(?:1|5(?:4[018]|5[017])|77|88|9[69])|2(?:2[127]|3[0-269]|4[59]|5(?:[1-3]|5[0-69]|9(?:17|99))|6(?:2|4[016-9])|7(?:[1-35]|8[0189])|8(?:[16]|3[0134]|9[0-5])|9(?:[028]|17))|4(?:2(?:[13-79]|8[014-6])|3[0-57]|[45]|6[248]|7[2-47]|9[29])|5(?:2|3(?:[045]|9(?:[0-58]|6[4-9]|7[0-35689]))|4[0-369]|5[29]|8[02389]|9[0-3])|7(?:2[02-46-9]|34|[58]|6[0249]|7[57]|9(?:[23]|4[0-59]|5[01569]|6[0167]))|8(?:2(?:[1258]|4[0-39]|9[0169])|3(?:[29]|60|7(?:[017-9]|6[6-8]))|49|51|6(?:[0-24]|36[2-57-9]|5(?:[0-389]|5[23])|6(?:[01]|9[178])|7(?:2[2-468]|3[78])|9[0145])|7[0-468]|8[68])|9(?:4[15]|5[138]|7[156]|8[189]|9(?:[1289]|3(?:31|4[357])|4[0178]))|(?:8294|96)[1-3]|2(?:57|93)[015-9]|(?:223|8699)[014-9]|(?:25[0468]|422|838)[01]|(?:48|8292|9[23])[1-9]|(?:47[59]|59[89]|8(?:68|9))[019]"],"0$1"],["(\\d{3})(\\d{2})(\\d{4})","$1-$2-$3",["[14]|[289][2-9]|5[3-9]|7[2-4679]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1-$2-$3",["800"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1-$2-$3",["[25-9]"],"0$1"]],"0",0,"(000[2569]\\d{4,6})$|(?:(?:003768)0?)|0","$1",0,0,[["(?:1(?:1[235-8]|2[3-6]|3[3-9]|4[2-6]|[58][2-8]|6[2-7]|7[2-9]|9[1-9])|(?:2[2-9]|[36][1-9])\\d|4(?:[2-578]\\d|6[02-8]|9[2-59])|5(?:[2-589]\\d|6[1-9]|7[2-8])|7(?:[25-9]\\d|3[4-9]|4[02-9])|8(?:[2679]\\d|3[2-9]|4[5-9]|5[1-9]|8[03-9])|9(?:[2-58]\\d|[679][1-9]))\\d{6}",[9]],["[6-9]0[1-9]\\d{7}",[10]],["00777(?:[01]|5\\d)\\d\\d|(?:00(?:7778|882[1245])|(?:120|800\\d)\\d\\d)\\d{4}|00(?:37|66|78)\\d{6,13}"],["990\\d{6}",[9]],["60\\d{7}",[9]],0,["570\\d{6}",[9]],["20\\d{8}",[10]],["50[1-9]\\d{7}",[10]]]],KE:["254","000","(?:[17]\\d\\d|900)\\d{6}|(?:2|80)0\\d{6,7}|[4-6]\\d{6,8}",[7,8,9,10],[["(\\d{2})(\\d{5,7})","$1 $2",["[24-6]"],"0$1"],["(\\d{3})(\\d{6})","$1 $2",["[17]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["[89]"],"0$1"]],"0",0,0,0,0,0,[["(?:4[245]|5[1-79]|6[01457-9])\\d{5,7}|(?:4[136]|5[08]|62)\\d{7}|(?:[24]0|66)\\d{6,7}",[7,8,9]],["(?:1(?:0[0-8]|[18]\\d|2[014]|30|4[0-5])|7\\d\\d)\\d{6}",[9]],["800[02-8]\\d{5,6}",[9,10]],["900[02-9]\\d{5}",[9]]]],KG:["996","00","8\\d{9}|[235-9]\\d{8}",[9,10],[["(\\d{4})(\\d{5})","$1 $2",["3(?:1[346]|[24-79])"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[235-79]|88"],"0$1"],["(\\d{3})(\\d{3})(\\d)(\\d{2,3})","$1 $2 $3 $4",["8"],"0$1"]],"0",0,0,0,0,0,[["312(?:5[0-79]\\d|9(?:[0-689]\\d|7[0-24-9]))\\d{3}|(?:3(?:1(?:2[0-46-8]|3[1-9]|47|[56]\\d)|2(?:22|3[0-479]|6[0-7])|4(?:22|5[6-9]|6\\d)|5(?:22|3[4-7]|59|6\\d)|6(?:22|5[35-7]|6\\d)|7(?:22|3[468]|4[1-9]|59|[67]\\d)|9(?:22|4[1-8]|6\\d))|6(?:09|12|2[2-4])\\d)\\d{5}",[9]],["312(?:58\\d|973)\\d{3}|(?:2(?:0[0-35]|2\\d)|5[0-24-7]\\d|600|7(?:[07]\\d|55)|88[08]|9(?:12|9[05-9]))\\d{6}",[9]],["800\\d{6,7}"]]],KH:["855","00[14-9]","1\\d{9}|[1-9]\\d{7,8}",[8,9,10],[["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[1-9]"],"0$1"],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1"]]],"0",0,0,0,0,0,[["23(?:4(?:[2-4]|[56]\\d)|[568]\\d\\d)\\d{4}|23[236-9]\\d{5}|(?:2[4-6]|3[2-6]|4[2-4]|[5-7][2-5])(?:(?:[237-9]|4[56]|5\\d)\\d{5}|6\\d{5,6})",[8,9]],["(?:(?:1[28]|3[18]|9[67])\\d|6[016-9]|7(?:[07-9]|[16]\\d)|8(?:[013-79]|8\\d))\\d{6}|(?:1\\d|9[0-57-9])\\d{6}|(?:2[3-6]|3[2-6]|4[2-4]|[5-7][2-5])48\\d{5}",[8,9]],["1800(?:1\\d|2[019])\\d{4}",[10]],["1900(?:1\\d|2[09])\\d{4}",[10]]]],KI:["686","00","(?:[37]\\d|6[0-79])\\d{6}|(?:[2-48]\\d|50)\\d{3}",[5,8],0,"0",0,0,0,0,0,[["(?:[24]\\d|3[1-9]|50|65(?:02[12]|12[56]|22[89]|[3-5]00)|7(?:27\\d\\d|3100|5(?:02[12]|12[56]|22[89]|[34](?:00|81)|500))|8[0-5])\\d{3}"],["(?:6200[01]|7(?:310[1-9]|5(?:02[03-9]|12[0-47-9]|22[0-7]|[34](?:0[1-9]|8[02-9])|50[1-9])))\\d{3}|(?:63\\d\\d|7(?:(?:[0146-9]\\d|2[0-689])\\d|3(?:[02-9]\\d|1[1-9])|5(?:[0-2][013-9]|[34][1-79]|5[1-9]|[6-9]\\d)))\\d{4}",[8]],0,0,0,0,0,0,["30(?:0[01]\\d\\d|12(?:11|20))\\d\\d",[8]]]],KM:["269","00","[3478]\\d{6}",[7],[["(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3",["[3478]"]]],0,0,0,0,0,0,[["7[4-7]\\d{5}"],["[34]\\d{6}"],0,["8\\d{6}"]]],KN:["1","011","(?:[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-7]\\d{6})$|1","869$1",0,"869",[["869(?:2(?:29|36)|302|4(?:6[015-9]|70)|56[5-7])\\d{4}"],["869(?:48[89]|55[6-8]|66\\d|76[02-7])\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],KP:["850","00|99","85\\d{6}|(?:19\\d|[2-7])\\d{7}",[8,10],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["8"],"0$1"],["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["[2-7]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["1"],"0$1"]],"0",0,0,0,0,0,[["(?:(?:195|2)\\d|3[19]|4[159]|5[37]|6[17]|7[39]|85)\\d{6}"],["19[1-3]\\d{7}",[10]]]],KR:["82","00(?:[125689]|3(?:[46]5|91)|7(?:00|27|3|55|6[126]))","00[1-9]\\d{8,11}|(?:[12]|5\\d{3})\\d{7}|[13-6]\\d{9}|(?:[1-6]\\d|80)\\d{7}|[3-6]\\d{4,5}|(?:00|7)0\\d{8}",[5,6,8,9,10,11,12,13,14],[["(\\d{2})(\\d{3,4})","$1-$2",["(?:3[1-3]|[46][1-4]|5[1-5])1"],"0$1"],["(\\d{4})(\\d{4})","$1-$2",["1"]],["(\\d)(\\d{3,4})(\\d{4})","$1-$2-$3",["2"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1-$2-$3",["[36]0|8"],"0$1"],["(\\d{2})(\\d{3,4})(\\d{4})","$1-$2-$3",["[1346]|5[1-5]"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1-$2-$3",["[57]"],"0$1"],["(\\d{2})(\\d{5})(\\d{4})","$1-$2-$3",["5"],"0$1"]],"0",0,"0(8(?:[1-46-8]|5\\d\\d))?",0,0,0,[["(?:2|3[1-3]|[46][1-4]|5[1-5])[1-9]\\d{6,7}|(?:3[1-3]|[46][1-4]|5[1-5])1\\d{2,3}",[5,6,8,9,10]],["1(?:05(?:[0-8]\\d|9[0-6])|22[13]\\d)\\d{4,5}|1(?:0[0-46-9]|[16-9]\\d|2[013-9])\\d{6,7}",[9,10]],["00(?:308\\d{6,7}|798\\d{7,9})|(?:00368|[38]0)\\d{7}",[9,11,12,13,14]],["60[2-9]\\d{6}",[9]],["50\\d{8,9}",[10,11]],0,["1(?:5(?:22|33|44|66|77|88|99)|6(?:[07]0|44|6[0168]|88)|8(?:00|33|55|77|99))\\d{4}",[8]],["15\\d{7,8}",[9,10]],["70\\d{8}",[10]]]],KW:["965","00","18\\d{5}|(?:[2569]\\d|41)\\d{6}",[7,8],[["(\\d{4})(\\d{3,4})","$1 $2",["[169]|2(?:[235]|4[1-35-9])|52"]],["(\\d{3})(\\d{5})","$1 $2",["[245]"]]],0,0,0,0,0,0,[["2(?:[23]\\d\\d|4(?:[1-35-9]\\d|44)|5(?:0[034]|[2-46]\\d|5[1-3]|7[1-7]))\\d{4}",[8]],["(?:41\\d\\d|5(?:(?:[05]\\d|1[0-7]|6[56])\\d|2(?:22|5[25])|7(?:55|77)|88[58])|6(?:(?:0[034679]|5[015-9]|6\\d)\\d|1(?:00|11|6[16])|2[26]2|3[36]3|4[46]4|7(?:0[013-9]|[67]\\d)|8[68]8|9(?:[069]\\d|3[039]))|9(?:(?:[04679]\\d|8[057-9])\\d|1(?:00|1[01]|99)|2(?:00|2\\d)|3(?:00|3[03])|5(?:00|5\\d)))\\d{4}",[8]],["18\\d{5}",[7]]]],KY:["1","011","(?:345|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","345$1",0,"345",[["345(?:2(?:22|3[23]|44|66)|333|444|6(?:23|38|40)|7(?:30|4[35-79]|6[6-9]|77)|8(?:00|1[45]|4[89]|88)|9(?:14|4[035-9]))\\d{4}"],["345(?:32[1-9]|4(?:1[2-6]|2[0-4])|5(?:1[67]|2[5-79]|4[6-9]|50|76)|649|82[56]|9(?:1[679]|2[2-9]|3[06-9]|90))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["(?:345976|900[2-9]\\d\\d)\\d{4}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],KZ:["7","810","8\\d{13}|[78]\\d{9}",[10,14],0,"8",0,0,0,0,"7",[["7(?:1(?:0(?:[23]\\d|4[0-3]|59|63)|1(?:[23]\\d|4[0-79]|59)|2(?:[23]\\d|59)|3(?:2\\d|3[0-79]|4[0-35-9]|59)|4(?:[24]\\d|3[013-9]|5[1-9]|97)|5(?:2\\d|3[1-9]|4[0-7]|59)|6(?:[2-4]\\d|5[19]|61)|72\\d|8(?:[27]\\d|3[1-46-9]|4[0-5]|59))|2(?:1(?:[23]\\d|4[46-9]|5[3469])|2(?:2\\d|3[0679]|46|5[12679])|3(?:[2-4]\\d|5[139])|4(?:2\\d|3[1-35-9]|59)|5(?:[23]\\d|4[0-8]|59|61)|6(?:2\\d|3[1-9]|4[0-4]|59)|7(?:[2379]\\d|40|5[279])|8(?:[23]\\d|4[0-3]|59)|9(?:2\\d|3[124578]|59)))\\d{5}",[10]],["7(?:0[0-25-8]|47|6[0-4]|7[15-8]|85)\\d{7}",[10]],["8(?:00|108\\d{3})\\d{7}"],["809\\d{7}",[10]],["808\\d{7}",[10]],0,0,0,["751\\d{7}",[10]]],"8~10"],LA:["856","00","[23]\\d{9}|3\\d{8}|(?:[235-8]\\d|41)\\d{6}",[8,9,10],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["2[13]|3[14]|[4-8]"],"0$1"],["(\\d{2})(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3 $4",["3"],"0$1"],["(\\d{2})(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3 $4",["[23]"],"0$1"]],"0",0,0,0,0,0,[["(?:2[13]|[35-7][14]|41|8[1468])\\d{6}",[8]],["(?:20(?:[23579]\\d|8[78])|30[24]\\d)\\d{6}|30\\d{7}",[9,10]]]],LB:["961","00","[27-9]\\d{7}|[13-9]\\d{6}",[7,8],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["[13-69]|7(?:[2-57]|62|8[0-6]|9[04-9])|8[02-9]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[27-9]"]]],"0",0,0,0,0,0,[["7(?:62|8[0-6]|9[04-9])\\d{4}|(?:[14-69]\\d|2(?:[14-69]\\d|[78][1-9])|7[2-57]|8[02-9])\\d{5}"],["(?:(?:3|81)\\d|7(?:[01]\\d|6[013-9]|8[7-9]|9[0-4]))\\d{5}"],0,["9[01]\\d{6}",[8]],0,0,0,0,0,["80\\d{6}",[8]]]],LC:["1","011","(?:[58]\\d\\d|758|900)\\d{7}",[10],0,"1",0,"([2-8]\\d{6})$|1","758$1",0,"758",[["758(?:234|4(?:30|5\\d|6[2-9]|8[0-2])|57[0-2]|(?:63|75)8)\\d{4}"],["758(?:28[4-7]|384|4(?:6[01]|8[4-9])|5(?:1[89]|20|84)|7(?:1[2-9]|2\\d|3[0-3])|812)\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],LI:["423","00","[68]\\d{8}|(?:[2378]\\d|90)\\d{5}",[7,9],[["(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3",["[2379]|8(?:0[09]|7)","[2379]|8(?:0(?:02|9)|7)"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["8"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["69"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["6"]]],"0",0,"(1001)|0",0,0,0,[["(?:2(?:01|1[27]|2[024]|3\\d|6[02-578]|96)|3(?:[24]0|33|7[0135-7]|8[048]|9[0269]))\\d{4}",[7]],["(?:6(?:(?:4[5-9]|5\\d)\\d|6(?:[024-68]\\d|1[01]|3[7-9]|7[02]))\\d|7(?:[37-9]\\d|42|56))\\d{4}"],["8002[28]\\d\\d|80(?:05\\d|9)\\d{4}"],["90(?:02[258]|1(?:23|3[14])|66[136])\\d\\d",[7]],0,["697(?:42|56|[78]\\d)\\d{4}",[9]],["870(?:28|87)\\d\\d",[7]]]],LK:["94","00","[1-9]\\d{8}",[9],[["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["7"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[1-689]"],"0$1"]],"0",0,0,0,0,0,[["(?:12[2-9]|602|8[12]\\d|9(?:1\\d|22|9[245]))\\d{6}|(?:11|2[13-7]|3[1-8]|4[157]|5[12457]|6[35-7])[2-57]\\d{6}"],["7(?:[0-25-8]\\d|4[0-4])\\d{6}"],0,0,0,0,["1973\\d{5}"]]],LR:["231","00","(?:[2457]\\d|33|88)\\d{7}|(?:2\\d|[4-6])\\d{6}",[7,8,9],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["4[67]|[56]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["2"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[2-578]"],"0$1"]],"0",0,0,0,0,0,[["2\\d{7}",[8]],["(?:(?:(?:22|33)0|555|7(?:6[01]|7\\d)|88\\d)\\d|4(?:240|[67]))\\d{5}|[56]\\d{6}",[7,9]],0,["332(?:02|[34]\\d)\\d{4}",[9]]]],LS:["266","00","(?:[256]\\d\\d|800)\\d{5}",[8],[["(\\d{4})(\\d{4})","$1 $2",["[2568]"]]],0,0,0,0,0,0,[["2\\d{7}"],["[56]\\d{7}"],["800[1256]\\d{4}"]]],LT:["370","00","(?:[3469]\\d|52|[78]0)\\d{6}",[8],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["52[0-7]"],"(0-$1)",1],["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["[7-9]"],"0 $1",1],["(\\d{2})(\\d{6})","$1 $2",["37|4(?:[15]|6[1-8])"],"(0-$1)",1],["(\\d{3})(\\d{5})","$1 $2",["[3-6]"],"(0-$1)",1]],"0",0,"[08]",0,0,0,[["(?:3[1478]|4[124-6]|52)\\d{6}"],["6\\d{7}"],["80[02]\\d{5}"],["9(?:0[0239]|10)\\d{5}"],["70[05]\\d{5}"],0,["70[67]\\d{5}"],0,["[89]01\\d{5}"],["808\\d{5}"]]],LU:["352","00","35[013-9]\\d{4,8}|6\\d{8}|35\\d{2,4}|(?:[2457-9]\\d|3[0-46-9])\\d{2,9}",[4,5,6,7,8,9,10,11],[["(\\d{2})(\\d{3})","$1 $2",["2(?:0[2-689]|[2-9])|[3-57]|8(?:0[2-9]|[13-9])|9(?:0[89]|[2-579])"]],["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["2(?:0[2-689]|[2-9])|[3-57]|8(?:0[2-9]|[13-9])|9(?:0[89]|[2-579])"]],["(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3",["20[2-689]"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})","$1 $2 $3 $4",["20"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{1,5})","$1 $2 $3 $4",["[3-57]|8[13-9]|9(?:0[89]|[2-579])|(?:2|80)[2-9]"]],["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["80[01]|90[015]"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3 $4",["20"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["6"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})","$1 $2 $3 $4 $5",["20"]]],0,0,"(15(?:0[06]|1[12]|[35]5|4[04]|6[26]|77|88|99)\\d)",0,0,0,[["(?:35[013-9]|80[2-9]|90[89])\\d{1,8}|(?:2[2-9]|3[0-46-9]|[457]\\d|8[13-9]|9[2-579])\\d{2,9}"],["6(?:[26][18]|5[1568]|7[189]|81|9[128])\\d{6}",[9]],["800\\d{5}",[8]],["90[015]\\d{5}",[8]],0,0,0,0,["20(?:1\\d{5}|[2-689]\\d{1,7})",[4,5,6,7,8,9,10]],["801\\d{5}",[8]]]],LV:["371","00","(?:[268]\\d|78|90)\\d{6}",[8],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[2679]|8[01]"]]],0,0,0,0,0,0,[["6\\d{7}"],["2333[0-8]\\d{3}|2(?:[0-24-9]\\d\\d|3(?:0[07]|[14-9]\\d|2[02-9]|3[0-24-9]))\\d{4}"],["80\\d{6}"],["90\\d{6}"],0,0,0,0,0,["81\\d{6}"]]],LY:["218","00","[2-9]\\d{8}",[9],[["(\\d{2})(\\d{7})","$1-$2",["[2-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:2(?:0[56]|[1-6]\\d|7[124579]|8[124])|3(?:1\\d|2[2356])|4(?:[17]\\d|2[1-357]|5[2-4]|8[124])|5(?:[1347]\\d|2[1-469]|5[13-5]|8[1-4])|6(?:[1-479]\\d|5[2-57]|8[1-5])|7(?:[13]\\d|2[13-79])|8(?:[124]\\d|5[124]|84))\\d{6}"],["9[1-6]\\d{7}"]]],MA:["212","00","[5-8]\\d{8}",[9],[["(\\d{4})(\\d{5})","$1-$2",["892"],"0$1"],["(\\d{2})(\\d{7})","$1-$2",["8(?:0[0-7]|9)"],"0$1"],["(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["[5-8]"],"0$1"]],"0",0,0,0,0,"[5-8]",[["5(?:(?:18|4[0679]|5[03])\\d|2(?:[0-25-79]\\d|3[1-578]|4[02-46-8]|8[0235-9])|3(?:[0-47]\\d|5[02-9]|6[02-8]|8[014-9]|9[3-9]))\\d{5}"],["(?:6(?:[0-79]\\d|8[0-247-9])|7(?:[016-8]\\d|2[0-8]|3[01]|5[0-5]))\\d{6}"],["80[0-7]\\d{6}"],["89\\d{7}"],0,0,0,0,["(?:592(?:4[0-2]|93)|80[89]\\d\\d)\\d{4}"]]],MC:["377","00","(?:[3489]|[67]\\d)\\d{7}",[8,9],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["4"],"0$1"],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[389]"]],["(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4 $5",["[67]"],"0$1"]],"0",0,0,0,0,0,[["(?:870|9[2-47-9]\\d)\\d{5}",[8]],["4(?:[46]\\d|5[1-9])\\d{5}|(?:3|[67]\\d)\\d{7}"],["(?:800|90\\d)\\d{5}",[8]]]],MD:["373","00","(?:[235-7]\\d|[89]0)\\d{6}",[8],[["(\\d{3})(\\d{5})","$1 $2",["[89]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["22|3"],"0$1"],["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["[25-7]"],"0$1"]],"0",0,0,0,0,0,[["(?:(?:2[1-9]|3[1-79])\\d|5(?:33|5[257]))\\d{5}"],["562\\d{5}|(?:6\\d|7[16-9])\\d{6}"],["800\\d{5}"],["90[056]\\d{5}"],0,0,["803\\d{5}"],0,["3[08]\\d{6}"],["808\\d{5}"]]],ME:["382","00","(?:20|[3-79]\\d)\\d{6}|80\\d{6,7}",[8,9],[["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[2-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:20[2-8]|3(?:[0-2][2-7]|3[24-7])|4(?:0[2-467]|1[2467])|5(?:0[2467]|1[24-7]|2[2-467]))\\d{5}",[8]],["6(?:[07-9]\\d|3[024]|6[0-25])\\d{5}",[8]],["80(?:[0-2578]|9\\d)\\d{5}"],["9(?:4[1568]|5[178])\\d{5}",[8]],0,0,["77[1-9]\\d{5}",[8]],0,["78[1-49]\\d{5}",[8]]]],MF:["590","00","7090\\d{5}|(?:[56]9|[89]\\d)\\d{7}",[9],0,"0",0,0,0,0,0,[["(?:59(?:0(?:0[079]|[14]3|[27][79]|3[03-7]|5[0-268]|87)|87\\d)|80[6-9]\\d\\d)\\d{4}"],["(?:69(?:0\\d\\d|1(?:2[2-9]|3[0-5]))|7090[0-4])\\d{4}"],["80[0-5]\\d{6}"],["8[129]\\d{7}"],0,0,0,0,["9(?:(?:39[5-7]|76[018])\\d|475[0-6])\\d{4}"]]],MG:["261","00","[23]\\d{8}",[9],[["(\\d{2})(\\d{2})(\\d{3})(\\d{2})","$1 $2 $3 $4",["[23]"],"0$1"]],"0",0,"([24-9]\\d{6})$|0","20$1",0,0,[["2072[29]\\d{4}|20(?:2\\d|4[47]|5[3467]|6[279]|7[356]|8[268]|9[2457])\\d{5}"],["3[2-9]\\d{7}"],0,0,0,0,0,0,["22\\d{7}"]]],MH:["692","011","329\\d{4}|(?:[256]\\d|45)\\d{5}",[7],[["(\\d{3})(\\d{4})","$1-$2",["[2-6]"]]],"1",0,0,0,0,0,[["(?:247|528|625)\\d{4}"],["(?:(?:23|54)5|329|45[35-8])\\d{4}"],0,0,0,0,0,0,["635\\d{4}"]]],MK:["389","00","[2-578]\\d{7}",[8],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["2|34[47]|4(?:[37]7|5[47]|64)"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[347]"],"0$1"],["(\\d{3})(\\d)(\\d{2})(\\d{2})","$1 $2 $3 $4",["[58]"],"0$1"]],"0",0,0,0,0,0,[["(?:(?:2(?:62|77)0|3444)\\d|4[56]440)\\d{3}|(?:34|4[357])700\\d{3}|(?:2(?:[0-3]\\d|5[0-578]|6[01]|82)|3(?:1[3-68]|[23][2-68]|4[23568])|4(?:[23][2-68]|4[3-68]|5[2568]|6[25-8]|7[24-68]|8[4-68]))\\d{5}"],["7(?:3555|(?:474|9[019]7)7)\\d{3}|7(?:[0-25-8]\\d\\d|3(?:[1-478]\\d|6[01])|4(?:2\\d|60|7[01578])|9(?:[2-4]\\d|5[01]|7[015]))\\d{4}"],["800\\d{5}"],["5\\d{7}"],0,0,0,0,0,["8(?:0[1-9]|[1-9]\\d)\\d{5}"]]],ML:["223","00","[24-9]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[24-9]"]]],0,0,0,0,0,0,[["2(?:07[0-8]|12[67])\\d{4}|(?:2(?:02|1[4-689])|4(?:0[0-4]|4[1-69]))\\d{5}"],["2(?:0(?:01|79)|17\\d)\\d{4}|(?:5[0-3]|[679]\\d|8[2-59])\\d{6}"],["80\\d{6}"]]],MM:["95","00","1\\d{5,7}|95\\d{6}|(?:[4-7]|9[0-46-9])\\d{6,8}|(?:2|8\\d)\\d{5,8}",[6,7,8,9,10],[["(\\d)(\\d{2})(\\d{3})","$1 $2 $3",["16|2"],"0$1"],["(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3",["4(?:[2-46]|5[3-5])|5|6(?:[1-689]|7[235-7])|7(?:[0-4]|5[2-7])|8[1-5]|(?:60|86)[23]"],"0$1"],["(\\d)(\\d{3})(\\d{3,4})","$1 $2 $3",["[12]|452|678|86","[12]|452|6788|86"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[4-7]|8[1-35]"],"0$1"],["(\\d)(\\d{3})(\\d{4,6})","$1 $2 $3",["9(?:2[0-4]|[35-9]|4[137-9])"],"0$1"],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["2"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["8"],"0$1"],["(\\d)(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["92"],"0$1"],["(\\d)(\\d{5})(\\d{4})","$1 $2 $3",["9"],"0$1"]],"0",0,0,0,0,0,[["(?:1(?:(?:12|[28]\\d|3[56]|7[3-6]|9[0-6])\\d|4(?:2[29]|7[0-2]|83)|6)|2(?:2(?:00|8[34])|4(?:0\\d|22|7[0-2]|83)|51\\d\\d)|4(?:2(?:2\\d\\d|48[013])|3(?:20\\d|4(?:70|83)|56)|420\\d|5(?:2\\d|470))|6(?:0(?:[23]|88\\d)|(?:124|[56]2\\d)\\d|2472|3(?:20\\d|470)|4(?:2[04]\\d|472)|7(?:3\\d\\d|4[67]0|8(?:[01459]\\d|8))))\\d{4}|5(?:2(?:2\\d{5,6}|47[02]\\d{4})|(?:3472|4(?:2(?:1|86)|470)|522\\d|6(?:20\\d|483)|7(?:20\\d|48[01])|8(?:20\\d|47[02])|9(?:20\\d|470))\\d{4})|7(?:(?:0470|4(?:25\\d|470)|5(?:202|470|96\\d))\\d{4}|1(?:20\\d{4,5}|4(?:70|83)\\d{4}))|8(?:1(?:2\\d{5,6}|4(?:10|7[01]\\d)\\d{3})|2(?:2\\d{5,6}|(?:320|490\\d)\\d{3})|(?:3(?:2\\d\\d|470)|4[24-7]|5(?:(?:2\\d|51)\\d|4(?:[1-35-9]\\d|4[0-57-9]))|6[23])\\d{4})|(?:1[2-6]\\d|4(?:2[24-8]|3[2-7]|[46][2-6]|5[3-5])|5(?:[27][2-8]|3[2-68]|4[24-8]|5[23]|6[2-4]|8[24-7]|9[2-7])|6(?:[19]20|42[03-6]|(?:52|7[45])\\d)|7(?:[04][24-8]|[15][2-7]|22|3[2-4])|8(?:1[2-689]|2[2-8]|(?:[35]2|64)\\d))\\d{4}|25\\d{5,6}|(?:2[2-9]|6(?:1[2356]|[24][2-6]|3[24-6]|5[2-4]|6[2-8]|7[235-7]|8[245]|9[24])|8(?:3[24]|5[245]))\\d{4}",[6,7,8,9]],["(?:17[01]|9(?:2(?:[0-4]|[56]\\d\\d)|(?:3(?:[0-36]|4\\d)|(?:6\\d|8[89]|9[4-8])\\d|7(?:3|40|[5-9]\\d))\\d|4(?:(?:[0245]\\d|[1379])\\d|88)|5[0-6])\\d)\\d{4}|9[69]1\\d{6}|9(?:[68]\\d|9[089])\\d{5}",[7,8,9,10]],["80080(?:0[1-9]|2\\d)\\d{3}",[10]],0,0,0,0,0,["1333\\d{4}",[8]]]],MN:["976","001","[12]\\d{7,9}|[5-9]\\d{7}",[8,9,10],[["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["11|2[16]"],"0$1"],["(\\d{4})(\\d{4})","$1 $2",["[5-9]"]],["(\\d{3})(\\d{5,6})","$1 $2",["[12]2[1-3]"],"0$1"],["(\\d{4})(\\d{5,6})","$1 $2",["[12](?:27|3[2-8]|4[2-68]|5[1-4689])","[12](?:27|3[2-8]|4[2-68]|5[1-4689])[0-3]"],"0$1"],["(\\d{5})(\\d{4,5})","$1 $2",["[12]"],"0$1"]],"0",0,0,0,0,0,[["[12](?:2[1-3]|(?:3[2-8]|4[2-68]|5[1-4689])\\d)\\d{5,6}|7(?:0(?:[0-5]\\d|7[078]|80)|128)\\d{4}|[12]27\\d{6}|(?:11|2[16]|5[368])\\d{6}"],["(?:87[01]|92[0139])\\d{5}|(?:5[05]|6[069]|7[28]|8[0135689]|9[013-9])\\d{6}",[8]],0,0,0,0,0,0,["712[0-79]\\d{4}|7(?:1[013-9]|[5-79]\\d)\\d{5}",[8]]]],MO:["853","00","0800\\d{3}|(?:28|[68]\\d)\\d{6}",[7,8],[["(\\d{4})(\\d{3})","$1 $2",["0"]],["(\\d{4})(\\d{4})","$1 $2",["[268]"]]],0,0,0,0,0,0,[["(?:28[2-9]|8(?:11|[2-57-9]\\d))\\d{5}",[8]],["6800[0-79]\\d{3}|6(?:[235]\\d\\d|6(?:0[0-5]|[1-9]\\d)|8(?:0[1-9]|[14-8]\\d|2[5-9]|[39][0-4]))\\d{4}",[8]],["0800\\d{3}",[7]]]],MP:["1","011","[58]\\d{9}|(?:67|90)0\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","670$1",0,"670",[["670(?:2(?:3[3-7]|56|8[4-8])|32[1-38]|4(?:33|8[348])|5(?:32|55|88)|6(?:64|70|82)|78[3589]|8[3-9]8|989)\\d{4}"],[""],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],MQ:["596","00","7091\\d{5}|(?:[56]9|[89]\\d)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[5-79]|8(?:0[6-9]|[36])"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:59(?:6(?:[03-7]\\d|1[05]|2[7-9]|8[0-39]|9[04-9])|89\\d)|80[6-9]\\d\\d|9(?:477[6-9]|767[4589]))\\d{4}"],["(?:69[67]\\d\\d|7091[0-3])\\d{4}"],["80[0-5]\\d{6}"],["8[129]\\d{7}"],0,0,0,0,["9(?:397[0-3]|477[0-5]|76(?:6\\d|7[0-367]))\\d{4}"]]],MR:["222","00","(?:[2-4]\\d\\d|800)\\d{5}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2-48]"]]],0,0,0,0,0,0,[["(?:25[08]|35\\d|45[1-7])\\d{5}"],["[2-4][0-46-9]\\d{6}"],["800\\d{5}"]]],MS:["1","011","(?:[58]\\d\\d|664|900)\\d{7}",[10],0,"1",0,"([34]\\d{6})$|1","664$1",0,"664",[["6644(?:1[0-3]|91)\\d{4}"],["664(?:3(?:49|9[1-6])|49[2-6])\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],MT:["356","00","3550\\d{4}|(?:[2579]\\d\\d|800)\\d{5}",[8],[["(\\d{4})(\\d{4})","$1 $2",["[2357-9]"]]],0,0,0,0,0,0,[["20(?:3[1-4]|6[059])\\d{4}|2(?:0[19]|[1-357]\\d|60)\\d{5}"],["(?:7(?:210|[79]\\d\\d)|9(?:[29]\\d\\d|69[67]|8(?:1[1-3]|89|97)))\\d{4}"],["800(?:02|[3467]\\d)\\d{3}"],["5(?:0(?:0(?:37|43)|(?:6\\d|70|9[0168])\\d)|[12]\\d0[1-5])\\d{3}"],0,0,["501\\d{5}"],["7117\\d{4}"],["3550\\d{4}"]]],MU:["230","0(?:0|[24-7]0|3[03])","(?:[57]|8\\d\\d)\\d{7}|[2-468]\\d{6}",[7,8,10],[["(\\d{3})(\\d{4})","$1 $2",["[2-46]|8[013]"]],["(\\d{4})(\\d{4})","$1 $2",["[57]"]],["(\\d{5})(\\d{5})","$1 $2",["8"]]],0,0,0,0,0,0,[["(?:2(?:[0346-8]\\d|1[0-8])|4(?:[013568]\\d|2[0-24-8]|71|90)|54(?:[3-5]\\d|71)|6\\d\\d|8(?:14|3[129]))\\d{4}",[7,8]],["5(?:4(?:2[1-389]|7[1-9])|87[15-8])\\d{4}|(?:5(?:2[5-9]|4[3-689]|[57]\\d|8[0-689]|9[0-8])|7(?:0[0-7]|3[013]))\\d{5}",[8]],["802\\d{7}|80[0-2]\\d{4}",[7,10]],["30\\d{5}",[7]],0,0,0,["219\\d{4}",[7]],["3(?:20|9\\d)\\d{4}",[7]]],"020"],MV:["960","0(?:0|19)","(?:800|9[0-57-9]\\d)\\d{7}|[34679]\\d{6}",[7,10],[["(\\d{3})(\\d{4})","$1-$2",["[34679]"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[89]"]]],0,0,0,0,0,0,[["(?:3(?:0[0-4]|3[0-59])|6(?:[58][024689]|6[024-68]|7[02468]))\\d{4}",[7]],["(?:46[46]|[79]\\d\\d)\\d{4}",[7]],["800\\d{7}",[10]],["900\\d{7}",[10]],0,0,["4(?:0[01]|50)\\d{4}",[7]]],"00"],MW:["265","00","(?:[1289]\\d|31|77)\\d{7}|1\\d{6}",[7,9],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["1[2-9]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[1-37-9]"],"0$1"]],"0",0,0,0,0,0,[["1[2-9]\\d{5}",[7]],["111\\d{6}|(?:2[12]|31|77|[89][89])\\d{7}",[9]]]],MX:["52","0[09]","[2-9]\\d{9}",[10],[["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["33|5[56]|81"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[2-9]"]]],0,0,0,0,0,0,[["(?:2(?:0[01]|2\\d|3[1-35-8]|4[13-9]|7[1-689]|8[1-578]|9[467])|3(?:1[1-79]|[2458][1-9]|3\\d|7[1-8]|9[1-5])|4(?:1[1-57-9]|[267][1-9]|3[1-8]|[45]\\d|8[1-35-9]|9[2-689])|5(?:[56]\\d|88|9[1-79])|6(?:1[2-68]|[2-4][1-9]|5[1-36-9]|6[0-57-9]|7[1-7]|8[67]|9[4-8])|7(?:[1346][1-9]|[27]\\d|5[13-9]|8[1-69]|9[17])|8(?:1\\d|2[13-689]|3[1-6]|4[124-6]|6[1246-9]|7[0-378]|9[12479])|9(?:1[346-9]|2[1-4]|3[2-46-8]|5[1348]|[69]\\d|7[12]|8[1-8]))\\d{7}"],["(?:2(?:2\\d|3[1-35-8]|4[13-9]|7[1-689]|8[1-578]|9[467])|3(?:1[1-79]|[2458][1-9]|3\\d|7[1-8]|9[1-5])|4(?:1[1-57-9]|[267][1-9]|3[1-8]|[45]\\d|8[1-35-9]|9[2-689])|5(?:[56]\\d|88|9[1-79])|6(?:1[2-68]|[2-4][1-9]|5[1-36-9]|6[0-57-9]|7[1-7]|8[67]|9[4-8])|7(?:[1346][1-9]|[27]\\d|5[13-9]|8[1-69]|9[17])|8(?:1\\d|2[13-689]|3[1-6]|4[124-6]|6[1246-9]|7[0-378]|9[12479])|9(?:1[346-9]|2[1-4]|3[2-46-8]|5[1348]|[69]\\d|7[12]|8[1-8]))\\d{7}"],["8(?:00|88)\\d{7}"],["900\\d{7}"],["500\\d{7}"],0,0,0,0,["300\\d{7}"]],"00"],MY:["60","00","1\\d{8,9}|(?:3\\d|[4-9])\\d{7}",[8,9,10],[["(\\d)(\\d{3})(\\d{4})","$1-$2 $3",["[4-79]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1-$2 $3",["1(?:[02469]|[378][1-9]|53)|8","1(?:[02469]|[37][1-9]|53|8(?:[1-46-9]|5[7-9]))|8"],"0$1"],["(\\d)(\\d{4})(\\d{4})","$1-$2 $3",["3"],"0$1"],["(\\d)(\\d{3})(\\d{2})(\\d{4})","$1-$2-$3-$4",["1(?:[367]|80)"]],["(\\d{3})(\\d{3})(\\d{4})","$1-$2 $3",["15"],"0$1"],["(\\d{2})(\\d{4})(\\d{4})","$1-$2 $3",["1"],"0$1"]],"0",0,0,0,0,0,[["427[01]\\d{4}|(?:3(?:2[0-36-9]|3[0-368]|4[0-278]|5[0-24-8]|6[0-467]|7[1246-9]|8\\d|9[0-57])\\d|4(?:2[0-689]|[3-79]\\d|8[1-35689])|5(?:2[0-589]|[3468]\\d|5[0-489]|7[1-9]|9[23])|6(?:2[2-9]|3[1357-9]|[46]\\d|5[0-6]|7[0-35-9]|85|9[015-8])|7(?:[2579]\\d|3[03-68]|4[0-8]|6[5-9]|8[0-35-9])|8(?:[24][2-8]|3[2-5]|5[2-7]|6[2-589]|7[2-578]|[89][2-9])|9(?:0[57]|13|[25-7]\\d|[3489][0-8]))\\d{5}",[8,9]],["1(?:(?:1888[689]|4400|8(?:47|8[27])[0-4])\\d{4}|9\\d{7,8})|1(?:0(?:[23568]\\d|4[0-6]|7[016-9]|9[0-8])|1(?:[1-5]\\d\\d|6(?:0[5-9]|[1-9]\\d)|7(?:[0-4]\\d|5[0-79]|6[02-4]|8[02-5]))|(?:[26]\\d|[37][1-9]|4[235-9])\\d|5(?:31|9\\d\\d)|8(?:1[23]|[236]\\d|4[06]|5(?:46|[7-9])|7[016-9]|8[01]|9[0-8]))\\d{5}",[9,10]],["1[378]00\\d{6}",[10]],["1600\\d{6}",[10]],0,0,0,0,["15(?:4(?:6[0-4]\\d|8(?:0[125]|[17]\\d|21|3[01]|4[01589]|5[014]|6[02]))|6(?:32[0-6]|78\\d))\\d{4}",[10]]]],MZ:["258","00","(?:2|8\\d)\\d{7}",[8,9],[["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["2|8[2-9]"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["2(?:[1346]\\d|5[0-2]|[78][12]|93)\\d{5}",[8]],["8[2-9]\\d{7}",[9]],["800\\d{6}",[9]]]],NA:["264","00","[68]\\d{7,8}",[8,9],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["88"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["6"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["87"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["8"],"0$1"]],"0",0,0,0,0,0,[["64426\\d{3}|6(?:1(?:2[2-7]|3[01378]|4[0-4])|254|32[0237]|4(?:27|41|5[25])|52[236-8]|626|7(?:2[2-4]|30))\\d{4,5}|6(?:1(?:(?:0\\d|2[0189]|3[24-69]|4[5-9])\\d|17|69|7[014])|2(?:17|5[0-36-8]|69|70)|3(?:17|2[14-689]|34|6[289]|7[01]|81)|4(?:17|2[0-2]|4[06]|5[0137]|69|7[01])|5(?:17|2[0459]|69|7[01])|6(?:17|25|38|42|69|7[01])|7(?:17|2[569]|3[13]|6[89]|7[01]))\\d{4}"],["(?:60|8[1245])\\d{7}",[9]],["80\\d{7}",[9]],["8701\\d{5}",[9]],0,0,0,0,["8(?:3\\d\\d|86)\\d{5}"]]],NC:["687","00","(?:050|[2-57-9]\\d\\d)\\d{3}",[6],[["(\\d{2})(\\d{2})(\\d{2})","$1.$2.$3",["[02-57-9]"]]],0,0,0,0,0,0,[["(?:2[03-9]|3[0-5]|4[1-7]|88)\\d{4}"],["(?:[579]\\d|8[0-79])\\d{4}"],["050\\d{3}"],["36\\d{4}"]]],NE:["227","00","[027-9]\\d{7}",[8],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["08"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[089]|2[013]|7[0467]"]]],0,0,0,0,0,0,[["2(?:0(?:20|3[1-8]|4[13-5]|5[14]|6[14578]|7[1-578])|1(?:4[145]|5[14]|6[14-68]|7[169]|88))\\d{4}"],["(?:23|7[0467]|[89]\\d)\\d{6}"],["08\\d{6}"],["09\\d{6}"]]],NF:["672","00","[13]\\d{5}",[6],[["(\\d{2})(\\d{4})","$1 $2",["1[0-3]"]],["(\\d)(\\d{5})","$1 $2",["[13]"]]],0,0,"([0-258]\\d{4})$","3$1",0,0,[["(?:1(?:06|17|28|39)|3[0-2]\\d)\\d{3}"],["(?:14|3[58])\\d{4}"]]],NG:["234","009","(?:20|9\\d)\\d{8}|[78]\\d{9,13}",[10,11,12,13,14],[["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["[7-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["20[129]"],"0$1"],["(\\d{4})(\\d{2})(\\d{4})","$1 $2 $3",["2"],"0$1"],["(\\d{3})(\\d{4})(\\d{4,5})","$1 $2 $3",["[78]"],"0$1"],["(\\d{3})(\\d{5})(\\d{5,6})","$1 $2 $3",["[78]"],"0$1"]],"0",0,0,0,0,0,[["20(?:[1259]\\d|3[013-9]|4[1-8]|6[024-689]|7[1-79]|8[2-9])\\d{6}",[10]],["(?:702[0-24-9]|819[01])\\d{6}|(?:7(?:0[13-9]|[12]\\d)|8(?:0[1-9]|1[0-8])|9(?:0[1-9]|1[1-6]))\\d{7}",[10]],["800\\d{7,11}"],0,0,0,["700\\d{7,11}"]]],NI:["505","00","(?:1800|[25-8]\\d{3})\\d{4}",[8],[["(\\d{4})(\\d{4})","$1 $2",["[125-8]"]]],0,0,0,0,0,0,[["2\\d{7}"],["(?:5(?:5[0-7]|[78]\\d)|6(?:20|3[035]|4[045]|5[05]|77|8[1-9]|9[059])|(?:7[5-8]|8\\d)\\d)\\d{5}"],["1800\\d{4}"]]],NL:["31","00","(?:[124-7]\\d\\d|3(?:[02-9]\\d|1[0-8]))\\d{6}|8\\d{6,9}|9\\d{6,10}|1\\d{4,5}",[5,6,7,8,9,10,11],[["(\\d{3})(\\d{4,7})","$1 $2",["[89]0"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["66"],"0$1"],["(\\d)(\\d{8})","$1 $2",["6"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["1[16-8]|2[259]|3[124]|4[17-9]|5[124679]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[1-578]|91"],"0$1"],["(\\d{3})(\\d{3})(\\d{5})","$1 $2 $3",["9"],"0$1"]],"0",0,0,0,0,0,[["(?:1(?:[035]\\d|1[13-578]|6[124-8]|7[24]|8[0-467])|2(?:[0346]\\d|2[2-46-9]|5[125]|9[479])|3(?:[03568]\\d|1[3-8]|2[01]|4[1-8])|4(?:[0356]\\d|1[1-368]|7[58]|8[15-8]|9[23579])|5(?:[0358]\\d|[19][1-9]|2[1-57-9]|4[13-8]|6[126]|7[0-3578])|7\\d\\d)\\d{6}",[9]],["(?:6[1-58]|970\\d)\\d{7}",[9,11]],["800\\d{4,7}",[7,8,9,10]],["90[069]\\d{4,7}",[7,8,9,10]],0,0,["140(?:1[035]|2[0346]|3[03568]|4[0356]|5[0358]|8[458])|(?:140(?:1[16-8]|2[259]|3[124]|4[17-9]|5[124679]|7)|8[478]\\d{6})\\d",[5,6,9]],["66\\d{7}",[9]],["(?:85|91)\\d{7}",[9]]]],NO:["47","00","(?:0|[2-9]\\d{3})\\d{4}",[5,8],[["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["8"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[2-79]"]]],0,0,0,0,0,"[02-689]|7[0-8]",[["(?:2[1-4]|3[1-3578]|5[1-35-7]|6[1-46-9]|7[0-8])\\d{6}",[8]],["45(?:[0-24-9]\\d|3[0-57-9])\\d{4}|(?:4[016-8]|9\\d)\\d{6}",[8]],["80[01]\\d{5}",[8]],["82[09]\\d{5}",[8]],["880\\d{5}",[8]],["81[23]\\d{5}",[8]],["(?:0[235-9]|81(?:0(?:0[7-9]|1\\d)|5\\d\\d))\\d{3}"],0,["85[0-5]\\d{5}",[8]],["810(?:0[0-6]|[2-8]\\d)\\d{3}",[8]]]],NP:["977","00","(?:1\\d|9)\\d{9}|[1-9]\\d{7}",[8,10,11],[["(\\d)(\\d{7})","$1-$2",["1[2-6]"],"0$1"],["(\\d{2})(\\d{6})","$1-$2",["1[01]|[2-8]|9(?:[1-59]|[67][2-6])"],"0$1"],["(\\d{3})(\\d{7})","$1-$2",["9"]]],"0",0,0,0,0,0,[["(?:1[0-6]\\d|99[02-6])\\d{5}|(?:2[13-79]|3[135-8]|4[146-9]|5[135-7]|6[13-9]|7[15-9]|8[1-46-9]|9[1-7])[2-6]\\d{5}",[8]],["9(?:00|6[0-3]|7[0-24-6]|8[0-24-68])\\d{7}",[10]],["1(?:66001|800\\d\\d)\\d{5}",[11]]]],NR:["674","00","(?:222|444|(?:55|8\\d)\\d|666|777|999)\\d{4}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[24-9]"]]],0,0,0,0,0,0,[["444\\d{4}"],["(?:222|55[3-9]|666|777|8\\d\\d|999)\\d{4}"]]],NU:["683","00","(?:[4-7]|888\\d)\\d{3}",[4,7],[["(\\d{3})(\\d{4})","$1 $2",["8"]]],0,0,0,0,0,0,[["[47]\\d{3}",[4]],["(?:[56]|888[1-9])\\d{3}"]]],NZ:["64","0(?:0|161)","[1289]\\d{9}|50\\d{5}(?:\\d{2,3})?|[27-9]\\d{7,8}|(?:[34]\\d|6[0-35-9])\\d{6}|8\\d{4,6}",[5,6,7,8,9,10],[["(\\d{2})(\\d{3,8})","$1 $2",["8[1-79]"],"0$1"],["(\\d{3})(\\d{2})(\\d{2,3})","$1 $2 $3",["50[036-8]|8|90","50(?:[0367]|88)|8|90"],"0$1"],["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["24|[346]|7[2-57-9]|9[2-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["2(?:10|74)|[589]"],"0$1"],["(\\d{2})(\\d{3,4})(\\d{4})","$1 $2 $3",["1|2[028]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,5})","$1 $2 $3",["2(?:[169]|7[0-35-9])|7"],"0$1"]],"0",0,0,0,0,0,[["240\\d{5}|(?:3[2-79]|[49][2-9]|6[235-9]|7[2-57-9])\\d{6}",[8]],["2(?:[0-27-9]\\d|6)\\d{6,7}|2(?:1\\d|75)\\d{5}",[8,9,10]],["508\\d{6,7}|80\\d{6,8}",[8,9,10]],["(?:1[13-57-9]\\d{5}|50(?:0[08]|30|66|77|88))\\d{3}|90\\d{6,8}",[7,8,9,10]],["70\\d{7}",[9]],0,["8(?:1[16-9]|22|3\\d|4[045]|5[459]|6[235-9]|7[0-3579]|90)\\d{2,7}"]],"00"],OM:["968","00","(?:1505|[279]\\d{3}|500)\\d{4}|800\\d{5,6}",[7,8,9],[["(\\d{3})(\\d{4,6})","$1 $2",["[58]"]],["(\\d{2})(\\d{6})","$1 $2",["2"]],["(\\d{4})(\\d{4})","$1 $2",["[179]"]]],0,0,0,0,0,0,[["2[1-6]\\d{6}",[8]],["(?:1505|90[1-9]\\d)\\d{4}|(?:7[124-9]|9[1-9])\\d{6}",[8]],["8007\\d{4,5}|(?:500|800[05])\\d{4}"],["900\\d{5}",[8]]]],PA:["507","00","(?:00800|8\\d{3})\\d{6}|[68]\\d{7}|[1-57-9]\\d{6}",[7,8,10,11],[["(\\d{3})(\\d{4})","$1-$2",["[1-57-9]"]],["(\\d{4})(\\d{4})","$1-$2",["[68]"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["(?:1(?:0\\d|1[0479]|2[37]|3[0137]|4[147]|5[05]|6[058]|7[0167]|8[2358]|9[1389])|2(?:[0235-79]\\d|1[0-7]|4[013-9]|8[02-9])|3(?:[0147-9]\\d|[25][0-5]|33|6[068])|4(?:00|3[0-579]|4\\d|7[0-57-9])|5(?:[01]\\d|2[0-7]|[56]0|79)|7(?:0[09]|2[0-26-8]|3[03]|4[04]|5[05-9]|6[0156]|7[0-24-9]|8[4-9]|90)|8(?:09|2[89]|3\\d|4[0-24-689]|5[014]|8[02])|9(?:0[5-9]|1[0135-8]|2[036-9]|3[35-79]|40|5[0457-9]|6[05-9]|7[04-9]|8[235-8]|9\\d))\\d{4}",[7]],["(?:1[16]1|21[89]|6\\d{3}|8(?:1[01]|7[23]))\\d{4}",[7,8]],["800\\d{4,5}|(?:00800|800\\d)\\d{6}"],["(?:8(?:22|55|60|7[78]|86)|9(?:00|81))\\d{4}",[7]]]],PE:["51","00|19(?:1[124]|77|90)00","(?:[14-8]|9\\d)\\d{7}",[8,9],[["(\\d{3})(\\d{5})","$1 $2",["80"],"(0$1)"],["(\\d)(\\d{7})","$1 $2",["1"],"(0$1)"],["(\\d{2})(\\d{6})","$1 $2",["[4-8]"],"(0$1)"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["9"]]],"0",0,0,0,0,0,[["(?:(?:19[02-68]|(?:4[34]|5[14])[0-8]|687)\\d|7(?:173|(?:3[0-8]|55)\\d)|8(?:10[05689]|6(?:0[06-9]|1[6-9]|29)|7(?:0[0569]|[56]0)))\\d{4}|(?:1[0-8]|4[12]|5[236]|6[1-7]|7[246]|8[2-4])\\d{6}",[8]],["9\\d{8}",[9]],["800\\d{5}",[8]],["805\\d{5}",[8]],["80[24]\\d{5}",[8]],0,0,0,0,["801\\d{5}",[8]]],"00"," Anexo "],PF:["689","00","4\\d{5}(?:\\d{2})?|8\\d{7,8}",[6,8,9],[["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["44"]],["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["4|8[7-9]"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"]]],0,0,0,0,0,0,[["4(?:0[4-689]|9[4-68])\\d{5}",[8]],["8[7-9]\\d{6}",[8]],["80[0-5]\\d{6}",[9]],0,0,0,["44\\d{4}",[6]],0,["499\\d{5}",[8]]]],PG:["675","00|140[1-3]","(?:180|[78]\\d{3})\\d{4}|(?:[2-589]\\d|64)\\d{5}",[7,8],[["(\\d{3})(\\d{4})","$1 $2",["18|[2-69]|85[02-46-9]"]],["(\\d{4})(\\d{4})","$1 $2",["[78]"]]],0,0,0,0,0,0,[["(?:(?:3[0-2]|4[257]|5[34]|9[78])\\d|64[1-9]|85[02-46-9])\\d{4}",[7]],["(?:7\\d|8[1-58])\\d{6}",[8]],["180\\d{4}",[7]],0,0,0,0,["27[01]\\d{4}",[7]],["2(?:0[0-57]|7[568])\\d{4}",[7]]],"00"],PH:["63","00","(?:[2-7]|9\\d)\\d{8}|2\\d{5}|(?:1800|8)\\d{7,9}",[6,8,9,10,11,12,13],[["(\\d)(\\d{5})","$1 $2",["2"],"(0$1)"],["(\\d{4})(\\d{4,6})","$1 $2",["3(?:23|39|46)|4(?:2[3-6]|[35]9|4[26]|76)|544|88[245]|(?:52|64|86)2","3(?:230|397|461)|4(?:2(?:35|[46]4|51)|396|4(?:22|63)|59[347]|76[15])|5(?:221|446)|642[23]|8(?:622|8(?:[24]2|5[13]))"],"(0$1)"],["(\\d{5})(\\d{4})","$1 $2",["346|4(?:27|9[35])|883","3469|4(?:279|9(?:30|56))|8834"],"(0$1)"],["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["2"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[3-7]|8[2-8]"],"(0$1)"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["[89]"],"0$1"],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["1"]],["(\\d{4})(\\d{1,2})(\\d{3})(\\d{4})","$1 $2 $3 $4",["1"]]],"0",0,0,0,0,0,[["(?:(?:2[3-8]|3[2-68]|4[2-9]|5[2-6]|6[2-58]|7[24578])\\d{3}|88(?:22\\d\\d|42))\\d{4}|(?:2|8[2-8]\\d\\d)\\d{5}",[6,8,9,10]],["(?:8(?:1[37]|9[5-8])|9(?:0[5-9]|1[0-24-9]|[235-7]\\d|4[2-9]|8[135-9]|9[1-9]))\\d{7}",[10]],["1800\\d{7,9}",[11,12,13]]]],PK:["92","00","122\\d{6}|[24-8]\\d{10,11}|9(?:[013-9]\\d{8,10}|2(?:[01]\\d\\d|2(?:[06-8]\\d|1[01]))\\d{7})|(?:[2-8]\\d{3}|92(?:[0-7]\\d|8[1-9]))\\d{6}|[24-9]\\d{8}|[89]\\d{7}",[8,9,10,11,12],[["(\\d{3})(\\d{3})(\\d{2,7})","$1 $2 $3",["[89]0"],"0$1"],["(\\d{4})(\\d{5})","$1 $2",["1"]],["(\\d{3})(\\d{6,7})","$1 $2",["2(?:3[2358]|4[2-4]|9[2-8])|45[3479]|54[2-467]|60[468]|72[236]|8(?:2[2-689]|3[23578]|4[3478]|5[2356])|9(?:2[2-8]|3[27-9]|4[2-6]|6[3569]|9[25-8])","9(?:2[3-8]|98)|(?:2(?:3[2358]|4[2-4]|9[2-8])|45[3479]|54[2-467]|60[468]|72[236]|8(?:2[2-689]|3[23578]|4[3478]|5[2356])|9(?:22|3[27-9]|4[2-6]|6[3569]|9[25-7]))[2-9]"],"(0$1)"],["(\\d{2})(\\d{7,8})","$1 $2",["(?:2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)[2-9]"],"(0$1)"],["(\\d{5})(\\d{5})","$1 $2",["58"],"(0$1)"],["(\\d{3})(\\d{7})","$1 $2",["3"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["2[125]|4[0-246-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91"],"(0$1)"],["(\\d{3})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["[24-9]"],"(0$1)"]],"0",0,0,0,0,0,[["(?:(?:21|42)[2-9]|58[126])\\d{7}|(?:2[25]|4[0146-9]|5[1-35-7]|6[1-8]|7[14]|8[16]|91)[2-9]\\d{6,7}|(?:2(?:3[2358]|4[2-4]|9[2-8])|45[3479]|54[2-467]|60[468]|72[236]|8(?:2[2-689]|3[23578]|4[3478]|5[2356])|9(?:2[2-8]|3[27-9]|4[2-6]|6[3569]|9[25-8]))[2-9]\\d{5,6}",[9,10]],["3(?:[0-247]\\d|3[0-79]|55|64)\\d{7}",[10]],["800\\d{5}(?:\\d{3})?",[8,11]],["900\\d{5}",[8]],["122\\d{6}",[9]],0,["(?:2(?:[125]|3[2358]|4[2-4]|9[2-8])|4(?:[0-246-9]|5[3479])|5(?:[1-35-7]|4[2-467])|6(?:0[468]|[1-8])|7(?:[14]|2[236])|8(?:[16]|2[2-689]|3[23578]|4[3478]|5[2356])|9(?:1|22|3[27-9]|4[2-6]|6[3569]|9[2-7]))111\\d{6}",[11,12]]]],PL:["48","00","(?:6|8\\d\\d)\\d{7}|[1-9]\\d{6}(?:\\d{2})?|[26]\\d{5}",[6,7,8,9,10],[["(\\d{5})","$1",["19"]],["(\\d{3})(\\d{3})","$1 $2",["11|20|64"]],["(\\d{2})(\\d{2})(\\d{3})","$1 $2 $3",["30|(?:1[2-8]|2[2-69]|3[2-4]|4[1-468]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145])1","30|(?:1[2-8]|2[2-69]|3[2-4]|4[1-468]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145])19"]],["(\\d{3})(\\d{2})(\\d{2,3})","$1 $2 $3",["64"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["21|39|45|5[0137]|6[0469]|7[02389]|8(?:0[14]|8)"]],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["1[2-8]|[2-7]|8[1-79]|9[145]"]],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["8"]]],0,0,0,0,0,0,[["(?:30|47\\d\\d)\\d{5}|(?:1[2-8]|2[2-69]|3[2-4]|4[1-468]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145])(?:[02-9]\\d{6}|1(?:[0-8]\\d{5}|9\\d{3}(?:\\d{2})?))",[7,9]],["21(?:1[013-5]|2\\d|3[1-9])\\d{5}|(?:45|5[0137]|6[069]|7[2389]|88)\\d{7}",[9]],["800\\d{6,7}",[9,10]],["70[01346-8]\\d{6}",[9]],0,0,["804\\d{6}",[9]],["64\\d{4,7}",[6,7,8,9]],["39\\d{7}",[9]],["801\\d{6}",[9]]]],PM:["508","00","[78]\\d{8}|[2-9]\\d{5}",[6,9],[["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["[2-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["7"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"],"0$1"]],"0",0,0,0,0,0,[["80[6-9]\\d{6}|(?:[236-9]\\d|4[1-35-9]|5[0-47-9])\\d{4}"],["708(?:4[0-5]|5[0-6])\\d{4}|(?:[236-9]\\d|4[02-489]|5[02-9])\\d{4}"],["80[0-5]\\d{6}",[9]],["8[129]\\d{7}",[9]]]],PR:["1","011","(?:[589]\\d\\d|787)\\d{7}",[10],0,"1",0,0,0,0,"787|939",[["(?:787|939)[2-9]\\d{6}"],[""],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],PS:["970","00","[2489]2\\d{6}|(?:1\\d|5)\\d{8}",[8,9,10],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["[2489]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["5"],"0$1"],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1"]]],"0",0,0,0,0,0,[["(?:22[2-47-9]|42[45]|82[014-68]|92[3569])\\d{5}",[8]],["5[69]\\d{7}",[9]],["1800\\d{6}",[10]],0,0,0,0,0,0,["1700\\d{6}",[10]]]],PT:["351","00","1693\\d{5}|(?:[26-9]\\d|30)\\d{7}",[9],[["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["2[12]"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["16|[236-9]"]]],0,0,0,0,0,0,[["2(?:[12]\\d|3[1-689]|4[1-59]|[57][1-9]|6[1-35689]|8[1-69]|9[1256])\\d{6}"],["6(?:[06]92(?:30|9\\d)|[35]92(?:[049]\\d|3[034]))\\d{3}|(?:(?:16|6[0356])93|9(?:[1-36]\\d\\d|480))\\d{5}"],["80[02]\\d{6}"],["(?:6(?:0[178]|4[68])\\d|76(?:0[1-57]|1[2-47]|2[1-37]))\\d{5}"],["884[0-4689]\\d{5}"],["600\\d{6}|6[06]92(?:0\\d|3[349]|49)\\d{3}"],["70(?:38[01]|596|(?:7\\d|8[17])\\d)\\d{4}"],["6(?:222\\d|89(?:00|88|99))\\d{4}"],["30\\d{7}"],["80(?:8\\d|9[1579])\\d{5}"]]],PW:["680","01[12]","(?:[24-8]\\d\\d|345|900)\\d{4}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[2-9]"]]],0,0,0,0,0,0,[["(?:2(?:55|77)|345|488|5(?:35|44|87)|6(?:22|54|79)|7(?:33|47)|8(?:24|55|76)|900)\\d{4}"],["(?:(?:46|83)[0-5]|(?:6[2-4689]|78)0)\\d{4}|(?:45|77|88)\\d{5}"]]],PY:["595","00","[36-8]\\d{5,8}|4\\d{6,8}|59\\d{6}|9\\d{5,10}|(?:2\\d|5[0-8])\\d{6,7}",[6,7,8,9,10,11],[["(\\d{3})(\\d{3,6})","$1 $2",["[2-9]0"],"0$1"],["(\\d{2})(\\d{5})","$1 $2",["3[289]|4[246-8]|61|7[1-3]|8[1-36]"],"(0$1)"],["(\\d{3})(\\d{4,5})","$1 $2",["2[279]|3[13-5]|4[359]|5|6(?:[34]|7[1-46-8])|7[46-8]|85"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["2[14-68]|3[26-9]|4[1246-8]|6(?:1|75)|7[1-35]|8[1-36]"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["87"]],["(\\d{3})(\\d{6})","$1 $2",["9(?:[5-79]|8[1-7])"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[2-8]"],"0$1"],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["9"]]],"0",0,0,0,0,0,[["(?:3[289]|4[246-8]|61|7[1-3]|8[1-36])\\d{5,7}|(?:2(?:[14-68]\\d|2[4-68]|7[15]|9[1-5])|3(?:18|3[167]|4[2357]|51|[67]\\d)|4(?:1\\d|3[12]|5[13]|9[1-47])|5(?:[1-4]\\d|5[02-4])|6(?:3[1-3]|44|7[1-8])|7(?:4[0-4]|5\\d|6[1-578]|75|8[0-8])|858)\\d{5,6}",[7,8,9]],["9(?:51|6[129]|7[1-6]|8[1-7]|9[1-5])\\d{6}",[9]],["9800\\d{5,7}",[9,10,11]],0,0,0,["[245]0\\d{6,7}|[36-9]0\\d{4,7}",[6,7,8,9]],0,["8700[0-4]\\d{4}",[9]]]],QA:["974","00","800\\d{4}|(?:2|800)\\d{6}|(?:0080|[3-7])\\d{7}",[7,8,9,11],[["(\\d{3})(\\d{4})","$1 $2",["2[136]|8"]],["(\\d{4})(\\d{4})","$1 $2",["[3-7]"]]],0,0,0,0,0,0,[["4(?:(?:[014]\\d\\d|999)\\d|2022)\\d{3}",[8]],["[35-7]\\d{7}",[8]],["800\\d{4}|(?:0080[01]|800)\\d{6}",[7,9,11]],0,0,0,0,["2[136]\\d{5}",[7]]]],RE:["262","00","709\\d{6}|(?:26|[689]\\d)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[26-9]"],"0$1"]],"0",0,0,0,0,0,[["2631[0-6]\\d{4}|26(?:2\\d|30|88)\\d{5}"],["(?:69(?:2\\d\\d|3(?:[06][0-6]|1[0-3]|2[0-2]|3[0-39]|4\\d|5[0-5]|7[0-37]|8[0-8]|9[0-479]))|7092[0-3])\\d{4}"],["80\\d{7}"],["89[1-37-9]\\d{6}"],0,0,0,0,["9(?:399[0-3]|479[0-6]|76(?:2[278]|3[0-37]))\\d{4}"],["8(?:1[019]|2[0156]|84|90)\\d{6}"]]],RO:["40","00","(?:[236-8]\\d|90)\\d{7}|[23]\\d{5}",[6,9],[["(\\d{3})(\\d{3})","$1 $2",["2[3-6]","2[3-6]\\d9"],"0$1"],["(\\d{2})(\\d{4})","$1 $2",["219|31"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[23]1"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[236-9]"],"0$1"]],"0",0,0,0,0,0,[["[23][13-6]\\d{7}|(?:2(?:19\\d|[3-6]\\d9)|31\\d\\d)\\d\\d"],["(?:630|702)0\\d{5}|(?:6(?:00|2\\d)|7(?:0[013-9]|1[0-3]|[2-7]\\d|8[03-8]|9[0-39]))\\d{6}",[9]],["800\\d{6}",[9]],["90[0136]\\d{6}",[9]],0,0,["(?:37\\d|80[578])\\d{6}",[9]],0,0,["801\\d{6}",[9]]],0," int "],RS:["381","00","38[02-9]\\d{6,9}|6\\d{7,9}|90\\d{4,8}|38\\d{5,6}|(?:7\\d\\d|800)\\d{3,9}|(?:[12]\\d|3[0-79])\\d{5,10}",[6,7,8,9,10,11,12],[["(\\d{3})(\\d{3,9})","$1 $2",["(?:2[389]|39)0|[7-9]"],"0$1"],["(\\d{2})(\\d{5,10})","$1 $2",["[1-36]"],"0$1"]],"0",0,0,0,0,0,[["(?:11[1-9]\\d|(?:2[389]|39)(?:0[2-9]|[2-9]\\d))\\d{3,8}|(?:1[02-9]|2[0-24-7]|3[0-8])[2-9]\\d{4,9}",[7,8,9,10,11,12]],["6(?:[0-689]|7\\d)\\d{6,7}",[8,9,10]],["800\\d{3,9}"],["(?:78\\d|90[0169])\\d{3,7}",[6,7,8,9,10]],0,0,["7[06]\\d{4,10}"]]],RU:["7","810","8\\d{13}|[347-9]\\d{9}",[10,14],[["(\\d{4})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["7(?:1[0-8]|2[1-9])","7(?:1(?:[0-356]2|4[29]|7|8[27])|2(?:1[23]|[2-9]2))","7(?:1(?:[0-356]2|4[29]|7|8[27])|2(?:13[03-69]|62[013-9]))|72[1-57-9]2"],"8 ($1)",1],["(\\d{5})(\\d)(\\d{2})(\\d{2})","$1 $2 $3 $4",["7(?:1[0-68]|2[1-9])","7(?:1(?:[06][3-6]|[18]|2[35]|[3-5][3-5])|2(?:[13][3-5]|[24-689]|7[457]))","7(?:1(?:0(?:[356]|4[023])|[18]|2(?:3[013-9]|5)|3[45]|43[013-79]|5(?:3[1-8]|4[1-7]|5)|6(?:3[0-35-9]|[4-6]))|2(?:1(?:3[178]|[45])|[24-689]|3[35]|7[457]))|7(?:14|23)4[0-8]|71(?:33|45)[1-79]"],"8 ($1)",1],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["7"],"8 ($1)",1],["(\\d{3})(\\d{3})(\\d{2})(\\d{2})","$1 $2-$3-$4",["[349]|8(?:[02-7]|1[1-8])"],"8 ($1)",1],["(\\d{4})(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3 $4",["8"],"8 ($1)"]],"8",0,0,0,0,"[3489]",[["(?:3(?:0[12]|36|4[1-35-79]|5[1-3]|65|8[1-58]|9[0145])|4(?:01|1[1356]|2[13467]|7[1-5]|8[1-7]|9[1-689])|8(?:1[1-8]|2[01]|3[13-6]|4[0-8]|5[15-7]|6[0-35-79]|7[1-37-9]))\\d{7}",[10]],["9\\d{9}",[10]],["8(?:0[04]|108\\d{3})\\d{7}"],["80[39]\\d{7}",[10]],["808\\d{7}",[10]]],"8~10"],RW:["250","00","(?:06|[27]\\d\\d|[89]00)\\d{6}",[8,9],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["0"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["2"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[7-9]"],"0$1"]],"0",0,0,0,0,0,[["(?:06|2[23568]\\d)\\d{6}"],["7[237-9]\\d{7}",[9]],["800\\d{6}",[9]],["900\\d{6}",[9]]]],SA:["966","00","(?:[15]\\d|800|92)\\d{7}",[9,10],[["(\\d{4})(\\d{5})","$1 $2",["9"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["1"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["5"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["8"]]],"0",0,0,0,0,0,[["1(?:1\\d|2[24-8]|3[35-8]|4[3-68]|6[2-5]|7[235-7])\\d{6}",[9]],["579[0-8]\\d{5}|5(?:[013-689]\\d|7[0-8])\\d{6}",[9]],["800\\d{7}",[10]],["925\\d{6}",[9]],0,0,0,0,0,["920\\d{6}",[9]]]],SB:["677","0[01]","[6-9]\\d{6}|[1-6]\\d{4}",[5,7],[["(\\d{2})(\\d{5})","$1 $2",["6[89]|7|8[4-9]|9(?:[1-8]|9[0-8])"]]],0,0,0,0,0,0,[["(?:1[4-79]|[23]\\d|4[0-2]|5[03]|6[0-37])\\d{3}",[5]],["48\\d{3}|(?:(?:6[89]|7[1-9]|8[4-9])\\d|9(?:1[2-9]|2[013-9]|3[0-2]|[46]\\d|5[0-46-9]|7[0-689]|8[0-79]|9[0-8]))\\d{4}"],["1[38]\\d{3}",[5]],0,0,0,0,0,["5[12]\\d{3}",[5]]]],SC:["248","010|0[0-2]","(?:[2489]\\d|64)\\d{5}",[7],[["(\\d)(\\d{3})(\\d{3})","$1 $2 $3",["[246]|9[57]"]]],0,0,0,0,0,0,[["4[2-46]\\d{5}"],["2[125-8]\\d{5}"],["800[08]\\d{3}"],["85\\d{5}"],0,0,0,0,["971\\d{4}|(?:64|95)\\d{5}"]],"00"],SD:["249","00","[19]\\d{8}",[9],[["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[19]"],"0$1"]],"0",0,0,0,0,0,[["1(?:5\\d|8[35-7])\\d{6}"],["(?:1[0-2]|9[0-3569])\\d{7}"]]],SE:["46","00","(?:[26]\\d\\d|9)\\d{9}|[1-9]\\d{8}|[1-689]\\d{7}|[1-4689]\\d{6}|2\\d{5}",[6,7,8,9,10,12],[["(\\d{2})(\\d{2,3})(\\d{2})","$1-$2 $3",["20"],"0$1",0,"$1 $2 $3"],["(\\d{3})(\\d{4})","$1-$2",["9(?:00|39|44|9)"],"0$1",0,"$1 $2"],["(\\d{2})(\\d{3})(\\d{2})","$1-$2 $3",["[12][136]|3[356]|4[0246]|6[03]|90[1-9]"],"0$1",0,"$1 $2 $3"],["(\\d)(\\d{2,3})(\\d{2})(\\d{2})","$1-$2 $3 $4",["8"],"0$1",0,"$1 $2 $3 $4"],["(\\d{3})(\\d{2,3})(\\d{2})","$1-$2 $3",["1[2457]|2(?:[247-9]|5[0138])|3[0247-9]|4[1357-9]|5[0-35-9]|6(?:[125689]|4[02-57]|7[0-2])|9(?:[125-8]|3[02-5]|4[0-3])"],"0$1",0,"$1 $2 $3"],["(\\d{3})(\\d{2,3})(\\d{3})","$1-$2 $3",["9(?:00|39|44)"],"0$1",0,"$1 $2 $3"],["(\\d{2})(\\d{2,3})(\\d{2})(\\d{2})","$1-$2 $3 $4",["1[13689]|2[0136]|3[1356]|4[0246]|54|6[03]|90[1-9]"],"0$1",0,"$1 $2 $3 $4"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1-$2 $3 $4",["10|7"],"0$1",0,"$1 $2 $3 $4"],["(\\d)(\\d{3})(\\d{3})(\\d{2})","$1-$2 $3 $4",["8"],"0$1",0,"$1 $2 $3 $4"],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1-$2 $3 $4",["[13-5]|2(?:[247-9]|5[0138])|6(?:[124-689]|7[0-2])|9(?:[125-8]|3[02-5]|4[0-3])"],"0$1",0,"$1 $2 $3 $4"],["(\\d{3})(\\d{2})(\\d{2})(\\d{3})","$1-$2 $3 $4",["9"],"0$1",0,"$1 $2 $3 $4"],["(\\d{3})(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1-$2 $3 $4 $5",["[26]"],"0$1",0,"$1 $2 $3 $4 $5"]],"0",0,0,0,0,0,[["(?:(?:[12][136]|3[356]|4[0246]|6[03]|8\\d)\\d|90[1-9])\\d{4,6}|(?:1(?:2[0-35]|4[0-4]|5[0-25-9]|7[13-6]|[89]\\d)|2(?:2[0-7]|4[0136-8]|5[0138]|7[018]|8[01]|9[0-57])|3(?:0[0-4]|1\\d|2[0-25]|4[056]|7[0-2]|8[0-3]|9[023])|4(?:1[013-8]|3[0135]|5[14-79]|7[0-246-9]|8[0156]|9[0-689])|5(?:0[0-6]|[15][0-5]|2[0-68]|3[0-4]|4\\d|6[03-5]|7[013]|8[0-79]|9[01])|6(?:1[1-3]|2[0-4]|4[02-57]|5[0-37]|6[0-3]|7[0-2]|8[0247]|9[0-356])|9(?:1[0-68]|2\\d|3[02-5]|4[0-3]|5[0-4]|[68][01]|7[0135-8]))\\d{5,6}",[7,8,9]],["7[023689]\\d{7}",[9]],["20\\d{4,7}",[6,7,8,9]],["649\\d{6}|99[1-59]\\d{4}(?:\\d{3})?|9(?:00|39|44)[1-8]\\d{3,6}",[7,8,9,10]],["75[1-8]\\d{6}",[9]],["(?:25[245]|67[3-68])\\d{9}",[12]],["10[1-8]\\d{6}",[9]],["74[02-9]\\d{6}",[9]],0,["77[0-7]\\d{6}",[9]]]],SG:["65","0[0-3]\\d","(?:(?:1\\d|8)\\d\\d|7000)\\d{7}|[3689]\\d{7}",[8,10,11],[["(\\d{4})(\\d{4})","$1 $2",["[369]|8(?:0[1-9]|[1-9])"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["8"]],["(\\d{4})(\\d{4})(\\d{3})","$1 $2 $3",["7"]],["(\\d{4})(\\d{3})(\\d{4})","$1 $2 $3",["1"]]],0,0,0,0,0,0,[["662[0-24-9]\\d{4}|6(?:[0-578]\\d|6[013-57-9]|9[0-35-9])\\d{5}",[8]],["80[1-9]\\d{5}|(?:8[1-9]|9[0-8])\\d{6}",[8]],["(?:18|8)00\\d{7}",[10,11]],["1900\\d{7}",[11]],0,0,["7000\\d{7}",[11]],0,["(?:3[12]\\d|666)\\d{5}",[8]]]],SH:["290","00","(?:[256]\\d|8)\\d{3}",[4,5],0,0,0,0,0,0,"[256]",[["2(?:[0-57-9]\\d|6[4-9])\\d\\d"],["[56]\\d{4}",[5]],0,0,0,0,0,0,["262\\d\\d",[5]]]],SI:["386","00|10(?:22|66|88|99)","[1-7]\\d{7}|8\\d{4,7}|90\\d{4,6}",[5,6,7,8],[["(\\d{2})(\\d{3,6})","$1 $2",["8[09]|9"],"0$1"],["(\\d{3})(\\d{5})","$1 $2",["59|8"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[37][01]|4[013]|51|6"],"0$1"],["(\\d)(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[1-57]"],"(0$1)"]],"0",0,0,0,0,0,[["(?:[1-357][2-8]|4[24-8])\\d{6}",[8]],["65(?:[178]\\d|5[56]|6[01])\\d{4}|(?:[37][01]|4[013]|51|6[489])\\d{6}",[8]],["80\\d{4,6}",[6,7,8]],["89[1-3]\\d{2,5}|90\\d{4,6}"],0,0,0,0,["(?:59\\d\\d|8(?:1(?:[67]\\d|8[0-589])|2(?:0\\d|2[0-37-9]|8[0-2489])|3[389]\\d))\\d{4}",[8]]],"00"],SJ:["47","00","0\\d{4}|(?:[489]\\d|79)\\d{6}",[5,8],0,0,0,0,0,0,"79",[["79\\d{6}",[8]],["45(?:[0-24-9]\\d|3[0-57-9])\\d{4}|(?:4[016-8]|9\\d)\\d{6}",[8]],["80[01]\\d{5}",[8]],["82[09]\\d{5}",[8]],["880\\d{5}",[8]],["81[23]\\d{5}",[8]],["(?:0[235-9]|81(?:0(?:0[7-9]|1\\d)|5\\d\\d))\\d{3}"],0,["85[0-5]\\d{5}",[8]],["810(?:0[0-6]|[2-8]\\d)\\d{3}",[8]]]],SK:["421","00","[2-689]\\d{8}|[2-59]\\d{6}|[2-5]\\d{5}",[6,7,9],[["(\\d)(\\d{2})(\\d{3,4})","$1 $2 $3",["21"],"0$1"],["(\\d{2})(\\d{2})(\\d{2,3})","$1 $2 $3",["[3-5][1-8]1","[3-5][1-8]1[67]"],"0$1"],["(\\d)(\\d{3})(\\d{3})(\\d{2})","$1 $2 $3 $4",["2"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[689]"],"0$1"],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[3-5]"],"0$1"]],"0",0,0,0,0,0,[["(?:2(?:16|[2-9]\\d{3})|(?:(?:[3-5][1-8]\\d|819)\\d|601[1-5])\\d)\\d{4}|(?:2|[3-5][1-8])1[67]\\d{3}|[3-5][1-8]16\\d\\d"],["909[1-9]\\d{5}|9(?:0[1-8]|1[0-24-9]|4[03-57-9]|5\\d)\\d{6}",[9]],["800\\d{6}",[9]],["9(?:00|[78]\\d)\\d{6}",[9]],0,0,["96\\d{7}",[9]],["9090\\d{3}",[7]],["6(?:02|5[0-4]|9[0-6])\\d{6}",[9]],["8[5-9]\\d{7}",[9]]]],SL:["232","00","(?:[237-9]\\d|66)\\d{6}",[8],[["(\\d{2})(\\d{6})","$1 $2",["[236-9]"],"(0$1)"]],"0",0,0,0,0,0,[["22[2-4][2-9]\\d{4}"],["(?:25|3[0-5]|66|7\\d|8[08]|9[09])\\d{6}"]]],SM:["378","00","(?:0549|[5-7]\\d)\\d{6}",[8,10],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[5-7]"]],["(\\d{4})(\\d{6})","$1 $2",["0"]]],0,0,"([89]\\d{5})$","0549$1",0,0,[["0549(?:8[0157-9]|9\\d)\\d{4}",[10]],["6[16]\\d{6}",[8]],0,["7[178]\\d{6}",[8]],0,0,0,0,["5[158]\\d{6}",[8]]]],SN:["221","00","(?:[378]\\d|93)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"]],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[379]"]]],0,0,0,0,0,0,[["3(?:[026]\\d|3[89])\\d{6}"],["7(?:[015-8]\\d|21|90)\\d{6}"],["800\\d{6}"],["88[4689]\\d{6}"],0,0,0,0,["(?:39|93)\\d{7}"],["81[02468]\\d{6}"]]],SO:["252","00","[346-9]\\d{8}|[12679]\\d{7}|[1-5]\\d{6}|[1348]\\d{5}",[6,7,8,9],[["(\\d{2})(\\d{4})","$1 $2",["8[125]"]],["(\\d{6})","$1",["[134]"]],["(\\d)(\\d{6})","$1 $2",["[15]|2[0-79]|3[0-46-8]|4[0-7]"]],["(\\d{2})(\\d{5,7})","$1 $2",["1|28|9[2-9]"]],["(\\d)(\\d{7})","$1 $2",["[267]|904"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[346-9]"]]],"0",0,0,0,0,0,[["(?:1\\d|2[0-79]|3[0-46-8]|4[0-7]|5[57-9])\\d{5}|(?:[134]\\d|8[125])\\d{4}",[6,7]],["(?:(?:15|(?:3[59]|4[89]|6\\d|7[0-35-9]|8[08])\\d|9(?:0\\d|[2-9]))\\d|2(?:4\\d|8))\\d{5}|(?:[67]\\d\\d|904)\\d{5}",[7,8,9]]]],SR:["597","00","(?:[2-5]|[6-9]\\d)\\d{5}",[6,7],[["(\\d{2})(\\d{2})(\\d{2})","$1-$2-$3",["56"]],["(\\d{3})(\\d{3})","$1-$2",["[2-5]"]],["(\\d{3})(\\d{4})","$1-$2",["[6-9]"]]],0,0,0,0,0,0,[["(?:2[1-3]|3[0-7]|4\\d|5[2-578])\\d{4}",[6]],["(?:6[08]|7[1-7]|8[1-9])\\d{5}",[7]],["80\\d{5}",[7]],["90\\d{5}",[7]],0,0,0,0,["(?:56|91\\d)\\d{4}"]]],SS:["211","00","[19]\\d{8}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[19]"],"0$1"]],"0",0,0,0,0,0,[["1[89]\\d{7}"],["(?:12|9[1257-9])\\d{7}"]]],ST:["239","00","(?:22|9\\d)\\d{5}",[7],[["(\\d{3})(\\d{4})","$1 $2",["[29]"]]],0,0,0,0,0,0,[["22\\d{5}"],["900[5-9]\\d{3}|9(?:0[1-9]|[89]\\d)\\d{4}"]]],SV:["503","00","[25-7]\\d{7}|(?:80\\d|900)\\d{4}(?:\\d{4})?",[7,8,11],[["(\\d{3})(\\d{4})","$1 $2",["[89]"]],["(\\d{4})(\\d{4})","$1 $2",["[25-7]"]],["(\\d{3})(\\d{4})(\\d{4})","$1 $2 $3",["[89]"]]],0,0,0,0,0,0,[["2(?:79(?:0[0347-9]|[1-9]\\d)|89(?:0[024589]|[1-9]\\d))\\d{3}|2(?:[1-69]\\d|[78][0-8])\\d{5}",[8]],["[5-7]\\d{7}",[8]],["800\\d{8}|80[01]\\d{4}",[7,11]],["900\\d{4}(?:\\d{4})?",[7,11]]]],SX:["1","011","7215\\d{6}|(?:[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"(5\\d{6})$|1","721$1",0,"721",[["7215(?:4[2-8]|8[39]|9[056])\\d{4}"],["7215(?:1[02]|2\\d|5[034679]|8[0-24-8])\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],SY:["963","00","[1-359]\\d{8}|[1-5]\\d{7}",[8,9],[["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[1-4]|5[1-3]"],"0$1",1],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[59]"],"0$1",1]],"0",0,0,0,0,0,[["(?:1(?:[1478]\\d|[2356])|21\\d|3(?:[13]\\d|4)|4[134]|5[1-3])\\d{6}|2[1-5]\\d{6}"],["(?:50|9[03-689])\\d{7}",[9]]]],SZ:["268","00","0800\\d{4}|(?:[237]\\d|900)\\d{6}",[8,9],[["(\\d{4})(\\d{4})","$1 $2",["[0237]"]],["(\\d{5})(\\d{4})","$1 $2",["9"]]],0,0,0,0,0,0,[["[23][2-5]\\d{6}",[8]],["7[5-9]\\d{6}",[8]],["0800\\d{4}",[8]],["900\\d{6}",[9]],0,0,0,0,["70\\d{6}",[8]]]],TA:["290","00","8\\d{3}",[4],0,0,0,0,0,0,"8",[["8\\d{3}"]]],TC:["1","011","(?:[58]\\d\\d|649|900)\\d{7}",[10],0,"1",0,"([2-479]\\d{6})$|1","649$1",0,"649",[["649(?:266|712|9(?:4\\d|50))\\d{4}"],["649(?:2(?:3[129]|4[1-79])|3\\d\\d|4[34][1-3])\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,0,0,["649(?:71[01]|966)\\d{4}"]]],TD:["235","00|16","(?:22|[3689]\\d|77)\\d{6}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[236-9]"]]],0,0,0,0,0,0,[["22(?:[37-9]0|5[0-5]|6[89])\\d{4}"],["(?:3[01]|[69]\\d|77|8[5-7])\\d{6}"]],"00"],TG:["228","00","[279]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[279]"]]],0,0,0,0,0,0,[["2(?:2[2-7]|3[23]|4[45]|55|6[67]|77)\\d{5}"],["(?:7[0-389]|9[0-36-9])\\d{6}"]]],TH:["66","00[1-9]","(?:001800|[2-57]|[689]\\d)\\d{7}|1\\d{7,9}",[8,9,10,13],[["(\\d)(\\d{3})(\\d{4})","$1 $2 $3",["2"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[13-9]"],"0$1"],["(\\d{4})(\\d{3})(\\d{3})","$1 $2 $3",["1"]]],"0",0,0,0,0,0,[["(?:1[0689]|2\\d|3[2-9]|4[2-5]|5[2-6]|7[3-7])\\d{6}",[8]],["(?:(?:14|[89]\\d)\\d\\d|6(?:[1-6]\\d\\d|7(?:1[0-8]|2[4-7]|3[1-6])))\\d{5}",[9]],["(?:001800\\d|1800)\\d{6}",[10,13]],["1900\\d{6}",[10]],0,0,0,0,["6[08]\\d{7}",[9]]]],TJ:["992","810","(?:[0-57-9]\\d|66)\\d{7}",[9],[["(\\d{6})(\\d)(\\d{2})","$1 $2 $3",["331","3317"]],["(\\d{3})(\\d{2})(\\d{4})","$1 $2 $3",["44[02-479]|[34]7"]],["(\\d{4})(\\d)(\\d{4})","$1 $2 $3",["3(?:[1245]|3[12])"]],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["\\d"]]],0,0,0,0,0,0,[["(?:3(?:1[3-5]|2[245]|3[12]|4[24-7]|5[25]|72)|4(?:46|74|87))\\d{6}"],["(?:33[03-9]|4(?:1[18]|4[02-479])|81[1-9])\\d{6}|(?:[09]\\d|1[0-27-9]|2[0-27]|3[08]|40|5[05]|66|7[0157-9]|8[07-9])\\d{7}"]],"8~10"],TK:["690","00","[2-47]\\d{3,6}",[4,5,6,7],0,0,0,0,0,0,0,[["(?:2[2-4]|[34]\\d)\\d{2,5}"],["7[2-4]\\d{2,5}"]]],TL:["670","00","7\\d{7}|(?:[2-47]\\d|[89]0)\\d{5}",[7,8],[["(\\d{3})(\\d{4})","$1 $2",["[2-489]|70"]],["(\\d{4})(\\d{4})","$1 $2",["7"]]],0,0,0,0,0,0,[["(?:2[1-5]|3[1-9]|4[1-4])\\d{5}",[7]],["7[2-8]\\d{6}",[8]],["80\\d{5}",[7]],["90\\d{5}",[7]],["70\\d{5}",[7]]]],TM:["993","810","[1-7]\\d{7}",[8],[["(\\d{2})(\\d{2})(\\d{2})(\\d{2})","$1 $2-$3-$4",["12"],"(8 $1)"],["(\\d{3})(\\d)(\\d{2})(\\d{2})","$1 $2-$3-$4",["[1-5]"],"(8 $1)"],["(\\d{2})(\\d{6})","$1 $2",["[67]"],"8 $1"]],"8",0,0,0,0,0,[["(?:1(?:2\\d|3[1-9])|2(?:22|4[0-35-8])|3(?:22|4[03-9])|4(?:22|3[128]|4\\d|6[15])|5(?:22|5[7-9]|6[014-689]))\\d{5}"],["(?:6\\d|7[12])\\d{6}"]],"8~10"],TN:["216","00","[2-57-9]\\d{7}",[8],[["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[2-57-9]"]]],0,0,0,0,0,0,[["81200\\d{3}|(?:3[0-2]|7\\d)\\d{6}"],["3(?:001|[12]40)\\d{4}|(?:(?:[259]\\d|4[0-8])\\d|3(?:1[1-35]|6[0-4]|91))\\d{5}"],["8010\\d{4}"],["88\\d{6}"],0,0,0,0,0,["8[12]10\\d{4}"]]],TO:["676","00","(?:0800|(?:[5-8]\\d\\d|999)\\d)\\d{3}|[2-8]\\d{4}",[5,7],[["(\\d{2})(\\d{3})","$1-$2",["[2-4]|50|6[09]|7[0-24-69]|8[05]"]],["(\\d{4})(\\d{3})","$1 $2",["0"]],["(\\d{3})(\\d{4})","$1 $2",["[5-9]"]]],0,0,0,0,0,0,[["(?:2\\d|3[0-8]|4[0-4]|50|6[09]|7[0-24-69]|8[05])\\d{3}",[5]],["(?:5(?:4[0-5]|5[4-6])|6(?:[09]\\d|3[02]|8[15-9])|(?:7\\d|8[46-9])\\d|999)\\d{4}",[7]],["0800\\d{3}",[7]],0,0,0,0,0,["55[0-37-9]\\d{4}",[7]]]],TR:["90","00","4\\d{6}|8\\d{11,12}|(?:[2-58]\\d\\d|900)\\d{7}",[7,10,12,13],[["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["512|8[01589]|90"],"0$1",1],["(\\d{3})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["5"],"0$1",1],["(\\d{3})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[24][1-8]|3[1-9]"],"(0$1)",1],["(\\d{3})(\\d{3})(\\d{6,7})","$1 $2 $3",["80"],"0$1",1]],"0",0,0,0,0,0,[["(?:2(?:1[26]|[28][2468]|[3-5][268]|[67][246])|3(?:[13][28]|[24-6][2468]|[78][02468]|92)|4(?:[16][246]|[23578][2468]|4[26]))\\d{7}",[10]],["5(?:61(?:011|61\\d)|82[2-5]\\d\\d)\\d{4}|5(?:[03-5]\\d|1[06]|24|6[24]|7[245]|9[46])\\d{7}",[10]],["8(?:00\\d{7}(?:\\d{2,3})?|11\\d{7})",[10,12,13]],["(?:8[89]8|900)\\d{7}",[10]],["592(?:21[12]|461)\\d{4}",[10]],0,["444\\d{4}",[7]],["512\\d{7}",[10]],["850\\d{7}",[10]]]],TT:["1","011","(?:[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-46-8]\\d{6})$|1","868$1",0,"868",[["868(?:2(?:01|1[5-9]|[23]\\d|4[0-2])|6(?:0[7-9]|1[02-8]|2[1-9]|[3-69]\\d|7[0-79])|82[124])\\d{4}"],["868(?:(?:2[5-9]|3\\d)\\d|4(?:3[0-6]|[6-9]\\d)|6(?:20|78|8\\d)|7(?:0[1-9]|1[02-9]|[2-9]\\d))\\d{4}"],["868800\\d{4}|8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],["868619\\d{4}"]]],TV:["688","00","(?:2|7\\d\\d|90)\\d{4}",[5,6,7],[["(\\d{2})(\\d{3})","$1 $2",["2"]],["(\\d{2})(\\d{4})","$1 $2",["90"]],["(\\d{2})(\\d{5})","$1 $2",["7"]]],0,0,0,0,0,0,[["2[02-9]\\d{3}",[5]],["(?:7[01]\\d|90)\\d{4}",[6,7]]]],TW:["886","0(?:0[25-79]|19)","[2-689]\\d{8}|7\\d{9,10}|[2-8]\\d{7}|2\\d{6}",[7,8,9,10,11],[["(\\d{2})(\\d)(\\d{4})","$1 $2 $3",["202"],"0$1"],["(\\d{3})(\\d{5})","$1 $2",["826"],"0$1"],["(\\d{3})(\\d{2})(\\d{3})","$1 $2 $3",["83"],"0$1"],["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["82"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["[25]0|37|49|8[09]"],"0$1"],["(\\d)(\\d{3,4})(\\d{4})","$1 $2 $3",["[23568]|4(?:0[02-48]|[1-478])|7[1-9]","[23568]|4(?:0[2-48]|[1-478])|(?:400|7)[1-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[49]"],"0$1"],["(\\d{2})(\\d{4})(\\d{4,5})","$1 $2 $3",["7"],"0$1"]],"0",0,0,0,0,0,[["(?:2[2-8]\\d|370|55[01]|7[1-9])\\d{6}|4(?:(?:0(?:0[1-9]|[2-48]\\d)|1[023]\\d)\\d{4,5}|(?:[239]\\d\\d|4(?:0[56]|12|49))\\d{5})|6(?:[01]\\d{7}|4(?:0[56]|12|24|4[09])\\d{4,5})|8(?:(?:2(?:3\\d|4[0-269]|[578]0|66)|36[24-9]|90\\d\\d)\\d{4}|4(?:0[56]|12|24|4[09])\\d{4,5})|(?:2(?:2(?:0\\d\\d|4(?:0[68]|[249]0|3[0-467]|5[0-25-9]|6[0235689]))|(?:3(?:[09]\\d|1[0-4])|(?:4\\d|5[0-49]|6[0-29]|7[0-5])\\d)\\d)|(?:(?:3[2-9]|5[2-8]|6[0-35-79]|8[7-9])\\d\\d|4(?:2(?:[089]\\d|7[1-9])|(?:3[0-4]|[78]\\d|9[01])\\d))\\d)\\d{3}",[8,9]],["(?:40001[0-2]|9[0-8]\\d{4})\\d{3}",[9]],["80[0-79]\\d{6}|800\\d{5}",[8,9]],["20(?:[013-9]\\d\\d|2)\\d{4}",[7,9]],["99\\d{7}",[9]],0,["50[0-46-9]\\d{6}",[9]],0,["7010(?:[0-2679]\\d|3[0-7]|8[0-5])\\d{5}|70\\d{8}",[10,11]]],0,"#"],TZ:["255","00[056]","(?:[25-8]\\d|41|90)\\d{7}",[9],[["(\\d{3})(\\d{2})(\\d{4})","$1 $2 $3",["[89]"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[24]"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["5"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[67]"],"0$1"]],"0",0,0,0,0,0,[["2[2-8]\\d{7}"],["(?:6[0-35-9]|7\\d)\\d{7}"],["80[08]\\d{6}"],["90\\d{7}"],0,0,0,0,["41\\d{7}"],["8(?:40|6[01])\\d{6}"]]],UA:["380","00","[89]\\d{9}|[3-9]\\d{8}",[9,10],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["6[12][29]|(?:3[1-8]|4[136-8]|5[12457]|6[49])2|(?:56|65)[24]","6[12][29]|(?:35|4[1378]|5[12457]|6[49])2|(?:56|65)[24]|(?:3[1-46-8]|46)2[013-9]"],"0$1"],["(\\d{4})(\\d{5})","$1 $2",["3[1-8]|4(?:[1367]|[45][6-9]|8[4-6])|5(?:[1-5]|6[0135689]|7[4-6])|6(?:[12][3-7]|[459])","3[1-8]|4(?:[1367]|[45][6-9]|8[4-6])|5(?:[1-5]|6(?:[015689]|3[02389])|7[4-6])|6(?:[12][3-7]|[459])"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[3-7]|89|9[1-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["[89]"],"0$1"]],"0",0,0,0,0,0,[["(?:3[1-8]|4[13-8]|5[1-7]|6[12459])\\d{7}",[9]],["790\\d{6}|(?:39|50|6[36-8]|7[1-357]|9[1-9])\\d{7}",[9]],["800[1-8]\\d{5,6}"],["900[239]\\d{5,6}"],0,0,0,0,["89[1-579]\\d{6}",[9]]],"0~0"],UG:["256","00[057]","800\\d{6}|(?:[29]0|[347]\\d)\\d{7}",[9],[["(\\d{4})(\\d{5})","$1 $2",["202","2024","20240"],"0$1"],["(\\d{3})(\\d{6})","$1 $2",["20[0-35-7]|4(?:6[45]|[7-9])|[7-9]","20(?:[0135-7]|2[5-9])|4(?:6[45]|[7-9])|[7-9]"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["[2-4]"],"0$1"]],"0",0,0,0,0,0,[["20(?:(?:24[09]|30[67])\\d|6(?:00[0-2]|30[0-4]))\\d{3}|(?:20(?:[017]\\d|2[5-9]|3[1-4]|5[0-4]|6[15-9])|[34]\\d{3})\\d{5}"],["7(?:28|34)0\\d{5}|7(?:[014-8]\\d|2[01467]|3[0167]|9[0-589])\\d{6}"],["800[1-3]\\d{5}"],["90[1-3]\\d{6}"]]],US:["1","011","[2-9]\\d{9}|3\\d{6}",[10],[["(\\d{3})(\\d{4})","$1-$2",["310"],0,1],["(\\d{3})(\\d{3})(\\d{4})","($1) $2-$3",["[2-9]"],0,1,"$1-$2-$3"]],"1",0,0,0,0,0,[["(?:472[2-47-9]|983[2-57-9])\\d{6}|(?:2(?:0[1-35-9]|1[02-9]|2[03-57-9]|3[1459]|4[08]|5[1-46]|6[0279]|7[02469]|8[13])|3(?:0[1-57-9]|1[02-9]|2[013-79]|3[0-24679]|4[167]|5[0-3]|6[01349]|8[056])|4(?:0[124-9]|1[02-579]|2[3-5]|3[0245]|4[023578]|58|6[349]|7[0589]|8[04])|5(?:0[1-57-9]|1[0235-8]|20|3[0149]|4[01]|5[179]|6[1-47]|7[0-5]|8[0256])|6(?:0[1-35-9]|1[024-9]|2[03689]|3[016]|4[0156]|5[01679]|6[0-279]|78|8[0-269])|7(?:0[1-46-8]|1[2-9]|2[04-8]|3[0-2478]|4[0378]|5[47]|6[02359]|7[0-59]|8[156])|8(?:0[1-68]|1[02-8]|2[0168]|3[0-2589]|4[03578]|5[046-9]|6[02-5]|7[028])|9(?:0[1346-9]|1[02-9]|2[0589]|3[0146-8]|4[01357-9]|5[12469]|7[0-3589]|8[04-69]))[2-9]\\d{6}"],[""],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],UY:["598","0(?:0|1[3-9]\\d)","0004\\d{2,9}|[1249]\\d{7}|2\\d{3,4}|(?:[49]\\d|80)\\d{5}",[4,5,6,7,8,9,10,11,12,13],[["(\\d{4,5})","$1",["21"]],["(\\d{3})(\\d{3,4})","$1 $2",["0"]],["(\\d{3})(\\d{4})","$1 $2",["[49]0|8"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["9"],"0$1"],["(\\d{4})(\\d{4})","$1 $2",["[124]"]],["(\\d{3})(\\d{3})(\\d{2,4})","$1 $2 $3",["0"]],["(\\d{3})(\\d{3})(\\d{3})(\\d{2,4})","$1 $2 $3 $4",["0"]]],"0",0,0,0,0,0,[["(?:1(?:770|9(?:20|[89]7))|(?:2\\d|4[2-7])\\d\\d)\\d{4}",[8]],["9[1-9]\\d{6}",[8]],["0004\\d{2,9}|(?:405|80[05])\\d{4}",[6,7,8,9,10,11,12,13]],["90[0-8]\\d{4}",[7]],0,0,["21\\d{2,3}",[4,5]]],"00"," int. "],UZ:["998","00","(?:20|33|[5-9]\\d)\\d{7}",[9],[["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["[235-9]"]]],0,0,0,0,0,0,[["(?:55\\d\\d|6(?:1(?:22|3[124]|4[1-4]|5[1-3578]|64)|2(?:22|3[0-57-9]|41)|5(?:22|3[3-7]|5[024-8])|[69]\\d\\d|7(?:[23]\\d|7[69]))|7(?:[168]\\d\\d|2(?:22|3[13-57-9]|4[1-3579]|5[14])|3(?:2\\d|3[1578]|4[1-35-7]|5[1-57]|61)|4(?:2\\d|3[1-579]|7[1-79])|5(?:22|5[1-9]|6[1457])|9(?:22|5[1-9])))\\d{5}"],["(?:(?:[25]0|33|8[078]|9[0-57-9])\\d{3}|6(?:1(?:2(?:2[01]|98)|35[0-4]|50\\d|61[23]|7(?:[01][017]|4\\d|55|9[5-9]))|2(?:(?:11|7\\d)\\d|2(?:[12]1|9[01379])|5(?:[126]\\d|3[0-4]))|5(?:19[01]|2(?:27|9[26])|(?:30|59|7\\d)\\d)|6(?:2(?:1[5-9]|2[0367]|38|41|52|60)|(?:3[79]|9[0-3])\\d|4(?:56|83)|7(?:[07]\\d|1[017]|3[07]|4[047]|5[057]|67|8[0178]|9[79]))|7(?:2(?:24|3[237]|4[5-9]|7[15-8])|5(?:7[12]|8[0589])|7(?:0\\d|[39][07])|9(?:0\\d|7[079])))|7(?:[07]\\d{3}|2(?:2(?:2[79]|95)|3(?:2[5-9]|6[0-6])|57\\d|7(?:0\\d|1[17]|2[27]|3[37]|44|5[057]|66|88))|3(?:2(?:1[0-6]|21|3[469]|7[159])|(?:33|9[4-6])\\d|5(?:0[0-4]|5[579]|9\\d)|7(?:[0-3579]\\d|4[0467]|6[67]|8[078]))|4(?:2(?:29|5[0257]|6[0-7]|7[1-57])|5(?:1[0-4]|8\\d|9[5-9])|7(?:0\\d|1[024589]|2[0-27]|3[0137]|[46][07]|5[01]|7[5-9]|9[079])|9(?:7[015-9]|[89]\\d))|5(?:112|2(?:0\\d|2[29]|[49]4)|3[1568]\\d|52[6-9]|7(?:0[01578]|1[017]|[23]7|4[047]|[5-7]\\d|8[78]|9[079]))|9(?:22[128]|3(?:2[0-4]|7\\d)|57[02569]|7(?:2[05-9]|3[37]|4\\d|60|7[2579]|87|9[07]))))\\d{4}"]]],VA:["39","00","0\\d{5,10}|3[0-8]\\d{7,10}|55\\d{8}|8\\d{5}(?:\\d{2,4})?|(?:1\\d|39)\\d{7,8}",[6,7,8,9,10,11,12],0,0,0,0,0,0,"06698",[["06698\\d{1,6}",[6,7,8,9,10,11]],["3[1-9]\\d{8}|3[2-9]\\d{7}",[9,10]],["80(?:0\\d{3}|3)\\d{3}",[6,9]],["(?:0878\\d{3}|89(?:2\\d|3[04]|4(?:[0-4]|[5-9]\\d\\d)|5[0-4]))\\d\\d|(?:1(?:44|6[346])|89(?:38|5[5-9]|9))\\d{6}",[6,8,9,10]],["1(?:78\\d|99)\\d{6}",[9,10]],["3[2-8]\\d{9,10}",[11,12]],0,0,["55\\d{8}",[10]],["84(?:[08]\\d{3}|[17])\\d{3}",[6,9]]]],VC:["1","011","(?:[58]\\d\\d|784|900)\\d{7}",[10],0,"1",0,"([2-7]\\d{6})$|1","784$1",0,"784",[["784(?:266|3(?:6[6-9]|7\\d|8[0-6])|4(?:38|5[0-36-8]|8[0-8])|5(?:55|7[0-2]|93)|638|784)\\d{4}"],["784(?:4(?:3[0-5]|5[45]|89|9[0-8])|5(?:2[6-9]|3[0-4])|720)\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"],0,0,0,["78451[0-2]\\d{4}"]]],VE:["58","00","[68]00\\d{7}|(?:[24]\\d|[59]0)\\d{8}",[10],[["(\\d{3})(\\d{7})","$1-$2",["[24-689]"],"0$1"]],"0",0,0,0,0,0,[["(?:2(?:12|3[457-9]|[467]\\d|[58][1-9]|9[1-6])|[4-6]00)\\d{7}"],["4(?:1[24-8]|2[246])\\d{7}"],["800\\d{7}"],["90[01]\\d{7}"],0,0,["501\\d{7}"]]],VG:["1","011","(?:284|[58]\\d\\d|900)\\d{7}",[10],0,"1",0,"([2-578]\\d{6})$|1","284$1",0,"284",[["284(?:229|4(?:22|9[45])|774|8(?:52|6[459]))\\d{4}"],["284(?:245|3(?:0[0-3]|4[0-7]|68|9[34])|4(?:4[0-6]|68|9[69])|5(?:4[0-7]|68|9[69]))\\d{4}"],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],VI:["1","011","[58]\\d{9}|(?:34|90)0\\d{7}",[10],0,"1",0,"([2-9]\\d{6})$|1","340$1",0,"340",[["340(?:2(?:0\\d|10|2[06-8]|4[49]|77)|3(?:32|44)|4(?:2[23]|44|7[34]|89)|5(?:1[34]|55)|6(?:2[56]|4[23]|77|9[023])|7(?:1[2-57-9]|2[57]|7\\d)|884|998)\\d{4}"],[""],["8(?:00|33|44|55|66|77|88)[2-9]\\d{6}"],["900[2-9]\\d{6}"],["52(?:3(?:[2-46-9][02-9]\\d|5(?:[02-46-9]\\d|5[0-46-9]))|4(?:[2-478][02-9]\\d|5(?:[034]\\d|2[024-9]|5[0-46-9])|6(?:0[1-9]|[2-9]\\d)|9(?:[05-9]\\d|2[0-5]|49)))\\d{4}|52[34][2-9]1[02-9]\\d{4}|5(?:00|2[125-9]|3[23]|44|66|77|88)[2-9]\\d{6}"]]],VN:["84","00","[12]\\d{9}|[135-9]\\d{8}|[16]\\d{6,7}|7\\d{6}",[7,8,9,10],[["(\\d{4})(\\d{4,6})","$1 $2",["1(?:2[02]|[89])"],0,1],["(\\d{2})(\\d{3})(\\d{2})(\\d{2})","$1 $2 $3 $4",["1[26]|6"],"0$1",1],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[357-9]"],"0$1",1],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["2[48]"],"0$1",1],["(\\d{3})(\\d{4})(\\d{3})","$1 $2 $3",["2"],"0$1",1]],"0",0,0,0,0,0,[["2(?:0[3-9]|1[0-689]|2[0-25-9]|[38][2-9]|4[2-8]|5[124-9]|6[0-39]|7[0-7]|9[0-4679])\\d{7}",[10]],["121[0-3]\\d{5}|(?:160|(?:3\\d|7[06-9])\\d|5(?:[1689]\\d|2[238]|59)|8(?:[1-8]\\d|9[6-9])|9(?:[0-8]\\d|9[013-9]))\\d{6}",[9]],["1800\\d{4,6}|12(?:0[13]|28)\\d{4}",[8,9,10]],["1900\\d{4,6}",[8,9,10]],0,0,["[17]99\\d{4}|69\\d{5,6}",[7,8]],0,["672\\d{6}",[9]]]],VU:["678","00","[57-9]\\d{6}|(?:[238]\\d|48)\\d{3}",[5,7],[["(\\d{3})(\\d{4})","$1 $2",["[57-9]"]]],0,0,0,0,0,0,[["(?:38[0-8]|48[4-9])\\d\\d|(?:2[02-9]|3[4-7]|88)\\d{3}",[5]],["(?:[58]\\d|7[0-7])\\d{5}",[7]],["81[18]\\d\\d",[5]],0,0,0,["(?:3[03]|900\\d)\\d{3}"],0,["9(?:0[1-9]|1[01])\\d{4}",[7]]]],WF:["681","00","(?:40|72|8\\d{4})\\d{4}|[89]\\d{5}",[6,9],[["(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3",["[47-9]"]],["(\\d{3})(\\d{2})(\\d{2})(\\d{2})","$1 $2 $3 $4",["8"]]],0,0,0,0,0,0,[["72\\d{4}",[6]],["(?:72|8[23])\\d{4}",[6]],["80[0-5]\\d{6}",[9]],0,0,["[48]0\\d{4}",[6]],0,0,["9[23]\\d{4}",[6]]]],WS:["685","0","(?:[2-6]|8\\d{5})\\d{4}|[78]\\d{6}|[68]\\d{5}",[5,6,7,10],[["(\\d{5})","$1",["[2-5]|6[1-9]"]],["(\\d{3})(\\d{3,7})","$1 $2",["[68]"]],["(\\d{2})(\\d{5})","$1 $2",["7"]]],0,0,0,0,0,0,[["6[1-9]\\d{3}|(?:[2-5]|60)\\d{4}",[5,6]],["(?:7[1-35-8]|8(?:[3-7]|9\\d{3}))\\d{5}",[7,10]],["800\\d{3}",[6]]]],XK:["383","00","2\\d{7,8}|3\\d{7,11}|(?:4\\d\\d|[89]00)\\d{5}",[8,9,10,11,12],[["(\\d{3})(\\d{5})","$1 $2",["[89]"],"0$1"],["(\\d{2})(\\d{3})(\\d{3})","$1 $2 $3",["[2-4]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["2|39"],"0$1"],["(\\d{2})(\\d{7,10})","$1 $2",["3"],"0$1"]],"0",0,0,0,0,0,[["38\\d{6,10}|(?:2[89]|39)(?:0\\d{5,6}|[1-9]\\d{5})"],["4[3-9]\\d{6}",[8]],["800\\d{5}",[8]],["900\\d{5}",[8]]]],YE:["967","00","(?:1|7\\d)\\d{7}|[1-7]\\d{6}",[7,8,9],[["(\\d)(\\d{3})(\\d{3,4})","$1 $2 $3",["[1-6]|7(?:[24-6]|8[0-7])"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["7"],"0$1"]],"0",0,0,0,0,0,[["78[0-7]\\d{4}|17\\d{6}|(?:[12][2-68]|3[2358]|4[2-58]|5[2-6]|6[3-58]|7[24-6])\\d{5}",[7,8]],["7[01378]\\d{7}",[9]]]],YT:["262","00","(?:639\\d|7093)\\d{5}|(?:26|80|9\\d)\\d{7}",[9],0,"0",0,0,0,0,0,[["26(?:89\\d|9(?:0[0-467]|15|5[0-4]|6\\d|[78]0))\\d{4}"],["(?:639(?:0[0-79]|1[019]|[267]\\d|3[09]|40|5[05-9]|9[04-79])|7093[5-7])\\d{4}"],["80\\d{7}"],0,0,0,0,0,["9(?:(?:39|47)8[01]|769\\d)\\d{4}"]]],ZA:["27","00","[1-79]\\d{8}|8\\d{4,9}",[5,6,7,8,9,10],[["(\\d{2})(\\d{3,4})","$1 $2",["8[1-4]"],"0$1"],["(\\d{2})(\\d{3})(\\d{2,3})","$1 $2 $3",["8[1-4]"],"0$1"],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["860"],"0$1"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["[1-9]"],"0$1"],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:2(?:0330|4302)|52087)0\\d{3}|(?:1[0-8]|2[1-378]|3[1-69]|4\\d|5[1346-8])\\d{7}",[9]],["(?:1(?:3492[0-25]|4495[0235]|549(?:20|5[01]))|4[34]492[01])\\d{3}|8[1-4]\\d{3,7}|(?:2[27]|47|54)4950\\d{3}|(?:1(?:049[2-4]|9[12]\\d\\d)|(?:50[0-2]|[67]\\d\\d)\\d\\d|8(?:5\\d{3}|7(?:08[67]|158|28[5-9]|310)))\\d{4}|(?:1[6-8]|28|3[2-69]|4[025689]|5[36-8])4920\\d{3}|(?:12|[2-5]1)492\\d{4}",[5,6,7,8,9]],["80\\d{7}",[9]],["(?:86[2-9]|9[0-2]\\d)\\d{6}",[9]],0,0,["861\\d{6,7}",[9,10]],0,["87(?:08[0-589]|15[0-79]|28[0-4]|31[1-9])\\d{4}|87(?:[02][0-79]|1[0-46-9]|3[02-9]|[4-9]\\d)\\d{5}",[9]],["860\\d{6}",[9]]]],ZM:["260","00","800\\d{6}|(?:21|[579]\\d|63)\\d{7}",[9],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[28]"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["[579]"],"0$1"]],"0",0,0,0,0,0,[["21[1-8]\\d{6}"],["(?:[59][5-8]|7[5-9])\\d{7}"],["800\\d{6}"],0,0,0,0,0,["63\\d{7}"]]],ZW:["263","00","(?:13|8\\d{4})\\d{5}|[235-8]\\d{8}|[2-689]\\d{6}",[7,9,10],[["(\\d{2})(\\d{3,5})","$1 $2",["1|2(?:0[0-36-9]|29|58)|67[0-46-9]|(?:55|68)[0-69]"],"0$1"],["(\\d{3})(\\d{3,5})","$1 $2",["2(?:0[45]|[27]|48)|37|675|(?:55|68)[78]"],"0$1"],["(\\d)(\\d{3})(\\d{2,4})","$1 $2 $3",["[49]"],"0$1"],["(\\d{3})(\\d{4})","$1 $2",["80"],"0$1"],["(\\d{4})(\\d{3,5})","$1 $2",["548"],"0$1"],["(\\d{2})(\\d{3})(\\d{3,4})","$1 $2 $3",["29[013-9]"],"0$1"],["(\\d{2})(\\d{7})","$1 $2",["[256]|39|8[13-59]"],"(0$1)"],["(\\d{2})(\\d{3})(\\d{4})","$1 $2 $3",["7"],"0$1"],["(\\d{3})(\\d{3})(\\d{3,4})","$1 $2 $3",["3"],"0$1"],["(\\d{4})(\\d{6})","$1 $2",["8"],"0$1"]],"0",0,0,0,0,0,[["(?:2(?:(?:(?:02[014]|72[03])\\d|48)\\d|2(?:[278]\\d|92)|583)|(?:37[56]|6[78]21\\d)\\d|5(?:483|525\\d\\d))\\d{3}|(?:2(?:0\\d|7[1-7])|(?:55|6[78])\\d)\\d{4}|(?:13|2(?:(?:42|9\\d)\\d|[56]20)|3(?:123|92\\d)|(?:4|542)\\d|6(?:[16]21|52[013])|8(?:[1349]28|523)|9[2-9])\\d{5}",[7,9]],["7(?:[1278]\\d|3[1-9]|9[01])\\d{6}",[9]],["80(?:[01]\\d|20|8[0-8])\\d{3}",[7]],0,0,0,0,0,["86(?:1[12]|22|30|44|55|77|8[368])\\d{6}",[10]]]]},nonGeographic:{800:["800",0,"(?:00|[1-9]\\d)\\d{6}",[8],[["(\\d{4})(\\d{4})","$1 $2",["\\d"]]],0,0,0,0,0,0,[0,0,["(?:00|[1-9]\\d)\\d{6}"]]],808:["808",0,"[1-9]\\d{7}",[8],[["(\\d{4})(\\d{4})","$1 $2",["[1-9]"]]],0,0,0,0,0,0,[0,0,0,0,0,0,0,0,0,["[1-9]\\d{7}"]]],870:["870",0,"7\\d{11}|[235-7]\\d{8}",[9,12],[["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["[235-7]"]]],0,0,0,0,0,0,[0,["(?:[356]|774[45])\\d{8}|7[6-8]\\d{7}"],0,0,0,0,0,0,["2\\d{8}",[9]]]],878:["878",0,"10\\d{10}",[12],[["(\\d{2})(\\d{5})(\\d{5})","$1 $2 $3",["1"]]],0,0,0,0,0,0,[0,0,0,0,0,0,0,0,["10\\d{10}"]]],881:["881",0,"6\\d{9}|[0-36-9]\\d{8}",[9,10],[["(\\d)(\\d{3})(\\d{5})","$1 $2 $3",["[0-37-9]"]],["(\\d)(\\d{3})(\\d{5,6})","$1 $2 $3",["6"]]],0,0,0,0,0,0,[0,["6\\d{9}|[0-36-9]\\d{8}"]]],882:["882",0,"[13]\\d{6}(?:\\d{2,5})?|[19]\\d{7}|(?:[25]\\d\\d|4)\\d{7}(?:\\d{2})?",[7,8,9,10,11,12],[["(\\d{2})(\\d{5})","$1 $2",["16|342"]],["(\\d{2})(\\d{6})","$1 $2",["49"]],["(\\d{2})(\\d{2})(\\d{4})","$1 $2 $3",["1[36]|9"]],["(\\d{2})(\\d{4})(\\d{3})","$1 $2 $3",["3[23]"]],["(\\d{2})(\\d{3,4})(\\d{4})","$1 $2 $3",["16"]],["(\\d{2})(\\d{4})(\\d{4})","$1 $2 $3",["10|23|3(?:[15]|4[57])|4|5[12]"]],["(\\d{3})(\\d{4})(\\d{4})","$1 $2 $3",["34"]],["(\\d{2})(\\d{4,5})(\\d{5})","$1 $2 $3",["[1-35]"]]],0,0,0,0,0,0,[0,["342\\d{4}|(?:337|49)\\d{6}|(?:3(?:2|47|7\\d{3})|5(?:0\\d{3}|2[0-2]))\\d{7}",[7,8,9,10,12]],0,0,0,["348[57]\\d{7}",[11]],0,0,["1(?:3(?:0[0347]|[13][0139]|2[035]|4[013568]|6[0459]|7[06]|8[15-8]|9[0689])\\d{4}|6\\d{5,10})|(?:345\\d|9[89])\\d{6}|(?:10|2(?:3|85\\d)|3(?:[15]|[69]\\d\\d)|4[15-8]|51)\\d{8}"]]],883:["883",0,"(?:[1-4]\\d|51)\\d{6,10}",[8,9,10,11,12],[["(\\d{3})(\\d{3})(\\d{2,8})","$1 $2 $3",["[14]|2[24-689]|3[02-689]|51[24-9]"]],["(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3",["510"]],["(\\d{3})(\\d{3})(\\d{4})","$1 $2 $3",["21"]],["(\\d{4})(\\d{4})(\\d{4})","$1 $2 $3",["51[13]"]],["(\\d{3})(\\d{3})(\\d{3})(\\d{3})","$1 $2 $3 $4",["[235]"]]],0,0,0,0,0,0,[0,0,0,0,0,0,0,0,["(?:2(?:00\\d\\d|10)|(?:370[1-9]|51\\d0)\\d)\\d{7}|51(?:00\\d{5}|[24-9]0\\d{4,7})|(?:1[0-79]|2[24-689]|3[02-689]|4[0-4])0\\d{5,9}"]]],888:["888",0,"\\d{11}",[11],[["(\\d{3})(\\d{3})(\\d{5})","$1 $2 $3"]],0,0,0,0,0,0,[0,0,0,0,0,0,["\\d{11}"]]],979:["979",0,"[1359]\\d{8}",[9],[["(\\d)(\\d{4})(\\d{4})","$1 $2 $3",["[1359]"]]],0,0,0,0,0,0,[0,0,0,["[1359]\\d{8}"]]]}};function e(d,e){var n=Array.prototype.slice.call(e);return n.push(t),d.apply(this,n)}function n(d,t){d=d.split("-"),t=t.split("-");for(var e=d[0].split("."),n=t[0].split("."),r=0;r<3;r++){var i=Number(e[r]),o=Number(n[r]);if(i>o)return 1;if(o>i)return-1;if(!isNaN(i)&&isNaN(o))return 1;if(isNaN(i)&&!isNaN(o))return-1}return d[1]&&t[1]?d[1]>t[1]?1:d[1]<t[1]?-1:0:!d[1]&&t[1]?1:d[1]&&!t[1]?-1:0}var r={}.constructor;function i(d){return null!=d&&d.constructor===r}var o=/^\d+$/;function a(d){return a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},a(d)}function u(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}function $(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,l(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function l(d){var t=function(d,t){if("object"!=a(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=a(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==a(t)?t:t+""}var c=" ext. ",s=function(){return $(function d(t){u(this,d),p(t),this.metadata=t,P.call(this,t)},[{key:"getCountries",value:function(){return Object.keys(this.metadata.countries).filter(function(d){return"001"!==d})}},{key:"getCountryMetadata",value:function(d){return this.metadata.countries[d]}},{key:"nonGeographic",value:function(){if(!(this.v1||this.v2||this.v3))return this.metadata.nonGeographic||this.metadata.nonGeographical}},{key:"hasCountry",value:function(d){return void 0!==this.getCountryMetadata(d)}},{key:"hasCallingCode",value:function(d){if(this.getCountryCodesForCallingCode(d))return!0;if(this.nonGeographic()){if(this.nonGeographic()[d])return!0}else{var t=this.countryCallingCodes()[d];if(t&&1===t.length&&"001"===t[0])return!0}}},{key:"isNonGeographicCallingCode",value:function(d){return this.nonGeographic()?!!this.nonGeographic()[d]:!this.getCountryCodesForCallingCode(d)}},{key:"country",value:function(d){return this.selectNumberingPlan(d)}},{key:"selectNumberingPlan",value:function(d,t){var e,n,r;if(d&&(r=d,o.test(r)?n=d:e=d),t&&(n=t),e&&"001"!==e){var i=this.getCountryMetadata(e);if(!i)throw new Error("Unknown country: ".concat(e));this.numberingPlan=new f(i,this)}else if(n){if(!this.hasCallingCode(n))throw new Error("Unknown calling code: ".concat(n));this.numberingPlan=new f(this.getNumberingPlanMetadata(n),this)}else this.numberingPlan=void 0;return this}},{key:"getCountryCodesForCallingCode",value:function(d){var t=this.countryCallingCodes()[d];if(t){if(1===t.length&&3===t[0].length)return;return t}}},{key:"getCountryCodeForCallingCode",value:function(d){var t=this.getCountryCodesForCallingCode(d);if(t)return t[0]}},{key:"getNumberingPlanMetadata",value:function(d){var t=this.getCountryCodeForCallingCode(d);if(t)return this.getCountryMetadata(t);if(this.nonGeographic()){var e=this.nonGeographic()[d];if(e)return e}else{var n=this.countryCallingCodes()[d];if(n&&1===n.length&&"001"===n[0])return this.metadata.countries["001"]}}},{key:"countryCallingCode",value:function(){return this.numberingPlan.callingCode()}},{key:"IDDPrefix",value:function(){return this.numberingPlan.IDDPrefix()}},{key:"defaultIDDPrefix",value:function(){return this.numberingPlan.defaultIDDPrefix()}},{key:"nationalNumberPattern",value:function(){return this.numberingPlan.nationalNumberPattern()}},{key:"possibleLengths",value:function(){return this.numberingPlan.possibleLengths()}},{key:"formats",value:function(){return this.numberingPlan.formats()}},{key:"nationalPrefixForParsing",value:function(){return this.numberingPlan.nationalPrefixForParsing()}},{key:"nationalPrefixTransformRule",value:function(){return this.numberingPlan.nationalPrefixTransformRule()}},{key:"leadingDigits",value:function(){return this.numberingPlan.leadingDigits()}},{key:"hasTypes",value:function(){return this.numberingPlan.hasTypes()}},{key:"type",value:function(d){return this.numberingPlan.type(d)}},{key:"ext",value:function(){return this.numberingPlan.ext()}},{key:"countryCallingCodes",value:function(){return this.v1?this.metadata.country_phone_code_to_countries:this.metadata.country_calling_codes}},{key:"chooseCountryByCountryCallingCode",value:function(d){return this.selectNumberingPlan(d)}},{key:"hasSelectedNumberingPlan",value:function(){return void 0!==this.numberingPlan}}])}(),f=function(){return $(function d(t,e){u(this,d),this.globalMetadataObject=e,this.metadata=t,P.call(this,e.metadata)},[{key:"callingCode",value:function(){return this.metadata[0]}},{key:"_getDefaultCountryMetadataForThisCallingCode",value:function(){return this.globalMetadataObject.getNumberingPlanMetadata(this.callingCode())}},{key:"getDefaultCountryMetadataForRegion",value:function(){return this._getDefaultCountryMetadataForThisCallingCode()}},{key:"IDDPrefix",value:function(){if(!this.v1&&!this.v2)return this.metadata[1]}},{key:"defaultIDDPrefix",value:function(){if(!this.v1&&!this.v2)return this.metadata[12]}},{key:"nationalNumberPattern",value:function(){return this.v1||this.v2?this.metadata[1]:this.metadata[2]}},{key:"possibleLengths",value:function(){if(!this.v1)return this.metadata[this.v2?2:3]}},{key:"_getFormats",value:function(d){return d[this.v1?2:this.v2?3:4]}},{key:"formats",value:function(){var d=this,t=this._getFormats(this.metadata)||this._getFormats(this._getDefaultCountryMetadataForThisCallingCode())||[];return t.map(function(t){return new h(t,d)})}},{key:"nationalPrefix",value:function(){return this.metadata[this.v1?3:this.v2?4:5]}},{key:"_getNationalPrefixFormattingRule",value:function(d){return d[this.v1?4:this.v2?5:6]}},{key:"nationalPrefixFormattingRule",value:function(){return this._getNationalPrefixFormattingRule(this.metadata)||this._getNationalPrefixFormattingRule(this._getDefaultCountryMetadataForThisCallingCode())}},{key:"_nationalPrefixForParsing",value:function(){return this.metadata[this.v1?5:this.v2?6:7]}},{key:"nationalPrefixForParsing",value:function(){return this._nationalPrefixForParsing()||this.nationalPrefix()}},{key:"nationalPrefixTransformRule",value:function(){return this.metadata[this.v1?6:this.v2?7:8]}},{key:"_getNationalPrefixIsOptionalWhenFormatting",value:function(){return!!this.metadata[this.v1?7:this.v2?8:9]}},{key:"nationalPrefixIsOptionalWhenFormattingInNationalFormat",value:function(){return this._getNationalPrefixIsOptionalWhenFormatting(this.metadata)||this._getNationalPrefixIsOptionalWhenFormatting(this._getDefaultCountryMetadataForThisCallingCode())}},{key:"leadingDigits",value:function(){return this.metadata[this.v1?8:this.v2?9:10]}},{key:"types",value:function(){return this.metadata[this.v1?9:this.v2?10:11]}},{key:"hasTypes",value:function(){return(!this.types()||0!==this.types().length)&&!!this.types()}},{key:"type",value:function(d){if(this.hasTypes()&&g(this.types(),d))return new m(g(this.types(),d),this)}},{key:"ext",value:function(){return this.v1||this.v2?c:this.metadata[13]||c}}])}(),h=function(){return $(function d(t,e){u(this,d),this._format=t,this.metadata=e},[{key:"pattern",value:function(){return this._format[0]}},{key:"format",value:function(){return this._format[1]}},{key:"leadingDigitsPatterns",value:function(){return this._format[2]||[]}},{key:"nationalPrefixFormattingRule",value:function(){return this._format[3]||this.metadata.nationalPrefixFormattingRule()}},{key:"nationalPrefixIsOptionalWhenFormattingInNationalFormat",value:function(){return!!this._format[4]||this.metadata.nationalPrefixIsOptionalWhenFormattingInNationalFormat()}},{key:"nationalPrefixIsMandatoryWhenFormattingInNationalFormat",value:function(){return this.usesNationalPrefix()&&!this.nationalPrefixIsOptionalWhenFormattingInNationalFormat()}},{key:"usesNationalPrefix",value:function(){return!(!this.nationalPrefixFormattingRule()||y.test(this.nationalPrefixFormattingRule()))}},{key:"internationalFormat",value:function(){return this._format[5]||this.format()}}])}(),y=/^\(?\$1\)?$/,m=function(){return $(function d(t,e){u(this,d),this.type=t,this.metadata=e},[{key:"pattern",value:function(){return this.metadata.v1?this.type:this.type[0]}},{key:"possibleLengths",value:function(){if(!this.metadata.v1)return this.type[1]||this.metadata.possibleLengths()}}])}();function g(d,t){switch(t){case"FIXED_LINE":return d[0];case"MOBILE":return d[1];case"TOLL_FREE":return d[2];case"PREMIUM_RATE":return d[3];case"PERSONAL_NUMBER":return d[4];case"VOICEMAIL":return d[5];case"UAN":return d[6];case"PAGER":return d[7];case"VOIP":return d[8];case"SHARED_COST":return d[9]}}function p(d){if(!d)throw new Error("[libphonenumber-js] `metadata` argument not passed. Check your arguments.");if(!i(d)||!i(d.countries))throw new Error("[libphonenumber-js] `metadata` argument was passed but it's not a valid metadata. Must be an object having `.countries` child object property. Got ".concat(i(d)?"an object of shape: { "+Object.keys(d).join(", ")+" }":"a "+b(d)+": "+d,"."))}var b=function(d){return a(d)};function v(d,t){var e=new s(t);return e.hasCountry(d)?e.selectNumberingPlan(d).ext():c}function C(d,t){var e=new s(t);if(e.hasCountry(d))return e.selectNumberingPlan(d).countryCallingCode();throw new Error("Unknown country: ".concat(d))}function N(d,t){return t.countries.hasOwnProperty(d)}function P(d){var t=d.version;"number"==typeof t?(this.v1=1===t,this.v2=2===t,this.v3=3===t,this.v4=4===t):t?-1===n(t,"1.2.0")?this.v2=!0:-1===n(t,"1.7.35")?this.v3=!0:this.v4=!0:this.v1=!0}function S(d,t,e){return function(d,t,e,n){e&&(n=new s(n.metadata)).selectNumberingPlan(e);var r=n.type(t),i=r&&r.possibleLengths()||n.possibleLengths();if(!i)return"IS_POSSIBLE";var o=d.length,a=i[0];if(a===o)return"IS_POSSIBLE";if(a>o)return"TOO_SHORT";if(i[i.length-1]<o)return"TOO_LONG";return i.indexOf(o,1)>=0?"IS_POSSIBLE":"INVALID_LENGTH"}(d,void 0,t,e)}function w(d,t){return"IS_POSSIBLE"===S(d,void 0,t)}function x(d,t){return d=d||"",new RegExp("^(?:"+t+")$").test(d)}function O(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return E(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?E(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function E(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}var I=["MOBILE","PREMIUM_RATE","TOLL_FREE","SHARED_COST","VOIP","PERSONAL_NUMBER","PAGER","UAN","VOICEMAIL"];function T(d,t,e){if(t=t||{},d.country||d.countryCallingCode){var n=new s(e);n.selectNumberingPlan(d.country||d.countryCallingCode);var r=t.v2?d.nationalNumber:d.phone;if(x(r,n.nationalNumberPattern())){if(A(r,"FIXED_LINE",n))return n.type("MOBILE")&&""===n.type("MOBILE").pattern()?"FIXED_LINE_OR_MOBILE":n.type("MOBILE")?A(r,"MOBILE",n)?"FIXED_LINE_OR_MOBILE":"FIXED_LINE":"FIXED_LINE_OR_MOBILE";for(var i,o=O(I);!(i=o()).done;){var a=i.value;if(A(r,a,n))return a}}}}function A(d,t,e){var n=e.type(t);return!(!n||!n.pattern())&&(!(n.possibleLengths()&&n.possibleLengths().indexOf(d.length)<0)&&x(d,n.pattern()))}var j=/^[A-Z]{2}$/;function F(d,t){var e,n,r,i=new s(t);return r=d,j.test(r)?(e=d,i.selectNumberingPlan(e),n=i.countryCallingCode()):n=d,{country:e,callingCode:n}}function k(d,t,e){var n=new s(e).getCountryCodesForCallingCode(d);return n?n.filter(function(d){return function(d,t,e){var n=new s(e);return n.selectNumberingPlan(t),n.numberingPlan.possibleLengths().indexOf(d.length)>=0}(t,d,e)}):[]}var M="0-9０-９٠-٩۰-۹",R="".concat("-‐-―−ー－").concat("／/").concat("．.").concat("  ­​⁠　").concat("()（）［］\\[\\]").concat("~⁓∼～"),D="+＋",_=new RegExp("(["+M+"])");function L(d,t,e,n){if(t){var r=new s(n);r.selectNumberingPlan(t||e);var i=new RegExp(r.IDDPrefix());if(0===d.search(i)){var o=(d=d.slice(d.match(i)[0].length)).match(_);if(!(o&&null!=o[1]&&o[1].length>0&&"0"===o[1]))return d}}}function G(d,t){if(d&&t.numberingPlan.nationalPrefixForParsing()){var e=new RegExp("^(?:"+t.numberingPlan.nationalPrefixForParsing()+")"),n=e.exec(d);if(n){var r,i,o,a=n.length-1,u=a>0&&n[a];if(t.nationalPrefixTransformRule()&&u)r=d.replace(e,t.nationalPrefixTransformRule()),a>1&&(i=n[1]);else{var $=n[0];r=d.slice($.length),u&&(i=n[1])}if(u){var l=d.indexOf(n[1]);d.slice(0,l)===t.numberingPlan.nationalPrefix()&&(o=t.numberingPlan.nationalPrefix())}else o=n[0];return{nationalNumber:r,nationalPrefix:o,carrierCode:i}}}return{nationalNumber:d}}function B(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return U(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?U(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function U(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function H(d,t,e){for(var n,r=new s(e),i=B(t);!(n=i()).done;){var o=n.value;if(r.selectNumberingPlan(o),r.leadingDigits()){if(d&&0===d.search(r.leadingDigits()))return o}else if(T({phone:d,country:o},void 0,r.metadata))return o}}function W(d,t){var e=t.nationalNumber,n=t.metadata,r=n.getCountryCodesForCallingCode(d);if(r)return 1===r.length?r[0]:H(e,r,n.metadata)}function V(d,t,e){var n=G(d,e),r=n.carrierCode,i=n.nationalNumber;if(i!==d){if(!function(d,t,e){if(x(d,e.nationalNumberPattern())&&!x(t,e.nationalNumberPattern()))return!1;return!0}(d,i,e))return{nationalNumber:d};if(e.numberingPlan.possibleLengths()&&(t||(t=W(e.numberingPlan.callingCode(),{nationalNumber:i,metadata:e})),!function(d,t,e){switch(S(d,t,e)){case"TOO_SHORT":case"INVALID_LENGTH":return!1;default:return!0}}(i,t,e)))return{nationalNumber:d}}return{nationalNumber:i,carrierCode:r}}function K(d,t,e,n,r){if(!(t||e||n))return{number:d};var i=t||e?C(t||e,r):n;if(0===d.indexOf(i)){var o=new s(r);o.selectNumberingPlan(t||e||n);var a=d.slice(i.length),u=V(a,void 0,o).nationalNumber,$=V(d,void 0,o).nationalNumber;if(!x($,o.nationalNumberPattern())&&x(u,o.nationalNumberPattern())||"TOO_LONG"===S($,void 0,o))return{countryCallingCode:i,number:a}}return{number:d}}function Y(d,t,e,n,r){if(!d)return{};var i;if("+"!==d[0]){var o=L(d,t||e,n,r);if(!o||o===d){if(t||e||n){var a=K(d,t,e,n,r),u=a.countryCallingCode,$=a.number;if(u)return{countryCallingCodeSource:"FROM_NUMBER_WITHOUT_PLUS_SIGN",countryCallingCode:u,number:$}}return{number:d}}i=!0,d="+"+o}if("0"===d[1])return{};for(var l=new s(r),c=2;c-1<=3&&c<=d.length;){var f=d.slice(1,c);if(l.hasCallingCode(f))return l.selectNumberingPlan(f),{countryCallingCodeSource:i?"FROM_NUMBER_WITH_IDD":"FROM_NUMBER_WITH_PLUS_SIGN",countryCallingCode:f,number:d.slice(c)};c++}return{}}function Z(d){return d.replace(new RegExp("[".concat(R,"]+"),"g")," ").trim()}var X=/(\$\d)/;function J(d,t,e){var n=e.useInternationalFormat,r=e.withNationalPrefix;e.carrierCode,e.metadata;var i=d.replace(new RegExp(t.pattern()),n?t.internationalFormat():r&&t.nationalPrefixFormattingRule()?t.format().replace(X,t.nationalPrefixFormattingRule()):t.format());return n?Z(i):i}var Q=/^[\d]+(?:[~\u2053\u223C\uFF5E][\d]+)?$/;var z=function(d){return"([".concat(M,"]{1,").concat(d,"})")};function q(d){var t="[  \\t,]*",e="[:\\.．]?[  \\t,-]*",n="#?",r="[  \\t]*";return";ext="+z("20")+"|"+(t+"(?:e?xt(?:ensi(?:ó?|ó))?n?|ｅ?ｘｔｎ?|доб|anexo)"+e+z("20")+n)+"|"+(t+"(?:[xｘ#＃~～]|int|ｉｎｔ)"+e+z("9")+n)+"|"+("[- ]+"+z("6")+"#")+"|"+(r+"(?:,{2}|;)"+e+z("15")+n)+"|"+(r+"(?:,)+"+e+z("9")+n)}var dd="["+M+"]{2}",td="[+＋]{0,1}(?:["+R+"]*["+M+"]){3,}["+R+M+"]*",ed=new RegExp("^[+＋]{0,1}(?:["+R+"]*["+M+"]){1,2}$","i"),nd=td+"(?:"+q()+")?",rd=new RegExp("^"+dd+"$|^"+nd+"$","i");function id(d){return d.length>=2&&rd.test(d)}function od(d,t){return function(d){if(Array.isArray(d))return d}(d)||function(d,t){var e=null==d?null:"undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(null!=e){var n,r,i,o,a=[],u=!0,$=!1;try{if(i=(e=e.call(d)).next,0===t);else for(;!(u=(n=i.call(e)).done)&&(a.push(n.value),a.length!==t);u=!0);}catch(d){$=!0,r=d}finally{try{if(!u&&null!=e.return&&(o=e.return(),Object(o)!==o))return}finally{if($)throw r}}return a}}(d,t)||ad(d,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function ad(d,t){if(d){if("string"==typeof d)return ud(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?ud(d,t):void 0}}function ud(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function $d(d){var t=d.number,e=d.ext;if(!t)return"";if("+"!==t[0])throw new Error('"formatRFC3966()" expects "number" to be in E.164 format.');return"tel:".concat(t).concat(e?";ext="+e:"")}var ld={formatExtension:function(d,t,e){return"".concat(d).concat(e.ext()).concat(t)}};function cd(d,t,e,n){e=e?function(){for(var d=1,t=arguments.length,e=new Array(t),n=0;n<t;n++)e[n]=arguments[n];for(;d<e.length;){if(e[d])for(var r in e[d])e[0][r]=e[d][r];d++}return e[0]}({},ld,e):ld;var r=new s(n);if(d.country&&"001"!==d.country){if(!r.hasCountry(d.country))throw new Error("Unknown country: ".concat(d.country));r.selectNumberingPlan(d.country)}else{if(!d.countryCallingCode)return d.phone||"";r.selectNumberingPlan(d.countryCallingCode)}var i,o=r.countryCallingCode(),a=e.v2?d.nationalNumber:d.phone;switch(t){case"NATIONAL":return a?hd(i=sd(a,d.carrierCode,"NATIONAL",r,e),d.ext,r,e.formatExtension):"";case"INTERNATIONAL":return a?(i=sd(a,null,"INTERNATIONAL",r,e),hd(i="+".concat(o," ").concat(i),d.ext,r,e.formatExtension)):"+".concat(o);case"E.164":return"+".concat(o).concat(a);case"RFC3966":return $d({number:"+".concat(o).concat(a),ext:d.ext});case"IDD":if(!e.fromCountry)return;var u=function(d,t,e,n,r){var i=C(n,r.metadata);if(i===e){var o=sd(d,t,"NATIONAL",r);return"1"===e?e+" "+o:o}var a=function(d,t,e){var n=new s(e);return n.selectNumberingPlan(d||t),n.defaultIDDPrefix()?n.defaultIDDPrefix():Q.test(n.IDDPrefix())?n.IDDPrefix():void 0}(n,void 0,r.metadata);if(a)return"".concat(a," ").concat(e," ").concat(sd(d,null,"INTERNATIONAL",r))}(a,d.carrierCode,o,e.fromCountry,r);if(!u)return;return hd(u,d.ext,r,e.formatExtension);default:throw new Error('Unknown "format" argument passed to "formatNumber()": "'.concat(t,'"'))}}function sd(d,t,e,n,r){var i=fd(n.formats(),d);return i?J(d,i,{useInternationalFormat:"INTERNATIONAL"===e,withNationalPrefix:!i.nationalPrefixIsOptionalWhenFormattingInNationalFormat()||!r||!1!==r.nationalPrefix,carrierCode:t,metadata:n}):d}function fd(d,t){return function(d,t){var e=0;for(;e<d.length;){if(t(d[e]))return d[e];e++}}(d,function(d){if(d.leadingDigitsPatterns().length>0){var e=d.leadingDigitsPatterns()[d.leadingDigitsPatterns().length-1];if(0!==t.search(e))return!1}return x(t,d.pattern())})}function hd(d,t,e,n){return t?n(d,t,e):d}function yd(d){return yd="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},yd(d)}function md(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function gd(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?md(Object(e),!0).forEach(function(t){pd(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):md(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function pd(d,t,e){return(t=vd(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function bd(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,vd(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function vd(d){var t=function(d,t){if("object"!=yd(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=yd(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==yd(t)?t:t+""}var Cd=function(){return bd(function d(t,e,n){if(function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),!t)throw new TypeError("First argument is required");if("string"!=typeof t)throw new TypeError("First argument must be a string");if("+"===t[0]&&!e)throw new TypeError("`metadata` argument not passed");if(i(e)&&i(e.countries)){n=e;var r=t;if(!Nd.test(r))throw new Error('Invalid `number` argument passed: must consist of a "+" followed by digits');var o=Y(r,void 0,void 0,void 0,n);if(t=o.countryCallingCode,!(e=o.number))throw new Error("Invalid `number` argument passed: too short")}if(!e)throw new TypeError("`nationalNumber` argument is required");if("string"!=typeof e)throw new TypeError("`nationalNumber` argument must be a string");p(n);var a=F(t,n),u=a.country,$=a.callingCode;this.country=u,this.countryCallingCode=$,this.nationalNumber=e,this.number="+"+this.countryCallingCode+this.nationalNumber,this.getMetadata=function(){return n}},[{key:"setExt",value:function(d){this.ext=d}},{key:"getPossibleCountries",value:function(){return this.country?[this.country]:k(this.countryCallingCode,this.nationalNumber,this.getMetadata())}},{key:"isPossible",value:function(){return function(d,t,e){void 0===t&&(t={});var n=new s(e);if(t.v2){if(!d.countryCallingCode)throw new Error("Invalid phone number object passed");n.selectNumberingPlan(d.country||d.countryCallingCode)}else{if(!d.phone)return!1;if(d.country){if(!n.hasCountry(d.country))throw new Error("Unknown country: ".concat(d.country));n.selectNumberingPlan(d.country)}else{if(!d.countryCallingCode)throw new Error("Invalid phone number object passed");n.selectNumberingPlan(d.countryCallingCode)}}if(n.possibleLengths())return w(d.phone||d.nationalNumber,n);if(d.countryCallingCode&&n.isNonGeographicCallingCode(d.countryCallingCode))return!0;throw new Error('Missing "possibleLengths" in metadata. Perhaps the metadata has been generated before v1.0.18.')}(this,{v2:!0},this.getMetadata())}},{key:"isValid",value:function(){return function(d,t,e){t=t||{};var n=new s(e);return n.selectNumberingPlan(d.country||d.countryCallingCode),n.hasTypes()?void 0!==T(d,t,n.metadata):x(t.v2?d.nationalNumber:d.phone,n.nationalNumberPattern())}(this,{v2:!0},this.getMetadata())}},{key:"isNonGeographic",value:function(){return new s(this.getMetadata()).isNonGeographicCallingCode(this.countryCallingCode)}},{key:"isEqual",value:function(d){return this.number===d.number&&this.ext===d.ext}},{key:"getType",value:function(){return T(this,{v2:!0},this.getMetadata())}},{key:"format",value:function(d,t){return cd(this,d,t?gd(gd({},t),{},{v2:!0}):{v2:!0},this.getMetadata())}},{key:"formatNational",value:function(d){return this.format("NATIONAL",d)}},{key:"formatInternational",value:function(d){return this.format("INTERNATIONAL",d)}},{key:"getURI",value:function(d){return this.format("RFC3966",d)}}])}(),Nd=/^\+\d+$/;function Pd(d){return Pd="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Pd(d)}function Sd(d,t,e){return t=Ed(t),function(d,t){if(t&&("object"==Pd(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(d){if(void 0===d)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return d}(d)}(d,xd()?Reflect.construct(t,e||[],Ed(d).constructor):t.apply(d,e))}function wd(d){var t="function"==typeof Map?new Map:void 0;return wd=function(d){if(null===d||!function(d){try{return-1!==Function.toString.call(d).indexOf("[native code]")}catch(t){return"function"==typeof d}}(d))return d;if("function"!=typeof d)throw new TypeError("Super expression must either be null or a function");if(void 0!==t){if(t.has(d))return t.get(d);t.set(d,e)}function e(){return function(d,t,e){if(xd())return Reflect.construct.apply(null,arguments);var n=[null];n.push.apply(n,t);var r=new(d.bind.apply(d,n));return e&&Od(r,e.prototype),r}(d,arguments,Ed(this).constructor)}return e.prototype=Object.create(d.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),Od(e,d)},wd(d)}function xd(){try{var d=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(d){}return(xd=function(){return!!d})()}function Od(d,t){return Od=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(d,t){return d.__proto__=t,d},Od(d,t)}function Ed(d){return Ed=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(d){return d.__proto__||Object.getPrototypeOf(d)},Ed(d)}var Id=function(d){function t(d){var e;return function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),e=Sd(this,t,[d]),Object.setPrototypeOf(e,t.prototype),e.name=e.constructor.name,e}return function(d,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");d.prototype=Object.create(t&&t.prototype,{constructor:{value:d,writable:!0,configurable:!0}}),Object.defineProperty(d,"prototype",{writable:!1}),t&&Od(d,t)}(t,d),e=t,Object.defineProperty(e,"prototype",{writable:!1}),e;var e}(wd(Error)),Td=new RegExp("(?:"+q()+")$","i");function Ad(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return jd(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?jd(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function jd(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}var Fd={0:"0",1:"1",2:"2",3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9","０":"0","１":"1","２":"2","３":"3","４":"4","５":"5","６":"6","７":"7","８":"8","９":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9"};function kd(d){return Fd[d]}function Md(d){for(var t,e="",n=Ad(d.split(""));!(t=n()).done;){var r=kd(t.value);r&&(e+=r)}return e}function Rd(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return Dd(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?Dd(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function Dd(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function _d(d){for(var t,e="",n=Rd(d.split(""));!(t=n()).done;){e+=Ld(t.value,e)||""}return e}function Ld(d,t,e){return"+"===d?t?void("function"==typeof e&&e("end")):"+":kd(d)}var Gd="(["+M+"]|[\\-\\.\\(\\)]?)",Bd=new RegExp("^\\+"+Gd+"*["+M+"]"+Gd+"*$","g"),Ud=new RegExp("^("+("["+M+"]+((\\-)*["+M+"])*")+"\\.)*"+("[a-zA-Z]+((\\-)*["+M+"])*")+"\\.?$","g"),Hd="tel:",Wd=";phone-context=";function Vd(d,t){var e,n=t.extractFormattedPhoneNumber,r=function(d){var t=d.indexOf(Wd);if(t<0)return null;var e=t+15;if(e>=d.length)return"";var n=d.indexOf(";",e);return n>=0?d.substring(e,n):d.substring(e)}(d);if(!function(d){return null===d||0!==d.length&&(Bd.test(d)||Ud.test(d))}(r))throw new Id("NOT_A_NUMBER");if(null===r)e=n(d)||"";else{e="","+"===r.charAt(0)&&(e+=r);var i,o=d.indexOf(Hd);i=o>=0?o+4:0;var a=d.indexOf(Wd);e+=d.substring(i,a)}var u=e.indexOf(";isub=");if(u>0&&(e=e.substring(0,u)),""!==e)return e}var Kd=new RegExp("[+＋"+M+"]"),Yd=new RegExp("[^"+M+"#]+$");function Zd(d,t,e){t=t||{};var n=new s(e);if(t.defaultCountry&&!n.hasCountry(t.defaultCountry)){if(t.v2)throw new Id("INVALID_COUNTRY");throw new Error("Unknown country: ".concat(t.defaultCountry))}var r=function(d,t,e){var n=Vd(d,{extractFormattedPhoneNumber:function(d){return function(d,t,e){if(!d)return;if(d.length>250){if(e)throw new Id("TOO_LONG");return}if(!1===t)return d;var n=d.search(Kd);if(n<0)return;return d.slice(n).replace(Yd,"")}(d,e,t)}});if(!n)return{};if(!id(n))return function(d){return ed.test(d)}(n)?{error:"TOO_SHORT"}:{};var r=function(d){var t=d.search(Td);if(t<0)return{};for(var e=d.slice(0,t),n=d.match(Td),r=1;r<n.length;){if(n[r])return{number:e,ext:n[r]};r++}}(n);if(r.ext)return r;return{number:n}}(d,t.v2,t.extract),i=r.number,o=r.ext,a=r.error;if(!i){if(t.v2){if("TOO_SHORT"===a)throw new Id("TOO_SHORT");throw new Id("NOT_A_NUMBER")}return{}}var u=function(d,t,e,n){var r,i=Y(_d(d),void 0,t,e,n.metadata),o=i.countryCallingCodeSource,a=i.countryCallingCode,u=i.number;if(a)n.selectNumberingPlan(a);else{if(!u||!t&&!e)return{};t?(r=t,n.selectNumberingPlan(t),a=n.numberingPlan.callingCode()):(n.selectNumberingPlan(e),a=e)}if(!u)return{countryCallingCodeSource:o,countryCallingCode:a};var $=V(_d(u),void 0,n),l=$.nationalNumber,c=$.carrierCode,s=W(a,{nationalNumber:l,metadata:n});s&&(r=s,"001"===s||n.selectNumberingPlan(r));return{country:r,countryCallingCode:a,countryCallingCodeSource:o,nationalNumber:l,carrierCode:c}}(i,t.defaultCountry,t.defaultCallingCode,n),$=u.country,l=u.nationalNumber,c=u.countryCallingCode,f=u.countryCallingCodeSource,h=u.carrierCode;if(!n.hasSelectedNumberingPlan()){if(t.v2)throw new Id("INVALID_COUNTRY");return{}}if(!l||l.length<2){if(t.v2)throw new Id("TOO_SHORT");return{}}if(l.length>17){if(t.v2)throw new Id("TOO_LONG");return{}}if(t.v2){var y=new Cd(c,l,n.metadata);return $&&(y.country=$),h&&(y.carrierCode=h),o&&(y.ext=o),y.__countryCallingCodeSource=f,y}var m=!!(t.extended?n.hasSelectedNumberingPlan():$)&&x(l,n.nationalNumberPattern());return t.extended?{country:$,countryCallingCode:c,carrierCode:h,valid:m,possible:!!m||!(!0!==t.extended||!n.possibleLengths()||!w(l,n)),phone:l,ext:o}:m?function(d,t,e){var n={country:d,phone:t};e&&(n.ext=e);return n}($,l,o):{}}function Xd(d){return Xd="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Xd(d)}function Jd(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function Qd(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?Jd(Object(e),!0).forEach(function(t){zd(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):Jd(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function zd(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=Xd(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Xd(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==Xd(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function qd(d,t,e){return Zd(d,Qd(Qd({},t),{},{v2:!0}),e)}function dt(d){return dt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},dt(d)}function tt(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function et(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=dt(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=dt(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==dt(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function nt(d,t){return function(d){if(Array.isArray(d))return d}(d)||function(d,t){var e=null==d?null:"undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(null!=e){var n,r,i,o,a=[],u=!0,$=!1;try{if(i=(e=e.call(d)).next,0===t);else for(;!(u=(n=i.call(e)).done)&&(a.push(n.value),a.length!==t);u=!0);}catch(d){$=!0,r=d}finally{try{if(!u&&null!=e.return&&(o=e.return(),Object(o)!==o))return}finally{if($)throw r}}return a}}(d,t)||function(d,t){if(d){if("string"==typeof d)return rt(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?rt(d,t):void 0}}(d,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function rt(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function it(d){var t,e,n,r=nt(Array.prototype.slice.call(d),4),o=r[0],a=r[1],u=r[2],$=r[3];if("string"!=typeof o)throw new TypeError("A text for parsing must be a string.");if(t=o,a&&"string"!=typeof a){if(!i(a))throw new Error("Invalid second argument: ".concat(a));u?(e=a,n=u):n=a}else $?(e=u,n=$):(e=void 0,n=u),a&&(e=function(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?tt(Object(e),!0).forEach(function(t){et(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):tt(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}({defaultCountry:a},e));return{text:t,options:e,metadata:n}}function ot(){var d=it(arguments);return qd(d.text,d.options,d.metadata)}function at(d){return at="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},at(d)}function ut(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function $t(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?ut(Object(e),!0).forEach(function(t){lt(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):ut(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function lt(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=at(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=at(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==at(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function ct(d,t,e){t&&t.defaultCountry&&!N(t.defaultCountry,e)&&(t=$t($t({},t),{},{defaultCountry:void 0}));try{return qd(d,t,e)}catch(d){if(!(d instanceof Id))throw d}}function st(){var d=it(arguments);return ct(d.text,d.options,d.metadata)}function ft(d){return ft="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},ft(d)}function ht(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function yt(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?ht(Object(e),!0).forEach(function(t){mt(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):ht(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function mt(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=ft(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=ft(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==ft(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function gt(){var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=ct(t,e=yt(yt({},e),{},{extract:!1}),n);return r&&r.isValid()||!1}function pt(d){return pt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},pt(d)}function bt(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function vt(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?bt(Object(e),!0).forEach(function(t){Ct(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):bt(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function Ct(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=pt(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=pt(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==pt(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function Nt(){var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=ct(t,e=vt(vt({},e),{},{extract:!1}),n);return r&&r.isPossible()||!1}function Pt(d){return Pt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Pt(d)}function St(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function wt(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?St(Object(e),!0).forEach(function(t){xt(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):St(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function xt(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=Pt(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Pt(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==Pt(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function Ot(){var d=it(arguments),t=d.text,e=d.options,n=d.metadata;e=wt(wt({},e),{},{extract:!1});try{var r=qd(t,e,n),i=new s(n);i.selectNumberingPlan(r.country||r.countryCallingCode);var o=S(r.nationalNumber,void 0,i);if("IS_POSSIBLE"!==o)return o}catch(d){if(d instanceof Id)return d.message;throw d}}function Et(d){return Et="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Et(d)}function It(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Tt(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Tt(d){var t=function(d,t){if("object"!=Et(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Et(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==Et(t)?t:t+""}function At(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}var jt=It(function d(t,e){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null,r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:null;At(this,d),this.key=t,this.value=e,this.next=n,this.prev=r}),Ft=function(){return It(function d(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:10;At(this,d),this.size=0,this.limit=t,this.head=null,this.tail=null,this.cache={}},[{key:"put",value:function(d,t){if(this.ensureLimit(),this.head){var e=new jt(d,t,this.head);this.head.prev=e,this.head=e}else this.head=this.tail=new jt(d,t);this.cache[d]=this.head,this.size++}},{key:"get",value:function(d){if(this.cache[d]){var t=this.cache[d].value;return this.remove(d),this.put(d,t),t}console.log("Item not available in cache for key ".concat(d))}},{key:"ensureLimit",value:function(){this.size===this.limit&&this.remove(this.tail.key)}},{key:"remove",value:function(d){var t=this.cache[d];null!==t.prev?t.prev.next=t.next:this.head=t.next,null!==t.next?t.next.prev=t.prev:this.tail=t.prev,delete this.cache[d],this.size--}},{key:"clear",value:function(){this.head=null,this.tail=null,this.size=0,this.cache={}}}])}();function kt(d){return kt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},kt(d)}function Mt(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Rt(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Rt(d){var t=function(d,t){if("object"!=kt(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=kt(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==kt(t)?t:t+""}var Dt=function(){return Mt(function d(t){!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.cache=new Ft(t)},[{key:"getPatternForRegExp",value:function(d){var t=this.cache.get(d);return t||(t=new RegExp("^"+d),this.cache.put(d,t)),t}}])}();function _t(d,t){if(d<0||t<=0||t<d)throw new TypeError;return"{".concat(d,",").concat(t,"}")}function Lt(d,t){var e=t.search(d);return e>=0?t.slice(0,e):t}var Gt="   ᠎ - \u2028\u2029  　",Bt="[".concat(Gt,"]"),Ut="[^".concat(Gt,"]"),Ht="[".concat("0-9٠-٩۰-۹߀-߉०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯๐-๙໐-໙༠-༩၀-၉႐-႙០-៩᠐-᠙᥆-᥏᧐-᧙᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙꘠-꘩꣐-꣙꤀-꤉꧐-꧙꩐-꩙꯰-꯹０-９","]"),Wt="A-Za-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԧԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠࢢ-ࢬऄ-हऽॐक़-ॡॱ-ॷॹ-ॿঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎↃↄⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々〆〱-〵〻〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚗꚠ-ꛥꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꪀ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ",Vt="[".concat(Wt,"]"),Kt=new RegExp(Vt),Yt="[".concat("$¢-¥֏؋৲৳৻૱௹฿៛₠-₹꠸﷼﹩＄￠￡￥￦","]"),Zt=new RegExp(Yt),Xt="[".concat("̀-ͯ҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ܑۭܰ-݊ަ-ް߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣤ-ࣾऀ-ंऺ़ु-ै्॑-ॗॢॣঁ়ু-ৄ্ৢৣਁਂ਼ੁੂੇੈੋ-੍ੑੰੱੵઁં઼ુ-ૅેૈ્ૢૣଁ଼ିୁ-ୄ୍ୖୢୣஂீ்ా-ీె-ైొ-్ౕౖౢౣ಼ಿೆೌ್ೢೣു-ൄ്ൢൣ්ි-ුූัิ-ฺ็-๎ັິ-ູົຼ່-ໍཱ༹༘༙༵༷-ཾྀ-྄྆྇ྍ-ྗྙ-ྼ࿆ိ-ူဲ-့္်ွှၘၙၞ-ၠၱ-ၴႂႅႆႍႝ፝-፟ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴឵ិ-ួំ៉-៓៝᠋-᠍ᢩᤠ-ᤢᤧᤨᤲ᤹-᤻ᨘᨗᩖᩘ-ᩞ᩠ᩢᩥ-ᩬᩳ-᩿᩼ᬀ-ᬃ᬴ᬶ-ᬺᬼᭂ᭫-᭳ᮀᮁᮢ-ᮥᮨᮩ᯦᮫ᯨᯩᯭᯯ-ᯱᰬ-ᰳᰶ᰷᳐-᳔᳒-᳢᳠-᳨᳭᳴᷀-ᷦ᷼-᷿⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〭꙯ꙴ-꙽ꚟ꛰꛱ꠂ꠆ꠋꠥꠦ꣄꣠-꣱ꤦ-꤭ꥇ-ꥑꦀ-ꦂ꦳ꦶ-ꦹꦼꨩ-ꨮꨱꨲꨵꨶꩃꩌꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫬꫭ꫶ꯥꯨ꯭ﬞ︀-️︠-︦","]"),Jt=new RegExp(Xt),Qt=new RegExp("[\0--ÿĀ-ſḀ-ỿƀ-ɏ̀-ͯ]");function zt(d){return!(!Kt.test(d)&&!Jt.test(d))&&Qt.test(d)}function qt(d){return"%"===d||Zt.test(d)}function de(d,t,e){var n=!0,r=st(d,e);if(r||(n=!1,r=st(d,{defaultCallingCode:t.countryCallingCode},e)),!r)return"INVALID_NUMBER";if(t.ext){if(r.ext!==t.ext)return"NO_MATCH"}else if(r.ext)return"NO_MATCH";return n&&t.countryCallingCode!==r.countryCallingCode?"NO_MATCH":t.number===r.number?n?"EXACT_MATCH":"NSN_MATCH":0===t.nationalNumber.indexOf(r.nationalNumber)||0===r.nationalNumber.indexOf(t.nationalNumber)?"SHORT_NSN_MATCH":"NO_MATCH"}var te={POSSIBLE:function(d,t){return t.candidate,t.metadata,!0},VALID:function(d,t){var e=t.candidate;t.defaultCountry;var n=t.metadata;return!(!d.isValid()||!ee(d,e,n))},STRICT_GROUPING:function(d,t){var e=t.candidate,n=t.defaultCountry,r=t.metadata;return t.regExpCache,!(!d.isValid()||!ee(d,e,r)||re(d,e)||!ne(d,{defaultCountry:n,metadata:r}))&&ie()},EXACT_GROUPING:function(d,t){var e=t.candidate,n=t.defaultCountry,r=t.metadata;return t.regExpCache,!(!d.isValid()||!ee(d,e,r)||re(d,e)||!ne(d,{defaultCountry:n,metadata:r}))&&ie()}};function ee(d,t,e){for(var n=0;n<t.length-1;n++){var r=t.charAt(n);if("x"===r||"X"===r){var i=t.charAt(n+1);if("x"===i||"X"===i){if(n++,"NSN_MATCH"!==de(t.substring(n),d,e))return!1}else{var o=Md(t.substring(n));if(o){if(d.ext!==o)return!1}else if(d.ext)return!1}}}return!0}function ne(d,t){t.defaultCountry;var e=t.metadata;if("FROM_DEFAULT_COUNTRY"!==d.__countryCallingCodeSource)return!0;var n=new s(e);n.selectNumberingPlan(d.countryCallingCode),d.country||W(d.countryCallingCode,{nationalNumber:d.nationalNumber,metadata:n});var r=d.nationalNumber,i=fd(n.numberingPlan.formats(),r);return!i.nationalPrefixFormattingRule()||(!!n.numberingPlan.nationalPrefixIsOptionalWhenFormattingInNationalFormat()||(!i.usesNationalPrefix()||Boolean(d.nationalPrefix)))}function re(d,t){var e=t.indexOf("/");if(e<0)return!1;var n=t.indexOf("/",e+1);return!(n<0)&&(!("FROM_NUMBER_WITH_PLUS_SIGN"===d.__countryCallingCodeSource||"FROM_NUMBER_WITHOUT_PLUS_SIGN"===d.__countryCallingCodeSource)||Md(t.substring(0,e))!==d.countryCallingCode||t.slice(n+1).indexOf("/")>=0)}function ie(d,t,e,n,r){throw new Error("This part of code hasn't been ported")}var oe=/[\\/] *x/;function ae(d){return Lt(oe,d)}var ue=/(?:(?:[0-3]?\d\/[01]?\d)|(?:[01]?\d\/[0-3]?\d))\/(?:[12]\d)?\d{2}/,$e=/[12]\d{3}[-/]?[01]\d[-/]?[0-3]\d +[0-2]\d$/,le=/^:[0-5]\d/;function ce(d,t,e){if(ue.test(d))return!1;if($e.test(d)){var n=e.slice(t+d.length);if(le.test(n))return!1}return!0}var se="(\\[（［",fe=")\\]）］",he="[^".concat(se).concat(fe,"]"),ye="[".concat(se).concat(D,"]"),me=new RegExp("^"+ye),ge=_t(0,3),pe=new RegExp("^(?:[(\\[（［])?(?:"+he+"+["+fe+"])?"+he+"+(?:["+se+"]"+he+"+["+fe+"])"+ge+he+"*$"),be=/\d{1,5}-+\d{1,5}\s{0,4}\(\d{1,4}/;function ve(d){return ve="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},ve(d)}function Ce(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return Ne(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?Ne(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function Ne(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function Pe(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Se(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Se(d){var t=function(d,t){if("object"!=ve(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=ve(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==ve(t)?t:t+""}var we=q(),xe=["/+(.*)","(\\([^(]*)","(?:".concat(Bt,"-|-").concat(Bt,")").concat(Bt,"*(.+)"),"[‒-―－]".concat(Bt,"*(.+)"),"\\.+".concat(Bt,"*([^.]+)"),"".concat(Bt,"+(").concat(Ut,"+)")],Oe=_t(0,2),Ee=_t(0,4),Ie=_t(0,20),Te="[".concat(R,"]")+Ee,Ae=Ht+_t(1,20),je="(?:"+ye+Te+")"+Oe+Ae+"(?:"+Te+Ae+")"+Ie+"(?:"+we+")?",Fe=new RegExp("[^".concat("0-9²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൦-൵๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꩐-꩙꯰-꯹０-９").concat(Wt,"#]+$")),ke=Number.MAX_SAFE_INTEGER||Math.pow(2,53)-1,Me=function(){return Pe(function d(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments.length>2?arguments[2]:void 0;if(function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),e={v2:e.v2,defaultCallingCode:e.defaultCallingCode,defaultCountry:e.defaultCountry&&N(e.defaultCountry,n)?e.defaultCountry:void 0,leniency:e.leniency||(e.extended?"POSSIBLE":"VALID"),maxTries:e.maxTries||ke},!te[e.leniency])throw new TypeError('Unknown leniency: "'.concat(e.leniency,'"'));if("POSSIBLE"!==e.leniency&&"VALID"!==e.leniency)throw new TypeError('Invalid `leniency`: "'.concat(e.leniency,'". Supported values: "POSSIBLE", "VALID".'));if(e.maxTries<0)throw new TypeError("`maxTries` must be `>= 0`");this.text=t,this.options=e,this.metadata=n,this.leniency=te[e.leniency],this.maxTries=e.maxTries,this.PATTERN=new RegExp(je,"ig"),this.INNER_MATCHES=xe.map(function(d){return new RegExp(d,"g")}),this.state="NOT_READY",this.searchIndex=0,this.regExpCache=new Dt(32)},[{key:"find",value:function(d){var t;for(this.PATTERN.lastIndex=d;this.maxTries>0&&null!==(t=this.PATTERN.exec(this.text));){var e=t[0],n=t.index;if(ce(e=ae(e),n,this.text)){var r=this.parseAndVerify(e,n,this.text)||this.extractInnerMatch(e,n,this.text);if(r){if(this.options.v2)return{startsAt:r.startsAt,endsAt:r.endsAt,number:r.phoneNumber};var i=r.phoneNumber,o={startsAt:r.startsAt,endsAt:r.endsAt,phone:i.nationalNumber};return i.country?o.country=i.country:o.countryCallingCode=i.countryCallingCode,i.ext&&(o.ext=i.ext),o}}this.maxTries--}}},{key:"extractInnerMatch",value:function(d,t,e){for(var n,r=Ce(this.INNER_MATCHES);!(n=r()).done;){var i=n.value;i.lastIndex=0;for(var o=!0,a=void 0;this.maxTries>0&&null!==(a=i.exec(d));){if(o){var u=Lt(Fe,d.slice(0,a.index)),$=this.parseAndVerify(u,t,e);if($)return $;this.maxTries--,o=!1}var l=Lt(Fe,a[1]),c=d.indexOf(l,a.index),s=this.parseAndVerify(l,t+c,e);if(s)return s;this.maxTries--}}}},{key:"parseAndVerify",value:function(d,t,e){if(function(d,t,e,n){if(pe.test(d)&&!be.test(d)){if("POSSIBLE"!==n){if(t>0&&!me.test(d)){var r=e[t-1];if(qt(r)||zt(r))return!1}var i=t+d.length;if(i<e.length){var o=e[i];if(qt(o)||zt(o))return!1}}return!0}}(d,t,e,this.options.leniency)){var n=st(d,{extended:!0,defaultCountry:this.options.defaultCountry,defaultCallingCode:this.options.defaultCallingCode},this.metadata);if(n&&n.isPossible())return this.leniency(n,{candidate:d,defaultCountry:this.options.defaultCountry,metadata:this.metadata,regExpCache:this.regExpCache})?{startsAt:t,endsAt:t+d.length,phoneNumber:n}:void 0}}},{key:"hasNext",value:function(){return"NOT_READY"===this.state&&(this.lastMatch=this.find(this.searchIndex),this.lastMatch?(this.searchIndex=this.lastMatch.endsAt,this.state="READY"):this.state="DONE"),"READY"===this.state}},{key:"next",value:function(){if(!this.hasNext())throw new Error("No next element");var d=this.lastMatch;return this.lastMatch=null,this.state="NOT_READY",d}}])}();function Re(){for(var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=new Me(t,e,n),i=[];r.hasNext();)i.push(r.next());return i}function De(d){return De="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},De(d)}function _e(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=De(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=De(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==De(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function Le(){var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=new Me(t,e,n);return _e({},Symbol.iterator,function(){return{next:function(){return r.hasNext()?{done:!1,value:r.next()}:{done:!0}}}})}function Ge(d){return Ge="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Ge(d)}function Be(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function Ue(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?Be(Object(e),!0).forEach(function(t){He(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):Be(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function He(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=Ge(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Ge(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==Ge(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function We(){for(var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=new Me(t,Ue(Ue({},e),{},{v2:!0}),n),i=[];r.hasNext();)i.push(r.next());return i}function Ve(d){return Ve="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Ve(d)}function Ke(d,t){var e=Object.keys(d);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(d);t&&(n=n.filter(function(t){return Object.getOwnPropertyDescriptor(d,t).enumerable})),e.push.apply(e,n)}return e}function Ye(d){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?Ke(Object(e),!0).forEach(function(t){Ze(d,t,e[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(d,Object.getOwnPropertyDescriptors(e)):Ke(Object(e)).forEach(function(t){Object.defineProperty(d,t,Object.getOwnPropertyDescriptor(e,t))})}return d}function Ze(d,t,e){return(t=function(d){var t=function(d,t){if("object"!=Ve(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Ve(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(d)}(d,"string");return"symbol"==Ve(t)?t:t+""}(t))in d?Object.defineProperty(d,t,{value:e,enumerable:!0,configurable:!0,writable:!0}):d[t]=e,d}function Xe(){var d=it(arguments),t=d.text,e=d.options,n=d.metadata,r=new Me(t,Ye(Ye({},e),{},{v2:!0}),n);return Ze({},Symbol.iterator,function(){return{next:function(){return r.hasNext()?{done:!1,value:r.next()}:{done:!0}}}})}function Je(d){return Je="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Je(d)}function Qe(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,ze(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function ze(d){var t=function(d,t){if("object"!=Je(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Je(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==Je(t)?t:t+""}var qe=function(){return Qe(function d(t){var e=t.onCountryChange,n=t.onCallingCodeChange;!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.onCountryChange=e,this.onCallingCodeChange=n},[{key:"reset",value:function(d){var t=d.country,e=d.callingCode;this.international=!1,this.missingPlus=!1,this.IDDPrefix=void 0,this.callingCode=void 0,this.digits="",this.resetNationalSignificantNumber(),this.initCountryAndCallingCode(t,e)}},{key:"resetNationalSignificantNumber",value:function(){this.nationalSignificantNumber=this.getNationalDigits(),this.nationalSignificantNumberIsModified=!1,this.nationalPrefix=void 0,this.carrierCode=void 0,this.prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix=void 0}},{key:"update",value:function(d){for(var t=0,e=Object.keys(d);t<e.length;t++){var n=e[t];this[n]=d[n]}}},{key:"initCountryAndCallingCode",value:function(d,t){this.setCountry(d),this.setCallingCode(t)}},{key:"setCountry",value:function(d){this.country=d,this.onCountryChange(d)}},{key:"setCallingCode",value:function(d){this.callingCode=d,this.onCallingCodeChange(d,this.country)}},{key:"startInternationalNumber",value:function(d,t){this.international=!0,this.initCountryAndCallingCode(d,t)}},{key:"appendDigits",value:function(d){this.digits+=d}},{key:"appendNationalSignificantNumberDigits",value:function(d){this.nationalSignificantNumber+=d}},{key:"getNationalDigits",value:function(){return this.international?this.digits.slice((this.IDDPrefix?this.IDDPrefix.length:0)+(this.callingCode?this.callingCode.length:0)):this.digits}},{key:"getDigitsWithoutInternationalPrefix",value:function(){return this.international&&this.IDDPrefix?this.digits.slice(this.IDDPrefix.length):this.digits}}])}();function dn(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return tn(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?tn(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function tn(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}var en="x",nn=new RegExp(en);function rn(d,t){if(t<1)return"";for(var e="";t>1;)1&t&&(e+=d),t>>=1,d+=d;return e+d}function on(d,t){return")"===d[t]&&t++,function(d){var t=[],e=0;for(;e<d.length;)"("===d[e]?t.push(e):")"===d[e]&&t.pop(),e++;var n=0,r="";t.push(d.length);for(var i=0,o=t;i<o.length;i++){var a=o[i];r+=d.slice(n,a),n=a+1}return r}(d.slice(0,t))}function an(d,t,e){var n=e.metadata,r=e.shouldTryNationalPrefixFormattingRule,i=e.getSeparatorAfterNationalPrefix;if(new RegExp("^(?:".concat(t.pattern(),")$")).test(d.nationalSignificantNumber))return function(d,t,e){var n=e.metadata,r=e.shouldTryNationalPrefixFormattingRule,i=e.getSeparatorAfterNationalPrefix;if(d.nationalSignificantNumber,d.international,d.nationalPrefix,d.carrierCode,r(t)){var o=un(d,t,{useNationalPrefixFormattingRule:!0,getSeparatorAfterNationalPrefix:i,metadata:n});if(o)return o}return un(d,t,{useNationalPrefixFormattingRule:!1,getSeparatorAfterNationalPrefix:i,metadata:n})}(d,t,{metadata:n,shouldTryNationalPrefixFormattingRule:r,getSeparatorAfterNationalPrefix:i})}function un(d,t,e){var n=e.metadata,r=e.useNationalPrefixFormattingRule,i=e.getSeparatorAfterNationalPrefix,o=J(d.nationalSignificantNumber,t,{carrierCode:d.carrierCode,useInternationalFormat:d.international,withNationalPrefix:r,metadata:n});if(r||(d.nationalPrefix?o=d.nationalPrefix+i(t)+o:d.prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix&&(o=d.prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix+" "+o)),function(d,t){return Md(d)===t.getNationalDigits()}(o,d))return o}function $n(d){return $n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},$n(d)}function ln(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,cn(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function cn(d){var t=function(d,t){if("object"!=$n(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=$n(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==$n(t)?t:t+""}var sn=function(){return ln(function d(){!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d)},[{key:"parse",value:function(d){if(this.context=[{or:!0,instructions:[]}],this.parsePattern(d),1!==this.context.length)throw new Error("Non-finalized contexts left when pattern parse ended");var t=this.context[0],e=t.branches,n=t.instructions;if(e)return{op:"|",args:e.concat([mn(n)])};if(0===n.length)throw new Error("Pattern is required");return 1===n.length?n[0]:n}},{key:"startContext",value:function(d){this.context.push(d)}},{key:"endContext",value:function(){this.context.pop()}},{key:"getContext",value:function(){return this.context[this.context.length-1]}},{key:"parsePattern",value:function(d){if(!d)throw new Error("Pattern is required");var t=d.match(yn);if(t){var e=t[1],n=d.slice(0,t.index),r=d.slice(t.index+e.length);switch(e){case"(?:":n&&this.parsePattern(n),this.startContext({or:!0,instructions:[],branches:[]});break;case")":if(!this.getContext().or)throw new Error('")" operator must be preceded by "(?:" operator');if(n&&this.parsePattern(n),0===this.getContext().instructions.length)throw new Error('No instructions found after "|" operator in an "or" group');var i=this.getContext().branches;i.push(mn(this.getContext().instructions)),this.endContext(),this.getContext().instructions.push({op:"|",args:i});break;case"|":if(!this.getContext().or)throw new Error('"|" operator can only be used inside "or" groups');if(n&&this.parsePattern(n),!this.getContext().branches){if(1!==this.context.length)throw new Error('"branches" not found in an "or" group context');this.getContext().branches=[]}this.getContext().branches.push(mn(this.getContext().instructions)),this.getContext().instructions=[];break;case"[":n&&this.parsePattern(n),this.startContext({oneOfSet:!0});break;case"]":if(!this.getContext().oneOfSet)throw new Error('"]" operator must be preceded by "[" operator');this.endContext(),this.getContext().instructions.push({op:"[]",args:fn(n)});break;default:throw new Error("Unknown operator: ".concat(e))}r&&this.parsePattern(r)}else{if(hn.test(d))throw new Error("Illegal characters found in a pattern: ".concat(d));this.getContext().instructions=this.getContext().instructions.concat(d.split(""))}}}])}();function fn(d){for(var t=[],e=0;e<d.length;){if("-"===d[e]){if(0===e||e===d.length-1)throw new Error("Couldn't parse a one-of set pattern: ".concat(d));for(var n=d[e-1].charCodeAt(0)+1,r=d[e+1].charCodeAt(0)-1,i=n;i<=r;)t.push(String.fromCharCode(i)),i++}else t.push(d[e]);e++}return t}var hn=/[\(\)\[\]\?\:\|]/,yn=new RegExp("(\\||\\(\\?\\:|\\)|\\[|\\])");function mn(d){return 1===d.length?d[0]:d}function gn(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return pn(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?pn(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function pn(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function bn(d){return bn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},bn(d)}function vn(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Cn(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Cn(d){var t=function(d,t){if("object"!=bn(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=bn(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==bn(t)?t:t+""}var Nn=function(){return vn(function d(t){!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.matchTree=(new sn).parse(t)},[{key:"match",value:function(d){var t=(arguments.length>1&&void 0!==arguments[1]?arguments[1]:{}).allowOverflow;if(!d)throw new Error("String is required");var e=Pn(d.split(""),this.matchTree,!0);if(e&&e.match&&delete e.matchedChars,!e||!e.overflow||t)return e}}])}();function Pn(d,t,e){if("string"==typeof t){var n=d.join("");return 0===t.indexOf(n)?d.length===t.length?{match:!0,matchedChars:d}:{partialMatch:!0}:0===n.indexOf(t)?e&&d.length>t.length?{overflow:!0}:{match:!0,matchedChars:d.slice(0,t.length)}:void 0}if(Array.isArray(t)){for(var r=d.slice(),i=0;i<t.length;){var o=Pn(r,t[i],e&&i===t.length-1);if(!o)return;if(o.overflow)return o;if(!o.match){if(o.partialMatch)return{partialMatch:!0};throw new Error("Unsupported match result:\n".concat(JSON.stringify(o,null,2)))}if(0===(r=r.slice(o.matchedChars.length)).length)return i===t.length-1?{match:!0,matchedChars:d}:{partialMatch:!0};i++}return e?{overflow:!0}:{match:!0,matchedChars:d.slice(0,d.length-r.length)}}switch(t.op){case"|":for(var a,u,$=gn(t.args);!(u=$()).done;){var l=Pn(d,u.value,e);if(l){if(l.overflow)return l;if(l.match)return{match:!0,matchedChars:l.matchedChars};if(!l.partialMatch)throw new Error("Unsupported match result:\n".concat(JSON.stringify(l,null,2)));a=!0}}return a?{partialMatch:!0}:void 0;case"[]":for(var c,s=gn(t.args);!(c=s()).done;){var f=c.value;if(d[0]===f)return 1===d.length?{match:!0,matchedChars:d}:e?{overflow:!0}:{match:!0,matchedChars:[f]}}return;default:throw new Error("Unsupported instruction tree: ".concat(t))}}function Sn(d){return Sn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Sn(d)}function wn(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=function(d,t){if(d){if("string"==typeof d)return xn(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?xn(d,t):void 0}}(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function xn(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function On(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,En(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function En(d){var t=function(d,t){if("object"!=Sn(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Sn(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==Sn(t)?t:t+""}var In=rn("9",15),Tn=/[- ]/,An=new RegExp("["+R+"]*\\$1["+R+"]*(\\$\\d["+R+"]*)*$"),jn=function(){return On(function d(t){t.state;var e=t.metadata;!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.metadata=e,this.resetFormat()},[{key:"resetFormat",value:function(){this.chosenFormat=void 0,this.template=void 0,this.nationalNumberTemplate=void 0,this.populatedNationalNumberTemplate=void 0,this.populatedNationalNumberTemplatePosition=-1}},{key:"reset",value:function(d,t){this.resetFormat(),d?(this.isNANP="1"===d.callingCode(),this.matchingFormats=d.formats(),t.nationalSignificantNumber&&this.narrowDownMatchingFormats(t)):(this.isNANP=void 0,this.matchingFormats=[])}},{key:"format",value:function(d,t){var e=this;if(function(d,t){return"IS_POSSIBLE"===S(d,void 0,t)}(t.nationalSignificantNumber,this.metadata))for(var n,r=wn(this.matchingFormats);!(n=r()).done;){var i=n.value,o=an(t,i,{metadata:this.metadata,shouldTryNationalPrefixFormattingRule:function(d){return e.shouldTryNationalPrefixFormattingRule(d,{international:t.international,nationalPrefix:t.nationalPrefix})},getSeparatorAfterNationalPrefix:function(d){return e.getSeparatorAfterNationalPrefix(d)}});if(o)return this.resetFormat(),this.chosenFormat=i,this.setNationalNumberTemplate(o.replace(/\d/g,en),t),this.populatedNationalNumberTemplate=o,this.populatedNationalNumberTemplatePosition=this.template.lastIndexOf(en),o}return this.formatNationalNumberWithNextDigits(d,t)}},{key:"formatNationalNumberWithNextDigits",value:function(d,t){var e=this.chosenFormat,n=this.chooseFormat(t);if(n)return n===e?this.formatNextNationalNumberDigits(d):this.formatNextNationalNumberDigits(t.getNationalDigits())}},{key:"narrowDownMatchingFormats",value:function(d){var t=this,e=d.nationalSignificantNumber,n=d.nationalPrefix,r=d.international,i=e,o=i.length-3;o<0&&(o=0),this.matchingFormats=this.matchingFormats.filter(function(d){return t.formatSuits(d,r,n)&&t.formatMatches(d,i,o)}),this.chosenFormat&&-1===this.matchingFormats.indexOf(this.chosenFormat)&&this.resetFormat()}},{key:"formatSuits",value:function(d,t,e){return!(e&&!d.usesNationalPrefix()&&!d.nationalPrefixIsOptionalWhenFormattingInNationalFormat())&&!(!t&&!e&&d.nationalPrefixIsMandatoryWhenFormattingInNationalFormat())}},{key:"formatMatches",value:function(d,t,e){var n=d.leadingDigitsPatterns().length;if(0===n)return!0;e=Math.min(e,n-1);var r=d.leadingDigitsPatterns()[e];if(t.length<3)try{return void 0!==new Nn(r).match(t,{allowOverflow:!0})}catch(d){return console.error(d),!0}return new RegExp("^(".concat(r,")")).test(t)}},{key:"getFormatFormat",value:function(d,t){return t?d.internationalFormat():d.format()}},{key:"chooseFormat",value:function(d){for(var t,e=this,n=function(){var n=t.value;return e.chosenFormat===n?0:An.test(e.getFormatFormat(n,d.international))?e.createTemplateForFormat(n,d)?(e.chosenFormat=n,0):(e.matchingFormats=e.matchingFormats.filter(function(d){return d!==n}),1):1},r=wn(this.matchingFormats.slice());!(t=r()).done&&0!==n(););return this.chosenFormat||this.resetFormat(),this.chosenFormat}},{key:"createTemplateForFormat",value:function(d,t){if(!(d.pattern().indexOf("|")>=0)){var e=this.getTemplateForFormat(d,t);return e?(this.setNationalNumberTemplate(e,t),!0):void 0}}},{key:"getSeparatorAfterNationalPrefix",value:function(d){return this.isNANP||d&&d.nationalPrefixFormattingRule()&&Tn.test(d.nationalPrefixFormattingRule())?" ":""}},{key:"getInternationalPrefixBeforeCountryCallingCode",value:function(d,t){var e=d.IDDPrefix,n=d.missingPlus;return e?t&&!1===t.spacing?e:e+" ":n?"":"+"}},{key:"getTemplate",value:function(d){if(this.template){for(var t=-1,e=0,n=d.international?this.getInternationalPrefixBeforeCountryCallingCode(d,{spacing:!1}):"";e<n.length+d.getDigitsWithoutInternationalPrefix().length;)t=this.template.indexOf(en,t+1),e++;return on(this.template,t+1)}}},{key:"setNationalNumberTemplate",value:function(d,t){this.nationalNumberTemplate=d,this.populatedNationalNumberTemplate=d,this.populatedNationalNumberTemplatePosition=-1,t.international?this.template=this.getInternationalPrefixBeforeCountryCallingCode(t).replace(/[\d\+]/g,en)+rn(en,t.callingCode.length)+" "+d:this.template=d}},{key:"getTemplateForFormat",value:function(d,t){var e=t.nationalSignificantNumber,n=t.international,r=t.nationalPrefix,i=t.prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix,o=d.pattern();o=o.replace(/\[([^\[\]])*\]/g,"\\d").replace(/\d(?=[^,}][^,}])/g,"\\d");var a=In.match(o)[0];if(!(e.length>a.length)){var u=new RegExp("^"+o+"$"),$=e.replace(/\d/g,"9");u.test($)&&(a=$);var l,c=this.getFormatFormat(d,n);if(this.shouldTryNationalPrefixFormattingRule(d,{international:n,nationalPrefix:r})){var s=c.replace(X,d.nationalPrefixFormattingRule());if(Md(d.nationalPrefixFormattingRule())===(r||"")+Md("$1")&&(c=s,l=!0,r))for(var f=r.length;f>0;)c=c.replace(/\d/,en),f--}var h=a.replace(new RegExp(o),c).replace(new RegExp("9","g"),en);return l||(i?h=rn(en,i.length)+" "+h:r&&(h=rn(en,r.length)+this.getSeparatorAfterNationalPrefix(d)+h)),n&&(h=Z(h)),h}}},{key:"formatNextNationalNumberDigits",value:function(d){var t=function(d,t,e){for(var n,r=dn(e.split(""));!(n=r()).done;){var i=n.value;if(d.slice(t+1).search(nn)<0)return;t=d.search(nn),d=d.replace(nn,i)}return[d,t]}(this.populatedNationalNumberTemplate,this.populatedNationalNumberTemplatePosition,d);if(t)return this.populatedNationalNumberTemplate=t[0],this.populatedNationalNumberTemplatePosition=t[1],on(this.populatedNationalNumberTemplate,this.populatedNationalNumberTemplatePosition+1);this.resetFormat()}},{key:"shouldTryNationalPrefixFormattingRule",value:function(d,t){var e=t.international,n=t.nationalPrefix;if(d.nationalPrefixFormattingRule()){var r=d.usesNationalPrefix();if(r&&n||!r&&!e)return!0}}}])}();function Fn(d){return Fn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Fn(d)}function kn(d,t){return function(d){if(Array.isArray(d))return d}(d)||function(d,t){var e=null==d?null:"undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(null!=e){var n,r,i,o,a=[],u=!0,$=!1;try{if(i=(e=e.call(d)).next,0===t);else for(;!(u=(n=i.call(e)).done)&&(a.push(n.value),a.length!==t);u=!0);}catch(d){$=!0,r=d}finally{try{if(!u&&null!=e.return&&(o=e.return(),Object(o)!==o))return}finally{if($)throw r}}return a}}(d,t)||function(d,t){if(d){if("string"==typeof d)return Mn(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?Mn(d,t):void 0}}(d,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Mn(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function Rn(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Dn(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Dn(d){var t=function(d,t){if("object"!=Fn(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Fn(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==Fn(t)?t:t+""}var _n=new RegExp("^"+("["+R+M+"]+")+"$","i"),Ln="(?:[+＋]["+R+M+"]*|["+R+M+"]+)",Gn=new RegExp("[^"+R+M+"]+.*$"),Bn=/[^\d\[\]]/,Un=function(){return Rn(function d(t){var e=t.defaultCountry,n=t.defaultCallingCode,r=t.metadata,i=t.onNationalSignificantNumberChange;!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.defaultCountry=e,this.defaultCallingCode=n,this.metadata=r,this.onNationalSignificantNumberChange=i},[{key:"input",value:function(d,t){var e,n=function(d){var t=function(d){var t=function(d){var t,e=d.search(Ln);if(e<0)return;d=d.slice(e),"+"===d[0]&&(t=!0,d=d.slice(1));d=d.replace(Gn,""),t&&(d="+"+d);return d}(d)||"";if("+"===t[0])return[t.slice(1),!0];return[t]}(d),e=kn(t,2),n=e[0],r=e[1];_n.test(n)||(n="");return[n,r]}(d),r=kn(n,2),i=r[0],o=r[1],a=Md(i);return o&&(t.digits||(t.startInternationalNumber(void 0,void 0),a||(e=!0))),a&&this.inputDigits(a,t),{digits:a,justLeadingPlus:e}}},{key:"inputDigits",value:function(d,t){var e=t.digits,n=e.length<3&&e.length+d.length>=3;if(t.appendDigits(d),n&&this.extractIddPrefix(t),this.isWaitingForCountryCallingCode(t)){if(!this.extractCountryCallingCode(t))return}else t.appendNationalSignificantNumberDigits(d);t.international||this.hasExtractedNationalSignificantNumber||this.extractNationalSignificantNumber(t.getNationalDigits(),function(d){return t.update(d)})}},{key:"isWaitingForCountryCallingCode",value:function(d){var t=d.international,e=d.callingCode;return t&&!e}},{key:"extractCountryCallingCode",value:function(d){var t=Y("+"+d.getDigitsWithoutInternationalPrefix(),d.country,this.defaultCountry,this.defaultCallingCode,this.metadata.metadata),e=t.countryCallingCode,n=t.number;if(e)return d.setCallingCode(e),d.update({nationalSignificantNumber:n}),!0}},{key:"reset",value:function(d){if(d){this.hasSelectedNumberingPlan=!0;var t=d._nationalPrefixForParsing();this.couldPossiblyExtractAnotherNationalSignificantNumber=t&&Bn.test(t)}else this.hasSelectedNumberingPlan=void 0,this.couldPossiblyExtractAnotherNationalSignificantNumber=void 0}},{key:"extractNationalSignificantNumber",value:function(d,t){if(this.hasSelectedNumberingPlan){var e=G(d,this.metadata),n=e.nationalPrefix,r=e.nationalNumber,i=e.carrierCode;if(r!==d)return this.onExtractedNationalNumber(n,i,r,d,t),!0}}},{key:"extractAnotherNationalSignificantNumber",value:function(d,t,e){if(!this.hasExtractedNationalSignificantNumber)return this.extractNationalSignificantNumber(d,e);if(this.couldPossiblyExtractAnotherNationalSignificantNumber){var n=G(d,this.metadata),r=n.nationalPrefix,i=n.nationalNumber,o=n.carrierCode;if(i!==t)return this.onExtractedNationalNumber(r,o,i,d,e),!0}}},{key:"onExtractedNationalNumber",value:function(d,t,e,n,r){var i,o=!1,a=n.lastIndexOf(e);if(a<0||a!==n.length-e.length)o=!0;else{var u=n.slice(0,a);u&&u!==d&&(i=u)}r({nationalPrefix:d,carrierCode:t,nationalSignificantNumber:e,nationalSignificantNumberIsModified:o,prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix:i}),this.hasExtractedNationalSignificantNumber=!0,this.onNationalSignificantNumberChange()}},{key:"reExtractNationalSignificantNumber",value:function(d){return!!this.extractAnotherNationalSignificantNumber(d.getNationalDigits(),d.nationalSignificantNumber,function(t){return d.update(t)})||(this.extractIddPrefix(d)||this.fixMissingPlus(d)?(this.extractCallingCodeAndNationalSignificantNumber(d),!0):void 0)}},{key:"extractIddPrefix",value:function(d){var t=d.international,e=d.IDDPrefix,n=d.digits;if(d.nationalSignificantNumber,!t&&!e){var r=L(n,this.defaultCountry,this.defaultCallingCode,this.metadata.metadata);return void 0!==r&&r!==n?(d.update({IDDPrefix:n.slice(0,n.length-r.length)}),this.startInternationalNumber(d,{country:void 0,callingCode:void 0}),!0):void 0}}},{key:"fixMissingPlus",value:function(d){if(!d.international){var t=K(d.digits,d.country,this.defaultCountry,this.defaultCallingCode,this.metadata.metadata).countryCallingCode;if(t)return d.update({missingPlus:!0}),this.startInternationalNumber(d,{country:d.country,callingCode:t}),!0}}},{key:"startInternationalNumber",value:function(d,t){var e=t.country,n=t.callingCode;d.startInternationalNumber(e,n),d.nationalSignificantNumber&&(d.resetNationalSignificantNumber(),this.onNationalSignificantNumberChange(),this.hasExtractedNationalSignificantNumber=void 0)}},{key:"extractCallingCodeAndNationalSignificantNumber",value:function(d){this.extractCountryCallingCode(d)&&this.extractNationalSignificantNumber(d.getNationalDigits(),function(t){return d.update(t)})}}])}();function Hn(d){return Hn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(d){return typeof d}:function(d){return d&&"function"==typeof Symbol&&d.constructor===Symbol&&d!==Symbol.prototype?"symbol":typeof d},Hn(d)}function Wn(d,t){return function(d){if(Array.isArray(d))return d}(d)||function(d,t){var e=null==d?null:"undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(null!=e){var n,r,i,o,a=[],u=!0,$=!1;try{if(i=(e=e.call(d)).next,0===t);else for(;!(u=(n=i.call(e)).done)&&(a.push(n.value),a.length!==t);u=!0);}catch(d){$=!0,r=d}finally{try{if(!u&&null!=e.return&&(o=e.return(),Object(o)!==o))return}finally{if($)throw r}}return a}}(d,t)||function(d,t){if(d){if("string"==typeof d)return Vn(d,t);var e={}.toString.call(d).slice(8,-1);return"Object"===e&&d.constructor&&(e=d.constructor.name),"Map"===e||"Set"===e?Array.from(d):"Arguments"===e||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e)?Vn(d,t):void 0}}(d,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Vn(d,t){(null==t||t>d.length)&&(t=d.length);for(var e=0,n=Array(t);e<t;e++)n[e]=d[e];return n}function Kn(d,t,e){return t&&function(d,t){for(var e=0;e<t.length;e++){var n=t[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(d,Yn(n.key),n)}}(d.prototype,t),Object.defineProperty(d,"prototype",{writable:!1}),d}function Yn(d){var t=function(d,t){if("object"!=Hn(d)||!d)return d;var e=d[Symbol.toPrimitive];if(void 0!==e){var n=e.call(d,t);if("object"!=Hn(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(d)}(d,"string");return"symbol"==Hn(t)?t:t+""}var Zn=function(){return Kn(function d(t,e){!function(d,t){if(!(d instanceof t))throw new TypeError("Cannot call a class as a function")}(this,d),this.metadata=new s(e);var n=Wn(this.getCountryAndCallingCode(t),2),r=n[0],i=n[1];this.defaultCountry=r,this.defaultCallingCode=i,this.reset()},[{key:"getCountryAndCallingCode",value:function(d){var t,e;return d&&(i(d)?(t=d.defaultCountry,e=d.defaultCallingCode):t=d),t&&!this.metadata.hasCountry(t)&&(t=void 0),[t,e]}},{key:"input",value:function(d){var t=this.parser.input(d,this.state),e=t.digits;if(t.justLeadingPlus)this.formattedOutput="+";else if(e){var n;if(this.determineTheCountryIfNeeded(),this.state.nationalSignificantNumber&&this.formatter.narrowDownMatchingFormats(this.state),this.metadata.hasSelectedNumberingPlan()&&(n=this.formatter.format(e,this.state)),void 0===n&&this.parser.reExtractNationalSignificantNumber(this.state)){this.determineTheCountryIfNeeded();var r=this.state.getNationalDigits();r&&(n=this.formatter.format(r,this.state))}this.formattedOutput=n?this.getFullNumber(n):this.getNonFormattedNumber()}return this.formattedOutput}},{key:"reset",value:function(){var d=this;return this.state=new qe({onCountryChange:function(t){d.country=t},onCallingCodeChange:function(t,e){d.metadata.selectNumberingPlan(e||t),d.formatter.reset(d.metadata.numberingPlan,d.state),d.parser.reset(d.metadata.numberingPlan)}}),this.formatter=new jn({state:this.state,metadata:this.metadata}),this.parser=new Un({defaultCountry:this.defaultCountry,defaultCallingCode:this.defaultCallingCode,metadata:this.metadata,state:this.state,onNationalSignificantNumberChange:function(){d.determineTheCountryIfNeeded(),d.formatter.reset(d.metadata.numberingPlan,d.state)}}),this.state.reset({country:this.defaultCountry,callingCode:this.defaultCallingCode}),this.formattedOutput="",this}},{key:"isInternational",value:function(){return this.state.international}},{key:"getCallingCode",value:function(){if(this.isInternational())return this.state.callingCode}},{key:"getCountryCallingCode",value:function(){return this.getCallingCode()}},{key:"getCountry",value:function(){if(this.state.digits)return this._getCountry()}},{key:"_getCountry",value:function(){return this.state.country}},{key:"determineTheCountryIfNeeded",value:function(){this.state.country&&!this.isCountryCallingCodeAmbiguous()||this.determineTheCountry()}},{key:"getFullNumber",value:function(d){var t=this;if(this.isInternational()){var e=function(d){return t.formatter.getInternationalPrefixBeforeCountryCallingCode(t.state,{spacing:!!d})+d},n=this.state.callingCode;return e(n?d?"".concat(n," ").concat(d):n:"".concat(this.state.getDigitsWithoutInternationalPrefix()))}return d}},{key:"getNonFormattedNationalNumberWithPrefix",value:function(){var d=this.state,t=d.nationalSignificantNumber,e=d.prefixBeforeNationalSignificantNumberThatIsNotNationalPrefix,n=d.nationalPrefix,r=t,i=e||n;return i&&(r=i+r),r}},{key:"getNonFormattedNumber",value:function(){var d=this.state.nationalSignificantNumberIsModified;return this.getFullNumber(d?this.state.getNationalDigits():this.getNonFormattedNationalNumberWithPrefix())}},{key:"getNonFormattedTemplate",value:function(){var d=this.getNonFormattedNumber();if(d)return d.replace(/[\+\d]/g,en)}},{key:"isCountryCallingCodeAmbiguous",value:function(){var d=this.state.callingCode,t=this.metadata.getCountryCodesForCallingCode(d);return t&&t.length>1}},{key:"determineTheCountry",value:function(){var d=W(this.isInternational()?this.state.callingCode:this.defaultCallingCode,{nationalNumber:this.state.nationalSignificantNumber,metadata:this.metadata});d!==this.state.country&&(this.state.setCountry(d),d&&this.metadata.selectNumberingPlan(d))}},{key:"getNumberValue",value:function(){var d=this.state,t=d.digits,e=d.callingCode,n=d.country,r=d.nationalSignificantNumber;if(t)return this.isInternational()?e?"+"+e+r:"+"+t:n||e?"+"+(n?this.metadata.countryCallingCode():e)+r:void 0}},{key:"getNumber",value:function(){var d=this.state,t=d.nationalSignificantNumber,e=d.carrierCode,n=d.callingCode;if(t){var r=this._getCountry();if(r||n){if(r&&r===this.defaultCountry){var i=function(d,t,e){var n=e.getCountryCodesForCallingCode(d);if(n.length>1)return H(t,n,e.metadata)}(this.metadata.numberingPlan.callingCode(),t,this.metadata);i&&(r=i)}var o=new Cd(r||n,t,this.metadata.metadata);return e&&(o.carrierCode=e),o}}}},{key:"isPossible",value:function(){var d=this.getNumber();return!!d&&d.isPossible()}},{key:"isValid",value:function(){var d=this.getNumber();return!!d&&d.isValid()}},{key:"validateLength",value:function(){var d=this.state,t=d.digits,e=d.nationalSignificantNumber;if(!t)return"NOT_A_NUMBER";if(!this.metadata.numberingPlan)return"INVALID_COUNTRY";if(!e)return"TOO_SHORT";var n=S(e,void 0,this.metadata);return"IS_POSSIBLE"!==n?n:void 0}},{key:"getNationalNumber",value:function(){return this.state.nationalSignificantNumber}},{key:"getChars",value:function(){return(this.state.international?"+":"")+this.state.digits}},{key:"getTemplate",value:function(){return this.formatter.getTemplate(this.state)||this.getNonFormattedTemplate()||""}}])}();function Xn(d){return new s(d).getCountries()}function Jn(d,t,e){if(t[d])return new Cd(d,t[d],e)}function Qn(d,t,e){return e||(e=t,t=void 0),new Zn(t,e).input(d)}function zn(){return e(ot,arguments)}function qn(){return e(st,arguments)}function dr(d,e){return Me.call(this,d,e,t)}function tr(d){return Zn.call(this,d,t)}function er(){return s.call(this,t)}function nr(d){return Cd.call(this,d,t)}dr.prototype=Object.create(Me.prototype,{}),dr.prototype.constructor=dr,tr.prototype=Object.create(Zn.prototype,{}),tr.prototype.constructor=tr,er.prototype=Object.create(s.prototype,{}),er.prototype.constructor=er,nr.prototype=Cd.prototype,nr.prototype.constructor=nr,d.AsYouType=tr,d.DIGIT_PLACEHOLDER=en,d.Metadata=er,d.ParseError=Id,d.PhoneNumber=nr,d.PhoneNumberMatcher=dr,d.default=qn,d.findNumbers=function(){return e(Re,arguments)},d.findPhoneNumbersInText=function(){return e(We,arguments)},d.formatIncompletePhoneNumber=function(){return e(Qn,arguments)},d.formatRFC3966=$d,d.getCountries=function(){return e(Xn,arguments)},d.getCountryCallingCode=function(){return e(C,arguments)},d.getExampleNumber=function(){return e(Jn,arguments)},d.getExtPrefix=function(){return e(v,arguments)},d.isPossiblePhoneNumber=function(){return e(Nt,arguments)},d.isSupportedCountry=function(){return e(N,arguments)},d.isValidPhoneNumber=function(){return e(gt,arguments)},d.parseDigits=Md,d.parseIncompletePhoneNumber=_d,d.parsePhoneNumber=zn,d.parsePhoneNumberCharacter=Ld,d.parsePhoneNumberFromString=qn,d.parsePhoneNumberWithError=zn,d.parseRFC3966=function(d){for(var t,e,n,r=function(d,t){var e="undefined"!=typeof Symbol&&d[Symbol.iterator]||d["@@iterator"];if(e)return(e=e.call(d)).next.bind(e);if(Array.isArray(d)||(e=ad(d))||t){e&&(d=e);var n=0;return function(){return n>=d.length?{done:!0}:{done:!1,value:d[n++]}}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}((d=d.replace(/^tel:/,"tel=")).split(";"));!(n=r()).done;){var i=od(n.value.split("="),2),o=i[0],a=i[1];switch(o){case"tel":t=a;break;case"ext":e=a;break;case"phone-context":"+"===a[0]&&(t=a+t)}}if(!id(t))return{};var u={number:t};return e&&(u.ext=e),u},d.searchNumbers=function(){return e(Le,arguments)},d.searchPhoneNumbersInText=function(){return e(Xe,arguments)},d.validatePhoneNumberLength=function(){return e(Ot,arguments)},Object.defineProperty(d,"__esModule",{value:!0})});
//# sourceMappingURL=libphonenumber-max.js.map

const phoneLibrary = module.exports;
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

})();
(() => { const module = { exports: {} }; const exports = module.exports;
/**
* Tom Select v2.6.2
* Licensed under the Apache License, Version 2.0 (the "License");
*/
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).TomSelect=t()}(this,function(){"use strict"
function e(e,t){e.split(/\s+/).forEach(e=>{t(e)})}class t{constructor(){this._events={}}on(t,i){e(t,e=>{const t=this._events[e]||[]
t.push(i),this._events[e]=t})}off(t,i){var s=arguments.length
0!==s?e(t,e=>{if(1===s)return void delete this._events[e]
const t=this._events[e]
void 0!==t&&(t.splice(t.indexOf(i),1),this._events[e]=t)}):this._events={}}trigger(t,...i){var s=this
e(t,e=>{const t=s._events[e]
void 0!==t&&t.forEach(e=>{e.apply(s,i)})})}}const i=e=>(e=e.filter(Boolean)).length<2?e[0]||"":1==l(e)?"["+e.join("")+"]":"(?:"+e.join("|")+")",s=e=>{if(!o(e))return e.join("")
let t="",i=0
const s=()=>{i>1&&(t+="{"+i+"}")}
return e.forEach((n,o)=>{n!==e[o-1]?(s(),t+=n,i=1):i++}),s(),t},n=e=>{let t=Array.from(e)
return i(t)},o=e=>new Set(e).size!==e.length,r=e=>(e+"").replace(/([\$\(\)\*\+\.\?\[\]\^\{\|\}\\])/gu,"\\$1"),l=e=>e.reduce((e,t)=>Math.max(e,a(t)),0),a=e=>Array.from(e).length,c=e=>{if(1===e.length)return[[e]]
let t=[]
const i=e.substring(1)
return c(i).forEach(function(i){let s=i.slice(0)
s[0]=e.charAt(0)+s[0],t.push(s),s=i.slice(0),s.unshift(e.charAt(0)),t.push(s)}),t},d=[[0,65535]]
let u,p
const h={},g={"/":"⁄∕",0:"߀",a:"ⱥɐɑ",aa:"ꜳ",ae:"æǽǣ",ao:"ꜵ",au:"ꜷ",av:"ꜹꜻ",ay:"ꜽ",b:"ƀɓƃ",c:"ꜿƈȼↄ",d:"đɗɖᴅƌꮷԁɦ",e:"ɛǝᴇɇ",f:"ꝼƒ",g:"ǥɠꞡᵹꝿɢ",h:"ħⱨⱶɥ",i:"ɨı",j:"ɉȷ",k:"ƙⱪꝁꝃꝅꞣ",l:"łƚɫⱡꝉꝇꞁɭ",m:"ɱɯϻ",n:"ꞥƞɲꞑᴎлԉ",o:"øǿɔɵꝋꝍᴑ",oe:"œ",oi:"ƣ",oo:"ꝏ",ou:"ȣ",p:"ƥᵽꝑꝓꝕρ",q:"ꝗꝙɋ",r:"ɍɽꝛꞧꞃ",s:"ßȿꞩꞅʂ",t:"ŧƭʈⱦꞇ",th:"þ",tz:"ꜩ",u:"ʉ",v:"ʋꝟʌ",vy:"ꝡ",w:"ⱳ",y:"ƴɏỿ",z:"ƶȥɀⱬꝣ",hv:"ƕ"}
for(let e in g){let t=g[e]||""
for(let i=0;i<t.length;i++){let s=t.substring(i,i+1)
h[s]=e}}const f=new RegExp(Object.keys(h).join("|")+"|[̀-ͯ·ʾʼ]","gu"),m=(e,t="NFKD")=>e.normalize(t),v=e=>Array.from(e).reduce((e,t)=>e+O(t),""),O=e=>(e=m(e).toLowerCase().replace(f,e=>h[e]||""),m(e,"NFC"))
const b=e=>{const t={},i=(e,i)=>{const s=t[e]||new Set,o=new RegExp("^"+n(s)+"$","iu")
i.match(o)||(s.add(r(i)),t[e]=s)}
for(let t of function*(e){for(const[t,i]of e)for(let e=t;e<=i;e++){let t=String.fromCharCode(e),i=v(t)
i!=t.toLowerCase()&&(i.length>3||0!=i.length&&(yield{folded:i,composed:t,code_point:e}))}}(e))i(t.folded,t.folded),i(t.folded,t.composed)
return t},y=e=>{const t=b(e),s={}
let o=[]
for(let e in t){let i=t[e]
i&&(s[e]=n(i)),e.length>1&&o.push(r(e))}o.sort((e,t)=>t.length-e.length)
const l=i(o)
return p=new RegExp("^"+l,"u"),s},w=(e,t=1)=>(t=Math.max(t,e.length-1),i(c(e).map(e=>((e,t=1)=>{let i=0
return e=e.map(e=>(u[e]&&(i+=e.length),u[e]||e)),i>=t?s(e):""})(e,t)))),S=(e,t=!0)=>{let n=e.length>1?1:0
return i(e.map(e=>{let i=[]
const o=t?e.length():e.length()-1
for(let t=0;t<o;t++)i.push(w(e.substrs[t]||"",n))
return s(i)}))},_=(e,t)=>{for(const i of t){if(i.start!=e.start||i.end!=e.end)continue
if(i.substrs.join("")!==e.substrs.join(""))continue
let t=e.parts
const s=e=>{for(const i of t){if(i.start===e.start&&i.substr===e.substr)return!1
if(1!=e.length&&1!=i.length){if(e.start<i.start&&e.end>i.start)return!0
if(i.start<e.start&&i.end>e.start)return!0}}return!1}
if(!(i.parts.filter(s).length>0))return!0}return!1}
class C{parts
substrs
start
end
constructor(){this.parts=[],this.substrs=[],this.start=0,this.end=0}add(e){e&&(this.parts.push(e),this.substrs.push(e.substr),this.start=Math.min(e.start,this.start),this.end=Math.max(e.end,this.end))}last(){return this.parts[this.parts.length-1]}length(){return this.parts.length}clone(e,t){let i=new C,s=JSON.parse(JSON.stringify(this.parts)),n=s.pop()
for(const e of s)i.add(e)
let o=t.substr.substring(0,e-n.start),r=o.length
return i.add({start:n.start,end:n.start+r,length:r,substr:o}),i}}const x=e=>{void 0===u&&(u=y(d)),e=v(e)
let t="",i=[new C]
for(let s=0;s<e.length;s++){let n=e.substring(s).match(p)
const o=e.substring(s,s+1),r=n?n[0]:null
let l=[],a=new Set
for(const e of i){const t=e.last()
if(!t||1==t.length||t.end<=s)if(r){const t=r.length
e.add({start:s,end:s+t,length:t,substr:r}),a.add("1")}else e.add({start:s,end:s+1,length:1,substr:o}),a.add("2")
else if(r){let i=e.clone(s,t)
const n=r.length
i.add({start:s,end:s+n,length:n,substr:r}),l.push(i)}else a.add("3")}if(l.length>0){l=l.sort((e,t)=>e.length()-t.length())
for(let e of l)_(e,i)||i.push(e)}else if(s>0&&1==a.size&&!a.has("3")){t+=S(i,!1)
let e=new C
const s=i[0]
s&&e.add(s.last()),i=[e]}}return t+=S(i,!0),t},A=(e,t)=>{if(e)return e[t]},I=(e,t)=>{if(e){for(var i,s=t.split(".");(i=s.shift())&&(e=e[i]););return e}},k=(e,t,i)=>{var s,n
return e?(e+="",null==t.regex||-1===(n=e.search(t.regex))?0:(s=t.string.length/e.length,0===n&&(s+=.5),s*i)):0},F=(e,t)=>{var i=e[t]
if("function"==typeof i)return i
i&&!Array.isArray(i)&&(e[t]=[i])},L=(e,t)=>{if(Array.isArray(e))e.forEach(t)
else for(var i in e)e.hasOwnProperty(i)&&t(e[i],i)},E=(e,t)=>"number"==typeof e&&"number"==typeof t?e>t?1:e<t?-1:0:(e=v(e+"").toLowerCase())>(t=v(t+"").toLowerCase())?1:t>e?-1:0
class T{items
settings
constructor(e,t){this.items=e,this.settings=t||{diacritics:!0}}tokenize(e,t,i){if(!e||!e.length)return[]
const s=[],n=e.split(/\s+/)
var o
return i&&(o=new RegExp("^("+Object.keys(i).map(r).join("|")+"):(.*)$")),n.forEach(e=>{let i,n=null,l=null
o&&(i=e.match(o))&&(n=i[1],e=i[2]),e.length>0&&(l=this.settings.diacritics?x(e)||null:r(e),l&&t&&(l="\\b"+l)),s.push({string:e,regex:l?new RegExp(l,"iu"):null,field:n})}),s}getScoreFunction(e,t){var i=this.prepareSearch(e,t)
return this._getScoreFunction(i)}_getScoreFunction(e){const t=e.tokens,i=t.length
if(!i)return function(){return 0}
const s=e.options.fields,n=e.weights,o=s.length,r=e.getAttrFn
if(!o)return function(){return 1}
const l=1===o?function(e,t){const i=s[0].field
return k(r(t,i),e,n[i]||1)}:function(e,t){var i=0
if(e.field){const s=r(t,e.field)
!e.regex&&s?i+=1/o:i+=k(s,e,1)}else L(n,(s,n)=>{i+=k(r(t,n),e,s)})
return i/o}
return 1===i?function(e){return l(t[0],e)}:"and"===e.options.conjunction?function(e){var s,n=0
for(let i of t){if((s=l(i,e))<=0)return 0
n+=s}return n/i}:function(e){var s=0
return L(t,t=>{s+=l(t,e)}),s/i}}getSortFunction(e,t){var i=this.prepareSearch(e,t)
return this._getSortFunction(i)}_getSortFunction(e){var t,i=[]
const s=this,n=e.options,o=!e.query&&n.sort_empty?n.sort_empty:n.sort
if("function"==typeof o)return o.bind(this)
const r=function(t,i){return"$score"===t?i.score:e.getAttrFn(s.items[i.id],t)}
if(o)for(let t of o)(e.query||"$score"!==t.field)&&i.push(t)
if(e.query){t=!0
for(let e of i)if("$score"===e.field){t=!1
break}t&&i.unshift({field:"$score",direction:"desc"})}else i=i.filter(e=>"$score"!==e.field)
return i.length?function(e,t){var s,n
for(let o of i){if(n=o.field,s=("desc"===o.direction?-1:1)*E(r(n,e),r(n,t)))return s}return 0}:null}prepareSearch(e,t){const i={}
var s=Object.assign({},t)
if(F(s,"sort"),F(s,"sort_empty"),s.fields){F(s,"fields")
const e=[]
s.fields.forEach(t=>{"string"==typeof t&&(t={field:t,weight:1}),e.push(t),i[t.field]="weight"in t?t.weight:1}),s.fields=e}return{options:s,query:e.toLowerCase().trim(),tokens:this.tokenize(e,s.respect_word_boundaries,i),total:0,items:[],weights:i,getAttrFn:s.nesting?I:A}}search(e,t){var i,s,n=this
s=this.prepareSearch(e,t),t=s.options,e=s.query
const o=t.score||n._getScoreFunction(s)
e.length?L(n.items,(e,n)=>{i=o(e),(!1===t.filter||i>0)&&s.items.push({score:i,id:n})}):L(n.items,(e,t)=>{s.items.push({score:1,id:t})})
const r=n._getSortFunction(s)
return r&&s.items.sort(r),s.total=s.items.length,"number"==typeof t.limit&&(s.items=s.items.slice(0,t.limit)),s}}const P=e=>null==e?null:N(e),N=e=>"boolean"==typeof e?e?"1":"0":e+"",D=e=>(e+"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"),V=(e,t)=>{var i
return function(s,n){var o=this
i&&(o.loading=Math.max(o.loading-1,0),clearTimeout(i)),i=setTimeout(function(){i=null,o.loadedSearches[s]=!0,e.call(o,s,n)},t)}},j=(e,t,i)=>{var s,n=e.trigger,o={}
for(s of(e.trigger=function(){var i=arguments[0]
if(-1===t.indexOf(i))return n.apply(e,arguments)
o[i]=arguments},i.apply(e,[]),e.trigger=n,t))s in o&&n.apply(e,o[s])},$=(e,t=!1)=>{e&&(e.preventDefault(),t&&e.stopPropagation())},q=(e,t,i,s)=>{e.addEventListener(t,i,s)},R=(e,t)=>!!t&&(!!t[e]&&1===(t.altKey?1:0)+(t.ctrlKey?1:0)+(t.shiftKey?1:0)+(t.metaKey?1:0)),H=(e,t)=>{const i=e.getAttribute("id")
return i||(e.setAttribute("id",t),t)},M=e=>e.replace(/[\\"']/g,"\\$&"),z=(e,t)=>{t&&e.append(t)},B=(e,t)=>{if(Array.isArray(e))e.forEach(t)
else for(var i in e)e.hasOwnProperty(i)&&t(e[i],i)},K=e=>{if(e.jquery)return e[0]
if(e instanceof HTMLElement)return e
if(G(e)){var t=document.createElement("template")
return t.innerHTML=e.trim(),t.content.firstChild}return document.querySelector(e)},G=e=>"string"==typeof e&&e.indexOf("<")>-1,U=(e,t)=>{var i=document.createEvent("HTMLEvents")
i.initEvent(t,!0,!1),e.dispatchEvent(i)},W=(e,t)=>{Object.assign(e.style,t)},Q=(e,...t)=>{var i=X(t);(e=Y(e)).map(e=>{i.map(t=>{e.classList.add(t)})})},J=(e,...t)=>{var i=X(t);(e=Y(e)).map(e=>{i.map(t=>{e.classList.remove(t)})})},X=e=>{var t=[]
return B(e,e=>{"string"==typeof e&&(e=e.trim().split(/[\t\n\f\r\s]/)),Array.isArray(e)&&(t=t.concat(e))}),t.filter(Boolean)},Y=e=>(Array.isArray(e)||(e=[e]),e),Z=(e,t,i)=>{if(!i||i.contains(e))for(;e&&e.matches;){if(e.matches(t))return e
e=e.parentNode}},ee=(e,t=0)=>t>0?e[e.length-1]:e[0],te=(e,t)=>{if(!e)return-1
t=t||e.nodeName
for(var i=0;e=e.previousElementSibling;)e.matches(t)&&i++
return i},ie=(e,t)=>{B(t,(t,i)=>{null==t?e.removeAttribute(i):e.setAttribute(i,""+t)})},se=(e,t)=>{e.parentNode&&e.parentNode.replaceChild(t,e)},ne=(e,t)=>{if(null===t)return
if("string"==typeof t){if(!t.length)return
t=new RegExp(t,"i")}const i=e=>3===e.nodeType?(e=>{var i=e.data.match(t)
if(i&&e.data.length>0){var s=document.createElement("span")
s.className="highlight"
var n=e.splitText(i.index)
n.splitText(i[0].length)
var o=n.cloneNode(!0)
return s.appendChild(o),se(n,s),1}return 0})(e):((e=>{1!==e.nodeType||!e.childNodes||/(script|style)/i.test(e.tagName)||"highlight"===e.className&&"SPAN"===e.tagName||Array.from(e.childNodes).forEach(e=>{i(e)})})(e),0)
i(e)},oe="undefined"!=typeof navigator&&/Mac/.test(navigator.userAgent)?"metaKey":"ctrlKey"
var re={options:[],optgroups:[],plugins:[],delimiter:",",splitOn:null,persist:!0,diacritics:!0,create:null,createOnBlur:!1,createFilter:null,clearAfterSelect:!1,highlight:!0,openOnFocus:!0,shouldOpen:null,maxOptions:50,maxItems:null,hideSelected:null,duplicates:!1,addPrecedence:!1,selectOnTab:!1,preload:null,allowEmptyOption:!1,refreshThrottle:300,loadThrottle:300,loadingClass:"loading",dataAttr:null,optgroupField:"optgroup",valueField:"value",labelField:"text",disabledField:"disabled",optgroupLabelField:"label",optgroupValueField:"value",lockOptgroupOrder:!1,sortField:"$order",searchField:["text"],searchConjunction:"and",mode:null,wrapperClass:"ts-wrapper",controlClass:"ts-control",dropdownClass:"ts-dropdown",dropdownContentClass:"ts-dropdown-content",itemClass:"item",optionClass:"option",dropdownParent:null,controlInput:'<input type="text" autocomplete="off" size="1" />',copyClassesToDropdown:!1,placeholder:null,hidePlaceholder:null,shouldLoad:function(e){return e.length>0},render:{}}
function le(e,t){var i=Object.assign({},re,t),s=i.dataAttr,n=i.labelField,o=i.valueField,r=i.disabledField,l=i.optgroupField,a=i.optgroupLabelField,c=i.optgroupValueField,d=e.tagName.toLowerCase(),u=e.getAttribute("placeholder")||e.getAttribute("data-placeholder")
if(!u&&!i.allowEmptyOption){let t=e.querySelector('option[value=""]')
t&&(u=t.textContent)}var p={placeholder:u,options:[],optgroups:[],items:[],maxItems:null}
return"select"===d?(()=>{var t,d=p.options,u={},h=1
let g=0
var f=e=>{var t=Object.assign({},e.dataset),i=s&&t[s]
return"string"==typeof i&&i.length&&(t=Object.assign(t,JSON.parse(i))),t},m=(e,t)=>{var s=P(e.value)
if(null!=s&&(s||i.allowEmptyOption)){if(u.hasOwnProperty(s)){if(t){var a=u[s][l]
a?Array.isArray(a)?a.push(t):u[s][l]=[a,t]:u[s][l]=t}}else{var c=f(e)
c[n]=c[n]||e.textContent,c[o]=c[o]||s,c[r]=c[r]||e.disabled,c[l]=c[l]||t,c.$option=e,c.$order=c.$order||++g,u[s]=c,d.push(c)}e.selected&&p.items.push(s)}}
p.maxItems=e.hasAttribute("multiple")?null:1,B(e.children,e=>{var i,s,n
"optgroup"===(t=e.tagName.toLowerCase())?((n=f(i=e))[a]=n[a]||i.getAttribute("label")||"",n[c]=n[c]||h++,n[r]=n[r]||i.disabled,n.$order=n.$order||++g,p.optgroups.push(n),s=n[c],B(i.children,e=>{m(e,s)})):"option"===t&&m(e)})})():(()=>{const t=e.getAttribute(s)
if(t)p.options=JSON.parse(t),B(p.options,e=>{p.items.push(e[o])})
else{var r,l,a=null!=(r=null==e||null==(l=e.value)?void 0:l.trim())?r:""
if(!i.allowEmptyOption&&!a.length)return
const t=a.split(i.delimiter)
B(t,e=>{const t={}
t[n]=e,t[o]=e,p.options.push(t)}),p.items=t}})(),Object.assign({},re,p,t)}var ae=0
class ce extends(function(e){return e.plugins={},class extends e{constructor(...e){super(...e),this.plugins={names:[],settings:{},requested:{},loaded:{}}}static define(t,i){e.plugins[t]={name:t,fn:i}}initializePlugins(e){var t,i
const s=this,n=[]
if(Array.isArray(e))e.forEach(e=>{"string"==typeof e?n.push(e):(s.plugins.settings[e.name]=e.options,n.push(e.name))})
else if(e)for(t in e)e.hasOwnProperty(t)&&(s.plugins.settings[t]=e[t],n.push(t))
for(;i=n.shift();)s.require(i)}loadPlugin(t){var i=this,s=i.plugins,n=e.plugins[t]
if(!e.plugins.hasOwnProperty(t))throw new Error('Unable to find "'+t+'" plugin')
s.requested[t]=!0,s.loaded[t]=n.fn.apply(i,[i.plugins.settings[t]||{}]),s.names.push(t)}require(e){var t=this,i=t.plugins
if(!t.plugins.loaded.hasOwnProperty(e)){if(i.requested[e])throw new Error('Plugin has circular dependency ("'+e+'")')
t.loadPlugin(e)}return i.loaded[e]}}}(t)){constructor(e,t){var i
super(),this.order=0,this.isOpen=!1,this.isDisabled=!1,this.isReadOnly=!1,this.isInvalid=!1,this.isValid=!0,this.isLocked=!1,this.isFocused=!1,this.isInputHidden=!1,this.isSetup=!1,this.isDropdownContentStale=!0,this.ignoreFocus=!1,this.ignoreHover=!1,this.hasOptions=!1,this.lastValue="",this.caretPos=0,this.loading=0,this.loadedSearches={},this.activeOption=null,this.activeItems=[],this.optgroups={},this.options={},this.userOptions={},this.items=[],this.refreshTimeout=null,ae++
var s=K(e)
if(s.tomselect)throw new Error("Tom Select already initialized on this element")
s.tomselect=this,i=(window.getComputedStyle&&window.getComputedStyle(s,null)).getPropertyValue("direction")
const n=le(s,t)
this.settings=n,this.input=s,this.tabIndex=s.tabIndex||0,this.is_select_tag="select"===s.tagName.toLowerCase(),this.rtl=/rtl/i.test(i),this.inputId=H(s,"tomselect-"+ae),this.isRequired=s.required,this.sifter=new T(this.options,{diacritics:n.diacritics}),n.mode=n.mode||(1===n.maxItems?"single":"multi"),"boolean"!=typeof n.hideSelected&&(n.hideSelected="multi"===n.mode),"boolean"!=typeof n.hidePlaceholder&&(n.hidePlaceholder="multi"!==n.mode)
var o=n.createFilter
"function"!=typeof o&&("string"==typeof o&&(o=new RegExp(o)),o instanceof RegExp?n.createFilter=e=>o.test(e):n.createFilter=e=>this.settings.duplicates||!this.options[e]),this.initializePlugins(n.plugins),this.setupCallbacks(),this.setupTemplates()
const r=K("<div>"),l=K("<div>"),a=this._render("dropdown"),c=K('<div role="listbox" tabindex="-1">'),d=this.input.getAttribute("class")||"",u=n.mode
var p
if(Q(r,n.wrapperClass,d,u),Q(l,n.controlClass),z(r,l),Q(a,n.dropdownClass,u),n.copyClassesToDropdown&&Q(a,d),Q(c,n.dropdownContentClass),z(a,c),K(n.dropdownParent||r).appendChild(a),G(n.controlInput)){p=K(n.controlInput)
B(["autocorrect","autocapitalize","autocomplete","spellcheck","aria-label"],e=>{s.getAttribute(e)&&ie(p,{[e]:s.getAttribute(e)})}),p.tabIndex=-1,l.appendChild(p),this.focus_node=p}else n.controlInput?(p=K(n.controlInput),this.focus_node=p):(p=K("<input/>"),this.focus_node=l)
this.wrapper=r,this.dropdown=a,this.dropdown_content=c,this.control=l,this.control_input=p,this.setup()}setup(){const e=this,t=e.settings,i=e.control_input,s=e.dropdown,n=e.dropdown_content,o=e.wrapper,l=e.control,a=e.input,c=e.focus_node,d={passive:!0},u=e.inputId+"-ts-dropdown"
ie(n,{id:u}),ie(c,{role:"combobox","aria-haspopup":"listbox","aria-expanded":"false","aria-controls":u})
const p=H(c,e.inputId+"-ts-control"),h="label[for='"+(e=>e.replace(/['"\\]/g,"\\$&"))(e.inputId)+"']",g=document.querySelector(h),f=e.focus.bind(e)
if(g){q(g,"click",f),ie(g,{for:p})
const t=H(g,e.inputId+"-ts-label")
ie(c,{"aria-labelledby":t}),ie(n,{"aria-labelledby":t})}if(o.style.width=a.style.width,o.style.minWidth=a.style.minWidth,o.style.maxWidth=a.style.maxWidth,e.plugins.names.length){const t="plugin-"+e.plugins.names.join(" plugin-")
Q([o,s],t)}(null===t.maxItems||t.maxItems>1)&&e.is_select_tag&&ie(a,{multiple:"multiple"}),t.placeholder&&ie(i,{placeholder:t.placeholder}),!t.splitOn&&t.delimiter&&(t.splitOn=new RegExp("\\s*"+r(t.delimiter)+"+\\s*")),t.load&&t.loadThrottle&&(t.load=V(t.load,t.loadThrottle)),q(s,"mousemove",()=>{e.ignoreHover=!1}),q(s,"mouseenter",t=>{var i=Z(t.target,"[data-selectable]",s)
i&&e.onOptionHover(t,i)},{capture:!0}),q(s,"click",t=>{const i=Z(t.target,"[data-selectable]")
i&&(e.onOptionSelect(t,i),$(t,!0))}),q(l,"click",t=>{var s=Z(t.target,"[data-ts-item]",l)
s&&e.onItemSelect(t,s)?$(t,!0):""==i.value&&(e.onClick(),$(t,!0))}),q(c,"keydown",t=>e.onKeyDown(t)),q(i,"keypress",t=>e.onKeyPress(t)),q(i,"input",t=>e.onInput(t)),q(c,"blur",t=>e.onBlur(t)),q(c,"focus",t=>e.onFocus(t)),q(i,"paste",t=>e.onPaste(t))
const m=t=>{const n=t.composedPath()[0]
if(!o.contains(n)&&!s.contains(n))return e.isFocused&&e.blur(),void e.inputState()
n==i&&e.isOpen?t.stopPropagation():$(t,!0)},v=()=>{e.isOpen&&e.positionDropdown()},O=()=>{e.isValid&&(e.isValid=!1,e.isInvalid=!0,e.refreshState())}
q(a,"invalid",O),q(document,"mousedown",m),q(window,"scroll",v,d),q(window,"resize",v,d),this._destroy=()=>{a.removeEventListener("invalid",O),document.removeEventListener("mousedown",m),window.removeEventListener("scroll",v),window.removeEventListener("resize",v),g&&g.removeEventListener("click",f)},this.revertSettings={innerHTML:a.innerHTML,tabIndex:a.tabIndex},a.tabIndex=-1,a.insertAdjacentElement("afterend",e.wrapper),e.sync(!1),t.items=[],delete t.optgroups,delete t.options,e.refreshItems(),e.close(!1),e.inputState(),e.isSetup=!0,e.on("change",this.onChange),Q(a,"tomselected","ts-hidden-accessible"),e.trigger("initialize"),!0===t.preload&&e.preload()}setupOptions(e=[],t=[]){this.addOptions(e),B(t,e=>{this.registerOptionGroup(e)})}setupTemplates(){var e=this,t=e.settings.labelField,i=e.settings.optgroupLabelField,s={optgroup:e=>{let t=document.createElement("div")
return t.className="optgroup",t.appendChild(e.options),t},optgroup_header:(e,t)=>'<div class="optgroup-header">'+t(e[i])+"</div>",option:(e,i)=>"<div>"+i(e[t])+"</div>",item:(e,i)=>"<div>"+i(e[t])+"</div>",option_create:(e,t)=>'<div class="create">Add <strong>'+t(e.input)+"</strong>&hellip;</div>",no_results:()=>'<div class="no-results">No results found</div>',loading:()=>'<div class="spinner"></div>',not_loading:()=>{},dropdown:()=>"<div></div>"}
e.settings.render=Object.assign({},s,e.settings.render)}setupCallbacks(){var e,t,i={initialize:"onInitialize",change:"onChange",item_add:"onItemAdd",item_remove:"onItemRemove",item_select:"onItemSelect",clear:"onClear",option_add:"onOptionAdd",option_remove:"onOptionRemove",option_clear:"onOptionClear",optgroup_add:"onOptionGroupAdd",optgroup_remove:"onOptionGroupRemove",optgroup_clear:"onOptionGroupClear",dropdown_open:"onDropdownOpen",dropdown_close:"onDropdownClose",type:"onType",load:"onLoad",focus:"onFocus",blur:"onBlur"}
for(e in i)(t=this.settings[i[e]])&&this.on(e,t)}sync(e=!0){const t=this,i=e?le(t.input,{delimiter:t.settings.delimiter,allowEmptyOption:t.settings.allowEmptyOption}):t.settings
t.setupOptions(i.options,i.optgroups),t.setValue(i.items||[],!0),t.input.disabled?t.disable():t.input.readOnly?t.setReadOnly(!0):t.enable(),t.lastQuery=null}onClick(){var e=this
if(e.activeItems.length>0)return e.clearActiveItems(),void e.focus()
e.isFocused&&e.isOpen?e.blur():e.focus()}onMouseDown(){}onChange(){U(this.input,"input"),U(this.input,"change")}onPaste(e){var t=this
t.isInputHidden||t.isLocked?$(e):t.settings.splitOn&&setTimeout(()=>{var e=t.inputValue()
if(e.match(t.settings.splitOn)){var i=e.trim().split(t.settings.splitOn)
B(i,e=>{P(e)&&(this.options[e]?t.addItem(e):t.createItem(e))})}},0)}onKeyPress(e){var t=this
if(!t.isLocked){var i=String.fromCharCode(e.keyCode||e.which)
return t.settings.create&&"multi"===t.settings.mode&&i===t.settings.delimiter?(t.createItem(),void $(e)):void 0}$(e)}onKeyDown(e){var t=this
if(t.ignoreHover=!0,t.isLocked)9!==e.keyCode&&$(e)
else{switch(e.keyCode){case 65:if(R(oe,e)&&""==t.control_input.value)return $(e),void t.selectAll()
break
case 27:return t.isOpen&&($(e,!0),t.close()),void t.clearActiveItems()
case 40:if(!t.isOpen&&t.hasOptions)t.open()
else if(t.activeOption){let e=t.getAdjacent(t.activeOption,1)
e&&t.setActiveOption(e)}return void $(e)
case 38:if(t.activeOption){let e=t.getAdjacent(t.activeOption,-1)
e&&t.setActiveOption(e)}return void $(e)
case 13:return void(t.canSelect(t.activeOption)?(t.onOptionSelect(e,t.activeOption),$(e)):(t.settings.create&&t.createItem()||document.activeElement==t.control_input&&t.isOpen)&&$(e))
case 37:return void t.advanceSelection(-1,e)
case 39:return void t.advanceSelection(1,e)
case 9:return void(t.settings.selectOnTab&&(t.canSelect(t.activeOption)?(t.onOptionSelect(e,t.activeOption),$(e)):t.settings.create&&t.createItem()&&$(e)))
case 8:case 46:return void t.deleteSelection(e)}t.isInputHidden&&!R(oe,e)&&$(e)}}onInput(e){if(this.isLocked)return
const t=this.inputValue()
this.lastValue!==t&&(this.lastValue=t,""!=t?(this.refreshTimeout&&window.clearTimeout(this.refreshTimeout),this.refreshTimeout=((e,t)=>t>0?window.setTimeout(e,t):(e.call(null),null))(()=>{this.refreshTimeout=null,this._onInput()},this.settings.refreshThrottle)):this._onInput())}_onInput(){const e=this.lastValue
this.settings.shouldLoad.call(this,e)&&this.load(e),this.refreshOptions(),this.trigger("type",e)}onOptionHover(e,t){this.ignoreHover||this.setActiveOption(t,!1)}onFocus(e){var t=this,i=t.isFocused
if(t.isDisabled||t.isReadOnly)return t.blur(),void $(e)
t.ignoreFocus||(t.isFocused=!0,"focus"===t.settings.preload&&t.preload(),i||t.trigger("focus"),t.activeItems.length||(t.inputState(),t.refreshOptions(!!t.settings.openOnFocus)),t.refreshState())}onBlur(e){if(!1!==document.hasFocus()){var t=this
if(t.isFocused){t.isFocused=!1,t.ignoreFocus=!1
var i=()=>{t.close(),t.setActiveItem(),t.setCaret(t.items.length),t.trigger("blur")}
t.settings.create&&t.settings.createOnBlur?t.createItem(null,i):i()}}}onOptionSelect(e,t){var i,s=this
t.parentElement&&t.parentElement.matches("[data-disabled]")||(t.classList.contains("create")?s.createItem(null,()=>{s.settings.closeAfterSelect?s.close():s.settings.clearAfterSelect&&s.setTextboxValue()}):void 0!==(i=t.dataset.value)&&(s.isDropdownContentStale=s.settings.hideSelected,s.addItem(i),s.settings.closeAfterSelect?s.close():s.settings.clearAfterSelect&&s.setTextboxValue(),!s.settings.hideSelected&&e.type&&/click/.test(e.type)&&s.setActiveOption(t)))}canSelect(e){return!!(this.isOpen&&e&&this.dropdown_content.contains(e))}onItemSelect(e,t){var i=this
return!i.isLocked&&"multi"===i.settings.mode&&($(e),i.setActiveItem(t,e),!0)}canLoad(e){return!!this.settings.load&&!this.loadedSearches.hasOwnProperty(e)}load(e){const t=this
if(!t.canLoad(e))return
Q(t.wrapper,t.settings.loadingClass),t.loading++
const i=t.loadCallback.bind(t)
t.settings.load.call(t,e,i)}loadCallback(e,t){const i=this
i.loading=Math.max(i.loading-1,0),i.isDropdownContentStale=!0,i.clearActiveOption(),i.setupOptions(e,t),i.refreshOptions(i.isFocused&&!i.isInputHidden),i.loading||J(i.wrapper,i.settings.loadingClass),i.trigger("load",e,t)}preload(){var e=this.wrapper.classList
e.contains("preloaded")||(e.add("preloaded"),this.load(""))}setTextboxValue(e=""){var t=this.control_input
t.value!==e&&(t.value=e,U(t,"update"),this.lastValue=e)}getValue(){return this.is_select_tag&&this.input.hasAttribute("multiple")?this.items:this.items.join(this.settings.delimiter)}setValue(e,t){j(this,t?[]:["change"],()=>{this.clear(t),this.addItems(e,t)})}setMaxItems(e){0===e&&(e=null),this.settings.maxItems=e,this.refreshState()}setActiveItem(e,t){var i,s,n,o,r,l,a=this
if("single"!==a.settings.mode){if(!e)return a.clearActiveItems(),void(a.isFocused&&a.inputState())
if("click"===(i=t&&t.type.toLowerCase())&&R("shiftKey",t)&&a.activeItems.length){for(l=a.getLastActive(),(n=Array.prototype.indexOf.call(a.control.children,l))>(o=Array.prototype.indexOf.call(a.control.children,e))&&(r=n,n=o,o=r),s=n;s<=o;s++)e=a.control.children[s],-1===a.activeItems.indexOf(e)&&a.setActiveItemClass(e)
$(t)}else"click"===i&&R(oe,t)||"keydown"===i&&R("shiftKey",t)?e.classList.contains("active")?a.removeActiveItem(e):a.setActiveItemClass(e):(a.clearActiveItems(),a.setActiveItemClass(e))
a.inputState(),a.isFocused||a.focus()}}setActiveItemClass(e){const t=this,i=t.control.querySelector(".last-active")
i&&J(i,"last-active"),Q(e,"active last-active"),t.trigger("item_select",e),-1==t.activeItems.indexOf(e)&&t.activeItems.push(e)}removeActiveItem(e){var t=this.activeItems.indexOf(e)
this.activeItems.splice(t,1),J(e,"active")}clearActiveItems(){J(this.activeItems,"active"),this.activeItems=[]}setActiveOption(e,t=!0){e!==this.activeOption&&(this.clearActiveOption(),e&&(this.activeOption=e,ie(this.focus_node,{"aria-activedescendant":e.getAttribute("id")}),ie(e,{"aria-selected":"true"}),Q(e,"active"),t&&this.scrollToOption(e)))}scrollToOption(e,t){if(!e)return
const i=this.dropdown_content,s=i.clientHeight,n=i.scrollTop||0,o=e.offsetHeight,r=e.getBoundingClientRect().top-i.getBoundingClientRect().top+n
r+o>s+n?this.scroll(r-s+o,t):r<n&&this.scroll(r,t)}scroll(e,t){const i=this.dropdown_content
t&&(i.style.scrollBehavior=t),i.scrollTop=e,i.style.scrollBehavior=""}clearActiveOption(){this.activeOption&&(J(this.activeOption,"active"),ie(this.activeOption,{"aria-selected":null})),this.activeOption=null,ie(this.focus_node,{"aria-activedescendant":null})}selectAll(){const e=this
if("single"===e.settings.mode)return
const t=e.controlChildren()
t.length&&(e.inputState(),e.close(),e.activeItems=t,B(t,t=>{e.setActiveItemClass(t)}))}inputState(){var e=this
e.control.contains(e.control_input)&&(ie(e.control_input,{placeholder:e.settings.placeholder}),e.activeItems.length>0||!e.isFocused&&e.settings.hidePlaceholder&&e.items.length>0?(e.setTextboxValue(),e.isInputHidden=!0):(e.settings.hidePlaceholder&&e.items.length>0&&ie(e.control_input,{placeholder:""}),e.isInputHidden=!1),e.wrapper.classList.toggle("input-hidden",e.isInputHidden))}inputValue(){return this.control_input.value.trim()}focus(){var e=this
if(e.isDisabled||e.isReadOnly)return
e.ignoreFocus=!0
const t=this.control_input.offsetWidth?this.control_input:this.focus_node
t.focus(),setTimeout(()=>{e.ignoreFocus=!1
t.getRootNode().activeElement===t&&this.onFocus()},0)}blur(){this.focus_node.blur(),this.onBlur()}getScoreFunction(e){return this.sifter.getScoreFunction(e,this.getSearchOptions())}getSearchOptions(){var e=this.settings,t=e.sortField
return"string"==typeof e.sortField&&(t=[{field:e.sortField}]),{fields:e.searchField,conjunction:e.searchConjunction,sort:t,nesting:e.nesting}}search(e){var t,i,s=this,n=this.getSearchOptions()
if(s.settings.score&&"function"!=typeof(i=s.settings.score.call(s,e)))throw new Error('Tom Select "score" setting must be a function that returns a function')
return s.isDropdownContentStale||e!==s.lastQuery?(s.lastQuery=e,/(.)\1{15,}/.test(e)&&(e=""),t=s.sifter.search(e,Object.assign(n,{score:i})),s.currentResults=t):t=Object.assign({},s.currentResults),s.settings.hideSelected&&(t.items=t.items.filter(e=>{let t=P(e.id)
return!(null!==t&&-1!==s.items.indexOf(t))})),t}refreshOptions(e=!0){var t,i,s,n,o,r,l,a,c,d
const u={},p=[]
var h=this,g=h.inputValue()
const f=g===h.lastQuery||""==g&&null==h.lastQuery
var m=h.search(g),v=null,O=h.settings.shouldOpen||!1,b=h.dropdown_content
f&&(v=h.activeOption)&&(c=v.closest("[data-group]")),n=m.items.length,"number"==typeof h.settings.maxOptions&&(n=Math.min(n,h.settings.maxOptions)),n>0&&(O=!0)
const y=(e,t)=>{let i=u[e]
if(void 0!==i){let e=p[i]
if(void 0!==e)return[i,e.fragment]}let s=document.createDocumentFragment()
return i=p.length,p.push({fragment:s,order:t,optgroup:e}),[i,s]}
for(t=0;t<n;t++){let e=m.items[t]
if(!e)continue
let n=e.id,l=h.options[n]
if(void 0===l)continue
let a=N(n),d=h.getOption(a,!0)
for(h.settings.hideSelected||d.classList.toggle("selected",h.items.includes(a)),o=l[h.settings.optgroupField]||"",i=0,s=(r=Array.isArray(o)?o:[o])&&r.length;i<s;i++){o=r[i]
let e=l.$order,t=h.optgroups[o]
var w
if(void 0===t&&"function"==typeof h.settings.optionGroupRegister)(w=h.settings.optionGroupRegister.apply(h,[o]))&&h.registerOptionGroup(w)
t=h.optgroups[o],void 0===t?o="":e=t.$order
const[s,a]=y(o,e)
i>0&&(d=d.cloneNode(!0),ie(d,{id:l.$id+"-clone-"+i,"aria-selected":null}),d.classList.add("ts-cloned"),J(d,"active"),h.activeOption&&h.activeOption.dataset.value==n&&c&&c.dataset.group===o.toString()&&(v=d)),a.appendChild(d),""!=o&&(u[o]=s)}}var S
h.settings.lockOptgroupOrder&&p.sort((e,t)=>e.order-t.order),l=document.createDocumentFragment(),B(p,e=>{let t=e.fragment,i=e.optgroup
if(!t||!t.children.length)return
let s=h.optgroups[i]
if(void 0!==s){let e=document.createDocumentFragment(),i=h.render("optgroup_header",s)
z(e,i),z(e,t)
let n=h.render("optgroup",{group:s,options:e})
z(l,n)}else z(l,t)}),b.innerHTML="",z(b,l),h.isDropdownContentStale=!1,h.settings.highlight&&(S=b.querySelectorAll("span.highlight"),Array.prototype.forEach.call(S,function(e){var t=e.parentNode
t.replaceChild(e.firstChild,e),t.normalize()}),m.query.length&&m.tokens.length&&B(m.tokens,e=>{ne(b,e.regex)}))
var _=e=>{let t=h.render(e,{input:g})
return t&&(O=!0,b.insertBefore(t,b.firstChild)),t}
if(h.loading?_("loading"):h.settings.shouldLoad.call(h,g)?0===m.items.length&&_("no_results"):_("not_loading"),(a=h.canCreate(g))&&(d=_("option_create")),h.hasOptions=m.items.length>0||a,O){if(m.items.length>0){if(v||"single"!==h.settings.mode||null==h.items[0]||(v=h.getOption(h.items[0])),!b.contains(v)){let e=0
d&&!h.settings.addPrecedence&&(e=1),v=h.selectable()[e]}}else d&&(v=d)
e&&!h.isOpen&&(h.open(),h.scrollToOption(v,"auto")),h.setActiveOption(v)}else h.clearActiveOption(),e&&h.isOpen&&h.close(!1)}selectable(){return this.dropdown_content.querySelectorAll("[data-selectable]")}addOption(e,t=!1){const i=this
if(Array.isArray(e))return i.addOptions(e,t),!1
const s=P(e[i.settings.valueField])
return null===s||i.options.hasOwnProperty(s)?(i.updateOption(e[i.settings.valueField],e),!1):(e.$order=e.$order||++i.order,e.$id=i.inputId+"-opt-"+e.$order,i.options[s]=e,i.isDropdownContentStale=!0,t&&(i.userOptions[s]=t,i.trigger("option_add",s,e)),s)}addOptions(e,t=!1){B(e,e=>{this.addOption(e,t)})}registerOption(e){return this.addOption(e)}registerOptionGroup(e){var t=P(e[this.settings.optgroupValueField])
return null!==t&&(e.$order=e.$order||++this.order,this.optgroups[t]=e,t)}addOptionGroup(e,t){var i
t[this.settings.optgroupValueField]=e,(i=this.registerOptionGroup(t))&&this.trigger("optgroup_add",i,t)}removeOptionGroup(e){this.optgroups.hasOwnProperty(e)&&(delete this.optgroups[e],this.clearCache(),this.trigger("optgroup_remove",e))}clearOptionGroups(){this.optgroups={},this.clearCache(),this.trigger("optgroup_clear")}updateOption(e,t){const i=this
var s,n
const o=P(e),r=P(t[i.settings.valueField])
if(null===o)return
const l=i.options[o]
if(null==l)return
if("string"!=typeof r)throw new Error("Value must be set in option data")
const a=i.getOption(o),c=i.getItem(o)
if(t.$order=t.$order||l.$order,delete i.options[o],i.uncacheValue(r),i.options[r]=t,a){if(i.dropdown_content.contains(a)){const e=i._render("option",t)
se(a,e),i.activeOption===a&&i.setActiveOption(e)}a.remove()}c&&(-1!==(n=i.items.indexOf(o))&&i.items.splice(n,1,r),s=i._render("item",t),c.classList.contains("active")&&Q(s,"active"),se(c,s)),i.isDropdownContentStale=!0}removeOption(e,t){const i=this
e=N(e),i.uncacheValue(e),delete i.userOptions[e],delete i.options[e],i.isDropdownContentStale=!0,i.trigger("option_remove",e),i.removeItem(e,t)}clearOptions(e){const t=(e||this.clearFilter).bind(this)
this.loadedSearches={},this.userOptions={},this.clearCache()
const i={}
B(this.options,(e,s)=>{t(e,s)&&(i[s]=e)}),this.options=this.sifter.items=i,this.isDropdownContentStale=!0,this.trigger("option_clear")}clearFilter(e,t){return this.items.indexOf(t)>=0}getOption(e,t=!1){const i=P(e)
if(null===i)return null
const s=this.options[i]
if(null!=s){if(s.$div)return s.$div
if(t)return this._render("option",s)}return null}getAdjacent(e,t,i="option"){var s
if(!e)return null
s="item"==i?this.controlChildren():this.dropdown_content.querySelectorAll("[data-selectable]")
for(let i=0;i<s.length;i++)if(s[i]==e)return t>0?s[i+1]:s[i-1]
return null}getItem(e){if("object"==typeof e)return e
var t=P(e)
return null!==t?this.control.querySelector(`[data-value="${M(t)}"]`):null}addItems(e,t){var i=this,s=Array.isArray(e)?e:[e]
const n=(s=s.filter(e=>-1===i.items.indexOf(e)))[s.length-1]
s.forEach(e=>{i.isPending=e!==n,i.addItem(e,t)})}addItem(e,t){j(this,t?[]:["change","dropdown_close"],()=>{var i,s
const n=this,o=n.settings.mode,r=P(e)
if((!r||-1===n.items.indexOf(r)||("single"===o&&n.close(),"single"!==o&&n.settings.duplicates))&&null!==r&&n.options.hasOwnProperty(r)&&("single"===o&&n.clear(t),"multi"!==o||!n.isFull())){if(i=n._render("item",n.options[r]),n.control.contains(i)&&(i=i.cloneNode(!0)),s=n.isFull(),n.items.splice(n.caretPos,0,r),n.insertAtCaret(i),n.isSetup){if(!n.isPending&&n.settings.hideSelected){let e=n.getOption(r),t=n.getAdjacent(e,1)
t&&n.setActiveOption(t)}n.settings.clearAfterSelect&&n.setTextboxValue(),n.isPending||n.settings.closeAfterSelect||n.refreshOptions(n.isFocused&&"single"!==o),0!=n.settings.closeAfterSelect&&n.isFull()?n.close():n.isPending||n.positionDropdown(),n.trigger("item_add",r,i),n.isPending||n.updateOriginalInput({silent:t})}(!n.isPending||!s&&n.isFull())&&(n.inputState(),n.refreshState())}})}removeItem(e=null,t){const i=this
if(!(e=i.getItem(e)))return
var s,n
const o=e.dataset.value
s=te(e),e.remove(),e.classList.contains("active")&&(n=i.activeItems.indexOf(e),i.activeItems.splice(n,1),J(e,"active")),i.items.splice(s,1),i.isDropdownContentStale=!0,!i.settings.persist&&i.userOptions.hasOwnProperty(o)&&i.removeOption(o,t),s<i.caretPos&&i.setCaret(i.caretPos-1),i.updateOriginalInput({silent:t}),i.refreshState(),i.positionDropdown(),i.trigger("item_remove",o,e)}createItem(e=null,t=()=>{}){3===arguments.length&&(t=arguments[2]),"function"!=typeof t&&(t=()=>{})
var i,s=this,n=s.caretPos
if(e=e||s.inputValue(),!s.canCreate(e)){return P(e)&&this.options[e]&&s.addItem(e),t(),!1}s.lock()
var o=!1,r=e=>{if(s.unlock(),!e||"object"!=typeof e)return t()
var i=P(e[s.settings.valueField])
if("string"!=typeof i)return t()
s.setTextboxValue(),s.addOption(e,!0),s.setCaret(n),s.addItem(i),t(e),o=!0}
return i="function"==typeof s.settings.create?s.settings.create.call(this,e,r):{[s.settings.labelField]:e,[s.settings.valueField]:e},o||r(i),!0}refreshItems(){var e=this
e.isDropdownContentStale=!0,e.isSetup&&e.addItems(e.items),e.updateOriginalInput(),e.refreshState()}refreshState(){const e=this
e.refreshValidityState()
const t=e.isFull(),i=e.isLocked
e.wrapper.classList.toggle("rtl",e.rtl)
const s=e.wrapper.classList
var n
s.toggle("focus",e.isFocused),s.toggle("disabled",e.isDisabled),s.toggle("readonly",e.isReadOnly),s.toggle("required",e.isRequired),s.toggle("invalid",!e.isValid),s.toggle("locked",i),s.toggle("full",t),s.toggle("input-active",e.isFocused&&!e.isInputHidden),s.toggle("dropdown-active",e.isOpen),s.toggle("has-options",(n=e.options,0===Object.keys(n).length)),s.toggle("has-items",e.items.length>0)}refreshValidityState(){var e=this
e.input.validity&&(e.isValid=e.input.validity.valid,e.isInvalid=!e.isValid)}isFull(){return null!==this.settings.maxItems&&this.items.length>=this.settings.maxItems}updateOriginalInput(e={}){const t=this
var i,s
const n=t.input.querySelector('option[value=""]')
if(t.is_select_tag){const o=[],r=t.input.querySelectorAll("option:checked").length
function l(e,i,s){return e||(e=K('<option value="'+D(i)+'">'+D(s)+"</option>")),e!=n&&t.input.append(e),o.push(e),(e!=n||r>0||"multi"==t.settings.mode)&&(e.selected=!0),e}t.input.querySelectorAll("option:checked").forEach(e=>{e.selected=!1}),0==t.items.length&&"single"==t.settings.mode?l(n,"",""):t.items.forEach(e=>{if(i=t.options[e],s=i[t.settings.labelField]||"",o.includes(i.$option)){l(t.input.querySelector(`option[value="${M(e)}"]:not(:checked)`),e,s)}else i.$option=l(i.$option,e,s)})}else t.input.value=t.getValue()
t.isSetup&&(e.silent||t.trigger("change",t.getValue()))}open(){var e=this
e.isLocked||e.isOpen||"multi"===e.settings.mode&&e.isFull()||(e.isOpen=!0,ie(e.focus_node,{"aria-expanded":"true"}),e.refreshState(),W(e.dropdown,{visibility:"hidden",display:"block"}),e.positionDropdown(),W(e.dropdown,{visibility:"visible",display:"block"}),e.focus(),e.trigger("dropdown_open",e.dropdown))}close(e=!0){var t=this,i=t.isOpen
e&&(t.setTextboxValue(),"single"===t.settings.mode&&t.items.length&&t.inputState()),t.isOpen=!1,ie(t.focus_node,{"aria-expanded":"false"}),W(t.dropdown,{display:"none"}),t.settings.hideSelected&&t.clearActiveOption(),t.refreshState(),i&&t.trigger("dropdown_close",t.dropdown)}positionDropdown(){if("body"===this.settings.dropdownParent){var e=this.control,t=e.getBoundingClientRect(),i=e.offsetHeight+t.top+window.scrollY,s=t.left+window.scrollX
W(this.dropdown,{width:t.width+"px",top:i+"px",left:s+"px"})}}clear(e){var t=this
if(t.items.length){var i=t.controlChildren()
B(i,e=>{t.removeItem(e,!0)}),t.inputState(),e||t.updateOriginalInput(),t.trigger("clear")}}insertAtCaret(e){const t=this,i=t.caretPos,s=t.control
s.insertBefore(e,s.children[i]||null),t.setCaret(i+1)}deleteSelection(e){var t,i,s,n,o,r=this
t=e&&8===e.keyCode?-1:1,i={start:(o=r.control_input).selectionStart||0,length:(o.selectionEnd||0)-(o.selectionStart||0)}
const l=[]
if(r.activeItems.length)n=ee(r.activeItems,t),s=te(n),t>0&&s++,B(r.activeItems,e=>l.push(e))
else if((r.isFocused||"single"===r.settings.mode)&&r.items.length){const e=r.controlChildren()
let s
t<0&&0===i.start&&0===i.length?s=e[r.caretPos-1]:t>0&&i.start===r.inputValue().length&&(s=e[r.caretPos]),void 0!==s&&l.push(s)}if(!r.shouldDelete(l,e))return!1
for($(e,!0),void 0!==s&&r.setCaret(s);l.length;)r.removeItem(l.pop())
return r.inputState(),r.positionDropdown(),r.refreshOptions(!1),!0}shouldDelete(e,t){const i=e.map(e=>e.dataset.value)
return!(!i.length||"function"==typeof this.settings.onDelete&&!1===this.settings.onDelete.call(this,i,t))}advanceSelection(e,t){var i,s,n=this
n.rtl&&(e*=-1),n.inputValue().length||(R(oe,t)||R("shiftKey",t)?(s=(i=n.getLastActive(e))?i.classList.contains("active")?n.getAdjacent(i,e,"item"):i:e>0?n.control_input.nextElementSibling:n.control_input.previousElementSibling)&&(s.classList.contains("active")&&n.removeActiveItem(i),n.setActiveItemClass(s)):n.moveCaret(e))}moveCaret(e){}getLastActive(e){let t=this.control.querySelector(".last-active")
if(t)return t
var i=this.control.querySelectorAll(".active")
return i?ee(i,e):void 0}setCaret(e){this.caretPos=this.items.length}controlChildren(){return Array.from(this.control.querySelectorAll("[data-ts-item]"))}lock(){this.setLocked(!0)}unlock(){this.setLocked(!1)}setLocked(e=this.isReadOnly||this.isDisabled){this.isLocked=e,this.refreshState()}disable(){this.setDisabled(!0),this.close()}enable(){this.setDisabled(!1)}setDisabled(e){this.focus_node.tabIndex=e?-1:this.tabIndex,this.isDisabled=e,this.input.disabled=e,this.control_input.disabled=e,this.setLocked()}setReadOnly(e){this.isReadOnly=e,this.input.readOnly=e,this.control_input.readOnly=e,this.setLocked()}destroy(){var e=this,t=e.revertSettings
e.trigger("destroy"),e.off(),e.wrapper.remove(),e.dropdown.remove(),e.input.innerHTML=t.innerHTML,e.input.tabIndex=t.tabIndex,J(e.input,"tomselected","ts-hidden-accessible"),e._destroy(),delete e.input.tomselect}render(e,t){var i,s
const n=this
if("function"!=typeof this.settings.render[e])return null
if(!(s=n.settings.render[e].call(this,t,D)))return null
if(s=K(s),"option"===e||"option_create"===e?t[n.settings.disabledField]?ie(s,{"aria-disabled":"true"}):ie(s,{"data-selectable":""}):"optgroup"===e&&(i=t.group[n.settings.optgroupValueField],ie(s,{"data-group":i}),t.group[n.settings.disabledField]&&ie(s,{"data-disabled":""})),"option"===e||"item"===e){const i=N(t[n.settings.valueField])
ie(s,{"data-value":i}),"item"===e?(Q(s,n.settings.itemClass),ie(s,{"data-ts-item":""})):(Q(s,n.settings.optionClass),ie(s,{role:"option",id:t.$id}),t.$div=s,n.options[i]=t)}return s}_render(e,t){const i=this.render(e,t)
if(null==i)throw"HTMLElement expected"
return i}clearCache(){B(this.options,e=>{e.$div&&(e.$div.remove(),delete e.$div)})}uncacheValue(e){const t=this.getOption(e)
t&&t.remove()}canCreate(e){return this.settings.create&&e.length>0&&this.settings.createFilter.call(this,e)}hook(e,t,i){var s=this,n=s[t]
s[t]=function(){var t,o
return"after"===e&&(t=n.apply(s,arguments)),o=i.apply(s,arguments),"instead"===e?o:("before"===e&&(t=n.apply(s,arguments)),t)}}}return ce.define("change_listener",function(){q(this.input,"change",()=>{this.sync()})}),ce.define("checkbox_options",function(e){var t=this,i=t.onOptionSelect
t.settings.hideSelected=!1
const s=Object.assign({className:"tomselect-checkbox",checkedClassNames:void 0,uncheckedClassNames:void 0},e)
var n=function(e,t){t?(e.checked=!0,s.uncheckedClassNames&&e.classList.remove(...s.uncheckedClassNames),s.checkedClassNames&&e.classList.add(...s.checkedClassNames)):(e.checked=!1,s.checkedClassNames&&e.classList.remove(...s.checkedClassNames),s.uncheckedClassNames&&e.classList.add(...s.uncheckedClassNames))},o=function(e){setTimeout(()=>{var t=e.querySelector("input."+s.className)
t instanceof HTMLInputElement&&n(t,e.classList.contains("selected"))},1)}
t.hook("after","setupTemplates",()=>{var e=t.settings.render.option
t.settings.render.option=(i,o)=>{var r=K(e.call(t,i,o)),l=document.createElement("input")
s.className&&l.classList.add(s.className),l.addEventListener("click",function(e){$(e)}),l.type="checkbox"
const a=P(i[t.settings.valueField])
return n(l,!!(a&&t.items.indexOf(a)>-1)),r.prepend(l),r}}),t.on("item_remove",e=>{var i=t.getOption(e)
i&&(i.classList.remove("selected"),o(i))}),t.on("item_add",e=>{var i=t.getOption(e)
i&&o(i)}),t.hook("instead","onOptionSelect",(e,s)=>{if(s.classList.contains("selected"))return s.classList.remove("selected"),t.removeItem(s.dataset.value),t.refreshOptions(),void $(e,!0)
i.call(t,e,s),o(s)})}),ce.define("clear_button",function(e){const t=this,i=Object.assign({className:"clear-button",title:"Clear All",role:"button",tabindex:0,html:e=>`<div class="${e.className}" title="${e.title}" role="${e.role}" tabindex="${e.tabindex}">&times;</div>`},e)
t.on("initialize",()=>{var e=K(i.html(i))
e.addEventListener("click",e=>{t.isLocked||(t.clear(),"single"===t.settings.mode&&t.settings.allowEmptyOption&&t.addItem(""),t.refreshOptions(!1),e.preventDefault(),e.stopPropagation())}),t.control.appendChild(e)})}),ce.define("drag_drop",function(){var e=this
if("multi"!==e.settings.mode)return
var t=e.lock,i=e.unlock
let s,n=!0
e.hook("after","setupTemplates",()=>{var t=e.settings.render.item
e.settings.render.item=(i,o)=>{const r=K(t.call(e,i,o))
ie(r,{draggable:"true"})
const l=e=>{e.preventDefault(),r.classList.add("ts-drag-over"),a(r,s)},a=(e,t)=>{var i,s,n
void 0!==t&&(((e,t)=>{do{var i
if(e==(t=null==(i=t)?void 0:i.previousElementSibling))return!0}while(t&&t.previousElementSibling)
return!1})(t,r)?(s=t,null==(n=(i=e).parentNode)||n.insertBefore(s,i.nextSibling)):((e,t)=>{var i
null==(i=e.parentNode)||i.insertBefore(t,e)})(e,t))}
return q(r,"mousedown",e=>{n||$(e),e.stopPropagation()}),q(r,"dragstart",e=>{s=r,setTimeout(()=>{r.classList.add("ts-dragging")},0)}),q(r,"dragenter",l),q(r,"dragover",l),q(r,"dragleave",()=>{r.classList.remove("ts-drag-over")}),q(r,"dragend",()=>{var t
document.querySelectorAll(".ts-drag-over").forEach(e=>e.classList.remove("ts-drag-over")),null==(t=s)||t.classList.remove("ts-dragging"),s=void 0
var i=[]
e.control.querySelectorAll("[data-value]").forEach(e=>{if(e.dataset.value){let t=e.dataset.value
t&&i.push(t)}}),e.setValue(i)}),r}}),e.hook("instead","lock",()=>(n=!1,t.call(e))),e.hook("instead","unlock",()=>(n=!0,i.call(e)))}),ce.define("dropdown_header",function(e){const t=this,i=Object.assign({title:"Untitled",headerClass:"dropdown-header",titleRowClass:"dropdown-header-title",labelClass:"dropdown-header-label",closeClass:"dropdown-header-close",html:e=>'<div class="'+e.headerClass+'"><div class="'+e.titleRowClass+'"><span class="'+e.labelClass+'">'+e.title+'</span><a class="'+e.closeClass+'">&times;</a></div></div>'},e)
t.on("initialize",()=>{var e=K(i.html(i)),s=e.querySelector("."+i.closeClass)
s&&s.addEventListener("click",e=>{$(e,!0),t.close()}),t.dropdown.insertBefore(e,t.dropdown.firstChild)})}),ce.define("caret_position",function(){var e=this
e.hook("instead","setCaret",t=>{"single"!==e.settings.mode&&e.control.contains(e.control_input)?(t=Math.max(0,Math.min(e.items.length,t)))==e.caretPos||e.isPending||e.controlChildren().forEach((i,s)=>{s<t?e.control_input.insertAdjacentElement("beforebegin",i):e.control.appendChild(i)}):t=e.items.length,e.caretPos=t}),e.hook("instead","moveCaret",t=>{if(!e.isFocused)return
const i=e.getLastActive(t)
if(i){const s=te(i)
e.setCaret(t>0?s+1:s),e.setActiveItem(),J(i,"last-active")}else e.setCaret(e.caretPos+t)})}),ce.define("dropdown_input",function(){const e=this
e.settings.shouldOpen=!0,e.hook("before","setup",()=>{var t
e.focus_node=e.control,Q(e.control_input,"dropdown-input")
const i=K('<div class="dropdown-input-wrap">')
i.append(e.control_input),e.dropdown.insertBefore(i,e.dropdown.firstChild)
const s=K('<input class="items-placeholder" tabindex="-1" />')
s.placeholder=e.settings.placeholder||"",e.control.append(s)
const n=null==(t=e.input)?void 0:t.getAttribute("aria-label")
n&&s.setAttribute("aria-label",n)}),e.on("initialize",()=>{e.control_input.addEventListener("keydown",t=>{switch(t.keyCode){case 27:return e.isOpen&&($(t,!0),e.close()),void e.clearActiveItems()
case 9:e.focus_node.tabIndex=-1}return e.onKeyDown.call(e,t)}),e.on("blur",()=>{e.focus_node.tabIndex=e.isDisabled?-1:e.tabIndex}),e.on("dropdown_open",()=>{e.control_input.focus()})
const t=e.onBlur
e.hook("instead","onBlur",i=>{if(!i||i.relatedTarget!=e.control_input)return t.call(e)}),q(e.control_input,"blur",()=>e.onBlur()),e.hook("before","close",()=>{e.isOpen&&e.focus_node.focus({preventScroll:!0})})})}),ce.define("input_autogrow",function(){var e=this
e.on("initialize",()=>{var t=document.createElement("span"),i=e.control_input
t.style.cssText="position:absolute; top:-99999px; left:-99999px; width:auto; padding:0; white-space:pre; ",e.wrapper.appendChild(t)
for(const e of["letterSpacing","fontSize","fontFamily","fontWeight","textTransform"])t.style[e]=i.style[e]
var s=()=>{t.textContent=i.value,i.style.width=t.clientWidth+"px"}
s(),e.on("update item_add item_remove",s),q(i,"input",s),q(i,"keyup",s),q(i,"blur",s),q(i,"update",s)})}),ce.define("no_backspace_delete",function(){var e=this,t=e.deleteSelection
this.hook("instead","deleteSelection",i=>!!e.activeItems.length&&t.call(e,i))}),ce.define("no_active_items",function(){this.hook("instead","setActiveItem",()=>{}),this.hook("instead","selectAll",()=>{})}),ce.define("optgroup_columns",function(){var e=this,t=e.onKeyDown
e.hook("instead","onKeyDown",i=>{var s,n,o,r
if(!e.isOpen||37!==i.keyCode&&39!==i.keyCode)return t.call(e,i)
e.ignoreHover=!0,r=Z(e.activeOption,"[data-group]"),s=te(e.activeOption,"[data-selectable]"),r&&(r=37===i.keyCode?r.previousSibling:r.nextSibling)&&(n=(o=r.querySelectorAll("[data-selectable]"))[Math.min(o.length-1,s)])&&e.setActiveOption(n)})}),ce.define("remove_button",function(e){const t=this,i=Object.assign({label:"×",title:"Remove",className:"remove",tabindex:-1,role:"button",html:e=>{var t
const i=document.createElement("div")
return i.className=e.className||"",i.title=e.title||"",i.setAttribute("role",e.role||"button"),i.tabIndex=null!=(t=e.tabindex)?t:-1,i.textContent=e.label||"",i}},e)
t.hook("after","setupTemplates",()=>{var e=t.settings.render.item
t.settings.render.item=(s,n)=>{var o=K(e.call(t,s,n)),r=K(i.html(i))
return o.appendChild(r),q(r,"mousedown",e=>{$(e,!0)}),q(r,"click",e=>{t.isLocked||($(e,!0),t.isLocked||t.shouldDelete([o],e)&&(t.removeItem(o),t.refreshOptions(!1),t.inputState()))}),o}})}),ce.define("restore_on_backspace",function(e){const t=this,i=Object.assign({text:e=>e[t.settings.labelField]},e)
t.on("item_remove",function(e){if(t.isFocused&&""===t.control_input.value.trim()){var s=t.options[e]
s&&t.setTextboxValue(i.text.call(t,s))}})}),ce.define("virtual_scroll",function(){const e=this,t=e.canLoad,i=e.clearActiveOption,s=e.loadCallback
var n,o,r,l={},a=!1,c=[],d=!1,u=[],p=[]
if(e.settings.shouldLoadMore||(e.settings.shouldLoadMore=()=>{if(n.clientHeight/(n.scrollHeight-n.scrollTop)>.9)return!0
if(e.activeOption){var t=e.selectable()
if(Array.from(t).indexOf(e.activeOption)>=t.length-2)return!0}return!1}),!e.settings.firstUrl)throw"virtual_scroll plugin requires a firstUrl() method"
e.settings.sortField=[{field:"$order"},{field:"$score"}]
const h=t=>!(null!==e.settings.maxOptions&&"number"==typeof e.settings.maxOptions&&n.children.length>=e.settings.maxOptions)&&!(!(t in l)||!l[t]),g=(t,i)=>e.items.indexOf(i)>=0||c.indexOf(i)>=0
e.setNextUrl=(e,t)=>{l[e]=t},e.getUrl=t=>{if(t in l){const e=l[t]
return l[t]=!1,e}return e.clearPagination(),e.settings.firstUrl.call(e,t)},e.clearPagination=()=>{l={}},e.hook("instead","clearActiveOption",()=>{if(!a)return i.call(e)}),e.hook("instead","canLoad",i=>i in l?h(i):t.call(e,i)),e.hook("instead","loadCallback",(t,i)=>{if(a){if(o){const i=t[0]
void 0!==i&&(o.dataset.value=i[e.settings.valueField])}}else{const t=""!==e.lastValue?(t,i)=>e.items.indexOf(i)>=0||p.indexOf(i)>=0:g
e.clearOptions(t)}s.call(e,t,i),a||d||(d=!0,""===e.lastValue&&(c=Object.keys(e.options),r=l[""],u=Object.values(e.options))),a=!1}),e.hook("before","refreshOptions",()=>{e.activeOption&&"option"!==e.activeOption.getAttribute("role")&&e.setActiveOption(e.activeOption.previousElementSibling)}),e.hook("after","refreshOptions",()=>{const t=e.lastValue
var i
h(t)?(i=e.render("loading_more",{query:t}))&&(i.setAttribute("data-selectable",""),o=i):t in l&&!n.querySelector(".no-results")&&(i=e.render("no_more_results",{query:t})),i&&(Q(i,e.settings.optionClass),n.append(i))})
const f=()=>{d&&(e.addOptions(u),e.clearOptions(g),r&&(l[""]=r))}
e.on("type",t=>{""===t&&(f(),e.refreshOptions(!1))}),e.on("dropdown_close",f),e.on("initialize",()=>{p=Object.keys(e.options),c=Object.keys(e.options),n=e.dropdown_content,e.settings.render=Object.assign({},{loading_more:()=>'<div class="loading-more-results">Loading more results ... </div>',no_more_results:()=>'<div class="no-more-results">No more results</div>'},e.settings.render),n.addEventListener("scroll",()=>{e.settings.shouldLoadMore.call(e)&&h(e.lastValue)&&(a||(a=!0,e.load.call(e,e.lastValue)))})})}),ce})
var tomSelect=function(e,t){return new TomSelect(e,t)}
//# sourceMappingURL=tom-select.complete.min.js.map

const TomSelect = module.exports;
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

})();
(() => {
const FilePond = (function () { const module = { exports: {} }; const exports = module.exports; /*!
 * FilePond 4.32.12
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e=e||self).FilePond={})}(this,function(e){"use strict";var t=function(e,t){for(var n in e)e.hasOwnProperty(n)&&t(n,e[n])},n=function(e){var n={};return t(e,function(t){!function(e,t,n){"function"!=typeof n?Object.defineProperty(e,t,Object.assign({},n)):e[t]=n}(n,t,e[t])}),n},r=function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null;if(null===n)return e.getAttribute(t)||e.hasAttribute(t);e.setAttribute(t,n)},o=["svg","path"],i=function(e){return o.includes(e)},a=function(e,n){var o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};"object"==typeof n&&(o=n,n=null);var a=i(e)?document.createElementNS("http://www.w3.org/2000/svg",e):document.createElement(e);return n&&(i(e)?r(a,"class",n):a.className=n),t(o,function(e,t){r(a,e,t)}),a},s=function(e,t){return function(e,n){return void 0!==n?t.splice(n,0,e):t.push(e),e}},u=function(e,t){return function(n){return t.splice(t.indexOf(n),1),n.element.parentNode&&e.removeChild(n.element),n}},l="undefined"!=typeof window&&void 0!==window.document,c=function(){return l},f="children"in(c()?a("svg"):{})?function(e){return e.children.length}:function(e){return e.childNodes.length},d=function(e,t,n,r){var o=n[0]||e.left,i=n[1]||e.top,a=o+e.width,s=i+e.height*(r[1]||1),u={element:Object.assign({},e),inner:{left:e.left,top:e.top,right:e.right,bottom:e.bottom},outer:{left:o,top:i,right:a,bottom:s}};return t.filter(function(e){return!e.isRectIgnored()}).map(function(e){return e.rect}).forEach(function(e){p(u.inner,Object.assign({},e.inner)),p(u.outer,Object.assign({},e.outer))}),E(u.inner),u.outer.bottom+=u.element.marginBottom,u.outer.right+=u.element.marginRight,E(u.outer),u},p=function(e,t){t.top+=e.top,t.right+=e.left,t.bottom+=e.top,t.left+=e.left,t.bottom>e.bottom&&(e.bottom=t.bottom),t.right>e.right&&(e.right=t.right)},E=function(e){e.width=e.right-e.left,e.height=e.bottom-e.top},_=function(e){return"number"==typeof e},T=function(e){return e<.5?2*e*e:(4-2*e)*e-1},I={spring:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.stiffness,r=void 0===t?.5:t,o=e.damping,i=void 0===o?.75:o,a=e.mass,s=void 0===a?10:a,u=null,l=null,c=0,f=!1,d=n({interpolate:function(e,t){if(!f){if(!_(u)||!_(l))return f=!0,void(c=0);(function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:.001;return Math.abs(e-t)<r&&Math.abs(n)<r})(l+=c+=-(l-u)*r/s,u,c*=i)||t?(l=u,c=0,f=!0,d.onupdate(l),d.oncomplete(l)):d.onupdate(l)}},target:{set:function(e){if(_(e)&&!_(l)&&(l=e),null===u&&(u=e,l=e),l===(u=e)||void 0===u)return f=!0,c=0,d.onupdate(l),void d.oncomplete(l);f=!1},get:function(){return u}},resting:{get:function(){return f}},onupdate:function(e){},oncomplete:function(e){}});return d},tween:function(){var e,t,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},o=r.duration,i=void 0===o?500:o,a=r.easing,s=void 0===a?T:a,u=r.delay,l=void 0===u?0:u,c=null,f=!0,d=!1,p=null,E=n({interpolate:function(n,r){f||null===p||(null===c&&(c=n),n-c<l||((e=n-c-l)>=i||r?(e=1,t=d?0:1,E.onupdate(t*p),E.oncomplete(t*p),f=!0):(t=e/i,E.onupdate((e>=0?s(d?1-t:t):0)*p))))},target:{get:function(){return d?0:p},set:function(e){if(null===p)return p=e,E.onupdate(e),void E.oncomplete(e);e<p?(p=1,d=!0):(d=!1,p=e),f=!1,c=null}},resting:{get:function(){return f}},onupdate:function(e){},oncomplete:function(e){}});return E}},v=function(e,t,n){var r=e[t]&&"object"==typeof e[t][n]?e[t][n]:e[t]||e,o="string"==typeof r?r:r.type,i="object"==typeof r?Object.assign({},r):{};return I[o]?I[o](i):null},m=function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]&&arguments[3];(t=Array.isArray(t)?t:[t]).forEach(function(t){e.forEach(function(e){var o=e,i=function(){return n[e]},a=function(t){return n[e]=t};"object"==typeof e&&(o=e.key,i=e.getter||i,a=e.setter||a),t[o]&&!r||(t[o]={get:i,set:a})})})},h=function(e){return null!=e},g={opacity:1,scaleX:1,scaleY:1,translateX:0,translateY:0,rotateX:0,rotateY:0,rotateZ:0,originX:0,originY:0},R=function(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!0;for(var n in t)if(t[n]!==e[n])return!0;return!1},O=function(e,t){var n=t.opacity,r=t.perspective,o=t.translateX,i=t.translateY,a=t.scaleX,s=t.scaleY,u=t.rotateX,l=t.rotateY,c=t.rotateZ,f=t.originX,d=t.originY,p=t.width,E=t.height,_="",T="";(h(f)||h(d))&&(T+="transform-origin: "+(f||0)+"px "+(d||0)+"px;"),h(r)&&(_+="perspective("+r+"px) "),(h(o)||h(i))&&(_+="translate3d("+(o||0)+"px, "+(i||0)+"px, 0) "),(h(a)||h(s))&&(_+="scale3d("+(h(a)?a:1)+", "+(h(s)?s:1)+", 1) "),h(c)&&(_+="rotateZ("+c+"rad) "),h(u)&&(_+="rotateX("+u+"rad) "),h(l)&&(_+="rotateY("+l+"rad) "),_.length&&(T+="transform:"+_+";"),h(n)&&(T+="opacity:"+n+";",0===n&&(T+="visibility:hidden;"),n<1&&(T+="pointer-events:none;")),h(E)&&(T+="height:"+E+"px;"),h(p)&&(T+="width:"+p+"px;");var I=e.elementCurrentStyle||"";T.length===I.length&&T===I||(e.style.cssText=T,e.elementCurrentStyle=T)},y={styles:function(e){var t=e.mixinConfig,n=e.viewProps,r=e.viewInternalAPI,o=e.viewExternalAPI,i=e.view,a=Object.assign({},n),s={};m(t,[r,o],n);var u=function(){return i.rect?d(i.rect,i.childViews,[n.translateX||0,n.translateY||0],[n.scaleX||0,n.scaleY||0]):null};return r.rect={get:u},o.rect={get:u},t.forEach(function(e){n[e]=void 0===a[e]?g[e]:a[e]}),{write:function(){if(R(s,n))return O(i.element,n),Object.assign(s,Object.assign({},n)),!0},destroy:function(){}}},listeners:function(e){e.mixinConfig,e.viewProps,e.viewInternalAPI;var t,n=e.viewExternalAPI,r=(e.viewState,e.view),o=[],i=(t=r.element,function(e,n){t.addEventListener(e,n)}),a=function(e){return function(t,n){e.removeEventListener(t,n)}}(r.element);return n.on=function(e,t){o.push({type:e,fn:t}),i(e,t)},n.off=function(e,t){o.splice(o.findIndex(function(n){return n.type===e&&n.fn===t}),1),a(e,t)},{write:function(){return!0},destroy:function(){o.forEach(function(e){a(e.type,e.fn)})}}},animations:function(e){var n=e.mixinConfig,r=e.viewProps,o=e.viewInternalAPI,i=e.viewExternalAPI,a=Object.assign({},r),s=[];return t(n,function(e,t){var n=v(t);n&&(n.onupdate=function(t){r[e]=t},n.target=a[e],m([{key:e,setter:function(e){n.target!==e&&(n.target=e)},getter:function(){return r[e]}}],[o,i],r,!0),s.push(n))}),{write:function(e){var t=document.hidden,n=!0;return s.forEach(function(r){r.resting||(n=!1),r.interpolate(e,t)}),n},destroy:function(){}}},apis:function(e){var t=e.mixinConfig,n=e.viewProps,r=e.viewExternalAPI;m(t,r,n)}},D=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return t.layoutCalculated||(e.paddingTop=parseInt(n.paddingTop,10)||0,e.marginTop=parseInt(n.marginTop,10)||0,e.marginRight=parseInt(n.marginRight,10)||0,e.marginBottom=parseInt(n.marginBottom,10)||0,e.marginLeft=parseInt(n.marginLeft,10)||0,t.layoutCalculated=!0),e.left=t.offsetLeft||0,e.top=t.offsetTop||0,e.width=t.offsetWidth||0,e.height=t.offsetHeight||0,e.right=e.left+e.width,e.bottom=e.top+e.height,e.scrollTop=t.scrollTop,e.hidden=null===t.offsetParent,e},S=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.tag,r=void 0===t?"div":t,o=e.name,i=void 0===o?null:o,l=e.attributes,c=void 0===l?{}:l,p=e.read,E=void 0===p?function(){}:p,_=e.write,T=void 0===_?function(){}:_,I=e.create,v=void 0===I?function(){}:I,m=e.destroy,h=void 0===m?function(){}:m,g=e.filterFrameActionsForChild,R=void 0===g?function(e,t){return t}:g,O=e.didCreateView,S=void 0===O?function(){}:O,A=e.didWriteView,L=void 0===A?function(){}:A,b=e.ignoreRect,P=void 0!==b&&b,M=e.ignoreRectUpdate,w=void 0!==M&&M,C=e.mixins,N=void 0===C?[]:C;return function(e){var t,o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},l=a(r,"filepond--"+i,c),p=window.getComputedStyle(l,null),_=D(),I=null,m=!1,g=[],O=[],A={},b={},M=[T],C=[E],G=[h],U=function(){return l},B=function(){return g.concat()},F=function(){return I||(I=d(_,g,[0,0],[1,1]))},q={element:{get:U},style:{get:function(){return p}},childViews:{get:B}},V=Object.assign({},q,{rect:{get:F},ref:{get:function(){return A}},is:function(e){return i===e},appendChild:(t=l,function(e,n){void 0!==n&&t.children[n]?t.insertBefore(e,t.children[n]):t.appendChild(e)}),createChildView:function(e){return function(t,n){return t(e,n)}}(e),linkView:function(e){return g.push(e),e},unlinkView:function(e){g.splice(g.indexOf(e),1)},appendChildView:s(0,g),removeChildView:u(l,g),registerWriter:function(e){return M.push(e)},registerReader:function(e){return C.push(e)},registerDestroyer:function(e){return G.push(e)},invalidateLayout:function(){return l.layoutCalculated=!1},dispatch:e.dispatch,query:e.query}),x={element:{get:U},childViews:{get:B},rect:{get:F},resting:{get:function(){return m}},isRectIgnored:function(){return P},_read:function(){I=null,g.forEach(function(e){return e._read()}),!(w&&_.width&&_.height)&&D(_,l,p);var e={root:k,props:o,rect:_};C.forEach(function(t){return t(e)})},_write:function(e,t,n){var r=0===t.length;return M.forEach(function(i){!1===i({props:o,root:k,actions:t,timestamp:e,shouldOptimize:n})&&(r=!1)}),O.forEach(function(t){!1===t.write(e)&&(r=!1)}),g.filter(function(e){return!!e.element.parentNode}).forEach(function(o){o._write(e,R(o,t),n)||(r=!1)}),g.forEach(function(o,i){o.element.parentNode||(k.appendChild(o.element,i),o._read(),o._write(e,R(o,t),n),r=!1)}),m=r,L({props:o,root:k,actions:t,timestamp:e}),r},_destroy:function(){O.forEach(function(e){return e.destroy()}),G.forEach(function(e){e({root:k,props:o})}),g.forEach(function(e){return e._destroy()})}},Y=Object.assign({},q,{rect:{get:function(){return _}}});Object.keys(N).sort(function(e,t){return"styles"===e?1:"styles"===t?-1:0}).forEach(function(e){var t=y[e]({mixinConfig:N[e],viewProps:o,viewState:b,viewInternalAPI:V,viewExternalAPI:x,view:n(Y)});t&&O.push(t)});var k=n(V);v({root:k,props:o});var j=f(l);return g.forEach(function(e,t){k.appendChild(e.element,j+t)}),S(k),n(x)}},A=function(e,t){return function(n){var r=n.root,o=n.props,i=n.actions,a=void 0===i?[]:i,s=n.timestamp,u=n.shouldOptimize;a.filter(function(t){return e[t.type]}).forEach(function(t){return e[t.type]({root:r,props:o,action:t.data,timestamp:s,shouldOptimize:u})}),t&&t({root:r,props:o,actions:a,timestamp:s,shouldOptimize:u})}},L=function(e,t){return t.parentNode.insertBefore(e,t)},b=function(e,t){return t.parentNode.insertBefore(e,t.nextSibling)},P=function(e){return Array.isArray(e)},M=function(e){return null==e},w=function(e){return e.trim()},C=function(e){return""+e},N=function(e){return"boolean"==typeof e},G=function(e){return N(e)?e:"true"===e},U=function(e){return"string"==typeof e},B=function(e){return _(e)?e:U(e)?C(e).replace(/[a-z]+/gi,""):0},F=function(e){return parseInt(B(e),10)},q=function(e){return parseFloat(B(e))},V=function(e){return _(e)&&isFinite(e)&&Math.floor(e)===e},x=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1e3;if(V(e))return e;var n=C(e).trim();return/MB$/i.test(n)?(n=n.replace(/MB$i/,"").trim(),F(n)*t*t):/KB/i.test(n)?(n=n.replace(/KB$i/,"").trim(),F(n)*t):F(n)},Y=function(e){return"function"==typeof e},k={process:"POST",patch:"PATCH",revert:"DELETE",fetch:"GET",restore:"GET",load:"GET"},j=function(e,t,n,r,o){if(null===t)return null;if("function"==typeof t)return t;var i={url:"GET"===n||"PATCH"===n?"?"+e+"=":"",method:n,headers:o,withCredentials:!1,timeout:r,onload:null,ondata:null,onerror:null};if(U(t))return i.url=t,i;if(Object.assign(i,t),U(i.headers)){var a=i.headers.split(/:(.+)/);i.headers={header:a[0],value:a[1]}}return i.withCredentials=G(i.withCredentials),i},H=function(e){return"object"==typeof e&&null!==e},X=function(e){return P(e)?"array":function(e){return null===e}(e)?"null":V(e)?"int":/^[0-9]+ ?(?:GB|MB|KB)$/gi.test(e)?"bytes":function(e){return H(e)&&U(e.url)&&H(e.process)&&H(e.revert)&&H(e.restore)&&H(e.fetch)}(e)?"api":typeof e},W={array:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:",";return M(e)?[]:P(e)?e:C(e).split(t).map(w).filter(function(e){return e.length})},boolean:G,int:function(e){return"bytes"===X(e)?x(e):F(e)},number:q,float:q,bytes:x,string:function(e){return Y(e)?e:C(e)},function:function(e){return function(e){for(var t=self,n=e.split("."),r=null;r=n.shift();)if(!(t=t[r]))return null;return t}(e)},serverapi:function(e){return(r={}).url=U(n=e)?n:n.url||"",r.timeout=n.timeout?parseInt(n.timeout,10):0,r.headers=n.headers?n.headers:{},t(k,function(e){r[e]=j(e,n[e],k[e],r.timeout,r.headers)}),r.process=n.process||U(n)||n.url?r.process:null,r.remove=n.remove||null,delete r.headers,r;var n,r},object:function(e){try{return JSON.parse(e.replace(/{\s*'/g,'{"').replace(/'\s*}/g,'"}').replace(/'\s*:/g,'":').replace(/:\s*'/g,':"').replace(/,\s*'/g,',"').replace(/'\s*,/g,'",'))}catch(e){return null}}},z=function(e,t,n){if(e===t)return e;var r,o=X(e);if(o!==n){var i=(r=e,W[n](r));if(o=X(i),null===i)throw'Trying to assign value with incorrect type to "'+option+'", allowed type: "'+n+'"';e=i}return e},Q=function(e){var r={};return t(e,function(t){var n,o,i,a=e[t];r[t]=(n=a[0],o=a[1],i=n,{enumerable:!0,get:function(){return i},set:function(e){i=z(e,n,o)}})}),n(r)},Z=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"-";return e.split(/(?=[A-Z])/).map(function(e){return e.toLowerCase()}).join(t)},K=function(e){return function(n,r,o){var i={};return t(e,function(e){var t=Z(e,"_").toUpperCase();i["SET_"+t]=function(r){try{o.options[e]=r.value}catch(e){}n("DID_SET_"+t,{value:o.options[e]})}}),i}},$=function(e){return function(n){var r={};return t(e,function(e){r["GET_"+Z(e,"_").toUpperCase()]=function(t){return n.options[e]}}),r}},J=1,ee=2,te=3,ne=4,re=5,oe=function(){return Math.random().toString(36).substring(2,11)};function ie(e){this.wrapped=e}function ae(e){var t,n;function r(t,n){try{var i=e[t](n),a=i.value,s=a instanceof ie;Promise.resolve(s?a.wrapped:a).then(function(e){s?r("next",e):o(i.done?"return":"normal",e)},function(e){r("throw",e)})}catch(e){o("throw",e)}}function o(e,o){switch(e){case"return":t.resolve({value:o,done:!0});break;case"throw":t.reject(o);break;default:t.resolve({value:o,done:!1})}(t=t.next)?r(t.key,t.arg):n=null}this._invoke=function(e,o){return new Promise(function(i,a){var s={key:e,arg:o,resolve:i,reject:a,next:null};n?n=n.next=s:(t=n=s,r(e,o))})},"function"!=typeof e.return&&(this.return=void 0)}function se(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}"function"==typeof Symbol&&Symbol.asyncIterator&&(ae.prototype[Symbol.asyncIterator]=function(){return this}),ae.prototype.next=function(e){return this._invoke("next",e)},ae.prototype.throw=function(e){return this._invoke("throw",e)},ae.prototype.return=function(e){return this._invoke("return",e)};function ue(e){return function(e){if(Array.isArray(e)){for(var t=0,n=new Array(e.length);t<e.length;t++)n[t]=e[t];return n}}(e)||le(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance")}()}function le(e){if(Symbol.iterator in Object(e)||"[object Arguments]"===Object.prototype.toString.call(e))return Array.from(e)}var ce,fe,de=function(e,t){return e.splice(t,1)},pe=function(){var e=[],t=function(t,n){de(e,e.findIndex(function(e){return e.event===t&&(e.cb===n||!n)}))},n=function(t,n,r){e.filter(function(e){return e.event===t}).map(function(e){return e.cb}).forEach(function(e){return function(e,t){t?e():document.hidden?Promise.resolve(1).then(e):setTimeout(e,0)}(function(){return e.apply(void 0,ue(n))},r)})};return{fireSync:function(e){for(var t=arguments.length,r=new Array(t>1?t-1:0),o=1;o<t;o++)r[o-1]=arguments[o];n(e,r,!0)},fire:function(e){for(var t=arguments.length,r=new Array(t>1?t-1:0),o=1;o<t;o++)r[o-1]=arguments[o];n(e,r,!1)},on:function(t,n){e.push({event:t,cb:n})},onOnce:function(n,r){e.push({event:n,cb:function(){t(n,r),r.apply(void 0,arguments)}})},off:t}},Ee=function(e,t,n){Object.getOwnPropertyNames(e).filter(function(e){return!n.includes(e)}).forEach(function(n){return Object.defineProperty(t,n,Object.getOwnPropertyDescriptor(e,n))})},_e=["fire","process","revert","load","on","off","onOnce","retryLoad","extend","archive","archived","release","released","requestProcessing","freeze"],Te=function(e){var t={};return Ee(e,t,_e),t},Ie={INIT:1,IDLE:2,PROCESSING_QUEUED:9,PROCESSING:3,PROCESSING_COMPLETE:5,PROCESSING_ERROR:6,PROCESSING_REVERT_ERROR:10,LOADING:7,LOAD_ERROR:8},ve={INPUT:1,LIMBO:2,LOCAL:3},me=function(e){return/[^0-9]+/.exec(e)},he=function(){return me(1.1.toLocaleString())[0]},ge={BOOLEAN:"boolean",INT:"int",NUMBER:"number",STRING:"string",ARRAY:"array",OBJECT:"object",FUNCTION:"function",ACTION:"action",SERVER_API:"serverapi",REGEX:"regex"},Re=[],Oe=function(e,t,n){return new Promise(function(r,o){var i=Re.filter(function(t){return t.key===e}).map(function(e){return e.cb});if(0!==i.length){var a=i.shift();i.reduce(function(e,t){return e.then(function(e){return t(e,n)})},a(t,n)).then(function(e){return r(e)}).catch(function(e){return o(e)})}else r(t)})},ye=function(e,t,n){return Re.filter(function(t){return t.key===e}).map(function(e){return e.cb(t,n)})},De=function(e,t){return Re.push({key:e,cb:t})},Se=function(){return Object.assign({},Ae)},Ae={id:[null,ge.STRING],name:["filepond",ge.STRING],disabled:[!1,ge.BOOLEAN],className:[null,ge.STRING],required:[!1,ge.BOOLEAN],captureMethod:[null,ge.STRING],allowSyncAcceptAttribute:[!0,ge.BOOLEAN],allowDrop:[!0,ge.BOOLEAN],allowBrowse:[!0,ge.BOOLEAN],allowPaste:[!0,ge.BOOLEAN],allowMultiple:[!1,ge.BOOLEAN],allowReplace:[!0,ge.BOOLEAN],allowRevert:[!0,ge.BOOLEAN],allowRemove:[!0,ge.BOOLEAN],allowProcess:[!0,ge.BOOLEAN],allowReorder:[!1,ge.BOOLEAN],allowDirectoriesOnly:[!1,ge.BOOLEAN],storeAsFile:[!1,ge.BOOLEAN],forceRevert:[!1,ge.BOOLEAN],maxFiles:[null,ge.INT],checkValidity:[!1,ge.BOOLEAN],itemInsertLocationFreedom:[!0,ge.BOOLEAN],itemInsertLocation:["before",ge.STRING],itemInsertInterval:[75,ge.INT],dropOnPage:[!1,ge.BOOLEAN],dropOnElement:[!0,ge.BOOLEAN],dropValidation:[!1,ge.BOOLEAN],ignoredFiles:[[".ds_store","thumbs.db","desktop.ini"],ge.ARRAY],instantUpload:[!0,ge.BOOLEAN],maxParallelUploads:[2,ge.INT],allowMinimumUploadDuration:[!0,ge.BOOLEAN],chunkUploads:[!1,ge.BOOLEAN],chunkForce:[!1,ge.BOOLEAN],chunkSize:[5e6,ge.INT],chunkRetryDelays:[[500,1e3,3e3],ge.ARRAY],server:[null,ge.SERVER_API],fileSizeBase:[1e3,ge.INT],labelFileSizeBytes:["bytes",ge.STRING],labelFileSizeKilobytes:["KB",ge.STRING],labelFileSizeMegabytes:["MB",ge.STRING],labelFileSizeGigabytes:["GB",ge.STRING],labelDecimalSeparator:[he(),ge.STRING],labelThousandsSeparator:[(ce=he(),fe=1e3.toLocaleString(),fe!==1e3.toString()?me(fe)[0]:"."===ce?",":"."),ge.STRING],labelIdle:['Drag & Drop your files or <span class="filepond--label-action">Browse</span>',ge.STRING],labelInvalidField:["Field contains invalid files",ge.STRING],labelFileWaitingForSize:["Waiting for size",ge.STRING],labelFileSizeNotAvailable:["Size not available",ge.STRING],labelFileCountSingular:["file in list",ge.STRING],labelFileCountPlural:["files in list",ge.STRING],labelFileLoading:["Loading",ge.STRING],labelFileAdded:["Added",ge.STRING],labelFileLoadError:["Error during load",ge.STRING],labelFileRemoved:["Removed",ge.STRING],labelFileRemoveError:["Error during remove",ge.STRING],labelFileProcessing:["Uploading",ge.STRING],labelFileProcessingComplete:["Upload complete",ge.STRING],labelFileProcessingAborted:["Upload cancelled",ge.STRING],labelFileProcessingError:["Error during upload",ge.STRING],labelFileProcessingRevertError:["Error during revert",ge.STRING],labelTapToCancel:["tap to cancel",ge.STRING],labelTapToRetry:["tap to retry",ge.STRING],labelTapToUndo:["tap to undo",ge.STRING],labelButtonRemoveItem:["Remove",ge.STRING],labelButtonAbortItemLoad:["Abort",ge.STRING],labelButtonRetryItemLoad:["Retry",ge.STRING],labelButtonAbortItemProcessing:["Cancel",ge.STRING],labelButtonUndoItemProcessing:["Undo",ge.STRING],labelButtonRetryItemProcessing:["Retry",ge.STRING],labelButtonProcessItem:["Upload",ge.STRING],iconRemove:['<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M11.586 13l-2.293 2.293a1 1 0 0 0 1.414 1.414L13 14.414l2.293 2.293a1 1 0 0 0 1.414-1.414L14.414 13l2.293-2.293a1 1 0 0 0-1.414-1.414L13 11.586l-2.293-2.293a1 1 0 0 0-1.414 1.414L11.586 13z" fill="currentColor" fill-rule="nonzero"/></svg>',ge.STRING],iconProcess:['<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M14 10.414v3.585a1 1 0 0 1-2 0v-3.585l-1.293 1.293a1 1 0 0 1-1.414-1.415l3-3a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.415L14 10.414zM9 18a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2H9z" fill="currentColor" fill-rule="evenodd"/></svg>',ge.STRING],iconRetry:['<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M10.81 9.185l-.038.02A4.997 4.997 0 0 0 8 13.683a5 5 0 0 0 5 5 5 5 0 0 0 5-5 1 1 0 0 1 2 0A7 7 0 1 1 9.722 7.496l-.842-.21a.999.999 0 1 1 .484-1.94l3.23.806c.535.133.86.675.73 1.21l-.804 3.233a.997.997 0 0 1-1.21.73.997.997 0 0 1-.73-1.21l.23-.928v-.002z" fill="currentColor" fill-rule="nonzero"/></svg>',ge.STRING],iconUndo:['<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M9.185 10.81l.02-.038A4.997 4.997 0 0 1 13.683 8a5 5 0 0 1 5 5 5 5 0 0 1-5 5 1 1 0 0 0 0 2A7 7 0 1 0 7.496 9.722l-.21-.842a.999.999 0 1 0-1.94.484l.806 3.23c.133.535.675.86 1.21.73l3.233-.803a.997.997 0 0 0 .73-1.21.997.997 0 0 0-1.21-.73l-.928.23-.002-.001z" fill="currentColor" fill-rule="nonzero"/></svg>',ge.STRING],iconDone:['<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M18.293 9.293a1 1 0 0 1 1.414 1.414l-7.002 7a1 1 0 0 1-1.414 0l-3.998-4a1 1 0 1 1 1.414-1.414L12 15.586l6.294-6.293z" fill="currentColor" fill-rule="nonzero"/></svg>',ge.STRING],oninit:[null,ge.FUNCTION],onwarning:[null,ge.FUNCTION],onerror:[null,ge.FUNCTION],onactivatefile:[null,ge.FUNCTION],oninitfile:[null,ge.FUNCTION],onaddfilestart:[null,ge.FUNCTION],onaddfileprogress:[null,ge.FUNCTION],onaddfile:[null,ge.FUNCTION],onprocessfilestart:[null,ge.FUNCTION],onprocessfileprogress:[null,ge.FUNCTION],onprocessfileabort:[null,ge.FUNCTION],onprocessfilerevert:[null,ge.FUNCTION],onprocessfile:[null,ge.FUNCTION],onprocessfiles:[null,ge.FUNCTION],onremovefile:[null,ge.FUNCTION],onpreparefile:[null,ge.FUNCTION],onupdatefiles:[null,ge.FUNCTION],onreorderfiles:[null,ge.FUNCTION],beforeDropFile:[null,ge.FUNCTION],beforeAddFile:[null,ge.FUNCTION],beforeRemoveFile:[null,ge.FUNCTION],beforePrepareFile:[null,ge.FUNCTION],stylePanelLayout:[null,ge.STRING],stylePanelAspectRatio:[null,ge.STRING],styleItemPanelAspectRatio:[null,ge.STRING],styleButtonRemoveItemPosition:["left",ge.STRING],styleButtonProcessItemPosition:["right",ge.STRING],styleLoadIndicatorPosition:["right",ge.STRING],styleProgressIndicatorPosition:["right",ge.STRING],styleButtonRemoveItemAlign:[!1,ge.BOOLEAN],files:[[],ge.ARRAY],credits:[["https://filepond.com","Powered by FilePond"],ge.ARRAY]},Le=function(e,t){return M(t)?e[0]||null:V(t)?e[t]||null:("object"==typeof t&&(t=t.id),e.find(function(e){return e.id===t})||null)},be=function(e){if(M(e))return e;if(/:/.test(e)){var t=e.split(":");return t[1]/t[0]}return parseFloat(e)},Pe=function(e){return e.filter(function(e){return!e.archived})},Me={EMPTY:0,IDLE:1,ERROR:2,BUSY:3,READY:4},we=null,Ce=[Ie.LOAD_ERROR,Ie.PROCESSING_ERROR,Ie.PROCESSING_REVERT_ERROR],Ne=[Ie.LOADING,Ie.PROCESSING,Ie.PROCESSING_QUEUED,Ie.INIT],Ge=[Ie.PROCESSING_COMPLETE],Ue=function(e){return Ce.includes(e.status)},Be=function(e){return Ne.includes(e.status)},Fe=function(e){return Ge.includes(e.status)},qe=function(e){return H(e.options.server)&&(H(e.options.server.process)||Y(e.options.server.process))},Ve=function(e){return{GET_STATUS:function(){var t=Pe(e.items),n=Me.EMPTY,r=Me.ERROR,o=Me.BUSY,i=Me.IDLE,a=Me.READY;return 0===t.length?n:t.some(Ue)?r:t.some(Be)?o:t.some(Fe)?a:i},GET_ITEM:function(t){return Le(e.items,t)},GET_ACTIVE_ITEM:function(t){return Le(Pe(e.items),t)},GET_ACTIVE_ITEMS:function(){return Pe(e.items)},GET_ITEMS:function(){return e.items},GET_ITEM_NAME:function(t){var n=Le(e.items,t);return n?n.filename:null},GET_ITEM_SIZE:function(t){var n=Le(e.items,t);return n?n.fileSize:null},GET_STYLES:function(){return Object.keys(e.options).filter(function(e){return/^style/.test(e)}).map(function(t){return{name:t,value:e.options[t]}})},GET_PANEL_ASPECT_RATIO:function(){return/circle/.test(e.options.stylePanelLayout)?1:be(e.options.stylePanelAspectRatio)},GET_ITEM_PANEL_ASPECT_RATIO:function(){return e.options.styleItemPanelAspectRatio},GET_ITEMS_BY_STATUS:function(t){return Pe(e.items).filter(function(e){return e.status===t})},GET_TOTAL_ITEMS:function(){return Pe(e.items).length},SHOULD_UPDATE_FILE_INPUT:function(){return e.options.storeAsFile&&function(){if(null===we)try{var e=new DataTransfer;e.items.add(new File(["hello world"],"This_Works.txt"));var t=document.createElement("input");t.setAttribute("type","file"),t.files=e.files,we=1===t.files.length}catch(e){we=!1}return we}()&&!qe(e)},IS_ASYNC:function(){return qe(e)},GET_FILE_SIZE_LABELS:function(e){return{labelBytes:e("GET_LABEL_FILE_SIZE_BYTES")||void 0,labelKilobytes:e("GET_LABEL_FILE_SIZE_KILOBYTES")||void 0,labelMegabytes:e("GET_LABEL_FILE_SIZE_MEGABYTES")||void 0,labelGigabytes:e("GET_LABEL_FILE_SIZE_GIGABYTES")||void 0}}}},xe=function(e,t,n){return Math.max(Math.min(n,e),t)},Ye=function(e){return/^\s*data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)?)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s]*)\s*$/i.test(e)},ke=function(e){return(""+e).split("/").pop().split("?").shift()},je=function(e){return e.split(".").pop()},He=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"";return(t+e).slice(-t.length)},Xe=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:new Date;return e.getFullYear()+"-"+He(e.getMonth()+1,"00")+"-"+He(e.getDate(),"00")+"_"+He(e.getHours(),"00")+"-"+He(e.getMinutes(),"00")+"-"+He(e.getSeconds(),"00")},We=function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null,r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:null,o="string"==typeof n?e.slice(0,e.size,n):e.slice(0,e.size,e.type);return o.lastModifiedDate=new Date,e._relativePath&&(o._relativePath=e._relativePath),U(t)||(t=Xe()),t&&null===r&&je(t)?o.name=t:(r=r||function(e){if("string"!=typeof e)return"";var t=e.split("/").pop();return/svg/.test(t)?"svg":/zip|compressed/.test(t)?"zip":/plain/.test(t)?"txt":/msword/.test(t)?"doc":/[a-z]+/.test(t)?"jpeg"===t?"jpg":t:""}(o.type),o.name=t+(r?"."+r:"")),o},ze=function(e,t){var n=window.BlobBuilder=window.BlobBuilder||window.WebKitBlobBuilder||window.MozBlobBuilder||window.MSBlobBuilder;if(n){var r=new n;return r.append(e),r.getBlob(t)}return new Blob([e],{type:t})},Qe=function(e){return(/^data:(.+);/.exec(e)||[])[1]||null},Ze=function(e){var t=Qe(e);return function(e,t){for(var n=new ArrayBuffer(e.length),r=new Uint8Array(n),o=0;o<e.length;o++)r[o]=e.charCodeAt(o);return ze(n,t)}(function(e){return atob(function(e){return e.split(",")[1].replace(/\s/g,"")}(e))}(e),t)},Ke=function(e){if(!/^content-disposition:/i.test(e))return null;var t=e.split(/filename=|filename\*=.+''/).splice(1).map(function(e){return e.trim().replace(/^["']|[;"']{0,2}$/g,"")}).filter(function(e){return e.length});return t.length?decodeURI(t[t.length-1]):null},$e=function(e){if(/content-length:/i.test(e)){var t=e.match(/[0-9]+/)[0];return t?parseInt(t,10):null}return null},Je=function(e){return/x-content-transfer-id:/i.test(e)&&(e.split(":")[1]||"").trim()||null},et=function(e){var t={source:null,name:null,size:null},n=e.split("\n"),r=!0,o=!1,i=void 0;try{for(var a,s=n[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){var u=a.value,l=Ke(u);if(l)t.name=l;else{var c=$e(u);if(c)t.size=c;else{var f=Je(u);f&&(t.source=f)}}}}catch(e){o=!0,i=e}finally{try{r||null==s.return||s.return()}finally{if(o)throw i}}return t},tt=function(e){var t={source:null,complete:!1,progress:0,size:null,timestamp:null,duration:0,request:null},n=function(n){e?(t.timestamp=Date.now(),t.request=e(n,function(e){t.duration=Date.now()-t.timestamp,t.complete=!0,e instanceof Blob&&(e=We(e,e.name||ke(n))),r.fire("load",e instanceof Blob?e:e?e.body:null)},function(e){r.fire("error","string"==typeof e?{type:"error",code:0,body:e}:e)},function(e,n,o){o&&(t.size=o),t.duration=Date.now()-t.timestamp,e?(t.progress=n/o,r.fire("progress",t.progress)):t.progress=null},function(){r.fire("abort")},function(e){var n=et("string"==typeof e?e:e.headers);r.fire("meta",{size:t.size||n.size,filename:n.name,source:n.source})})):r.fire("error",{type:"error",body:"Can't load URL",code:400})},r=Object.assign({},pe(),{setSource:function(e){return t.source=e},getProgress:function(){return t.progress},abort:function(){t.request&&t.request.abort&&t.request.abort()},load:function(){var e,o,i=t.source;r.fire("init",i),i instanceof File?r.fire("load",i):i instanceof Blob?r.fire("load",We(i,i.name)):Ye(i)?r.fire("load",We(Ze(i),e,null,o)):n(i)}});return r},nt=function(e){return/GET|HEAD/.test(e)},rt=function(e,t,n){var r={onheaders:function(){},onprogress:function(){},onload:function(){},ontimeout:function(){},onerror:function(){},onabort:function(){},abort:function(){o=!0,a.abort()}},o=!1,i=!1;n=Object.assign({method:"POST",headers:{},withCredentials:!1},n),t=encodeURI(t),nt(n.method)&&e&&(t=""+t+encodeURIComponent("string"==typeof e?e:JSON.stringify(e)));var a=new XMLHttpRequest;return(nt(n.method)?a:a.upload).onprogress=function(e){o||r.onprogress(e.lengthComputable,e.loaded,e.total)},a.onreadystatechange=function(){a.readyState<2||4===a.readyState&&0===a.status||i||(i=!0,r.onheaders(a))},a.onload=function(){a.status>=200&&a.status<300?r.onload(a):r.onerror(a)},a.onerror=function(){return r.onerror(a)},a.onabort=function(){o=!0,r.onabort()},a.ontimeout=function(){return r.ontimeout(a)},a.open(n.method,t,!0),V(n.timeout)&&(a.timeout=n.timeout),Object.keys(n.headers).forEach(function(e){var t=unescape(encodeURIComponent(n.headers[e]));a.setRequestHeader(e,t)}),n.responseType&&(a.responseType=n.responseType),n.withCredentials&&(a.withCredentials=!0),a.send(e),r},ot=function(e,t,n,r){return{type:e,code:t,body:n,headers:r}},it=function(e){return function(t){e(ot("error",0,"Timeout",t.getAllResponseHeaders()))}},at=function(e){return/\?/.test(e)},st=function(){for(var e="",t=arguments.length,n=new Array(t),r=0;r<t;r++)n[r]=arguments[r];return n.forEach(function(t){e+=at(e)&&at(t)?t.replace(/\?/,"&"):t}),e},ut=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=arguments.length>1?arguments[1]:void 0;if("function"==typeof t)return t;if(!t||!U(t.url))return null;var n=t.onload||function(e){return e},r=t.onerror||function(e){return null};return function(o,i,a,s,u,l){var c=rt(o,st(e,t.url),Object.assign({},t,{responseType:"blob"}));return c.onload=function(e){var r=e.getAllResponseHeaders(),a=et(r).name||ke(o);i(ot("load",e.status,"HEAD"===t.method?null:We(n(e.response),a),r))},c.onerror=function(e){a(ot("error",e.status,r(e.response)||e.statusText,e.getAllResponseHeaders()))},c.onheaders=function(e){l(ot("headers",e.status,null,e.getAllResponseHeaders()))},c.ontimeout=it(a),c.onprogress=s,c.onabort=u,c}},lt=0,ct=1,ft=2,dt=3,pt=4,Et=function(e,t,n,r,o,i,a,s,u,l,c){for(var f=[],d=c.chunkTransferId,p=c.chunkServer,E=c.chunkSize,_=c.chunkRetryDelays,T={serverId:d,aborted:!1},I=t.ondata||function(e){return e},v=t.onload||function(e,t){return"HEAD"===t?e.getResponseHeader("Upload-Offset"):e.response},m=t.onerror||function(e){return null},h=Math.floor(r.size/E),g=0;g<=h;g++){var R=g*E,O=r.slice(R,R+E,"application/offset+octet-stream");f[g]={index:g,size:O.size,offset:R,data:O,file:r,progress:0,retries:ue(_),status:lt,error:null,request:null,timeout:null}}var y,D,S,A,L=function(e){return e.status===lt||e.status===dt},b=function(t){if(!T.aborted)if(t=t||f.find(L)){t.status=ft,t.progress=null;var n=p.ondata||function(e){return e},o=p.onerror||function(e){return null},s=p.onload||function(){},l=st(e,p.url,T.serverId),c="function"==typeof p.headers?p.headers(t):Object.assign({},p.headers,{"Content-Type":"application/offset+octet-stream","Upload-Offset":t.offset,"Upload-Length":r.size,"Upload-Name":r.name}),d=t.request=rt(n(t.data),l,Object.assign({},p,{headers:c}));d.onload=function(e){s(e,t.index,f.length),t.status=ct,t.request=null,w()},d.onprogress=function(e,n,r){t.progress=e?n:null,M()},d.onerror=function(e){t.status=dt,t.request=null,t.error=o(e.response)||e.statusText,P(t)||a(ot("error",e.status,o(e.response)||e.statusText,e.getAllResponseHeaders()))},d.ontimeout=function(e){t.status=dt,t.request=null,P(t)||it(a)(e)},d.onabort=function(){t.status=lt,t.request=null,u()}}else f.every(function(e){return e.status===ct})&&i(T.serverId)},P=function(e){return 0!==e.retries.length&&(e.status=pt,clearTimeout(e.timeout),e.timeout=setTimeout(function(){b(e)},e.retries.shift()),!0)},M=function(){var e=f.reduce(function(e,t){return null===e||null===t.progress?null:e+t.progress},0);if(null===e)return s(!1,0,0);var t=f.reduce(function(e,t){return e+t.size},0);s(!0,e,t)},w=function(){f.filter(function(e){return e.status===ft}).length>=1||b()};return T.serverId?(y=function(e){T.aborted||(f.filter(function(t){return t.offset<e}).forEach(function(e){e.status=ct,e.progress=e.size}),w())},D=st(e,p.url,T.serverId),S={headers:"function"==typeof t.headers?t.headers(T.serverId):Object.assign({},t.headers),method:"HEAD"},(A=rt(null,D,S)).onload=function(e){return y(v(e,S.method))},A.onerror=function(e){return a(ot("error",e.status,m(e.response)||e.statusText,e.getAllResponseHeaders()))},A.ontimeout=it(a)):function(i){var s=new FormData;H(o)&&s.append(n,JSON.stringify(o));var u="function"==typeof t.headers?t.headers(r,o):Object.assign({},t.headers,{"Upload-Length":r.size}),l=Object.assign({},t,{headers:u}),c=rt(I(s),st(e,t.url),l);c.onload=function(e){return i(v(e,l.method))},c.onerror=function(e){return a(ot("error",e.status,m(e.response)||e.statusText,e.getAllResponseHeaders()))},c.ontimeout=it(a)}(function(e){T.aborted||(l(e),T.serverId=e,w())}),{abort:function(){T.aborted=!0,f.forEach(function(e){clearTimeout(e.timeout),e.request&&e.request.abort()})}}},_t=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=arguments.length>1?arguments[1]:void 0,n=arguments.length>2?arguments[2]:void 0,r=arguments.length>3?arguments[3]:void 0;return"function"==typeof t?function(){for(var e=arguments.length,o=new Array(e),i=0;i<e;i++)o[i]=arguments[i];return t.apply(void 0,[n].concat(o,[r]))}:t&&U(t.url)?function(e,t,n,r){return function(o,i,a,s,u,l,c){if(o){var f=r.chunkUploads,d=f&&o.size>r.chunkSize,p=f&&(d||r.chunkForce);if(o instanceof Blob&&p)return Et(e,t,n,o,i,a,s,u,l,c,r);var E=t.ondata||function(e){return e},_=t.onload||function(e){return e},T=t.onerror||function(e){return null},I="function"==typeof t.headers?t.headers(o,i)||{}:Object.assign({},t.headers),v=Object.assign({},t,{headers:I}),m=new FormData;H(i)&&m.append(n,JSON.stringify(i)),(o instanceof Blob?[{name:null,file:o}]:o).forEach(function(e){m.append(n,e.file,null===e.name?e.file.name:""+e.name+e.file.name)});var h=rt(E(m),st(e,t.url),v);return h.onload=function(e){a(ot("load",e.status,_(e.response),e.getAllResponseHeaders()))},h.onerror=function(e){s(ot("error",e.status,T(e.response)||e.statusText,e.getAllResponseHeaders()))},h.ontimeout=it(s),h.onprogress=u,h.onabort=l,h}}}(e,t,n,r):null},Tt=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=arguments.length>1?arguments[1]:void 0;if("function"==typeof t)return t;if(!t||!U(t.url))return function(e,t){return t()};var n=t.onload||function(e){return e},r=t.onerror||function(e){return null};return function(o,i,a){var s=rt(o,e+t.url,t);return s.onload=function(e){i(ot("load",e.status,n(e.response),e.getAllResponseHeaders()))},s.onerror=function(e){a(ot("error",e.status,r(e.response)||e.statusText,e.getAllResponseHeaders()))},s.ontimeout=it(a),s}},It=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1;return e+Math.random()*(t-e)},vt=function(e,t){var n={complete:!1,perceivedProgress:0,perceivedPerformanceUpdater:null,progress:null,timestamp:null,perceivedDuration:0,duration:0,request:null,response:null},r=t.allowMinimumUploadDuration,o=function(){n.request&&(n.perceivedPerformanceUpdater.clear(),n.request.abort&&n.request.abort(),n.complete=!0)},i=r?function(){return n.progress?Math.min(n.progress,n.perceivedProgress):null}:function(){return n.progress||null},a=r?function(){return Math.min(n.duration,n.perceivedDuration)}:function(){return n.duration},s=Object.assign({},pe(),{process:function(t,o){var i=function(){0!==n.duration&&null!==n.progress&&s.fire("progress",s.getProgress())},a=function(){n.complete=!0,s.fire("load-perceived",n.response.body)};s.fire("start"),n.timestamp=Date.now(),n.perceivedPerformanceUpdater=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1e3,n=(arguments.length>2&&void 0!==arguments[2]&&arguments[2],arguments.length>3&&void 0!==arguments[3]?arguments[3]:25),r=arguments.length>4&&void 0!==arguments[4]?arguments[4]:250,o=null,i=Date.now();return t>0&&function a(){var s=Date.now()-i,u=It(n,r);s+u>t&&(u=s+u-t);var l=s/t;l>=1||document.hidden?e(1):(e(l),o=setTimeout(a,u))}(),{clear:function(){clearTimeout(o)}}}(function(e){n.perceivedProgress=e,n.perceivedDuration=Date.now()-n.timestamp,i(),n.response&&1===n.perceivedProgress&&!n.complete&&a()},r?It(750,1500):0),n.request=e(t,o,function(e){n.response=H(e)?e:{type:"load",code:200,body:""+e,headers:{}},n.duration=Date.now()-n.timestamp,n.progress=1,s.fire("load",n.response.body),(!r||r&&1===n.perceivedProgress)&&a()},function(e){n.perceivedPerformanceUpdater.clear(),s.fire("error",H(e)?e:{type:"error",code:0,body:""+e})},function(e,t,r){n.duration=Date.now()-n.timestamp,n.progress=e?t/r:null,i()},function(){n.perceivedPerformanceUpdater.clear(),s.fire("abort",n.response?n.response.body:null)},function(e){s.fire("transfer",e)})},abort:o,getProgress:i,getDuration:a,reset:function(){o(),n.complete=!1,n.perceivedProgress=0,n.progress=0,n.timestamp=null,n.perceivedDuration=0,n.duration=0,n.request=null,n.response=null}});return s},mt=function(e){return e.substring(0,e.lastIndexOf("."))||e},ht=function(e){return!!(e instanceof File||e instanceof Blob&&e.name)},gt=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:null,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null,o=oe(),i={archived:!1,frozen:!1,released:!1,source:null,file:r,serverFileReference:t,transferId:null,processingAborted:!1,status:t?Ie.PROCESSING_COMPLETE:Ie.INIT,activeLoader:null,activeProcessor:null},a=null,s={},u=function(e){return i.status=e},l=function(e){if(!i.released&&!i.frozen){for(var t=arguments.length,n=new Array(t>1?t-1:0),r=1;r<t;r++)n[r-1]=arguments[r];f.fire.apply(f,[e].concat(n))}},c=function(e,t,n){var r=e.split("."),o=r[0],i=r.pop(),a=s;r.forEach(function(e){return a=a[e]}),JSON.stringify(a[i])!==JSON.stringify(t)&&(a[i]=t,l("metadata-update",{key:o,value:s[o],silent:n}))},f=Object.assign({id:{get:function(){return o}},origin:{get:function(){return e},set:function(t){return e=t}},serverId:{get:function(){return i.serverFileReference}},transferId:{get:function(){return i.transferId}},status:{get:function(){return i.status}},filename:{get:function(){return i.file.name}},filenameWithoutExtension:{get:function(){return mt(i.file.name)}},fileExtension:{get:function(){return je(i.file.name)}},fileType:{get:function(){return i.file.type}},fileSize:{get:function(){return i.file.size}},file:{get:function(){return i.file}},relativePath:{get:function(){return i.file._relativePath}},source:{get:function(){return i.source}},getMetadata:function(e){return function e(t){if(!H(t))return t;var n=P(t)?[]:{};for(var r in t)if(t.hasOwnProperty(r)){var o=t[r];n[r]=o&&H(o)?e(o):o}return n}(e?s[e]:s)},setMetadata:function(e,t,n){if(H(e)){var r=e;return Object.keys(r).forEach(function(e){c(e,r[e],t)}),e}return c(e,t,n),t},extend:function(e,t){return d[e]=t},abortLoad:function(){i.activeLoader?i.activeLoader.abort():(u(Ie.INIT),l("load-abort"))},retryLoad:function(){i.activeLoader&&i.activeLoader.load()},requestProcessing:function(){i.processingAborted=!1,u(Ie.PROCESSING_QUEUED)},abortProcessing:function(){return new Promise(function(e){if(!i.activeProcessor)return i.processingAborted=!0,u(Ie.IDLE),l("process-abort"),void e();a=function(){e()},i.activeProcessor.abort()})},load:function(t,n,r){i.source=t,f.fireSync("init"),i.file?f.fireSync("load-skip"):(i.file=function(e){var t=[e.name,e.size,e.type];return e instanceof Blob||Ye(e)?t[0]=e.name||Xe():Ye(e)?(t[1]=e.length,t[2]=Qe(e)):U(e)&&(t[0]=ke(e),t[1]=0,t[2]="application/octet-stream"),{name:t[0],size:t[1],type:t[2]}}(t),n.on("init",function(){l("load-init")}),n.on("meta",function(t){i.file.size=t.size,i.file.filename=t.filename,t.source&&(e=ve.LIMBO,i.serverFileReference=t.source,i.status=Ie.PROCESSING_COMPLETE),l("load-meta")}),n.on("progress",function(e){u(Ie.LOADING),l("load-progress",e)}),n.on("error",function(e){u(Ie.LOAD_ERROR),l("load-request-error",e)}),n.on("abort",function(){u(Ie.INIT),l("load-abort")}),n.on("load",function(t){i.activeLoader=null;var n=function(t){i.file=ht(t)?t:i.file,e===ve.LIMBO&&i.serverFileReference?u(Ie.PROCESSING_COMPLETE):u(Ie.IDLE),l("load")};i.serverFileReference?n(t):r(t,n,function(e){i.file=t,l("load-meta"),u(Ie.LOAD_ERROR),l("load-file-error",e)})}),n.setSource(t),i.activeLoader=n,n.load())},process:function e(t,n){if(i.processingAborted)i.processingAborted=!1;else if(u(Ie.PROCESSING),a=null,i.file instanceof Blob){t.on("load",function(e){i.transferId=null,i.serverFileReference=e}),t.on("transfer",function(e){i.transferId=e}),t.on("load-perceived",function(e){i.activeProcessor=null,i.transferId=null,i.serverFileReference=e,u(Ie.PROCESSING_COMPLETE),l("process-complete",e)}),t.on("start",function(){l("process-start")}),t.on("error",function(e){i.activeProcessor=null,u(Ie.PROCESSING_ERROR),l("process-error",e)}),t.on("abort",function(e){i.activeProcessor=null,i.serverFileReference=e,u(Ie.IDLE),l("process-abort"),a&&a()}),t.on("progress",function(e){l("process-progress",e)});var r=console.error;n(i.file,function(e){i.archived||t.process(e,Object.assign({},s))},r),i.activeProcessor=t}else f.on("load",function(){e(t,n)})},revert:function(e,t){return new Promise(function(n,r){var o=null!==i.serverFileReference?i.serverFileReference:i.transferId;null!==o?(e(o,function(){i.serverFileReference=null,i.transferId=null,n()},function(e){t?(u(Ie.PROCESSING_REVERT_ERROR),l("process-revert-error"),r(e)):n()}),u(Ie.IDLE),l("process-revert")):n()})}},pe(),{freeze:function(){return i.frozen=!0},release:function(){return i.released=!0},released:{get:function(){return i.released}},archive:function(){return i.archived=!0},archived:{get:function(){return i.archived}},setFile:function(e){return i.file=e}}),d=n(f);return d},Rt=function(e,t){var n=function(e,t){return M(t)?0:U(t)?e.findIndex(function(e){return e.id===t}):-1}(e,t);if(!(n<0))return e[n]||null},Ot=function(e,t,n,r,o,i){var a=rt(null,e,{method:"GET",responseType:"blob"});return a.onload=function(n){var r=n.getAllResponseHeaders(),o=et(r).name||ke(e);t(ot("load",n.status,We(n.response,o),r))},a.onerror=function(e){n(ot("error",e.status,e.statusText,e.getAllResponseHeaders()))},a.onheaders=function(e){i(ot("headers",e.status,null,e.getAllResponseHeaders()))},a.ontimeout=it(n),a.onprogress=r,a.onabort=o,a},yt=function(e){return 0===e.indexOf("//")&&(e=location.protocol+e),e.toLowerCase().replace("blob:","").replace(/([a-z])?:\/\//,"$1").split("/")[0]},Dt=function(e){return function(){return Y(e)?e.apply(void 0,arguments):e}},St=function(e,t){clearTimeout(t.listUpdateTimeout),t.listUpdateTimeout=setTimeout(function(){e("DID_UPDATE_ITEMS",{items:Pe(t.items)})},0)},At=function(e){for(var t=arguments.length,n=new Array(t>1?t-1:0),r=1;r<t;r++)n[r-1]=arguments[r];return new Promise(function(t){if(!e)return t(!0);var r=e.apply(void 0,n);return null==r?t(!0):"boolean"==typeof r?t(r):void("function"==typeof r.then&&r.then(t))})},Lt=function(e,t){e.items.sort(function(e,n){return t(Te(e),Te(n))})},bt=function(e,t){return function(){var n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=n.query,o=n.success,i=void 0===o?function(){}:o,a=n.failure,s=void 0===a?function(){}:a,u=se(n,["query","success","failure"]),l=Le(e.items,r);l?t(l,i,s,u||{}):s({error:ot("error",0,"Item not found"),file:null})}},Pt=function(e,t,n){return{ABORT_ALL:function(){Pe(n.items).forEach(function(e){e.freeze(),e.abortLoad(),e.abortProcessing()})},DID_SET_FILES:function(t){var r=t.value,o=(void 0===r?[]:r).map(function(e){return{source:e.source?e.source:e,options:e.options}}),i=Pe(n.items);i.forEach(function(t){o.find(function(e){return e.source===t.source||e.source===t.file})||e("REMOVE_ITEM",{query:t,remove:!1})}),i=Pe(n.items),o.forEach(function(t,n){i.find(function(e){return e.source===t.source||e.file===t.source})||e("ADD_ITEM",Object.assign({},t,{interactionMethod:re,index:n}))})},DID_UPDATE_ITEM_METADATA:function(r){var o=r.id,i=r.action,a=r.change;a.silent||(clearTimeout(n.itemUpdateTimeout),n.itemUpdateTimeout=setTimeout(function(){var r=Rt(n.items,o);if(t("IS_ASYNC")){r.origin===ve.LOCAL&&e("DID_LOAD_ITEM",{id:r.id,error:null,serverFileReference:r.source});var s,u=function(){setTimeout(function(){e("REQUEST_ITEM_PROCESSING",{query:o})},32)};return r.status===Ie.PROCESSING_COMPLETE?(s=n.options.instantUpload,void r.revert(Tt(n.options.server.url,n.options.server.revert),t("GET_FORCE_REVERT")).then(s?u:function(){}).catch(function(){})):r.status===Ie.PROCESSING?function(e){r.abortProcessing().then(e?u:function(){})}(n.options.instantUpload):void(n.options.instantUpload&&u())}Oe("SHOULD_PREPARE_OUTPUT",!1,{item:r,query:t,action:i,change:a}).then(function(n){var i=t("GET_BEFORE_PREPARE_FILE");i&&(n=i(r,n)),n&&e("REQUEST_PREPARE_OUTPUT",{query:o,item:r,success:function(t){e("DID_PREPARE_OUTPUT",{id:o,file:t})}},!0)})},0))},MOVE_ITEM:function(e){var t=e.query,r=e.index,o=Le(n.items,t);if(o){var i=n.items.indexOf(o);i!==(r=xe(r,0,n.items.length-1))&&n.items.splice(r,0,n.items.splice(i,1)[0])}},SORT:function(r){var o=r.compare;Lt(n,o),e("DID_SORT_ITEMS",{items:t("GET_ACTIVE_ITEMS")})},ADD_ITEMS:function(n){var r=n.items,o=n.index,i=n.interactionMethod,a=n.success,s=void 0===a?function(){}:a,u=n.failure,l=void 0===u?function(){}:u,c=o;if(-1===o||void 0===o){var f=t("GET_ITEM_INSERT_LOCATION"),d=t("GET_TOTAL_ITEMS");c="before"===f?0:d}var p=t("GET_IGNORED_FILES"),E=r.filter(function(e){return ht(e)?!p.includes(e.name.toLowerCase()):!M(e)}).map(function(t){return new Promise(function(n,r){e("ADD_ITEM",{interactionMethod:i,source:t.source||t,success:n,failure:r,index:c++,options:t.options||{}})})});Promise.all(E).then(s).catch(l)},ADD_ITEM:function(r){var o=r.source,i=r.index,a=void 0===i?-1:i,s=r.interactionMethod,u=r.success,l=void 0===u?function(){}:u,c=r.failure,f=void 0===c?function(){}:c,d=r.options,p=void 0===d?{}:d;if(M(o))f({error:ot("error",0,"No source"),file:null});else if(!ht(o)||!n.options.ignoredFiles.includes(o.name.toLowerCase())){if(!function(e){var t=Pe(e.items).length;if(!e.options.allowMultiple)return 0===t;var n=e.options.maxFiles;return null===n||t<n}(n)){if(n.options.allowMultiple||!n.options.allowMultiple&&!n.options.allowReplace){var E=ot("warning",0,"Max files");return e("DID_THROW_MAX_FILES",{source:o,error:E}),void f({error:E,file:null})}var _=Pe(n.items)[0];if(_.status===Ie.PROCESSING_COMPLETE||_.status===Ie.PROCESSING_REVERT_ERROR){var T=t("GET_FORCE_REVERT");if(_.revert(Tt(n.options.server.url,n.options.server.revert),T).then(function(){T&&e("ADD_ITEM",{source:o,index:a,interactionMethod:s,success:l,failure:f,options:p})}).catch(function(){}),T)return}e("REMOVE_ITEM",{query:_.id})}var I="local"===p.type?ve.LOCAL:"limbo"===p.type?ve.LIMBO:ve.INPUT,v=gt(I,I===ve.INPUT?null:o,p.file);Object.keys(p.metadata||{}).forEach(function(e){v.setMetadata(e,p.metadata[e])}),ye("DID_CREATE_ITEM",v,{query:t,dispatch:e});var m=t("GET_ITEM_INSERT_LOCATION");n.options.itemInsertLocationFreedom||(a="before"===m?-1:n.items.length),function(e,t,n){M(t)||(void 0===n?e.push(t):function(e,t,n){e.splice(t,0,n)}(e,n=xe(n,0,e.length),t))}(n.items,v,a),Y(m)&&o&&Lt(n,m);var h=v.id;v.on("init",function(){e("DID_INIT_ITEM",{id:h})}),v.on("load-init",function(){e("DID_START_ITEM_LOAD",{id:h})}),v.on("load-meta",function(){e("DID_UPDATE_ITEM_META",{id:h})}),v.on("load-progress",function(t){e("DID_UPDATE_ITEM_LOAD_PROGRESS",{id:h,progress:t})}),v.on("load-request-error",function(t){var r=Dt(n.options.labelFileLoadError)(t);if(t.code>=400&&t.code<500)return e("DID_THROW_ITEM_INVALID",{id:h,error:t,status:{main:r,sub:t.code+" ("+t.body+")"}}),void f({error:t,file:Te(v)});e("DID_THROW_ITEM_LOAD_ERROR",{id:h,error:t,status:{main:r,sub:n.options.labelTapToRetry}})}),v.on("load-file-error",function(t){e("DID_THROW_ITEM_INVALID",{id:h,error:t.status,status:t.status}),f({error:t.status,file:Te(v)})}),v.on("load-abort",function(){e("REMOVE_ITEM",{query:h})}),v.on("load-skip",function(){v.on("metadata-update",function(t){ht(v.file)&&e("DID_UPDATE_ITEM_METADATA",{id:h,change:t})}),e("COMPLETE_LOAD_ITEM",{query:h,item:v,data:{source:o,success:l}})}),v.on("load",function(){var r=function(r){r?(v.on("metadata-update",function(t){e("DID_UPDATE_ITEM_METADATA",{id:h,change:t})}),Oe("SHOULD_PREPARE_OUTPUT",!1,{item:v,query:t}).then(function(r){var i=t("GET_BEFORE_PREPARE_FILE");i&&(r=i(v,r));var a=function(){e("COMPLETE_LOAD_ITEM",{query:h,item:v,data:{source:o,success:l}}),St(e,n)};r?e("REQUEST_PREPARE_OUTPUT",{query:h,item:v,success:function(t){e("DID_PREPARE_OUTPUT",{id:h,file:t}),a()}},!0):a()})):e("REMOVE_ITEM",{query:h})};Oe("DID_LOAD_ITEM",v,{query:t,dispatch:e}).then(function(){At(t("GET_BEFORE_ADD_FILE"),Te(v)).then(r)}).catch(function(t){if(!t||!t.error||!t.status)return r(!1);e("DID_THROW_ITEM_INVALID",{id:h,error:t.error,status:t.status})})}),v.on("process-start",function(){e("DID_START_ITEM_PROCESSING",{id:h})}),v.on("process-progress",function(t){e("DID_UPDATE_ITEM_PROCESS_PROGRESS",{id:h,progress:t})}),v.on("process-error",function(t){e("DID_THROW_ITEM_PROCESSING_ERROR",{id:h,error:t,status:{main:Dt(n.options.labelFileProcessingError)(t),sub:n.options.labelTapToRetry}})}),v.on("process-revert-error",function(t){e("DID_THROW_ITEM_PROCESSING_REVERT_ERROR",{id:h,error:t,status:{main:Dt(n.options.labelFileProcessingRevertError)(t),sub:n.options.labelTapToRetry}})}),v.on("process-complete",function(t){e("DID_COMPLETE_ITEM_PROCESSING",{id:h,error:null,serverFileReference:t}),e("DID_DEFINE_VALUE",{id:h,value:t})}),v.on("process-abort",function(){e("DID_ABORT_ITEM_PROCESSING",{id:h})}),v.on("process-revert",function(){e("DID_REVERT_ITEM_PROCESSING",{id:h}),e("DID_DEFINE_VALUE",{id:h,value:null})}),e("DID_ADD_ITEM",{id:h,index:a,interactionMethod:s}),St(e,n);var g=n.options.server||{},R=g.url,O=g.load,y=g.restore,D=g.fetch;v.load(o,tt(I===ve.INPUT?U(o)&&function(e){return(e.indexOf(":")>-1||e.indexOf("//")>-1)&&yt(location.href)!==yt(e)}(o)&&D?ut(R,D):Ot:ut(R,I===ve.LIMBO?y:O)),function(e,n,r){Oe("LOAD_FILE",e,{query:t}).then(n).catch(r)})}},REQUEST_PREPARE_OUTPUT:function(e){var n=e.item,r=e.success,o=e.failure,i=void 0===o?function(){}:o,a={error:ot("error",0,"Item not found"),file:null};if(n.archived)return i(a);Oe("PREPARE_OUTPUT",n.file,{query:t,item:n}).then(function(e){Oe("COMPLETE_PREPARE_OUTPUT",e,{query:t,item:n}).then(function(e){if(n.archived)return i(a);r(e)})})},COMPLETE_LOAD_ITEM:function(r){var o=r.item,i=r.data,a=i.success,s=i.source,u=t("GET_ITEM_INSERT_LOCATION");if(Y(u)&&s&&Lt(n,u),e("DID_LOAD_ITEM",{id:o.id,error:null,serverFileReference:o.origin===ve.INPUT?null:s}),a(Te(o)),o.origin!==ve.LOCAL)return o.origin===ve.LIMBO?(e("DID_COMPLETE_ITEM_PROCESSING",{id:o.id,error:null,serverFileReference:s}),void e("DID_DEFINE_VALUE",{id:o.id,value:o.serverId||s})):void(t("IS_ASYNC")&&n.options.instantUpload&&e("REQUEST_ITEM_PROCESSING",{query:o.id}));e("DID_LOAD_LOCAL_ITEM",{id:o.id})},RETRY_ITEM_LOAD:bt(n,function(e){e.retryLoad()}),REQUEST_ITEM_PREPARE:bt(n,function(t,n,r){e("REQUEST_PREPARE_OUTPUT",{query:t.id,item:t,success:function(r){e("DID_PREPARE_OUTPUT",{id:t.id,file:r}),n({file:t,output:r})},failure:r},!0)}),REQUEST_ITEM_PROCESSING:bt(n,function(r,o,i){if(r.status===Ie.IDLE||r.status===Ie.PROCESSING_ERROR)r.status!==Ie.PROCESSING_QUEUED&&(r.requestProcessing(),e("DID_REQUEST_ITEM_PROCESSING",{id:r.id}),e("PROCESS_ITEM",{query:r,success:o,failure:i},!0));else{var a=function(){return e("REQUEST_ITEM_PROCESSING",{query:r,success:o,failure:i})},s=function(){return document.hidden?a():setTimeout(a,32)};r.status===Ie.PROCESSING_COMPLETE||r.status===Ie.PROCESSING_REVERT_ERROR?r.revert(Tt(n.options.server.url,n.options.server.revert),t("GET_FORCE_REVERT")).then(s).catch(function(){}):r.status===Ie.PROCESSING&&r.abortProcessing().then(s)}}),PROCESS_ITEM:bt(n,function(r,o,i){var a=t("GET_MAX_PARALLEL_UPLOADS");if(t("GET_ITEMS_BY_STATUS",Ie.PROCESSING).length!==a){if(r.status!==Ie.PROCESSING){var s=function t(){var r=n.processingQueue.shift();if(r){var o=r.id,i=r.success,a=r.failure,s=Le(n.items,o);s&&!s.archived?e("PROCESS_ITEM",{query:o,success:i,failure:a},!0):t()}};r.onOnce("process-complete",function(){o(Te(r)),s();var i=n.options.server;if(n.options.instantUpload&&r.origin===ve.LOCAL&&Y(i.remove)){var a=function(){};r.origin=ve.LIMBO,n.options.server.remove(r.source,a,a)}t("GET_ITEMS_BY_STATUS",Ie.PROCESSING_COMPLETE).length===n.items.length&&e("DID_COMPLETE_ITEM_PROCESSING_ALL")}),r.onOnce("process-error",function(e){i({error:e,file:Te(r)}),s()}),r.onOnce("process-abort",function(){s()});var u=n.options;r.process(vt(_t(u.server.url,u.server.process,u.name,{chunkTransferId:r.transferId,chunkServer:u.server.patch,chunkUploads:u.chunkUploads,chunkForce:u.chunkForce,chunkSize:u.chunkSize,chunkRetryDelays:u.chunkRetryDelays}),{allowMinimumUploadDuration:t("GET_ALLOW_MINIMUM_UPLOAD_DURATION")}),function(n,o,i){Oe("PREPARE_OUTPUT",n,{query:t,item:r}).then(function(t){e("DID_PREPARE_OUTPUT",{id:r.id,file:t}),o(t)}).catch(i)})}}else n.processingQueue.push({id:r.id,success:o,failure:i})}),RETRY_ITEM_PROCESSING:bt(n,function(t){e("REQUEST_ITEM_PROCESSING",{query:t})}),REQUEST_REMOVE_ITEM:bt(n,function(n){At(t("GET_BEFORE_REMOVE_FILE"),Te(n)).then(function(t){t&&e("REMOVE_ITEM",{query:n})})}),RELEASE_ITEM:bt(n,function(e){e.release()}),REMOVE_ITEM:bt(n,function(r,o,i,a){var s=function(){var t=r.id;Rt(n.items,t).archive(),e("DID_REMOVE_ITEM",{error:null,id:t,item:r}),St(e,n),o(Te(r))},u=n.options.server;r.origin===ve.LOCAL&&u&&Y(u.remove)&&!1!==a.remove?(e("DID_START_ITEM_REMOVE",{id:r.id}),u.remove(r.source,function(){return s()},function(t){e("DID_THROW_ITEM_REMOVE_ERROR",{id:r.id,error:ot("error",0,t,null),status:{main:Dt(n.options.labelFileRemoveError)(t),sub:n.options.labelTapToRetry}})})):((a.revert&&r.origin!==ve.LOCAL&&null!==r.serverId||n.options.chunkUploads&&r.file.size>n.options.chunkSize||n.options.chunkUploads&&n.options.chunkForce)&&r.revert(Tt(n.options.server.url,n.options.server.revert),t("GET_FORCE_REVERT")),s())}),ABORT_ITEM_LOAD:bt(n,function(e){e.abortLoad()}),ABORT_ITEM_PROCESSING:bt(n,function(t){t.serverId?e("REVERT_ITEM_PROCESSING",{id:t.id}):t.abortProcessing().then(function(){n.options.instantUpload&&e("REMOVE_ITEM",{query:t.id})})}),REQUEST_REVERT_ITEM_PROCESSING:bt(n,function(r){if(n.options.instantUpload){var o=function(t){t&&e("REVERT_ITEM_PROCESSING",{query:r})},i=t("GET_BEFORE_REMOVE_FILE");if(!i)return o(!0);var a=i(Te(r));return null==a?o(!0):"boolean"==typeof a?o(a):void("function"==typeof a.then&&a.then(o))}e("REVERT_ITEM_PROCESSING",{query:r})}),REVERT_ITEM_PROCESSING:bt(n,function(r){r.revert(Tt(n.options.server.url,n.options.server.revert),t("GET_FORCE_REVERT")).then(function(){(n.options.instantUpload||function(e){return!ht(e.file)}(r))&&e("REMOVE_ITEM",{query:r.id})}).catch(function(){})}),SET_OPTIONS:function(t){var n=t.options,r=Object.keys(n),o=Mt.filter(function(e){return r.includes(e)});[].concat(ue(o),ue(Object.keys(n).filter(function(e){return!o.includes(e)}))).forEach(function(t){e("SET_"+Z(t,"_").toUpperCase(),{value:n[t]})})}}},Mt=["server"],wt=function(e){return e},Ct=function(e){return document.createElement(e)},Nt=function(e,t){var n=e.childNodes[0];n?t!==n.nodeValue&&(n.nodeValue=t):(n=document.createTextNode(t),e.appendChild(n))},Gt=function(e,t,n,r){var o=(r%360-90)*Math.PI/180;return{x:e+n*Math.cos(o),y:t+n*Math.sin(o)}},Ut=function(e,t,n,r,o){var i=1;return o>r&&o-r<=.5&&(i=0),r>o&&r-o>=.5&&(i=0),function(e,t,n,r,o,i){var a=Gt(e,t,n,o),s=Gt(e,t,n,r);return["M",a.x,a.y,"A",n,n,0,i,0,s.x,s.y].join(" ")}(e,t,n,360*Math.min(.9999,r),360*Math.min(.9999,o),i)},Bt=S({tag:"div",name:"progress-indicator",ignoreRectUpdate:!0,ignoreRect:!0,create:function(e){var t=e.root,n=e.props;n.spin=!1,n.progress=0,n.opacity=0;var r=a("svg");t.ref.path=a("path",{"stroke-width":2,"stroke-linecap":"round"}),r.appendChild(t.ref.path),t.ref.svg=r,t.appendChild(r)},write:function(e){var t=e.root,n=e.props;if(0!==n.opacity){n.align&&(t.element.dataset.align=n.align);var o=parseInt(r(t.ref.path,"stroke-width"),10),i=.5*t.rect.element.width,a=0,s=0;n.spin?(a=0,s=.5):(a=0,s=n.progress);var u=Ut(i,i,i-o,a,s);r(t.ref.path,"d",u),r(t.ref.path,"stroke-opacity",n.spin||n.progress>0?1:0)}},mixins:{apis:["progress","spin","align"],styles:["opacity"],animations:{opacity:{type:"tween",duration:500},progress:{type:"spring",stiffness:.95,damping:.65,mass:10}}}}),Ft=S({tag:"button",attributes:{type:"button"},ignoreRect:!0,ignoreRectUpdate:!0,name:"file-action-button",mixins:{apis:["label"],styles:["translateX","translateY","scaleX","scaleY","opacity"],animations:{scaleX:"spring",scaleY:"spring",translateX:"spring",translateY:"spring",opacity:{type:"tween",duration:250}},listeners:!0},create:function(e){var t=e.root,n=e.props;t.element.innerHTML=(n.icon||"")+"<span>"+n.label+"</span>",n.isDisabled=!1},write:function(e){var t=e.root,n=e.props,o=n.isDisabled,i=t.query("GET_DISABLED")||0===n.opacity;i&&!o?(n.isDisabled=!0,r(t.element,"disabled","disabled")):!i&&o&&(n.isDisabled=!1,t.element.removeAttribute("disabled"))}}),qt=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:".",n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1e3,r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},o=r.labelBytes,i=void 0===o?"bytes":o,a=r.labelKilobytes,s=void 0===a?"KB":a,u=r.labelMegabytes,l=void 0===u?"MB":u,c=r.labelGigabytes,f=void 0===c?"GB":c,d=n,p=n*n,E=n*n*n;return(e=Math.round(Math.abs(e)))<d?e+" "+i:e<p?Math.floor(e/d)+" "+s:e<E?Vt(e/p,1,t)+" "+l:Vt(e/E,2,t)+" "+f},Vt=function(e,t,n){return e.toFixed(t).split(".").filter(function(e){return"0"!==e}).join(n)},xt=function(e){var t=e.root,n=e.props;Nt(t.ref.fileSize,qt(t.query("GET_ITEM_SIZE",n.id),".",t.query("GET_FILE_SIZE_BASE"),t.query("GET_FILE_SIZE_LABELS",t.query))),Nt(t.ref.fileName,wt(t.query("GET_ITEM_NAME",n.id)))},Yt=function(e){var t=e.root,n=e.props;V(t.query("GET_ITEM_SIZE",n.id))?xt({root:t,props:n}):Nt(t.ref.fileSize,t.query("GET_LABEL_FILE_SIZE_NOT_AVAILABLE"))},kt=S({name:"file-info",ignoreRect:!0,ignoreRectUpdate:!0,write:A({DID_LOAD_ITEM:xt,DID_UPDATE_ITEM_META:xt,DID_THROW_ITEM_LOAD_ERROR:Yt,DID_THROW_ITEM_INVALID:Yt}),didCreateView:function(e){ye("CREATE_VIEW",Object.assign({},e,{view:e}))},create:function(e){var t=e.root,n=e.props,o=Ct("span");o.className="filepond--file-info-main",r(o,"aria-hidden","true"),t.appendChild(o),t.ref.fileName=o;var i=Ct("span");i.className="filepond--file-info-sub",t.appendChild(i),t.ref.fileSize=i,Nt(i,t.query("GET_LABEL_FILE_WAITING_FOR_SIZE")),Nt(o,wt(t.query("GET_ITEM_NAME",n.id)))},mixins:{styles:["translateX","translateY"],animations:{translateX:"spring",translateY:"spring"}}}),jt=function(e){return Math.round(100*e)},Ht=function(e){var t=e.root,n=e.action,r=null===n.progress?t.query("GET_LABEL_FILE_LOADING"):t.query("GET_LABEL_FILE_LOADING")+" "+jt(n.progress)+"%";Nt(t.ref.main,r),Nt(t.ref.sub,t.query("GET_LABEL_TAP_TO_CANCEL"))},Xt=function(e){var t=e.root;Nt(t.ref.main,""),Nt(t.ref.sub,"")},Wt=function(e){var t=e.root,n=e.action;Nt(t.ref.main,n.status.main),Nt(t.ref.sub,n.status.sub)},zt=S({name:"file-status",ignoreRect:!0,ignoreRectUpdate:!0,write:A({DID_LOAD_ITEM:Xt,DID_REVERT_ITEM_PROCESSING:Xt,DID_REQUEST_ITEM_PROCESSING:function(e){var t=e.root;Nt(t.ref.main,t.query("GET_LABEL_FILE_PROCESSING")),Nt(t.ref.sub,t.query("GET_LABEL_TAP_TO_CANCEL"))},DID_ABORT_ITEM_PROCESSING:function(e){var t=e.root;Nt(t.ref.main,t.query("GET_LABEL_FILE_PROCESSING_ABORTED")),Nt(t.ref.sub,t.query("GET_LABEL_TAP_TO_RETRY"))},DID_COMPLETE_ITEM_PROCESSING:function(e){var t=e.root;Nt(t.ref.main,t.query("GET_LABEL_FILE_PROCESSING_COMPLETE")),Nt(t.ref.sub,t.query("GET_LABEL_TAP_TO_UNDO"))},DID_UPDATE_ITEM_PROCESS_PROGRESS:function(e){var t=e.root,n=e.action,r=null===n.progress?t.query("GET_LABEL_FILE_PROCESSING"):t.query("GET_LABEL_FILE_PROCESSING")+" "+jt(n.progress)+"%";Nt(t.ref.main,r),Nt(t.ref.sub,t.query("GET_LABEL_TAP_TO_CANCEL"))},DID_UPDATE_ITEM_LOAD_PROGRESS:Ht,DID_THROW_ITEM_LOAD_ERROR:Wt,DID_THROW_ITEM_INVALID:Wt,DID_THROW_ITEM_PROCESSING_ERROR:Wt,DID_THROW_ITEM_PROCESSING_REVERT_ERROR:Wt,DID_THROW_ITEM_REMOVE_ERROR:Wt}),didCreateView:function(e){ye("CREATE_VIEW",Object.assign({},e,{view:e}))},create:function(e){var t=e.root,n=Ct("span");n.className="filepond--file-status-main",t.appendChild(n),t.ref.main=n;var r=Ct("span");r.className="filepond--file-status-sub",t.appendChild(r),t.ref.sub=r,Ht({root:t,action:{progress:null}})},mixins:{styles:["translateX","translateY","opacity"],animations:{opacity:{type:"tween",duration:250},translateX:"spring",translateY:"spring"}}}),Qt={AbortItemLoad:{label:"GET_LABEL_BUTTON_ABORT_ITEM_LOAD",action:"ABORT_ITEM_LOAD",className:"filepond--action-abort-item-load",align:"LOAD_INDICATOR_POSITION"},RetryItemLoad:{label:"GET_LABEL_BUTTON_RETRY_ITEM_LOAD",action:"RETRY_ITEM_LOAD",icon:"GET_ICON_RETRY",className:"filepond--action-retry-item-load",align:"BUTTON_PROCESS_ITEM_POSITION"},RemoveItem:{label:"GET_LABEL_BUTTON_REMOVE_ITEM",action:"REQUEST_REMOVE_ITEM",icon:"GET_ICON_REMOVE",className:"filepond--action-remove-item",align:"BUTTON_REMOVE_ITEM_POSITION"},ProcessItem:{label:"GET_LABEL_BUTTON_PROCESS_ITEM",action:"REQUEST_ITEM_PROCESSING",icon:"GET_ICON_PROCESS",className:"filepond--action-process-item",align:"BUTTON_PROCESS_ITEM_POSITION"},AbortItemProcessing:{label:"GET_LABEL_BUTTON_ABORT_ITEM_PROCESSING",action:"ABORT_ITEM_PROCESSING",className:"filepond--action-abort-item-processing",align:"BUTTON_PROCESS_ITEM_POSITION"},RetryItemProcessing:{label:"GET_LABEL_BUTTON_RETRY_ITEM_PROCESSING",action:"RETRY_ITEM_PROCESSING",icon:"GET_ICON_RETRY",className:"filepond--action-retry-item-processing",align:"BUTTON_PROCESS_ITEM_POSITION"},RevertItemProcessing:{label:"GET_LABEL_BUTTON_UNDO_ITEM_PROCESSING",action:"REQUEST_REVERT_ITEM_PROCESSING",icon:"GET_ICON_UNDO",className:"filepond--action-revert-item-processing",align:"BUTTON_PROCESS_ITEM_POSITION"}},Zt=[];t(Qt,function(e){Zt.push(e)});var Kt,$t=function(e){if("right"===nn(e))return 0;var t=e.ref.buttonRemoveItem.rect.element;return t.hidden?null:t.width+t.left},Jt=function(e){return e.ref.buttonAbortItemLoad.rect.element.width},en=function(e){return Math.floor(e.ref.buttonRemoveItem.rect.element.height/4)},tn=function(e){return Math.floor(e.ref.buttonRemoveItem.rect.element.left/2)},nn=function(e){return e.query("GET_STYLE_BUTTON_REMOVE_ITEM_POSITION")},rn={buttonAbortItemLoad:{opacity:0},buttonRetryItemLoad:{opacity:0},buttonRemoveItem:{opacity:0},buttonProcessItem:{opacity:0},buttonAbortItemProcessing:{opacity:0},buttonRetryItemProcessing:{opacity:0},buttonRevertItemProcessing:{opacity:0},loadProgressIndicator:{opacity:0,align:function(e){return e.query("GET_STYLE_LOAD_INDICATOR_POSITION")}},processProgressIndicator:{opacity:0,align:function(e){return e.query("GET_STYLE_PROGRESS_INDICATOR_POSITION")}},processingCompleteIndicator:{opacity:0,scaleX:.75,scaleY:.75},info:{translateX:0,translateY:0,opacity:0},status:{translateX:0,translateY:0,opacity:0}},on={buttonRemoveItem:{opacity:1},buttonProcessItem:{opacity:1},info:{translateX:$t},status:{translateX:$t}},an={buttonAbortItemProcessing:{opacity:1},processProgressIndicator:{opacity:1},status:{opacity:1}},sn={DID_THROW_ITEM_INVALID:{buttonRemoveItem:{opacity:1},info:{translateX:$t},status:{translateX:$t,opacity:1}},DID_START_ITEM_LOAD:{buttonAbortItemLoad:{opacity:1},loadProgressIndicator:{opacity:1},status:{opacity:1}},DID_THROW_ITEM_LOAD_ERROR:{buttonRetryItemLoad:{opacity:1},buttonRemoveItem:{opacity:1},info:{translateX:$t},status:{opacity:1}},DID_START_ITEM_REMOVE:{processProgressIndicator:{opacity:1,align:nn},info:{translateX:$t},status:{opacity:0}},DID_THROW_ITEM_REMOVE_ERROR:{processProgressIndicator:{opacity:0,align:nn},buttonRemoveItem:{opacity:1},info:{translateX:$t},status:{opacity:1,translateX:$t}},DID_LOAD_ITEM:on,DID_LOAD_LOCAL_ITEM:{buttonRemoveItem:{opacity:1},info:{translateX:$t},status:{translateX:$t}},DID_START_ITEM_PROCESSING:an,DID_REQUEST_ITEM_PROCESSING:an,DID_UPDATE_ITEM_PROCESS_PROGRESS:an,DID_COMPLETE_ITEM_PROCESSING:{buttonRevertItemProcessing:{opacity:1},info:{opacity:1},status:{opacity:1}},DID_THROW_ITEM_PROCESSING_ERROR:{buttonRemoveItem:{opacity:1},buttonRetryItemProcessing:{opacity:1},status:{opacity:1},info:{translateX:$t}},DID_THROW_ITEM_PROCESSING_REVERT_ERROR:{buttonRevertItemProcessing:{opacity:1},status:{opacity:1},info:{opacity:1}},DID_ABORT_ITEM_PROCESSING:{buttonRemoveItem:{opacity:1},buttonProcessItem:{opacity:1},info:{translateX:$t},status:{opacity:1}},DID_REVERT_ITEM_PROCESSING:on},un=S({create:function(e){var t=e.root;t.element.innerHTML=t.query("GET_ICON_DONE")},name:"processing-complete-indicator",ignoreRect:!0,mixins:{styles:["scaleX","scaleY","opacity"],animations:{scaleX:"spring",scaleY:"spring",opacity:{type:"tween",duration:250}}}}),ln=A({DID_SET_LABEL_BUTTON_ABORT_ITEM_PROCESSING:function(e){var t=e.root,n=e.action;t.ref.buttonAbortItemProcessing.label=n.value},DID_SET_LABEL_BUTTON_ABORT_ITEM_LOAD:function(e){var t=e.root,n=e.action;t.ref.buttonAbortItemLoad.label=n.value},DID_SET_LABEL_BUTTON_ABORT_ITEM_REMOVAL:function(e){var t=e.root,n=e.action;t.ref.buttonAbortItemRemoval.label=n.value},DID_REQUEST_ITEM_PROCESSING:function(e){var t=e.root;t.ref.processProgressIndicator.spin=!0,t.ref.processProgressIndicator.progress=0},DID_START_ITEM_LOAD:function(e){var t=e.root;t.ref.loadProgressIndicator.spin=!0,t.ref.loadProgressIndicator.progress=0},DID_START_ITEM_REMOVE:function(e){var t=e.root;t.ref.processProgressIndicator.spin=!0,t.ref.processProgressIndicator.progress=0},DID_UPDATE_ITEM_LOAD_PROGRESS:function(e){var t=e.root,n=e.action;t.ref.loadProgressIndicator.spin=!1,t.ref.loadProgressIndicator.progress=n.progress},DID_UPDATE_ITEM_PROCESS_PROGRESS:function(e){var t=e.root,n=e.action;t.ref.processProgressIndicator.spin=!1,t.ref.processProgressIndicator.progress=n.progress}}),cn=S({create:function(e){var n,r=e.root,o=e.props,i=Object.keys(Qt).reduce(function(e,t){return e[t]=Object.assign({},Qt[t]),e},{}),a=o.id,s=r.query("GET_ALLOW_REVERT"),u=r.query("GET_ALLOW_REMOVE"),l=r.query("GET_ALLOW_PROCESS"),c=r.query("GET_INSTANT_UPLOAD"),f=r.query("IS_ASYNC"),d=r.query("GET_STYLE_BUTTON_REMOVE_ITEM_ALIGN");f?l&&!s?n=function(e){return!/RevertItemProcessing/.test(e)}:!l&&s?n=function(e){return!/ProcessItem|RetryItemProcessing|AbortItemProcessing/.test(e)}:l||s||(n=function(e){return!/Process/.test(e)}):n=function(e){return!/Process/.test(e)};var p=n?Zt.filter(n):Zt.concat();if(c&&s&&(i.RevertItemProcessing.label="GET_LABEL_BUTTON_REMOVE_ITEM",i.RevertItemProcessing.icon="GET_ICON_REMOVE"),f&&!s){var E=sn.DID_COMPLETE_ITEM_PROCESSING;E.info.translateX=tn,E.info.translateY=en,E.status.translateY=en,E.processingCompleteIndicator={opacity:1,scaleX:1,scaleY:1}}if(f&&!l&&(["DID_START_ITEM_PROCESSING","DID_REQUEST_ITEM_PROCESSING","DID_UPDATE_ITEM_PROCESS_PROGRESS","DID_THROW_ITEM_PROCESSING_ERROR"].forEach(function(e){sn[e].status.translateY=en}),sn.DID_THROW_ITEM_PROCESSING_ERROR.status.translateX=Jt),d&&s){i.RevertItemProcessing.align="BUTTON_REMOVE_ITEM_POSITION";var _=sn.DID_COMPLETE_ITEM_PROCESSING;_.info.translateX=$t,_.status.translateY=en,_.processingCompleteIndicator={opacity:1,scaleX:1,scaleY:1}}u||(i.RemoveItem.disabled=!0),t(i,function(e,t){var n=r.createChildView(Ft,{label:r.query(t.label),icon:r.query(t.icon),opacity:0});p.includes(e)&&r.appendChildView(n),t.disabled&&(n.element.setAttribute("disabled","disabled"),n.element.setAttribute("hidden","hidden")),n.element.dataset.align=r.query("GET_STYLE_"+t.align),n.element.classList.add(t.className),n.on("click",function(e){e.stopPropagation(),t.disabled||r.dispatch(t.action,{query:a})}),r.ref["button"+e]=n}),r.ref.processingCompleteIndicator=r.appendChildView(r.createChildView(un)),r.ref.processingCompleteIndicator.element.dataset.align=r.query("GET_STYLE_BUTTON_PROCESS_ITEM_POSITION"),r.ref.info=r.appendChildView(r.createChildView(kt,{id:a})),r.ref.status=r.appendChildView(r.createChildView(zt,{id:a}));var T=r.appendChildView(r.createChildView(Bt,{opacity:0,align:r.query("GET_STYLE_LOAD_INDICATOR_POSITION")}));T.element.classList.add("filepond--load-indicator"),r.ref.loadProgressIndicator=T;var I=r.appendChildView(r.createChildView(Bt,{opacity:0,align:r.query("GET_STYLE_PROGRESS_INDICATOR_POSITION")}));I.element.classList.add("filepond--process-indicator"),r.ref.processProgressIndicator=I,r.ref.activeStyles=[]},write:function(e){var n=e.root,r=e.actions,o=e.props;ln({root:n,actions:r,props:o});var i=r.concat().filter(function(e){return/^DID_/.test(e.type)}).reverse().find(function(e){return sn[e.type]});if(i){n.ref.activeStyles=[];var a=sn[i.type];t(rn,function(e,r){var o=n.ref[e];t(r,function(t,r){var i=a[e]&&void 0!==a[e][t]?a[e][t]:r;n.ref.activeStyles.push({control:o,key:t,value:i})})})}n.ref.activeStyles.forEach(function(e){var t=e.control,r=e.key,o=e.value;t[r]="function"==typeof o?o(n):o})},didCreateView:function(e){ye("CREATE_VIEW",Object.assign({},e,{view:e}))},name:"file"}),fn=S({create:function(e){var t=e.root,n=e.props;t.ref.fileName=Ct("legend"),t.appendChild(t.ref.fileName),t.ref.file=t.appendChildView(t.createChildView(cn,{id:n.id})),t.ref.data=!1},ignoreRect:!0,write:A({DID_LOAD_ITEM:function(e){var t=e.root,n=e.props;Nt(t.ref.fileName,wt(t.query("GET_ITEM_NAME",n.id)))}}),didCreateView:function(e){ye("CREATE_VIEW",Object.assign({},e,{view:e}))},tag:"fieldset",name:"file-wrapper"}),dn={type:"spring",damping:.6,mass:7},pn=function(e,t,n){var r=S({name:"panel-"+t.name+" filepond--"+n,mixins:t.mixins,ignoreRectUpdate:!0}),o=e.createChildView(r,t.props);e.ref[t.name]=e.appendChildView(o)},En=S({name:"panel",read:function(e){var t=e.root;return e.props.heightCurrent=t.ref.bottom.translateY},write:function(e){var t=e.root,n=e.props;if(null!==t.ref.scalable&&n.scalable===t.ref.scalable||(t.ref.scalable=!N(n.scalable)||n.scalable,t.element.dataset.scalable=t.ref.scalable),n.height){var r=t.ref.top.rect.element,o=t.ref.bottom.rect.element,i=Math.max(r.height+o.height,n.height);t.ref.center.translateY=r.height,t.ref.center.scaleY=(i-r.height-o.height)/100,t.ref.bottom.translateY=i-o.height}},create:function(e){var t=e.root,n=e.props;[{name:"top"},{name:"center",props:{translateY:null,scaleY:null},mixins:{animations:{scaleY:dn},styles:["translateY","scaleY"]}},{name:"bottom",props:{translateY:null},mixins:{animations:{translateY:dn},styles:["translateY"]}}].forEach(function(e){pn(t,e,n.name)}),t.element.classList.add("filepond--"+n.name),t.ref.scalable=null},ignoreRect:!0,mixins:{apis:["height","heightCurrent","scalable"]}}),_n={type:"spring",stiffness:.75,damping:.45,mass:10},Tn={DID_START_ITEM_LOAD:"busy",DID_UPDATE_ITEM_LOAD_PROGRESS:"loading",DID_THROW_ITEM_INVALID:"load-invalid",DID_THROW_ITEM_LOAD_ERROR:"load-error",DID_LOAD_ITEM:"idle",DID_THROW_ITEM_REMOVE_ERROR:"remove-error",DID_START_ITEM_REMOVE:"busy",DID_START_ITEM_PROCESSING:"busy processing",DID_REQUEST_ITEM_PROCESSING:"busy processing",DID_UPDATE_ITEM_PROCESS_PROGRESS:"processing",DID_COMPLETE_ITEM_PROCESSING:"processing-complete",DID_THROW_ITEM_PROCESSING_ERROR:"processing-error",DID_THROW_ITEM_PROCESSING_REVERT_ERROR:"processing-revert-error",DID_ABORT_ITEM_PROCESSING:"cancelled",DID_REVERT_ITEM_PROCESSING:"idle"},In=A({DID_UPDATE_PANEL_HEIGHT:function(e){var t=e.root,n=e.action;t.height=n.height}}),vn=A({DID_GRAB_ITEM:function(e){var t=e.root;e.props.dragOrigin={x:t.translateX,y:t.translateY}},DID_DRAG_ITEM:function(e){e.root.element.dataset.dragState="drag"},DID_DROP_ITEM:function(e){var t=e.root,n=e.props;n.dragOffset=null,n.dragOrigin=null,t.element.dataset.dragState="drop"}},function(e){var t=e.root,n=e.actions,r=e.props,o=e.shouldOptimize;"drop"===t.element.dataset.dragState&&t.scaleX<=1&&(t.element.dataset.dragState="idle");var i=n.concat().filter(function(e){return/^DID_/.test(e.type)}).reverse().find(function(e){return Tn[e.type]});i&&i.type!==r.currentState&&(r.currentState=i.type,t.element.dataset.filepondItemState=Tn[r.currentState]||"");var a=t.query("GET_ITEM_PANEL_ASPECT_RATIO")||t.query("GET_PANEL_ASPECT_RATIO");a?o||(t.height=t.rect.element.width*a):(In({root:t,actions:n,props:r}),!t.height&&t.ref.container.rect.element.height>0&&(t.height=t.ref.container.rect.element.height)),o&&(t.ref.panel.height=null),t.ref.panel.height=t.height}),mn=S({create:function(e){var t=e.root,n=e.props;t.ref.handleClick=function(e){return t.dispatch("DID_ACTIVATE_ITEM",{id:n.id})},t.element.id="filepond--item-"+n.id,t.element.addEventListener("click",t.ref.handleClick),t.ref.container=t.appendChildView(t.createChildView(fn,{id:n.id})),t.ref.panel=t.appendChildView(t.createChildView(En,{name:"item-panel"})),t.ref.panel.height=null,n.markedForRemoval=!1,t.query("GET_ALLOW_REORDER")&&(t.element.dataset.dragState="idle",t.element.addEventListener("pointerdown",function(e){if(e.isPrimary){var r=!1,o=e.pageX,i=e.pageY;n.dragOrigin={x:t.translateX,y:t.translateY},n.dragCenter={x:e.offsetX,y:e.offsetY};var a,s,u,l=(a=t.query("GET_ACTIVE_ITEMS"),s=a.map(function(e){return e.id}),u=void 0,{setIndex:function(e){u=e},getIndex:function(){return u},getItemIndex:function(e){return s.indexOf(e.id)}});t.dispatch("DID_GRAB_ITEM",{id:n.id,dragState:l});var c=function(e){e.isPrimary&&(e.stopPropagation(),e.preventDefault(),n.dragOffset={x:e.pageX-o,y:e.pageY-i},n.dragOffset.x*n.dragOffset.x+n.dragOffset.y*n.dragOffset.y>16&&!r&&(r=!0,t.element.removeEventListener("click",t.ref.handleClick)),t.dispatch("DID_DRAG_ITEM",{id:n.id,dragState:l}))},f=function(e){e.isPrimary&&(n.dragOffset={x:e.pageX-o,y:e.pageY-i},p())},d=function(){p()},p=function(){document.removeEventListener("pointercancel",d),document.removeEventListener("pointermove",c),document.removeEventListener("pointerup",f),t.dispatch("DID_DROP_ITEM",{id:n.id,dragState:l}),r&&setTimeout(function(){return t.element.addEventListener("click",t.ref.handleClick)},0)};document.addEventListener("pointercancel",d),document.addEventListener("pointermove",c),document.addEventListener("pointerup",f)}}))},write:vn,destroy:function(e){var t=e.root,n=e.props;t.element.removeEventListener("click",t.ref.handleClick),t.dispatch("RELEASE_ITEM",{query:n.id})},tag:"li",name:"item",mixins:{apis:["id","interactionMethod","markedForRemoval","spawnDate","dragCenter","dragOrigin","dragOffset"],styles:["translateX","translateY","scaleX","scaleY","opacity","height"],animations:{scaleX:"spring",scaleY:"spring",translateX:_n,translateY:_n,opacity:{type:"tween",duration:150}}}}),hn=function(e,t){return Math.max(1,Math.floor((e+1)/t))},gn=function(e,t,n){if(n){var r=e.rect.element.width,o=t.length,i=null;if(0===o||n.top<t[0].rect.element.top)return-1;var a=t[0].rect.element,s=a.marginLeft+a.marginRight,u=a.width+s,l=hn(r,u);if(1===l){for(var c=0;c<o;c++){var f=t[c],d=f.rect.outer.top+.5*f.rect.element.height;if(n.top<d)return c}return o}for(var p=a.marginTop+a.marginBottom,E=a.height+p,_=0;_<o;_++){var T=_%l*u,I=Math.floor(_/l)*E,v=I-a.marginTop,m=T+u,h=I+E+a.marginBottom;if(n.top<h&&n.top>v){if(n.left<m)return _;i=_!==o-1?_:null}}return null!==i?i:o}},Rn={height:0,width:0,get getHeight(){return this.height},set setHeight(e){0!==this.height&&0!==e||(this.height=e)},get getWidth(){return this.width},set setWidth(e){0!==this.width&&0!==e||(this.width=e)},setDimensions:function(e,t){0!==this.height&&0!==e||(this.height=e),0!==this.width&&0!==t||(this.width=t)}},On=function(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:0,o=arguments.length>4&&void 0!==arguments[4]?arguments[4]:1;e.dragOffset?(e.translateX=null,e.translateY=null,e.translateX=e.dragOrigin.x+e.dragOffset.x,e.translateY=e.dragOrigin.y+e.dragOffset.y,e.scaleX=1.025,e.scaleY=1.025):(e.translateX=t,e.translateY=n,Date.now()>e.spawnDate&&(0===e.opacity&&yn(e,t,n,r,o),e.scaleX=1,e.scaleY=1,e.opacity=1))},yn=function(e,t,n,r,o){e.interactionMethod===re?(e.translateX=null,e.translateX=t,e.translateY=null,e.translateY=n):e.interactionMethod===ee?(e.translateX=null,e.translateX=t-20*r,e.translateY=null,e.translateY=n-10*o,e.scaleX=.8,e.scaleY=.8):e.interactionMethod===te?(e.translateY=null,e.translateY=n-30):e.interactionMethod===J&&(e.translateX=null,e.translateX=t-30,e.translateY=null)},Dn=function(e){return e.rect.element.height+e.rect.element.marginBottom+e.rect.element.marginTop},Sn=A({DID_ADD_ITEM:function(e){var t=e.root,n=e.action,r=n.id,o=n.index,i=n.interactionMethod;t.ref.addIndex=o;var a=Date.now(),s=a,u=1;if(i!==re){u=0;var l=t.query("GET_ITEM_INSERT_INTERVAL"),c=a-t.ref.lastItemSpanwDate;s=c<l?a+(l-c):a}t.ref.lastItemSpanwDate=s,t.appendChildView(t.createChildView(mn,{spawnDate:s,id:r,opacity:u,interactionMethod:i}),o)},DID_REMOVE_ITEM:function(e){var t=e.root,n=e.action.id,r=t.childViews.find(function(e){return e.id===n});r&&(r.scaleX=.9,r.scaleY=.9,r.opacity=0,r.markedForRemoval=!0)},DID_DRAG_ITEM:function(e){var t=e.root,n=e.action,r=n.id,o=n.dragState,i=t.query("GET_ITEM",{id:r}),a=t.childViews.find(function(e){return e.id===r}),s=t.childViews.length,u=o.getItemIndex(i);if(a){var l,c=a.dragOrigin.x+a.dragOffset.x+a.dragCenter.x,f=a.dragOrigin.y+a.dragOffset.y+a.dragCenter.y,d=Dn(a),p=(l=a).rect.element.width+.5*l.rect.element.marginLeft+.5*l.rect.element.marginRight,E=Math.floor(t.rect.outer.width/p);E>s&&(E=s);var _=Math.floor(s/E+1);Rn.setHeight=d*_,Rn.setWidth=p*E;var T={y:Math.floor(f/d),x:Math.floor(c/p),getGridIndex:function(){return f>Rn.getHeight||f<0||c>Rn.getWidth||c<0?u:this.y*E+this.x},getColIndex:function(){for(var e=t.query("GET_ACTIVE_ITEMS"),n=t.childViews.filter(function(e){return e.rect.element.height}),r=e.map(function(e){return n.find(function(t){return t.id===e.id})}),o=r.findIndex(function(e){return e===a}),i=Dn(a),s=r.length,u=s,l=0,c=0,d=0,p=0;p<s;p++)if(l=Dn(r[p]),f<(c=(d=c)+l)){if(o>p){if(f<d+i){u=p;break}continue}u=p;break}return u}},I=E>1?T.getGridIndex():T.getColIndex();t.dispatch("MOVE_ITEM",{query:a,index:I});var v=o.getIndex();if(void 0===v||v!==I){if(o.setIndex(I),void 0===v)return;t.dispatch("DID_REORDER_ITEMS",{items:t.query("GET_ACTIVE_ITEMS"),origin:u,target:I})}}}}),An=S({create:function(e){var t=e.root;r(t.element,"role","list"),t.ref.lastItemSpanwDate=Date.now()},write:function(e){var t=e.root,n=e.props,r=e.actions,o=e.shouldOptimize;Sn({root:t,props:n,actions:r});var i=n.dragCoordinates,a=t.rect.element.width,s=t.childViews.filter(function(e){return e.rect.element.height}),u=t.query("GET_ACTIVE_ITEMS").map(function(e){return s.find(function(t){return t.id===e.id})}).filter(function(e){return e}),l=i?gn(t,u,i):null,c=t.ref.addIndex||null;t.ref.addIndex=null;var f=0,d=0,p=0;if(0!==u.length){var E=u[0].rect.element,_=E.marginTop+E.marginBottom,T=E.marginLeft+E.marginRight,I=E.width+T,v=E.height+_,m=hn(a,I);if(1===m){var h=0,g=0;u.forEach(function(e,t){if(l){var n=t-l;g=-2===n?.25*-_:-1===n?.75*-_:0===n?.75*_:1===n?.25*_:0}o&&(e.translateX=null,e.translateY=null),e.markedForRemoval||On(e,0,h+g);var r=(e.rect.element.height+_)*(e.markedForRemoval?e.opacity:1);h+=r})}else{var R=0,O=0;u.forEach(function(e,t){t===l&&(f=1),t===c&&(p+=1),e.markedForRemoval&&e.opacity<.5&&(d-=1);var n=t+p+f+d,r=n%m,i=Math.floor(n/m),a=r*I,s=i*v,u=Math.sign(a-R),E=Math.sign(s-O);R=a,O=s,e.markedForRemoval||(o&&(e.translateX=null,e.translateY=null),On(e,a,s,u,E))})}}},tag:"ul",name:"list",didWriteView:function(e){var t=e.root;t.childViews.filter(function(e){return e.markedForRemoval&&0===e.opacity&&e.resting}).forEach(function(e){e._destroy(),t.removeChildView(e)})},filterFrameActionsForChild:function(e,t){return t.filter(function(t){return!t.data||!t.data.id||e.id===t.data.id})},mixins:{apis:["dragCoordinates"]}}),Ln=A({DID_DRAG:function(e){var t=e.root,n=e.props,r=e.action;t.query("GET_ITEM_INSERT_LOCATION_FREEDOM")&&(n.dragCoordinates={left:r.position.scopeLeft-t.ref.list.rect.element.left,top:r.position.scopeTop-(t.rect.outer.top+t.rect.element.marginTop+t.rect.element.scrollTop)})},DID_END_DRAG:function(e){e.props.dragCoordinates=null}}),bn=S({create:function(e){var t=e.root,n=e.props;t.ref.list=t.appendChildView(t.createChildView(An)),n.dragCoordinates=null,n.overflowing=!1},write:function(e){var t=e.root,n=e.props,r=e.actions;if(Ln({root:t,props:n,actions:r}),t.ref.list.dragCoordinates=n.dragCoordinates,n.overflowing&&!n.overflow&&(n.overflowing=!1,t.element.dataset.state="",t.height=null),n.overflow){var o=Math.round(n.overflow);o!==t.height&&(n.overflowing=!0,t.element.dataset.state="overflow",t.height=o)}},name:"list-scroller",mixins:{apis:["overflow","dragCoordinates"],styles:["height","translateY"],animations:{translateY:"spring"}}}),Pn=function(e,t,n){var o=arguments.length>3&&void 0!==arguments[3]?arguments[3]:"";n?r(e,t,o):e.removeAttribute(t)},Mn=function(e){var t=e.root,n=e.action;t.query("GET_ALLOW_SYNC_ACCEPT_ATTRIBUTE")&&Pn(t.element,"accept",!!n.value,n.value?n.value.join(","):"")},wn=function(e){var t=e.root,n=e.action;Pn(t.element,"multiple",n.value)},Cn=function(e){var t=e.root,n=e.action;Pn(t.element,"webkitdirectory",n.value)},Nn=function(e){var t=e.root,n=t.query("GET_DISABLED"),r=t.query("GET_ALLOW_BROWSE"),o=n||!r;Pn(t.element,"disabled",o)},Gn=function(e){var t=e.root;e.action.value?0===t.query("GET_TOTAL_ITEMS")&&Pn(t.element,"required",!0):Pn(t.element,"required",!1)},Un=function(e){var t=e.root,n=e.action;Pn(t.element,"capture",!!n.value,!0===n.value?"":n.value)},Bn=function(e){var t=e.root,n=t.element;if(t.query("GET_TOTAL_ITEMS")>0){Pn(n,"required",!1),Pn(n,"name",!1);for(var r=t.query("GET_ACTIVE_ITEMS"),o=!1,i=0;i<r.length;i++)r[i].status===Ie.LOAD_ERROR&&(o=!0);t.element.setCustomValidity(o?t.query("GET_LABEL_INVALID_FIELD"):"")}else{Pn(n,"name",!0,t.query("GET_NAME")),t.query("GET_CHECK_VALIDITY")&&n.setCustomValidity(""),t.query("GET_REQUIRED")&&Pn(n,"required",!0)}},Fn=S({tag:"input",name:"browser",ignoreRect:!0,ignoreRectUpdate:!0,attributes:{type:"file"},create:function(e){var t=e.root,n=e.props;t.element.id="filepond--browser-"+n.id,r(t.element,"name",t.query("GET_NAME")),r(t.element,"aria-controls","filepond--assistant-"+n.id),r(t.element,"aria-labelledby","filepond--drop-label-"+n.id),Mn({root:t,action:{value:t.query("GET_ACCEPTED_FILE_TYPES")}}),wn({root:t,action:{value:t.query("GET_ALLOW_MULTIPLE")}}),Cn({root:t,action:{value:t.query("GET_ALLOW_DIRECTORIES_ONLY")}}),Nn({root:t}),Gn({root:t,action:{value:t.query("GET_REQUIRED")}}),Un({root:t,action:{value:t.query("GET_CAPTURE_METHOD")}}),t.ref.handleChange=function(e){if(t.element.value){var r=Array.from(t.element.files).map(function(e){return e._relativePath=e.webkitRelativePath,e});setTimeout(function(){n.onload(r),function(e){if(e&&""!==e.value){try{e.value=""}catch(e){}if(e.value){var t=Ct("form"),n=e.parentNode,r=e.nextSibling;t.appendChild(e),t.reset(),r?n.insertBefore(e,r):n.appendChild(e)}}}(t.element)},250)}},t.element.addEventListener("change",t.ref.handleChange)},destroy:function(e){var t=e.root;t.element.removeEventListener("change",t.ref.handleChange)},write:A({DID_LOAD_ITEM:Bn,DID_REMOVE_ITEM:Bn,DID_THROW_ITEM_INVALID:function(e){var t=e.root;t.query("GET_CHECK_VALIDITY")&&t.element.setCustomValidity(t.query("GET_LABEL_INVALID_FIELD"))},DID_SET_DISABLED:Nn,DID_SET_ALLOW_BROWSE:Nn,DID_SET_ALLOW_DIRECTORIES_ONLY:Cn,DID_SET_ALLOW_MULTIPLE:wn,DID_SET_ACCEPTED_FILE_TYPES:Mn,DID_SET_CAPTURE_METHOD:Un,DID_SET_REQUIRED:Gn})}),qn=13,Vn=32,xn=function(e,t){e.innerHTML=t;var n=e.querySelector(".filepond--label-action");return n&&r(n,"tabindex","0"),t},Yn=S({name:"drop-label",ignoreRect:!0,create:function(e){var t=e.root,n=e.props,o=Ct("label");r(o,"for","filepond--browser-"+n.id),r(o,"id","filepond--drop-label-"+n.id),t.ref.handleKeyDown=function(e){(e.keyCode===qn||e.keyCode===Vn)&&(e.preventDefault(),t.ref.label.click())},t.ref.handleClick=function(e){e.target===o||o.contains(e.target)||t.ref.label.click()},o.addEventListener("keydown",t.ref.handleKeyDown),t.element.addEventListener("click",t.ref.handleClick),xn(o,n.caption),t.appendChild(o),t.ref.label=o},destroy:function(e){var t=e.root;t.ref.label.addEventListener("keydown",t.ref.handleKeyDown),t.element.removeEventListener("click",t.ref.handleClick)},write:A({DID_SET_LABEL_IDLE:function(e){var t=e.root,n=e.action;xn(t.ref.label,n.value)}}),mixins:{styles:["opacity","translateX","translateY"],animations:{opacity:{type:"tween",duration:150},translateX:"spring",translateY:"spring"}}}),kn=S({name:"drip-blob",ignoreRect:!0,mixins:{styles:["translateX","translateY","scaleX","scaleY","opacity"],animations:{scaleX:"spring",scaleY:"spring",translateX:"spring",translateY:"spring",opacity:{type:"tween",duration:250}}}}),jn=A({DID_DRAG:function(e){var t=e.root,n=e.action;t.ref.blob?(t.ref.blob.translateX=n.position.scopeLeft,t.ref.blob.translateY=n.position.scopeTop,t.ref.blob.scaleX=1,t.ref.blob.scaleY=1,t.ref.blob.opacity=1):function(e){var t=e.root,n=.5*t.rect.element.width,r=.5*t.rect.element.height;t.ref.blob=t.appendChildView(t.createChildView(kn,{opacity:0,scaleX:2.5,scaleY:2.5,translateX:n,translateY:r}))}({root:t})},DID_DROP:function(e){var t=e.root;t.ref.blob&&(t.ref.blob.scaleX=2.5,t.ref.blob.scaleY=2.5,t.ref.blob.opacity=0)},DID_END_DRAG:function(e){var t=e.root;t.ref.blob&&(t.ref.blob.opacity=0)}}),Hn=S({ignoreRect:!0,ignoreRectUpdate:!0,name:"drip",write:function(e){var t=e.root,n=e.props,r=e.actions;jn({root:t,props:n,actions:r});var o=t.ref.blob;0===r.length&&o&&0===o.opacity&&(t.removeChildView(o),t.ref.blob=null)}}),Xn=function(e,t){try{var n=new DataTransfer;t.forEach(function(e){e instanceof File?n.items.add(e):n.items.add(new File([e],e.name,{type:e.type}))}),e.files=n.files}catch(e){return!1}return!0},Wn=function(e,t){return e.ref.fields[t]},zn=function(e){e.query("GET_ACTIVE_ITEMS").forEach(function(t){e.ref.fields[t.id]&&e.element.appendChild(e.ref.fields[t.id])})},Qn=function(e){var t=e.root;return zn(t)},Zn=A({DID_SET_DISABLED:function(e){var t=e.root;t.element.disabled=t.query("GET_DISABLED")},DID_ADD_ITEM:function(e){var t=e.root,n=e.action,r=!(t.query("GET_ITEM",n.id).origin===ve.LOCAL)&&t.query("SHOULD_UPDATE_FILE_INPUT"),o=Ct("input");o.type=r?"file":"hidden",o.name=t.query("GET_NAME"),t.ref.fields[n.id]=o,zn(t)},DID_LOAD_ITEM:function(e){var t=e.root,n=e.action,r=Wn(t,n.id);if(r&&(null!==n.serverFileReference&&(r.value=n.serverFileReference),t.query("SHOULD_UPDATE_FILE_INPUT"))){var o=t.query("GET_ITEM",n.id);Xn(r,[o.file])}},DID_REMOVE_ITEM:function(e){var t=e.root,n=e.action,r=Wn(t,n.id);r&&(r.parentNode&&r.parentNode.removeChild(r),delete t.ref.fields[n.id])},DID_DEFINE_VALUE:function(e){var t=e.root,n=e.action,r=Wn(t,n.id);r&&(null===n.value?r.removeAttribute("value"):"file"!=r.type&&(r.value=n.value),zn(t))},DID_PREPARE_OUTPUT:function(e){var t=e.root,n=e.action;t.query("SHOULD_UPDATE_FILE_INPUT")&&setTimeout(function(){var e=Wn(t,n.id);e&&Xn(e,[n.file])},0)},DID_REORDER_ITEMS:Qn,DID_SORT_ITEMS:Qn}),Kn=S({tag:"fieldset",name:"data",create:function(e){var t=e.root;t.ref.fields={};var n=document.createElement("legend");n.textContent="Files",t.element.appendChild(n)},write:Zn,ignoreRect:!0}),$n=["jpg","jpeg","png","gif","bmp","webp","svg","tiff"],Jn=["css","csv","html","txt"],er={zip:"zip|compressed",epub:"application/epub+zip"},tr=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"";return e=e.toLowerCase(),$n.includes(e)?"image/"+("jpg"===e?"jpeg":"svg"===e?"svg+xml":e):Jn.includes(e)?"text/"+e:er[e]||""},nr=function(e){return new Promise(function(t,n){var r=dr(e);if(r.length&&!rr(e))return t(r);or(e).then(t)})},rr=function(e){return!!e.files&&e.files.length>0},or=function(e){return new Promise(function(t,n){var r=(e.items?Array.from(e.items):[]).filter(function(e){return ir(e)}).map(function(e){return ar(e)});r.length?Promise.all(r).then(function(e){var n=[];e.forEach(function(e){n.push.apply(n,e)}),t(n.filter(function(e){return e}).map(function(e){return e._relativePath||(e._relativePath=e.webkitRelativePath),e}))}).catch(console.error):t(e.files?Array.from(e.files):[])})},ir=function(e){if(cr(e)){var t=fr(e);if(t)return t.isFile||t.isDirectory}return"file"===e.kind},ar=function(e){return new Promise(function(t,n){lr(e)?sr(fr(e)).then(t).catch(n):t([e.getAsFile()])})},sr=function(e){return new Promise(function(t,n){var r=[],o=0,i=0,a=function(){0===i&&0===o&&t(r)};!function e(t){o++;var s=t.createReader();!function t(){s.readEntries(function(n){if(0===n.length)return o--,void a();n.forEach(function(t){t.isDirectory?e(t):(i++,t.file(function(e){var n=ur(e);t.fullPath&&(n._relativePath=t.fullPath),r.push(n),i--,a()}))}),t()},n)}()}(e)})},ur=function(e){if(e.type.length)return e;var t=e.lastModifiedDate,n=e.name,r=tr(je(e.name));return r.length?((e=e.slice(0,e.size,r)).name=n,e.lastModifiedDate=t,e):e},lr=function(e){return cr(e)&&(fr(e)||{}).isDirectory},cr=function(e){return"webkitGetAsEntry"in e},fr=function(e){return e.webkitGetAsEntry()},dr=function(e){var t=[];try{if((t=Er(e)).length)return t;t=pr(e)}catch(e){}return t},pr=function(e){var t=e.getData("url");return"string"==typeof t&&t.length?[t]:[]},Er=function(e){var t=e.getData("text/html");if("string"==typeof t&&t.length){var n=t.match(/src\s*=\s*"(.+?)"/);if(n)return[n[1]]}return[]},_r=[],Tr=function(e){return{pageLeft:e.pageX,pageTop:e.pageY,scopeLeft:e.offsetX||e.layerX,scopeTop:e.offsetY||e.layerY}},Ir=function(e){var t=_r.find(function(t){return t.element===e});if(t)return t;var n=vr(e);return _r.push(n),n},vr=function(e){var n=[],r={dragenter:Rr,dragover:Or,dragleave:Dr,drop:yr},o={};t(r,function(t,r){o[t]=r(e,n),e.addEventListener(t,o[t],!1)});var i={element:e,addListener:function(a){return n.push(a),function(){n.splice(n.indexOf(a),1),0===n.length&&(_r.splice(_r.indexOf(i),1),t(r,function(t){e.removeEventListener(t,o[t],!1)}))}}};return i},mr=function(e,t){var n,r=function(e,t){return"elementFromPoint"in e||(e=document),e.elementFromPoint(t.x,t.y)}("getRootNode"in(n=t)?n.getRootNode():document,{x:e.pageX-window.pageXOffset,y:e.pageY-window.pageYOffset});return r===t||t.contains(r)},hr=null,gr=function(e,t){try{e.dropEffect=t}catch(e){}},Rr=function(e,t){return function(e){e.preventDefault(),hr=e.target,t.forEach(function(t){var n=t.element,r=t.onenter;mr(e,n)&&(t.state="enter",r(Tr(e)))})}},Or=function(e,t){return function(e){e.preventDefault();var n=e.dataTransfer;nr(n).then(function(r){var o=!1;t.some(function(t){var i=t.filterElement,a=t.element,s=t.onenter,u=t.onexit,l=t.ondrag,c=t.allowdrop;gr(n,"copy");var f=c(r);if(f)if(mr(e,a)){if(o=!0,null===t.state)return t.state="enter",void s(Tr(e));if(t.state="over",i&&!f)return void gr(n,"none");l(Tr(e))}else i&&!o&&gr(n,"none"),t.state&&(t.state=null,u(Tr(e)));else gr(n,"none")})})}},yr=function(e,t){return function(e){e.preventDefault();var n=e.dataTransfer;nr(n).then(function(n){t.forEach(function(t){var r=t.filterElement,o=t.element,i=t.ondrop,a=t.onexit,s=t.allowdrop;if(t.state=null,!r||mr(e,o))return s(n)?void i(Tr(e),n):a(Tr(e))})})}},Dr=function(e,t){return function(e){hr===e.target&&t.forEach(function(t){var n=t.onexit;t.state=null,n(Tr(e))})}},Sr=function(e,t,n){e.classList.add("filepond--hopper");var r=n.catchesDropsOnPage,o=n.requiresDropOnElement,i=n.filterItems,a=void 0===i?function(e){return e}:i,s=function(e,t,n){var r=Ir(t),o={element:e,filterElement:n,state:null,ondrop:function(){},onenter:function(){},ondrag:function(){},onexit:function(){},onload:function(){},allowdrop:function(){}};return o.destroy=r.addListener(o),o}(e,r?document.documentElement:e,o),u="",l="";s.allowdrop=function(e){return t(a(e))},s.ondrop=function(e,n){var r=a(n);t(r)?(l="drag-drop",c.onload(r,e)):c.ondragend(e)},s.ondrag=function(e){c.ondrag(e)},s.onenter=function(e){l="drag-over",c.ondragstart(e)},s.onexit=function(e){l="drag-exit",c.ondragend(e)};var c={updateHopperState:function(){u!==l&&(e.dataset.hopperState=l,u=l)},onload:function(){},ondragstart:function(){},ondrag:function(){},ondragend:function(){},destroy:function(){s.destroy()}};return c},Ar=!1,Lr=[],br=function(e){var t=document.activeElement;if(t&&(/textarea|input/i.test(t.nodeName)||"true"===t.getAttribute("contenteditable")||""===t.getAttribute("contenteditable"))){for(var n=!1,r=t;r!==document.body;){if(r.classList.contains("filepond--root")){n=!0;break}r=r.parentNode}if(!n)return}nr(e.clipboardData).then(function(e){e.length&&Lr.forEach(function(t){return t(e)})})},Pr=function(){var e=function(e){t.onload(e)},t={destroy:function(){var t;t=e,de(Lr,Lr.indexOf(t)),0===Lr.length&&(document.removeEventListener("paste",br),Ar=!1)},onload:function(){}};return function(e){Lr.includes(e)||(Lr.push(e),Ar||(Ar=!0,document.addEventListener("paste",br)))}(e),t},Mr=null,wr=null,Cr=[],Nr=function(e,t){e.element.textContent=t},Gr=function(e,t,n){var r=e.query("GET_TOTAL_ITEMS");Nr(e,n+" "+t+", "+r+" "+(1===r?e.query("GET_LABEL_FILE_COUNT_SINGULAR"):e.query("GET_LABEL_FILE_COUNT_PLURAL"))),clearTimeout(wr),wr=setTimeout(function(){!function(e){e.element.textContent=""}(e)},1500)},Ur=function(e){return e.element.parentNode.contains(document.activeElement)},Br=function(e){var t=e.root,n=e.action,r=t.query("GET_ITEM",n.id).filename,o=t.query("GET_LABEL_FILE_PROCESSING_ABORTED");Nr(t,r+" "+o)},Fr=function(e){var t=e.root,n=e.action,r=t.query("GET_ITEM",n.id).filename;Nr(t,n.status.main+" "+r+" "+n.status.sub)},qr=S({create:function(e){var t=e.root,n=e.props;t.element.id="filepond--assistant-"+n.id,r(t.element,"role","alert"),r(t.element,"aria-live","polite"),r(t.element,"aria-relevant","additions")},ignoreRect:!0,ignoreRectUpdate:!0,write:A({DID_LOAD_ITEM:function(e){var t=e.root,n=e.action;if(Ur(t)){t.element.textContent="";var r=t.query("GET_ITEM",n.id);Cr.push(r.filename),clearTimeout(Mr),Mr=setTimeout(function(){Gr(t,Cr.join(", "),t.query("GET_LABEL_FILE_ADDED")),Cr.length=0},750)}},DID_REMOVE_ITEM:function(e){var t=e.root,n=e.action;if(Ur(t)){var r=n.item;Gr(t,r.filename,t.query("GET_LABEL_FILE_REMOVED"))}},DID_COMPLETE_ITEM_PROCESSING:function(e){var t=e.root,n=e.action,r=t.query("GET_ITEM",n.id).filename,o=t.query("GET_LABEL_FILE_PROCESSING_COMPLETE");Nr(t,r+" "+o)},DID_ABORT_ITEM_PROCESSING:Br,DID_REVERT_ITEM_PROCESSING:Br,DID_THROW_ITEM_REMOVE_ERROR:Fr,DID_THROW_ITEM_LOAD_ERROR:Fr,DID_THROW_ITEM_INVALID:Fr,DID_THROW_ITEM_PROCESSING_ERROR:Fr}),tag:"span",name:"assistant"}),Vr=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"-";return e.replace(new RegExp(t+".","g"),function(e){return e.charAt(1).toUpperCase()})},xr=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:16,n=!(arguments.length>2&&void 0!==arguments[2])||arguments[2],r=Date.now(),o=null;return function(){for(var i=arguments.length,a=new Array(i),s=0;s<i;s++)a[s]=arguments[s];clearTimeout(o);var u=Date.now()-r,l=function(){r=Date.now(),e.apply(void 0,a)};u<t?n||(o=setTimeout(l,t-u)):l()}},Yr=function(e){return e.preventDefault()},kr=function(e){var t=e.ref.list.childViews[0].childViews[0];return t?{top:t.rect.element.marginTop,bottom:t.rect.element.marginBottom}:{top:0,bottom:0}},jr=function(e){var t=0,n=0,r=e.ref.list,o=r.childViews[0],i=o.childViews.filter(function(e){return e.rect.element.height}),a=e.query("GET_ACTIVE_ITEMS").map(function(e){return i.find(function(t){return t.id===e.id})}).filter(function(e){return e});if(0===a.length)return{visual:t,bounds:n};var s=o.rect.element.width,u=gn(o,a,r.dragCoordinates),l=a[0].rect.element,c=l.marginTop+l.marginBottom,f=l.marginLeft+l.marginRight,d=l.width+f,p=l.height+c,E=void 0!==u&&u>=0?1:0,_=a.find(function(e){return e.markedForRemoval&&e.opacity<.45})?-1:0,T=a.length+E+_,I=hn(s,d);return 1===I?a.forEach(function(e){var r=e.rect.element.height+c;n+=r,t+=r*e.opacity}):(n=Math.ceil(T/I)*p,t=n),{visual:t,bounds:n}},Hr=function(e){var t=e.ref.measureHeight||null;return{cappedHeight:parseInt(e.style.maxHeight,10)||null,fixedHeight:0===t?null:t}},Xr=function(e,t){var n=e.query("GET_ALLOW_REPLACE"),r=e.query("GET_ALLOW_MULTIPLE"),o=e.query("GET_TOTAL_ITEMS"),i=e.query("GET_MAX_FILES"),a=t.length;return!r&&a>1?(e.dispatch("DID_THROW_MAX_FILES",{source:t,error:ot("warning",0,"Max files")}),!0):!(!r&&n)&&(!!(V(i=r?i:1)&&o+a>i)&&(e.dispatch("DID_THROW_MAX_FILES",{source:t,error:ot("warning",0,"Max files")}),!0))},Wr=function(e,t,n){var r=e.childViews[0];return gn(r,t,{left:n.scopeLeft-r.rect.element.left,top:n.scopeTop-(e.rect.outer.top+e.rect.element.marginTop+e.rect.element.scrollTop)})},zr=function(e){var t=e.query("GET_ALLOW_DROP"),n=e.query("GET_DISABLED"),r=t&&!n;if(r&&!e.ref.hopper){var o=Sr(e.element,function(t){var n=e.query("GET_BEFORE_DROP_FILE")||function(){return!0};return!e.query("GET_DROP_VALIDATION")||t.every(function(t){return ye("ALLOW_HOPPER_ITEM",t,{query:e.query}).every(function(e){return!0===e})&&n(t)})},{filterItems:function(t){var n=e.query("GET_IGNORED_FILES");return t.filter(function(e){return!ht(e)||!n.includes(e.name.toLowerCase())})},catchesDropsOnPage:e.query("GET_DROP_ON_PAGE"),requiresDropOnElement:e.query("GET_DROP_ON_ELEMENT")});o.onload=function(t,n){var r=e.ref.list.childViews[0].childViews.filter(function(e){return e.rect.element.height}),o=e.query("GET_ACTIVE_ITEMS").map(function(e){return r.find(function(t){return t.id===e.id})}).filter(function(e){return e});Oe("ADD_ITEMS",t,{dispatch:e.dispatch}).then(function(t){if(Xr(e,t))return!1;e.dispatch("ADD_ITEMS",{items:t,index:Wr(e.ref.list,o,n),interactionMethod:ee})}),e.dispatch("DID_DROP",{position:n}),e.dispatch("DID_END_DRAG",{position:n})},o.ondragstart=function(t){e.dispatch("DID_START_DRAG",{position:t})},o.ondrag=xr(function(t){e.dispatch("DID_DRAG",{position:t})}),o.ondragend=function(t){e.dispatch("DID_END_DRAG",{position:t})},e.ref.hopper=o,e.ref.drip=e.appendChildView(e.createChildView(Hn))}else!r&&e.ref.hopper&&(e.ref.hopper.destroy(),e.ref.hopper=null,e.removeChildView(e.ref.drip))},Qr=function(e,t){var n=e.query("GET_ALLOW_BROWSE"),r=e.query("GET_DISABLED"),o=n&&!r;o&&!e.ref.browser?e.ref.browser=e.appendChildView(e.createChildView(Fn,Object.assign({},t,{onload:function(t){Oe("ADD_ITEMS",t,{dispatch:e.dispatch}).then(function(t){if(Xr(e,t))return!1;e.dispatch("ADD_ITEMS",{items:t,index:-1,interactionMethod:te})})}})),0):!o&&e.ref.browser&&(e.removeChildView(e.ref.browser),e.ref.browser=null)},Zr=function(e){var t=e.query("GET_ALLOW_PASTE"),n=e.query("GET_DISABLED"),r=t&&!n;r&&!e.ref.paster?(e.ref.paster=Pr(),e.ref.paster.onload=function(t){Oe("ADD_ITEMS",t,{dispatch:e.dispatch}).then(function(t){if(Xr(e,t))return!1;e.dispatch("ADD_ITEMS",{items:t,index:-1,interactionMethod:ne})})}):!r&&e.ref.paster&&(e.ref.paster.destroy(),e.ref.paster=null)},Kr=A({DID_SET_ALLOW_BROWSE:function(e){var t=e.root,n=e.props;Qr(t,n)},DID_SET_ALLOW_DROP:function(e){var t=e.root;zr(t)},DID_SET_ALLOW_PASTE:function(e){var t=e.root;Zr(t)},DID_SET_DISABLED:function(e){var t=e.root,n=e.props;zr(t),Zr(t),Qr(t,n),t.query("GET_DISABLED")?t.element.dataset.disabled="disabled":t.element.removeAttribute("data-disabled")}}),$r=S({name:"root",read:function(e){var t=e.root;t.ref.measure&&(t.ref.measureHeight=t.ref.measure.offsetHeight)},create:function(e){var t=e.root,n=e.props,r=t.query("GET_ID");r&&(t.element.id=r);var o=t.query("GET_CLASS_NAME");o&&o.split(" ").filter(function(e){return e.length}).forEach(function(e){t.element.classList.add(e)}),t.ref.label=t.appendChildView(t.createChildView(Yn,Object.assign({},n,{translateY:null,caption:t.query("GET_LABEL_IDLE")}))),t.ref.list=t.appendChildView(t.createChildView(bn,{translateY:null})),t.ref.panel=t.appendChildView(t.createChildView(En,{name:"panel-root"})),t.ref.assistant=t.appendChildView(t.createChildView(qr,Object.assign({},n))),t.ref.data=t.appendChildView(t.createChildView(Kn,Object.assign({},n))),t.ref.measure=Ct("div"),t.ref.measure.style.height="100%",t.element.appendChild(t.ref.measure),t.ref.bounds=null,t.query("GET_STYLES").filter(function(e){return!M(e.value)}).map(function(e){var n=e.name,r=e.value;t.element.dataset[n]=r}),t.ref.widthPrevious=null,t.ref.widthUpdated=xr(function(){t.ref.updateHistory=[],t.dispatch("DID_RESIZE_ROOT")},250),t.ref.previousAspectRatio=null,t.ref.updateHistory=[];var i=window.matchMedia("(pointer: fine) and (hover: hover)").matches,a="PointerEvent"in window;t.query("GET_ALLOW_REORDER")&&a&&!i&&(t.element.addEventListener("touchmove",Yr,{passive:!1}),t.element.addEventListener("gesturestart",Yr));var s=t.query("GET_CREDITS");if(2===s.length){var u=document.createElement("a");u.className="filepond--credits",u.href=s[0],u.tabIndex=-1,u.target="_blank",u.rel="noopener noreferrer nofollow",u.textContent=s[1],t.element.appendChild(u),t.ref.credits=u}},write:function(e){var t=e.root,n=e.props,r=e.actions;if(Kr({root:t,props:n,actions:r}),r.filter(function(e){return/^DID_SET_STYLE_/.test(e.type)}).filter(function(e){return!M(e.data.value)}).map(function(e){var n=e.type,r=e.data,o=Vr(n.substring(8).toLowerCase(),"_");t.element.dataset[o]=r.value,t.invalidateLayout()}),!t.rect.element.hidden){t.rect.element.width!==t.ref.widthPrevious&&(t.ref.widthPrevious=t.rect.element.width,t.ref.widthUpdated());var o=t.ref.bounds;o||(o=t.ref.bounds=Hr(t),t.element.removeChild(t.ref.measure),t.ref.measure=null);var i=t.ref,a=i.hopper,s=i.label,u=i.list,l=i.panel;a&&a.updateHopperState();var c=t.query("GET_PANEL_ASPECT_RATIO"),f=t.query("GET_ALLOW_MULTIPLE"),d=t.query("GET_TOTAL_ITEMS"),p=d===(f?t.query("GET_MAX_FILES")||1e6:1),E=r.find(function(e){return"DID_ADD_ITEM"===e.type});if(p&&E){var _=E.data.interactionMethod;s.opacity=0,f?s.translateY=-40:_===J?s.translateX=40:s.translateY=_===te?40:30}else p||(s.opacity=1,s.translateX=0,s.translateY=0);var T=kr(t),I=jr(t),v=s.rect.element.height,m=!f||p?0:v,h=p?u.rect.element.marginTop:0,g=0===d?0:u.rect.element.marginBottom,R=m+h+I.visual+g,O=m+h+I.bounds+g;if(u.translateY=Math.max(0,m-u.rect.element.marginTop)-T.top,c){var y=t.rect.element.width,D=y*c;c!==t.ref.previousAspectRatio&&(t.ref.previousAspectRatio=c,t.ref.updateHistory=[]);var S=t.ref.updateHistory;if(S.push(y),S.length>4)for(var A=S.length,L=A-10,b=0,P=A;P>=L;P--)if(S[P]===S[P-2]&&b++,b>=2)return;l.scalable=!1,l.height=D;var w=D-m-(g-T.bottom)-(p?h:0);I.visual>w?u.overflow=w:u.overflow=null,t.height=D}else if(o.fixedHeight){l.scalable=!1;var C=o.fixedHeight-m-(g-T.bottom)-(p?h:0);I.visual>C?u.overflow=C:u.overflow=null}else if(o.cappedHeight){var N=R>=o.cappedHeight,G=Math.min(o.cappedHeight,R);l.scalable=!0,l.height=N?G:G-T.top-T.bottom;var U=G-m-(g-T.bottom)-(p?h:0);R>o.cappedHeight&&I.visual>U?u.overflow=U:u.overflow=null,t.height=Math.min(o.cappedHeight,O-T.top-T.bottom)}else{var B=d>0?T.top+T.bottom:0;l.scalable=!0,l.height=Math.max(v,R-B),t.height=Math.max(v,O-B)}t.ref.credits&&l.heightCurrent&&(t.ref.credits.style.transform="translateY("+l.heightCurrent+"px)")}},destroy:function(e){var t=e.root;t.ref.paster&&t.ref.paster.destroy(),t.ref.hopper&&t.ref.hopper.destroy(),t.element.removeEventListener("touchmove",Yr),t.element.removeEventListener("gesturestart",Yr)},mixins:{styles:["height"]}}),Jr=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=null,o=Se(),i=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[],n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:[],r=Object.assign({},e),o=[],i=[],a=function(e,t,n){!n||document.hidden?(c[e]&&c[e](t),o.push({type:e,data:t})):i.push({type:e,data:t})},s=function(e){for(var t,n=arguments.length,r=new Array(n>1?n-1:0),o=1;o<n;o++)r[o-1]=arguments[o];return l[e]?(t=l)[e].apply(t,r):null},u={getState:function(){return Object.assign({},r)},processActionQueue:function(){var e=[].concat(o);return o.length=0,e},processDispatchQueue:function(){var e=[].concat(i);i.length=0,e.forEach(function(e){var t=e.type,n=e.data;a(t,n)})},dispatch:a,query:s},l={};t.forEach(function(e){l=Object.assign({},e(r),{},l)});var c={};return n.forEach(function(e){c=Object.assign({},e(a,s,r),{},c)}),u}({items:[],listUpdateTimeout:null,itemUpdateTimeout:null,processingQueue:[],options:Q(o)},[Ve,$(o)],[Pt,K(o)]);i.dispatch("SET_OPTIONS",{options:e});var a=function(){document.hidden||i.dispatch("KICK")};document.addEventListener("visibilitychange",a);var s=null,u=!1,l=!1,c=null,f=null,d=function(){u||(u=!0),clearTimeout(s),s=setTimeout(function(){u=!1,c=null,f=null,l&&(l=!1,i.dispatch("DID_STOP_RESIZE"))},500)};window.addEventListener("resize",d);var p=$r(i,{id:oe()}),E=!1,T=!1,I={_read:function(){u&&(f=window.innerWidth,c||(c=f),l||f===c||(i.dispatch("DID_START_RESIZE"),l=!0)),T&&E&&(E=null===p.element.offsetParent),E||(p._read(),T=p.rect.element.hidden)},_write:function(e){var t,n=i.processActionQueue().filter(function(e){return!/^SET_/.test(e.type)});E&&!n.length||(g(n),E=p._write(e,n,l),(t=i.query("GET_ITEMS")).forEach(function(e,n){e.released&&de(t,n)}),E&&i.processDispatchQueue())}},v=function(e){return function(t){var n={type:e};if(!t)return n;if(t.hasOwnProperty("error")&&(n.error=t.error?Object.assign({},t.error):null),t.status&&(n.status=Object.assign({},t.status)),t.file&&(n.output=t.file),t.source)n.file=t.source;else if(t.item||t.id){var r=t.item?t.item:i.query("GET_ITEM",t.id);n.file=r?Te(r):null}return t.items&&(n.items=t.items.map(Te)),/progress/.test(e)&&(n.progress=t.progress),t.hasOwnProperty("origin")&&t.hasOwnProperty("target")&&(n.origin=t.origin,n.target=t.target),n}},m={DID_DESTROY:v("destroy"),DID_INIT:v("init"),DID_THROW_MAX_FILES:v("warning"),DID_INIT_ITEM:v("initfile"),DID_START_ITEM_LOAD:v("addfilestart"),DID_UPDATE_ITEM_LOAD_PROGRESS:v("addfileprogress"),DID_LOAD_ITEM:v("addfile"),DID_THROW_ITEM_INVALID:[v("error"),v("addfile")],DID_THROW_ITEM_LOAD_ERROR:[v("error"),v("addfile")],DID_THROW_ITEM_REMOVE_ERROR:[v("error"),v("removefile")],DID_PREPARE_OUTPUT:v("preparefile"),DID_START_ITEM_PROCESSING:v("processfilestart"),DID_UPDATE_ITEM_PROCESS_PROGRESS:v("processfileprogress"),DID_ABORT_ITEM_PROCESSING:v("processfileabort"),DID_COMPLETE_ITEM_PROCESSING:v("processfile"),DID_COMPLETE_ITEM_PROCESSING_ALL:v("processfiles"),DID_REVERT_ITEM_PROCESSING:v("processfilerevert"),DID_THROW_ITEM_PROCESSING_ERROR:[v("error"),v("processfile")],DID_REMOVE_ITEM:v("removefile"),DID_UPDATE_ITEMS:v("updatefiles"),DID_ACTIVATE_ITEM:v("activatefile"),DID_REORDER_ITEMS:v("reorderfiles")},h=function(e){var t=Object.assign({pond:A},e);delete t.type,p.element.dispatchEvent(new CustomEvent("FilePond:"+e.type,{detail:t,bubbles:!0,cancelable:!0,composed:!0}));var n=[];e.hasOwnProperty("error")&&n.push(e.error),e.hasOwnProperty("file")&&n.push(e.file);var r=["type","error","file"];Object.keys(e).filter(function(e){return!r.includes(e)}).forEach(function(t){return n.push(e[t])}),A.fire.apply(A,[e.type].concat(n));var o=i.query("GET_ON"+e.type.toUpperCase());o&&o.apply(void 0,n)},g=function(e){e.length&&e.filter(function(e){return m[e.type]}).forEach(function(e){var t=m[e.type];(Array.isArray(t)?t:[t]).forEach(function(t){"DID_INIT_ITEM"===e.type?h(t(e.data)):setTimeout(function(){h(t(e.data))},0)})})},R=function(e){return new Promise(function(t,n){i.dispatch("REQUEST_ITEM_PREPARE",{query:e,success:function(e){t(e)},failure:function(e){n(e)}})})},O=function(e,t){var n;return"object"!=typeof e||(n=e).file&&n.id||t||(t=e,e=void 0),i.dispatch("REMOVE_ITEM",Object.assign({},t,{query:e})),null===i.query("GET_ACTIVE_ITEM",e)},y=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return new Promise(function(e,n){var r=[],o={};if(P(t[0]))r.push.apply(r,t[0]),Object.assign(o,t[1]||{});else{var a=t[t.length-1];"object"!=typeof a||a instanceof Blob||Object.assign(o,t.pop()),r.push.apply(r,t)}i.dispatch("ADD_ITEMS",{items:r,index:o.index,interactionMethod:J,success:e,failure:n})})},D=function(){return i.query("GET_ACTIVE_ITEMS")},S=function(e){return new Promise(function(t,n){i.dispatch("REQUEST_ITEM_PROCESSING",{query:e,success:function(e){t(e)},failure:function(e){n(e)}})})},A=Object.assign({},pe(),{},I,{},function(e,n){var r={};return t(n,function(t){r[t]={get:function(){return e.getState().options[t]},set:function(n){e.dispatch("SET_"+Z(t,"_").toUpperCase(),{value:n})}}}),r}(i,o),{setOptions:function(e){return i.dispatch("SET_OPTIONS",{options:e})},addFile:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return new Promise(function(n,r){y([{source:e,options:t}],{index:t.index}).then(function(e){return n(e&&e[0])}).catch(r)})},addFiles:y,getFile:function(e){return i.query("GET_ACTIVE_ITEM",e)},processFile:S,prepareFile:R,removeFile:O,moveFile:function(e,t){return i.dispatch("MOVE_ITEM",{query:e,index:t})},getFiles:D,processFiles:function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];var r=Array.isArray(t[0])?t[0]:t;if(!r.length){var o=D().filter(function(e){return!(e.status===Ie.IDLE&&e.origin===ve.LOCAL)&&e.status!==Ie.PROCESSING&&e.status!==Ie.PROCESSING_COMPLETE&&e.status!==Ie.PROCESSING_REVERT_ERROR});return Promise.all(o.map(S))}return Promise.all(r.map(S))},removeFiles:function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];var r,o=Array.isArray(t[0])?t[0]:t;"object"==typeof o[o.length-1]?r=o.pop():Array.isArray(t[0])&&(r=t[1]);var i=D();return o.length?o.map(function(e){return _(e)?i[e]?i[e].id:null:e}).filter(function(e){return e}).map(function(e){return O(e,r)}):Promise.all(i.map(function(e){return O(e,r)}))},prepareFiles:function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];var r=Array.isArray(t[0])?t[0]:t,o=r.length?r:D();return Promise.all(o.map(R))},sort:function(e){return i.dispatch("SORT",{compare:e})},browse:function(){var e=p.element.querySelector("input[type=file]");e&&e.click()},destroy:function(){A.fire("destroy",p.element),i.dispatch("ABORT_ALL"),p._destroy(),window.removeEventListener("resize",d),document.removeEventListener("visibilitychange",a),i.dispatch("DID_DESTROY")},insertBefore:function(e){return L(p.element,e)},insertAfter:function(e){return b(p.element,e)},appendTo:function(e){return e.appendChild(p.element)},replaceElement:function(e){L(p.element,e),e.parentNode.removeChild(e),r=e},restoreElement:function(){r&&(b(r,p.element),p.element.parentNode.removeChild(p.element),r=null)},isAttachedTo:function(e){return p.element===e||r===e},element:{get:function(){return p.element}},status:{get:function(){return i.query("GET_STATUS")}}});return i.dispatch("DID_INIT"),n(A)},eo=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n={};return t(Se(),function(e,t){n[e]=t[0]}),Jr(Object.assign({},n,{},e))},to=function(e){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},o=[];t(e.attributes,function(t){o.push(e.attributes[t])});var i=o.filter(function(e){return e.name}).reduce(function(t,n){var o,i=r(e,n.name);return t[(o=n.name,Vr(o.replace(/^data-/,"")))]=i===n.name||i,t},{});return function e(n,r){t(r,function(r,o){t(n,function(e,t){var i=new RegExp(r);if(i.test(e)&&(delete n[e],!1!==o))if(U(o))n[o]=t;else{var a,s=o.group;H(o)&&!n[s]&&(n[s]={}),n[s][(a=e.replace(i,""),a.charAt(0).toLowerCase()+a.slice(1))]=t}}),o.mapping&&e(n[o.group],o.mapping)})}(i,n),i},no=function(){return(arguments.length<=0?void 0:arguments[0])instanceof HTMLElement?function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n={"^class$":"className","^multiple$":"allowMultiple","^capture$":"captureMethod","^webkitdirectory$":"allowDirectoriesOnly","^server":{group:"server",mapping:{"^process":{group:"process"},"^revert":{group:"revert"},"^fetch":{group:"fetch"},"^restore":{group:"restore"},"^load":{group:"load"}}},"^type$":!1,"^files$":!1};ye("SET_ATTRIBUTE_TO_OPTION_MAP",n);var r=Object.assign({},t),o=to("FIELDSET"===e.nodeName?e.querySelector("input[type=file]"):e,n);Object.keys(o).forEach(function(e){H(o[e])?(H(r[e])||(r[e]={}),Object.assign(r[e],o[e])):r[e]=o[e]}),r.files=(t.files||[]).concat(Array.from(e.querySelectorAll("input:not([type=file])")).map(function(e){return{source:e.value,options:{type:e.dataset.type}}}));var i=eo(r);return e.files&&Array.from(e.files).forEach(function(e){i.addFile(e)}),i.replaceElement(e),i}.apply(void 0,arguments):eo.apply(void 0,arguments)},ro=["fire","_read","_write"],oo=function(e){var t={};return Ee(e,t,ro),t},io=function(e,t){return e.replace(/(?:{([a-zA-Z]+)})/g,function(e,n){return t[n]})},ao=function(e){var t=new Blob(["(",e.toString(),")()"],{type:"application/javascript"}),n=URL.createObjectURL(t),r=new Worker(n);return{transfer:function(e,t){},post:function(e,t,n){var o=oe();r.onmessage=function(e){e.data.id===o&&t(e.data.message)},r.postMessage({id:o,message:e},n)},terminate:function(){r.terminate(),URL.revokeObjectURL(n)}}},so=function(e){return new Promise(function(t,n){var r=new Image;r.onload=function(){t(r)},r.onerror=function(e){n(e)},r.src=e})},uo=function(e,t){var n=e.slice(0,e.size,e.type);return n.lastModifiedDate=e.lastModifiedDate,n.name=t,n},lo=function(e){return uo(e,e.name)},co=[],fo=function(e){if(!co.includes(e)){co.push(e);var n,r=e({addFilter:De,utils:{Type:ge,forin:t,isString:U,isFile:ht,toNaturalFileSize:qt,replaceInString:io,getExtensionFromFilename:je,getFilenameWithoutExtension:mt,guesstimateMimeType:tr,getFileFromBlob:We,getFilenameFromURL:ke,createRoute:A,createWorker:ao,createView:S,createItemAPI:Te,loadImage:so,copyFile:lo,renameFile:uo,createBlob:ze,applyFilterChain:Oe,text:Nt,getNumericAspectRatioFromString:be},views:{fileActionButton:Ft}});n=r.options,Object.assign(Ae,n)}},po=(Kt=c()&&!("[object OperaMini]"===Object.prototype.toString.call(window.operamini))&&"visibilityState"in document&&"Promise"in window&&"slice"in Blob.prototype&&"URL"in window&&"createObjectURL"in window.URL&&"performance"in window&&("supports"in(window.CSS||{})||/MSIE|Trident/.test(window.navigator.userAgent)),function(){return Kt}),Eo={apps:[]},_o=function(){};if(e.Status={},e.FileStatus={},e.FileOrigin={},e.OptionTypes={},e.create=_o,e.destroy=_o,e.parse=_o,e.find=_o,e.registerPlugin=_o,e.getOptions=_o,e.setOptions=_o,po()){!function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:60,r="__framePainter";if(window[r])return window[r].readers.push(e),void window[r].writers.push(t);window[r]={readers:[e],writers:[t]};var o=window[r],i=1e3/n,a=null,s=null,u=null,l=null,c=function(){document.hidden?(u=function(){return window.setTimeout(function(){return f(performance.now())},i)},l=function(){return window.clearTimeout(s)}):(u=function(){return window.requestAnimationFrame(f)},l=function(){return window.cancelAnimationFrame(s)})};document.addEventListener("visibilitychange",function(){l&&l(),c(),f(performance.now())});var f=function e(t){s=u(e),a||(a=t);var n=t-a;n<=i||(a=t-n%i,o.readers.forEach(function(e){return e()}),o.writers.forEach(function(e){return e(t)}))};c(),f(performance.now())}(function(){Eo.apps.forEach(function(e){return e._read()})},function(e){Eo.apps.forEach(function(t){return t._write(e)})});var To=function t(){document.dispatchEvent(new CustomEvent("FilePond:loaded",{detail:{supported:po,create:e.create,destroy:e.destroy,parse:e.parse,find:e.find,registerPlugin:e.registerPlugin,setOptions:e.setOptions}})),document.removeEventListener("DOMContentLoaded",t)};"loading"!==document.readyState?setTimeout(function(){return To()},0):document.addEventListener("DOMContentLoaded",To);var Io=function(){return t(Se(),function(t,n){e.OptionTypes[t]=n[1]})};e.Status=Object.assign({},Me),e.FileOrigin=Object.assign({},ve),e.FileStatus=Object.assign({},Ie),e.OptionTypes={},Io(),e.create=function(){var t=no.apply(void 0,arguments);return t.on("destroy",e.destroy),Eo.apps.push(t),oo(t)},e.destroy=function(e){var t=Eo.apps.findIndex(function(t){return t.isAttachedTo(e)});return t>=0&&(Eo.apps.splice(t,1)[0].restoreElement(),!0)},e.parse=function(t){return Array.from(t.querySelectorAll(".filepond")).filter(function(e){return!Eo.apps.find(function(t){return t.isAttachedTo(e)})}).map(function(t){return e.create(t)})},e.find=function(e){var t=Eo.apps.find(function(t){return t.isAttachedTo(e)});return t?oo(t):null},e.registerPlugin=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];t.forEach(fo),Io()},e.getOptions=function(){var e={};return t(Se(),function(t,n){e[t]=n[0]}),e},e.setOptions=function(n){return H(n)&&(Eo.apps.forEach(function(e){e.setOptions(n)}),function(e){t(e,function(e,t){Ae[e]&&(Ae[e][0]=z(t,Ae[e][0],Ae[e][1]))})}(n)),e.getOptions()}}e.supported=po,Object.defineProperty(e,"__esModule",{value:!0})});
; return module.exports; })();
const validateType = (function () { const module = { exports: {} }; const exports = module.exports; /*!
 * FilePondPluginFileValidateType 1.2.9
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e=e||self).FilePondPluginFileValidateType=t()}(this,function(){"use strict";var e=function(e){var t=e.addFilter,n=e.utils,i=n.Type,T=n.isString,E=n.replaceInString,l=n.guesstimateMimeType,o=n.getExtensionFromFilename,r=n.getFilenameFromURL,u=function(e,t){return e.some(function(e){return/\*$/.test(e)?(n=e,(/^[^/]+/.exec(t)||[]).pop()===n.slice(0,-2)):e===t;var n})},a=function(e,t,n){if(0===t.length)return!0;var i=function(e){var t="";if(T(e)){var n=r(e),i=o(n);i&&(t=l(i))}else t=e.type;return t}(e);return n?new Promise(function(T,E){n(e,i).then(function(e){u(t,e)?T():E()}).catch(E)}):u(t,i)};return t("SET_ATTRIBUTE_TO_OPTION_MAP",function(e){return Object.assign(e,{accept:"acceptedFileTypes"})}),t("ALLOW_HOPPER_ITEM",function(e,t){var n=t.query;return!n("GET_ALLOW_FILE_TYPE_VALIDATION")||a(e,n("GET_ACCEPTED_FILE_TYPES"))}),t("LOAD_FILE",function(e,t){var n=t.query;return new Promise(function(t,i){if(n("GET_ALLOW_FILE_TYPE_VALIDATION")){var T=n("GET_ACCEPTED_FILE_TYPES"),l=n("GET_FILE_VALIDATE_TYPE_DETECT_TYPE"),o=a(e,T,l),r=function(){var e,t=T.map((e=n("GET_FILE_VALIDATE_TYPE_LABEL_EXPECTED_TYPES_MAP"),function(t){return null!==e[t]&&(e[t]||t)})).filter(function(e){return!1!==e}),l=t.filter(function(e,n){return t.indexOf(e)===n});i({status:{main:n("GET_LABEL_FILE_TYPE_NOT_ALLOWED"),sub:E(n("GET_FILE_VALIDATE_TYPE_LABEL_EXPECTED_TYPES"),{allTypes:l.join(", "),allButLastType:l.slice(0,-1).join(", "),lastType:l[l.length-1]})}})};if("boolean"==typeof o)return o?t(e):r();o.then(function(){t(e)}).catch(r)}else t(e)})}),{options:{allowFileTypeValidation:[!0,i.BOOLEAN],acceptedFileTypes:[[],i.ARRAY],labelFileTypeNotAllowed:["File is of invalid type",i.STRING],fileValidateTypeLabelExpectedTypes:["Expects {allButLastType} or {lastType}",i.STRING],fileValidateTypeLabelExpectedTypesMap:[{},i.OBJECT],fileValidateTypeDetectType:[null,i.FUNCTION]}}};return"undefined"!=typeof window&&void 0!==window.document&&document.dispatchEvent(new CustomEvent("FilePond:pluginloaded",{detail:e})),e});
; return module.exports; })();
const validateSize = (function () { const module = { exports: {} }; const exports = module.exports; /*!
 * FilePondPluginFileValidateSize 2.2.8
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

!function(e,i){"object"==typeof exports&&"undefined"!=typeof module?module.exports=i():"function"==typeof define&&define.amd?define(i):(e=e||self).FilePondPluginFileValidateSize=i()}(this,function(){"use strict";var e=function(e){var i=e.addFilter,E=e.utils,l=E.Type,_=E.replaceInString,n=E.toNaturalFileSize;return i("ALLOW_HOPPER_ITEM",function(e,i){var E=i.query;if(!E("GET_ALLOW_FILE_SIZE_VALIDATION"))return!0;var l=E("GET_MAX_FILE_SIZE");if(null!==l&&e.size>l)return!1;var _=E("GET_MIN_FILE_SIZE");return!(null!==_&&e.size<_)}),i("LOAD_FILE",function(e,i){var E=i.query;return new Promise(function(i,l){if(!E("GET_ALLOW_FILE_SIZE_VALIDATION"))return i(e);var I=E("GET_FILE_VALIDATE_SIZE_FILTER");if(I&&!I(e))return i(e);var t=E("GET_MAX_FILE_SIZE");if(null!==t&&e.size>t)l({status:{main:E("GET_LABEL_MAX_FILE_SIZE_EXCEEDED"),sub:_(E("GET_LABEL_MAX_FILE_SIZE"),{filesize:n(t,".",E("GET_FILE_SIZE_BASE"),E("GET_FILE_SIZE_LABELS",E))})}});else{var L=E("GET_MIN_FILE_SIZE");if(null!==L&&e.size<L)l({status:{main:E("GET_LABEL_MIN_FILE_SIZE_EXCEEDED"),sub:_(E("GET_LABEL_MIN_FILE_SIZE"),{filesize:n(L,".",E("GET_FILE_SIZE_BASE"),E("GET_FILE_SIZE_LABELS",E))})}});else{var a=E("GET_MAX_TOTAL_FILE_SIZE");if(null!==a)if(E("GET_ACTIVE_ITEMS").reduce(function(e,i){return e+i.fileSize},0)>a)return void l({status:{main:E("GET_LABEL_MAX_TOTAL_FILE_SIZE_EXCEEDED"),sub:_(E("GET_LABEL_MAX_TOTAL_FILE_SIZE"),{filesize:n(a,".",E("GET_FILE_SIZE_BASE"),E("GET_FILE_SIZE_LABELS",E))})}});i(e)}}})}),{options:{allowFileSizeValidation:[!0,l.BOOLEAN],maxFileSize:[null,l.INT],minFileSize:[null,l.INT],maxTotalFileSize:[null,l.INT],fileValidateSizeFilter:[null,l.FUNCTION],labelMinFileSizeExceeded:["File is too small",l.STRING],labelMinFileSize:["Minimum file size is {filesize}",l.STRING],labelMaxFileSizeExceeded:["File is too large",l.STRING],labelMaxFileSize:["Maximum file size is {filesize}",l.STRING],labelMaxTotalFileSizeExceeded:["Maximum total size exceeded",l.STRING],labelMaxTotalFileSize:["Maximum total file size is {filesize}",l.STRING]}}};return"undefined"!=typeof window&&void 0!==window.document&&document.dispatchEvent(new CustomEvent("FilePond:pluginloaded",{detail:e})),e});
; return module.exports; })();
const imagePreview = (function () { const module = { exports: {} }; const exports = module.exports; /*!
 * FilePondPluginImagePreview 4.6.12
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e=e||self).FilePondPluginImagePreview=t()}(this,function(){"use strict";function e(e){this.wrapped=e}function t(t){var i,r;function a(i,r){try{var o=t[i](r),c=o.value,s=c instanceof e;Promise.resolve(s?c.wrapped:c).then(function(e){s?a("next",e):n(o.done?"return":"normal",e)},function(e){a("throw",e)})}catch(e){n("throw",e)}}function n(e,t){switch(e){case"return":i.resolve({value:t,done:!0});break;case"throw":i.reject(t);break;default:i.resolve({value:t,done:!1})}(i=i.next)?a(i.key,i.arg):r=null}this._invoke=function(e,t){return new Promise(function(n,o){var c={key:e,arg:t,resolve:n,reject:o,next:null};r?r=r.next=c:(i=r=c,a(e,t))})},"function"!=typeof t.return&&(this.return=void 0)}"function"==typeof Symbol&&Symbol.asyncIterator&&(t.prototype[Symbol.asyncIterator]=function(){return this}),t.prototype.next=function(e){return this._invoke("next",e)},t.prototype.throw=function(e){return this._invoke("throw",e)},t.prototype.return=function(e){return this._invoke("return",e)};function i(e,t){return r(e)||function(e,t){var i=[],r=!0,a=!1,n=void 0;try{for(var o,c=e[Symbol.iterator]();!(r=(o=c.next()).done)&&(i.push(o.value),!t||i.length!==t);r=!0);}catch(e){a=!0,n=e}finally{try{r||null==c.return||c.return()}finally{if(a)throw n}}return i}(e,t)||a()}function r(e){if(Array.isArray(e))return e}function a(){throw new TypeError("Invalid attempt to destructure non-iterable instance")}var n=function(e,t){return s(e.x*t,e.y*t)},o=function(e,t){return s(e.x+t.x,e.y+t.y)},c=function(e,t,i){var r=Math.cos(t),a=Math.sin(t),n=s(e.x-i.x,e.y-i.y);return s(i.x+r*n.x-a*n.y,i.y+a*n.x+r*n.y)},s=function(){return{x:arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,y:arguments.length>1&&void 0!==arguments[1]?arguments[1]:0}},h=function(e,t){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,r=arguments.length>3?arguments[3]:void 0;return"string"==typeof e?parseFloat(e)*i:"number"==typeof e?e*(r?t[r]:Math.min(t.width,t.height)):void 0},u=function(e){return null!=e},l=function(e,t){return Object.keys(t).forEach(function(i){return e.setAttribute(i,t[i])})},d=function(e,t){var i=document.createElementNS("http://www.w3.org/2000/svg",e);return t&&l(i,t),i},f={contain:"xMidYMid meet",cover:"xMidYMid slice"},p={left:"start",center:"middle",right:"end"},g=function(e){return function(t){return d(e,{id:t.id})}},m={image:function(e){var t=d("image",{id:e.id,"stroke-linecap":"round","stroke-linejoin":"round",opacity:"0"});return t.onload=function(){t.setAttribute("opacity",e.opacity||1)},t.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",e.src),t},rect:g("rect"),ellipse:g("ellipse"),text:g("text"),path:g("path"),line:function(e){var t=d("g",{id:e.id,"stroke-linecap":"round","stroke-linejoin":"round"}),i=d("line");t.appendChild(i);var r=d("path");t.appendChild(r);var a=d("path");return t.appendChild(a),t}},y={rect:function(e){return l(e,Object.assign({},e.rect,e.styles))},ellipse:function(e){var t=e.rect.x+.5*e.rect.width,i=e.rect.y+.5*e.rect.height,r=.5*e.rect.width,a=.5*e.rect.height;return l(e,Object.assign({cx:t,cy:i,rx:r,ry:a},e.styles))},image:function(e,t){l(e,Object.assign({},e.rect,e.styles,{preserveAspectRatio:f[t.fit]||"none"}))},text:function(e,t,i,r){var a=h(t.fontSize,i,r),n=t.fontFamily||"sans-serif",o=t.fontWeight||"normal",c=p[t.textAlign]||"start";l(e,Object.assign({},e.rect,e.styles,{"stroke-width":0,"font-weight":o,"font-size":a,"font-family":n,"text-anchor":c})),e.text!==t.text&&(e.text=t.text,e.textContent=t.text.length?t.text:" ")},path:function(e,t,i,r){var a;l(e,Object.assign({},e.styles,{fill:"none",d:(a=t.points.map(function(e){return{x:h(e.x,i,r,"width"),y:h(e.y,i,r,"height")}}),a.map(function(e,t){return"".concat(0===t?"M":"L"," ").concat(e.x," ").concat(e.y)}).join(" "))}))},line:function(e,t,i,r){l(e,Object.assign({},e.rect,e.styles,{fill:"none"}));var a=e.childNodes[0],u=e.childNodes[1],d=e.childNodes[2],f=e.rect,p={x:e.rect.x+e.rect.width,y:e.rect.y+e.rect.height};if(l(a,{x1:f.x,y1:f.y,x2:p.x,y2:p.y}),t.lineDecoration){u.style.display="none",d.style.display="none";var g=function(e){var t=Math.sqrt(e.x*e.x+e.y*e.y);return 0===t?{x:0,y:0}:s(e.x/t,e.y/t)}({x:p.x-f.x,y:p.y-f.y}),m=h(.05,i,r);if(-1!==t.lineDecoration.indexOf("arrow-begin")){var y=n(g,m),E=o(f,y),v=c(f,2,E),w=c(f,-2,E);l(u,{style:"display:block;",d:"M".concat(v.x,",").concat(v.y," L").concat(f.x,",").concat(f.y," L").concat(w.x,",").concat(w.y)})}if(-1!==t.lineDecoration.indexOf("arrow-end")){var _=n(g,-m),I=o(p,_),M=c(p,2,I),x=c(p,-2,I);l(d,{style:"display:block;",d:"M".concat(M.x,",").concat(M.y," L").concat(p.x,",").concat(p.y," L").concat(x.x,",").concat(x.y)})}}}},E=function(e,t,i,r,a){"path"!==t&&(e.rect=function(e,t){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,r=h(e.x,t,i,"width")||h(e.left,t,i,"width"),a=h(e.y,t,i,"height")||h(e.top,t,i,"height"),n=h(e.width,t,i,"width"),o=h(e.height,t,i,"height"),c=h(e.right,t,i,"width"),s=h(e.bottom,t,i,"height");return u(a)||(a=u(o)&&u(s)?t.height-o-s:s),u(r)||(r=u(n)&&u(c)?t.width-n-c:c),u(n)||(n=u(r)&&u(c)?t.width-r-c:0),u(o)||(o=u(a)&&u(s)?t.height-a-s:0),{x:r||0,y:a||0,width:n||0,height:o||0}}(i,r,a)),e.styles=function(e,t,i){var r=e.borderStyle||e.lineStyle||"solid",a=e.backgroundColor||e.fontColor||"transparent",n=e.borderColor||e.lineColor||"transparent",o=h(e.borderWidth||e.lineWidth,t,i);return{"stroke-linecap":e.lineCap||"round","stroke-linejoin":e.lineJoin||"round","stroke-width":o||0,"stroke-dasharray":"string"==typeof r?"":r.map(function(e){return h(e,t,i)}).join(","),stroke:n,fill:a,opacity:e.opacity||1}}(i,r,a),y[t](e,i,r,a)},v=["x","y","left","top","right","bottom","width","height"],w=function(e){var t=i(e,2),r=t[0],a=t[1],n=a.points?{}:v.reduce(function(e,t){var i;return e[t]="string"==typeof(i=a[t])&&/%/.test(i)?parseFloat(i)/100:i,e},{});return[r,Object.assign({zIndex:0},a,n)]},_=function(e,t){return e[1].zIndex>t[1].zIndex?1:e[1].zIndex<t[1].zIndex?-1:0},I=function(e){return e.utils.createView({name:"image-preview-markup",tag:"svg",ignoreRect:!0,mixins:{apis:["width","height","crop","markup","resize","dirty"]},write:function(e){var t=e.root,r=e.props;if(r.dirty){var a=r.crop,n=r.resize,o=r.markup,c=r.width,s=r.height,h=a.width,u=a.height;if(n){var l=n.size,d=l&&l.width,f=l&&l.height,p=n.mode,g=n.upscale;d&&!f&&(f=d),f&&!d&&(d=f);var y=h<d&&u<f;if(!y||y&&g){var v,I=d/h,M=f/u;if("force"===p)h=d,u=f;else"cover"===p?v=Math.max(I,M):"contain"===p&&(v=Math.min(I,M)),h*=v,u*=v}}var x={width:c,height:s};t.element.setAttribute("width",x.width),t.element.setAttribute("height",x.height);var T=Math.min(c/h,s/u);t.element.innerHTML="";var A=t.query("GET_IMAGE_PREVIEW_MARKUP_FILTER");o.filter(A).map(w).sort(_).forEach(function(e){var r=i(e,2),a=r[0],n=r[1],o=function(e,t){return m[e](t)}(a,n);E(o,a,n,x,T),t.element.appendChild(o)})}}})},M=function(e,t){return{x:e,y:t}},x=function(e,t){return M(e.x-t.x,e.y-t.y)},T=function(e,t){return Math.sqrt(function(e,t){return function(e,t){return e.x*t.x+e.y*t.y}(x(e,t),x(e,t))}(e,t))},A=function(e,t){var i=e,r=t,a=1.5707963267948966-t,n=Math.sin(1.5707963267948966),o=Math.sin(r),c=Math.sin(a),s=Math.cos(a),h=i/n;return M(s*(h*o),s*(h*c))},R=function(e,t,i,r){var a=r.x>.5?1-r.x:r.x,n=r.y>.5?1-r.y:r.y,o=2*a*e.width,c=2*n*e.height,s=function(e,t){var i=e.width,r=e.height,a=A(i,t),n=A(r,t),o=M(e.x+Math.abs(a.x),e.y-Math.abs(a.y)),c=M(e.x+e.width+Math.abs(n.y),e.y+Math.abs(n.x)),s=M(e.x-Math.abs(n.y),e.y+e.height-Math.abs(n.x));return{width:T(o,c),height:T(o,s)}}(t,i);return Math.max(s.width/o,s.height/c)},P=function(e,t){var i=e.width,r=i*t;return r>e.height&&(i=(r=e.height)/t),{x:.5*(e.width-i),y:.5*(e.height-r),width:i,height:r}},C=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},i=t.zoom,r=t.rotation,a=t.center,n=t.aspectRatio;n||(n=e.height/e.width);var o=function(e,t){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,r=e.height/e.width,a=t,n=1,o=r;o>a&&(n=(o=a)/r);var c=Math.max(1/n,a/o),s=e.width/(i*c*n);return{width:s,height:s*t}}(e,n,i),c={x:.5*o.width,y:.5*o.height},s={x:0,y:0,width:o.width,height:o.height,center:c},h=void 0===t.scaleToFit||t.scaleToFit,u=i*R(e,P(s,n),r,h?a:{x:.5,y:.5});return{widthFloat:o.width/u,heightFloat:o.height/u,width:Math.round(o.width/u),height:Math.round(o.height/u)}},k={type:"spring",stiffness:.5,damping:.45,mass:10},D=function(e){return e.utils.createView({name:"image-clip",tag:"div",ignoreRect:!0,mixins:{apis:["crop","markup","resize","width","height","dirty","background"],styles:["width","height","opacity"],animations:{opacity:{type:"tween",duration:250}}},didWriteView:function(e){var t=e.root,i=e.props;i.background&&(t.element.style.backgroundColor=i.background)},create:function(t){var i=t.root,r=t.props;i.ref.image=i.appendChildView(i.createChildView(function(e){return e.utils.createView({name:"image-canvas-wrapper",tag:"div",ignoreRect:!0,mixins:{apis:["crop","width","height"],styles:["originX","originY","translateX","translateY","scaleX","scaleY","rotateZ"],animations:{originX:k,originY:k,scaleX:k,scaleY:k,translateX:k,translateY:k,rotateZ:k}},create:function(t){var i=t.root,r=t.props;r.width=r.image.width,r.height=r.image.height,i.ref.bitmap=i.appendChildView(i.createChildView(function(e){return e.utils.createView({name:"image-bitmap",ignoreRect:!0,mixins:{styles:["scaleX","scaleY"]},create:function(e){var t=e.root,i=e.props;t.appendChild(i.image)}})}(e),{image:r.image}))},write:function(e){var t=e.root,i=e.props.crop.flip,r=t.ref.bitmap;r.scaleX=i.horizontal?-1:1,r.scaleY=i.vertical?-1:1}})}(e),Object.assign({},r))),i.ref.createMarkup=function(){i.ref.markup||(i.ref.markup=i.appendChildView(i.createChildView(I(e),Object.assign({},r))))},i.ref.destroyMarkup=function(){i.ref.markup&&(i.removeChildView(i.ref.markup),i.ref.markup=null)};var a=i.query("GET_IMAGE_PREVIEW_TRANSPARENCY_INDICATOR");null!==a&&(i.element.dataset.transparencyIndicator="grid"===a?a:"color")},write:function(e){var t=e.root,i=e.props,r=e.shouldOptimize,a=i.crop,n=i.markup,o=i.resize,c=i.dirty,s=i.width,h=i.height;t.ref.image.crop=a;var u={x:0,y:0,width:s,height:h,center:{x:.5*s,y:.5*h}},l={width:t.ref.image.width,height:t.ref.image.height},d={x:a.center.x*l.width,y:a.center.y*l.height},f={x:u.center.x-l.width*a.center.x,y:u.center.y-l.height*a.center.y},p=2*Math.PI+a.rotation%(2*Math.PI),g=a.aspectRatio||l.height/l.width,m=void 0===a.scaleToFit||a.scaleToFit,y=R(l,P(u,g),p,m?a.center:{x:.5,y:.5}),E=a.zoom*y;n&&n.length?(t.ref.createMarkup(),t.ref.markup.width=s,t.ref.markup.height=h,t.ref.markup.resize=o,t.ref.markup.dirty=c,t.ref.markup.markup=n,t.ref.markup.crop=C(l,a)):t.ref.markup&&t.ref.destroyMarkup();var v=t.ref.image;if(r)return v.originX=null,v.originY=null,v.translateX=null,v.translateY=null,v.rotateZ=null,v.scaleX=null,void(v.scaleY=null);v.originX=d.x,v.originY=d.y,v.translateX=f.x,v.translateY=f.y,v.rotateZ=p,v.scaleX=E,v.scaleY=E}})},G=0,V=function(){self.onmessage=function(e){createImageBitmap(e.data.message.file).then(function(t){self.postMessage({id:e.data.id,message:t},[t])})}},O=function(){self.onmessage=function(e){for(var t=e.data.message.imageData,i=e.data.message.colorMatrix,r=t.data,a=r.length,n=i[0],o=i[1],c=i[2],s=i[3],h=i[4],u=i[5],l=i[6],d=i[7],f=i[8],p=i[9],g=i[10],m=i[11],y=i[12],E=i[13],v=i[14],w=i[15],_=i[16],I=i[17],M=i[18],x=i[19],T=0,A=0,R=0,P=0,C=0;T<a;T+=4)A=r[T]/255,R=r[T+1]/255,P=r[T+2]/255,C=r[T+3]/255,r[T]=Math.max(0,Math.min(255*(A*n+R*o+P*c+C*s+h),255)),r[T+1]=Math.max(0,Math.min(255*(A*u+R*l+P*d+C*f+p),255)),r[T+2]=Math.max(0,Math.min(255*(A*g+R*m+P*y+C*E+v),255)),r[T+3]=Math.max(0,Math.min(255*(A*w+R*_+P*I+C*M+x),255));self.postMessage({id:e.data.id,message:t},[t.data.buffer])}},b={1:function(){return[1,0,0,1,0,0]},2:function(e){return[-1,0,0,1,e,0]},3:function(e,t){return[-1,0,0,-1,e,t]},4:function(e,t){return[1,0,0,-1,0,t]},5:function(){return[0,1,1,0,0,0]},6:function(e,t){return[0,1,-1,0,t,0]},7:function(e,t){return[0,-1,-1,0,t,e]},8:function(e){return[0,-1,1,0,0,e]}},S=function(e,t,i,r){t=Math.round(t),i=Math.round(i);var a=document.createElement("canvas");a.width=t,a.height=i;var n=a.getContext("2d");if(r>=5&&r<=8){var o=[i,t];t=o[0],i=o[1]}return function(e,t,i,r){-1!==r&&e.transform.apply(e,b[r](t,i))}(n,t,i,r),n.drawImage(e,0,0,t,i),a},L=function(e){return/^image/.test(e.type)&&!/svg/.test(e.type)},N=function(e){var t=Math.min(10/e.width,10/e.height),i=document.createElement("canvas"),r=i.getContext("2d"),a=i.width=Math.ceil(e.width*t),n=i.height=Math.ceil(e.height*t);r.drawImage(e,0,0,a,n);var o=null;try{o=r.getImageData(0,0,a,n).data}catch(e){return null}for(var c=o.length,s=0,h=0,u=0,l=0;l<c;l+=4)s+=o[l]*o[l],h+=o[l+1]*o[l+1],u+=o[l+2]*o[l+2];return{r:s=W(s,c),g:h=W(h,c),b:u=W(u,c)}},W=function(e,t){return Math.floor(Math.sqrt(e/(t/4)))},z=function(e){var t=e.utils.createView({name:"image-preview-overlay",tag:"div",ignoreRect:!0,create:function(e){var t=e.root,i=e.props,r='<svg width="500" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">\n    <defs>\n        <radialGradient id="gradient-__UID__" cx=".5" cy="1.25" r="1.15">\n            <stop offset=\'50%\' stop-color=\'#000000\'/>\n            <stop offset=\'56%\' stop-color=\'#0a0a0a\'/>\n            <stop offset=\'63%\' stop-color=\'#262626\'/>\n            <stop offset=\'69%\' stop-color=\'#4f4f4f\'/>\n            <stop offset=\'75%\' stop-color=\'#808080\'/>\n            <stop offset=\'81%\' stop-color=\'#b1b1b1\'/>\n            <stop offset=\'88%\' stop-color=\'#dadada\'/>\n            <stop offset=\'94%\' stop-color=\'#f6f6f6\'/>\n            <stop offset=\'100%\' stop-color=\'#ffffff\'/>\n        </radialGradient>\n        <mask id="mask-__UID__">\n            <rect x="0" y="0" width="500" height="200" fill="url(#gradient-__UID__)"></rect>\n        </mask>\n    </defs>\n    <rect x="0" width="500" height="200" fill="currentColor" mask="url(#mask-__UID__)"></rect>\n</svg>';if(document.querySelector("base")){var a=new URL(window.location.href.replace(window.location.hash,"")).href;r=r.replace(/url\(\#/g,"url("+a+"#")}G++,t.element.classList.add("filepond--image-preview-overlay-".concat(i.status)),t.element.innerHTML=r.replace(/__UID__/g,G)},mixins:{styles:["opacity"],animations:{opacity:{type:"spring",mass:25}}}}),i=function(e){return e.utils.createView({name:"image-preview",tag:"div",ignoreRect:!0,mixins:{apis:["image","crop","markup","resize","dirty","background"],styles:["translateY","scaleX","scaleY","opacity"],animations:{scaleX:k,scaleY:k,translateY:k,opacity:{type:"tween",duration:400}}},create:function(t){var i=t.root,r=t.props;i.ref.clip=i.appendChildView(i.createChildView(D(e),{id:r.id,image:r.image,crop:r.crop,markup:r.markup,resize:r.resize,dirty:r.dirty,background:r.background}))},write:function(e){var t=e.root,i=e.props,r=e.shouldOptimize,a=t.ref.clip,n=i.image,o=i.crop,c=i.markup,s=i.resize,h=i.dirty;if(a.crop=o,a.markup=c,a.resize=s,a.dirty=h,a.opacity=r?0:1,!r&&!t.rect.element.hidden){var u=n.height/n.width,l=o.aspectRatio||u,d=t.rect.inner.width,f=t.rect.inner.height,p=t.query("GET_IMAGE_PREVIEW_HEIGHT"),g=t.query("GET_IMAGE_PREVIEW_MIN_HEIGHT"),m=t.query("GET_IMAGE_PREVIEW_MAX_HEIGHT"),y=t.query("GET_PANEL_ASPECT_RATIO"),E=t.query("GET_ALLOW_MULTIPLE");y&&!E&&(p=d*y,l=y);var v=null!==p?p:Math.max(g,Math.min(d*l,m)),w=v/l;w>d&&(v=(w=d)*l),v>f&&(v=f,w=f/l),a.width=w,a.height=v}}})}(e),r=e.utils.createWorker,a=function(e,t,i){return new Promise(function(a){e.ref.imageData||(e.ref.imageData=i.getContext("2d").getImageData(0,0,i.width,i.height));var n=function(e){var t;try{t=new ImageData(e.width,e.height)}catch(i){t=document.createElement("canvas").getContext("2d").createImageData(e.width,e.height)}return t.data.set(new Uint8ClampedArray(e.data)),t}(e.ref.imageData);if(!t||20!==t.length)return i.getContext("2d").putImageData(n,0,0),a();var o=r(O);o.post({imageData:n,colorMatrix:t},function(e){i.getContext("2d").putImageData(e,0,0),o.terminate(),a()},[n.data.buffer])})},n=function(e){var t=e.root,r=e.props,a=e.image,n=r.id,o=t.query("GET_ITEM",{id:n});if(o){var c,s,h=o.getMetadata("crop")||{center:{x:.5,y:.5},flip:{horizontal:!1,vertical:!1},zoom:1,rotation:0,aspectRatio:null},u=t.query("GET_IMAGE_TRANSFORM_CANVAS_BACKGROUND_COLOR"),l=!1;t.query("GET_IMAGE_PREVIEW_MARKUP_SHOW")&&(c=o.getMetadata("markup")||[],s=o.getMetadata("resize"),l=!0);var d=t.appendChildView(t.createChildView(i,{id:n,image:a,crop:h,resize:s,markup:c,dirty:l,background:u,opacity:0,scaleX:1.15,scaleY:1.15,translateY:15}),t.childViews.length);t.ref.images.push(d),d.opacity=1,d.scaleX=1,d.scaleY=1,d.translateY=0,setTimeout(function(){t.dispatch("DID_IMAGE_PREVIEW_SHOW",{id:n})},250)}},o=function(e){var t=e.root;t.ref.overlayShadow.opacity=1,t.ref.overlayError.opacity=0,t.ref.overlaySuccess.opacity=0},c=function(e){var t=e.root;t.ref.overlayShadow.opacity=.25,t.ref.overlayError.opacity=1};return e.utils.createView({name:"image-preview-wrapper",create:function(e){var i=e.root;i.ref.images=[],i.ref.imageData=null,i.ref.imageViewBin=[],i.ref.overlayShadow=i.appendChildView(i.createChildView(t,{opacity:0,status:"idle"})),i.ref.overlaySuccess=i.appendChildView(i.createChildView(t,{opacity:0,status:"success"})),i.ref.overlayError=i.appendChildView(i.createChildView(t,{opacity:0,status:"failure"}))},styles:["height"],apis:["height"],destroy:function(e){e.root.ref.images.forEach(function(e){e.image.width=1,e.image.height=1})},didWriteView:function(e){e.root.ref.images.forEach(function(e){e.dirty=!1})},write:e.utils.createRoute({DID_IMAGE_PREVIEW_DRAW:function(e){var t=e.root,i=t.ref.images[t.ref.images.length-1];i.translateY=0,i.scaleX=1,i.scaleY=1,i.opacity=1},DID_IMAGE_PREVIEW_CONTAINER_CREATE:function(e){var t=e.root,i=e.props.id,r=t.query("GET_ITEM",i);if(r){var a,n,o,c=URL.createObjectURL(r.file);a=c,n=function(e,r){t.dispatch("DID_IMAGE_PREVIEW_CALCULATE_SIZE",{id:i,width:e,height:r})},(o=new Image).onload=function(){var e=o.naturalWidth,t=o.naturalHeight;o=null,n(e,t)},o.src=a}},DID_FINISH_CALCULATE_PREVIEWSIZE:function(e){var t=e.root,i=e.props,o=i.id,c=t.query("GET_ITEM",o);if(c){var s,h,u,l=URL.createObjectURL(c.file),d=function(){var e;(e=l,new Promise(function(t,i){var r=new Image;r.crossOrigin="Anonymous",r.onload=function(){t(r)},r.onerror=function(e){i(e)},r.src=e})).then(f)},f=function(e){URL.revokeObjectURL(l);var r=(c.getMetadata("exif")||{}).orientation||-1,o=e.width,s=e.height;if(o&&s){if(r>=5&&r<=8){var h=[s,o];o=h[0],s=h[1]}var u=Math.max(1,.75*window.devicePixelRatio),d=t.query("GET_IMAGE_PREVIEW_ZOOM_FACTOR")*u,f=s/o,p=t.rect.element.width,g=t.rect.element.height,m=p,y=m*f;f>1?y=(m=Math.min(o,p*d))*f:m=(y=Math.min(s,g*d))/f;var E=S(e,m,y,r),v=function(){var r=t.query("GET_IMAGE_PREVIEW_CALCULATE_AVERAGE_IMAGE_COLOR")?N(data):null;c.setMetadata("color",r,!0),"close"in e&&e.close(),t.ref.overlayShadow.opacity=1,n({root:t,props:i,image:E})},w=c.getMetadata("filter");w?a(t,w,E).then(v):v()}};if(s=c.file,h=window.navigator.userAgent.match(/Firefox\/([0-9]+)\./),!(null!==(u=h?parseInt(h[1]):null)&&u<=58)&&"createImageBitmap"in window&&L(s)){var p=r(V);p.post({file:c.file},function(e){p.terminate(),e?f(e):d()})}else d()}},DID_UPDATE_ITEM_METADATA:function(e){var t=e.root,i=e.props,r=e.action;if(/crop|filter|markup|resize/.test(r.change.key)&&t.ref.images.length){var o=t.query("GET_ITEM",{id:i.id});if(o)if(/filter/.test(r.change.key)){var c=t.ref.images[t.ref.images.length-1];a(t,r.change.value,c.image)}else{if(/crop|markup|resize/.test(r.change.key)){var s=o.getMetadata("crop"),h=t.ref.images[t.ref.images.length-1];if(s&&s.aspectRatio&&h.crop&&h.crop.aspectRatio&&Math.abs(s.aspectRatio-h.crop.aspectRatio)>1e-5){var u=function(e){var t=e.root,i=t.ref.images.shift();return i.opacity=0,i.translateY=-15,t.ref.imageViewBin.push(i),i}({root:t});n({root:t,props:i,image:(l=u.image,(d=d||document.createElement("canvas")).width=l.width,d.height=l.height,d.getContext("2d").drawImage(l,0,0),d)})}else!function(e){var t=e.root,i=e.props,r=t.query("GET_ITEM",{id:i.id});if(r){var a=t.ref.images[t.ref.images.length-1];a.crop=r.getMetadata("crop"),a.background=t.query("GET_IMAGE_TRANSFORM_CANVAS_BACKGROUND_COLOR"),t.query("GET_IMAGE_PREVIEW_MARKUP_SHOW")&&(a.dirty=!0,a.resize=r.getMetadata("resize"),a.markup=r.getMetadata("markup"))}}({root:t,props:i})}var l,d}}},DID_THROW_ITEM_LOAD_ERROR:c,DID_THROW_ITEM_PROCESSING_ERROR:c,DID_THROW_ITEM_INVALID:c,DID_COMPLETE_ITEM_PROCESSING:function(e){var t=e.root;t.ref.overlayShadow.opacity=.25,t.ref.overlaySuccess.opacity=1},DID_START_ITEM_PROCESSING:o,DID_REVERT_ITEM_PROCESSING:o},function(e){var t=e.root,i=t.ref.imageViewBin.filter(function(e){return 0===e.opacity});t.ref.imageViewBin=t.ref.imageViewBin.filter(function(e){return e.opacity>0}),i.forEach(function(e){return function(e,t){e.removeChildView(t),t.image.width=1,t.image.height=1,t._destroy()}(t,e)}),i.length=0})})},H=function(e){var t=e.addFilter,i=e.utils,r=i.Type,a=i.createRoute,n=i.isFile,o=z(e);return t("CREATE_VIEW",function(e){var t=e.is,i=e.view,r=e.query;if(t("file")&&r("GET_ALLOW_IMAGE_PREVIEW")){var c=function(e){e.root.ref.shouldRescale=!0};i.registerWriter(a({DID_RESIZE_ROOT:c,DID_STOP_RESIZE:c,DID_LOAD_ITEM:function(e){var t=e.root,a=e.props.id,c=r("GET_ITEM",a);if(c&&n(c.file)&&!c.archived){var s=c.file;if(function(e){return/^image/.test(e.type)}(s)&&r("GET_IMAGE_PREVIEW_FILTER_ITEM")(c)){var h="createImageBitmap"in(window||{}),u=r("GET_IMAGE_PREVIEW_MAX_FILE_SIZE");if(!(!h&&u&&s.size>u)){t.ref.imagePreview=i.appendChildView(i.createChildView(o,{id:a}));var l=t.query("GET_IMAGE_PREVIEW_HEIGHT");l&&t.dispatch("DID_UPDATE_PANEL_HEIGHT",{id:c.id,height:l});var d=!h&&s.size>r("GET_IMAGE_PREVIEW_MAX_INSTANT_PREVIEW_FILE_SIZE");t.dispatch("DID_IMAGE_PREVIEW_CONTAINER_CREATE",{id:a},d)}}}},DID_IMAGE_PREVIEW_CALCULATE_SIZE:function(e){var t=e.root,i=e.action;t.ref.imageWidth=i.width,t.ref.imageHeight=i.height,t.ref.shouldRescale=!0,t.ref.shouldDrawPreview=!0,t.dispatch("KICK")},DID_UPDATE_ITEM_METADATA:function(e){var t=e.root;"crop"===e.action.change.key&&(t.ref.shouldRescale=!0)}},function(e){var t=e.root,i=e.props;t.ref.imagePreview&&(t.rect.element.hidden||(t.ref.shouldRescale&&(!function(e,t){if(e.ref.imagePreview){var i=t.id,r=e.query("GET_ITEM",{id:i});if(r){var a=e.query("GET_PANEL_ASPECT_RATIO"),n=e.query("GET_ITEM_PANEL_ASPECT_RATIO"),o=e.query("GET_IMAGE_PREVIEW_HEIGHT");if(!(a||n||o)){var c=e.ref,s=c.imageWidth,h=c.imageHeight;if(s&&h){var u=e.query("GET_IMAGE_PREVIEW_MIN_HEIGHT"),l=e.query("GET_IMAGE_PREVIEW_MAX_HEIGHT"),d=(r.getMetadata("exif")||{}).orientation||-1;if(d>=5&&d<=8){var f=[h,s];s=f[0],h=f[1]}if(!L(r.file)||e.query("GET_IMAGE_PREVIEW_UPSCALE")){var p=2048/s;s*=p,h*=p}var g=h/s,m=(r.getMetadata("crop")||{}).aspectRatio||g,y=Math.max(u,Math.min(h,l)),E=e.rect.element.width,v=Math.min(E*m,y);e.dispatch("DID_UPDATE_PANEL_HEIGHT",{id:r.id,height:v})}}}}}(t,i),t.ref.shouldRescale=!1),t.ref.shouldDrawPreview&&(requestAnimationFrame(function(){requestAnimationFrame(function(){t.dispatch("DID_FINISH_CALCULATE_PREVIEWSIZE",{id:i.id})})}),t.ref.shouldDrawPreview=!1)))}))}}),{options:{allowImagePreview:[!0,r.BOOLEAN],imagePreviewFilterItem:[function(){return!0},r.FUNCTION],imagePreviewHeight:[null,r.INT],imagePreviewMinHeight:[44,r.INT],imagePreviewMaxHeight:[256,r.INT],imagePreviewMaxFileSize:[null,r.INT],imagePreviewZoomFactor:[2,r.INT],imagePreviewUpscale:[!1,r.BOOLEAN],imagePreviewMaxInstantPreviewFileSize:[1e6,r.INT],imagePreviewTransparencyIndicator:[null,r.STRING],imagePreviewCalculateAverageImageColor:[!1,r.BOOLEAN],imagePreviewMarkupShow:[!0,r.BOOLEAN],imagePreviewMarkupFilter:[function(){return!0},r.FUNCTION]}}};return"undefined"!=typeof window&&void 0!==window.document&&document.dispatchEvent(new CustomEvent("FilePond:pluginloaded",{detail:H})),H});
; return module.exports; })();
const filePoster = (function () { const module = { exports: {} }; const exports = module.exports; /*!
 * FilePondPluginFilePoster 2.5.2
 * Licensed under MIT, https://opensource.org/licenses/MIT/
 * Please visit https://pqina.nl/filepond/ for details.
 */

/* eslint-disable */

!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e=e||self).FilePondPluginFilePoster=t()}(this,function(){"use strict";var e={type:"spring",stiffness:.5,damping:.45,mass:10},t=function(e){return-.5*(Math.cos(Math.PI*e)-1)},r=function(e){var t=Math.min(10/e.width,10/e.height),r=document.createElement("canvas"),a=r.getContext("2d"),o=r.width=Math.ceil(e.width*t),n=r.height=Math.ceil(e.height*t);a.drawImage(e,0,0,o,n);var l=null;try{l=a.getImageData(0,0,o,n).data}catch(e){return null}for(var c=l.length,d=0,E=0,s=0,f=0;f<c;f+=4)d+=l[f]*l[f],E+=l[f+1]*l[f+1],s+=l[f+2]*l[f+2];return{r:d=i(d,c),g:E=i(E,c),b:s=i(s,c)}},i=function(e,t){return Math.floor(Math.sqrt(e/(t/4)))},a=function(e,r,i,a,o){e.width=r,e.height=i;var n=e.getContext("2d"),l=.5*r,c=n.createRadialGradient(l,i+110,i-100,l,i+110,i+100);!function(e,r){for(var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,a=arguments.length>3&&void 0!==arguments[3]?arguments[3]:t,o=arguments.length>4&&void 0!==arguments[4]?arguments[4]:10,n=arguments.length>5&&void 0!==arguments[5]?arguments[5]:0,l=1-n,c=r.join(","),d=0;d<=o;d++){var E=d/o,s=n+l*E;e.addColorStop(s,"rgba(".concat(c,", ").concat(a(E)*i,")"))}}(c,a,o,void 0,8,.4),n.save(),n.translate(.5*-r,0),n.scale(2,1),n.fillStyle=c,n.fillRect(0,0,r,i),n.restore()},o="undefined"!=typeof navigator,n="undefined"!=typeof document,l=o&&n&&document.createElement("canvas"),c=o&&n&&document.createElement("canvas"),d=o&&n&&document.createElement("canvas"),E=[40,40,40],s=[196,78,71],f=[54,151,99];o&&n&&(a(l,500,200,E,.85),a(c,500,200,s,1),a(d,500,200,f,1));var u=function(t){var i=t.utils.createView({name:"file-poster-overlay",tag:"canvas",ignoreRect:!0,create:function(e){var t,r,i=e.root,a=e.props;t=a.template,(r=i.element).width=t.width,r.height=t.height,r.getContext("2d").drawImage(t,0,0)},mixins:{styles:["opacity"],animations:{opacity:{type:"spring",mass:25}}}}),o=function(e){var t=e.root;t.ref.overlayShadow.opacity=1,t.ref.overlayError.opacity=0,t.ref.overlaySuccess.opacity=0},n=function(e){var t=e.root;t.ref.overlayShadow.opacity=.25,t.ref.overlayError.opacity=1};return t.utils.createView({name:"file-poster-wrapper",create:function(r){var o=r.root,n=r.props,u=o.query("GET_FILE_POSTER_ITEM_OVERLAY_SHADOW_COLOR"),_=o.query("GET_FILE_POSTER_ITEM_OVERLAY_ERROR_COLOR"),I=o.query("GET_FILE_POSTER_ITEM_OVERLAY_SUCCESS_COLOR");u&&u!==E&&a(l,500,200,E=u,.85),_&&_!==s&&a(c,500,200,s=_,1),I&&I!==f&&a(d,500,200,f=I,1);var p=function(t){return t.utils.createView({name:"file-poster",tag:"div",ignoreRect:!0,create:function(e){var t=e.root;t.ref.image=document.createElement("img"),t.element.appendChild(t.ref.image)},write:t.utils.createRoute({DID_FILE_POSTER_LOAD:function(e){var t=e.root,r=e.props,i=r.id,a=t.query("GET_ITEM",{id:r.id});if(a){var o=a.getMetadata("poster");t.ref.image.src=o,t.dispatch("DID_FILE_POSTER_DRAW",{id:i})}}}),mixins:{styles:["scaleX","scaleY","opacity"],animations:{scaleX:e,scaleY:e,opacity:{type:"tween",duration:750}}}})}(t);o.ref.image=o.appendChildView(o.createChildView(p,{id:n.id,scaleX:1.25,scaleY:1.25,opacity:0})),o.ref.overlayShadow=o.appendChildView(o.createChildView(i,{template:l,opacity:0})),o.ref.overlaySuccess=o.appendChildView(o.createChildView(i,{template:d,opacity:0})),o.ref.overlayError=o.appendChildView(o.createChildView(i,{template:c,opacity:0}))},write:t.utils.createRoute({DID_FILE_POSTER_LOAD:function(e){e.root.ref.overlayShadow.opacity=1},DID_FILE_POSTER_DRAW:function(e){var t=e.root.ref.image;t.scaleX=1,t.scaleY=1,t.opacity=1},DID_FILE_POSTER_CONTAINER_CREATE:function(e){var t=e.root,i=e.props.id,a=t.query("GET_ITEM",i);if(a){var o,n,l,c=a.getMetadata("poster"),d=function(e){var o=t.query("GET_FILE_POSTER_CALCULATE_AVERAGE_IMAGE_COLOR")?r(e):null;a.setMetadata("color",o,!0),t.dispatch("DID_FILE_POSTER_LOAD",{id:i,data:e})};o=c,n=function(e,r){var a,o;t.dispatch("DID_FILE_POSTER_CALCULATE_SIZE",{id:i,width:e,height:r}),(a=c,o=t.query("GET_FILE_POSTER_CROSS_ORIGIN_ATTRIBUTE_VALUE"),new Promise(function(e,t){var r=new Image;"string"==typeof crossOrigin&&(r.crossOrigin=o),r.onload=function(){e(r)},r.onerror=function(e){t(e)},r.src=a})).then(d)},(l=new Image).onload=function(){var e=l.naturalWidth,t=l.naturalHeight;l=null,n(e,t)},l.src=o}},DID_THROW_ITEM_LOAD_ERROR:n,DID_THROW_ITEM_PROCESSING_ERROR:n,DID_THROW_ITEM_INVALID:n,DID_COMPLETE_ITEM_PROCESSING:function(e){var t=e.root;t.ref.overlayShadow.opacity=.25,t.ref.overlaySuccess.opacity=1},DID_START_ITEM_PROCESSING:o,DID_REVERT_ITEM_PROCESSING:o})})},_=function(e){var t=e.addFilter,r=e.utils,i=r.Type,a=r.createRoute,o=u(e);return t("CREATE_VIEW",function(e){var t=e.is,r=e.view,i=e.query;if(t("file")&&i("GET_ALLOW_FILE_POSTER")){var n=function(e,t){var a=t.id,n=i("GET_ITEM",a);n&&n.getMetadata("poster")&&!n.archived&&e.ref.previousPoster!==n.getMetadata("poster")&&(e.ref.previousPoster=n.getMetadata("poster"),i("GET_FILE_POSTER_FILTER_ITEM")(n)&&(e.ref.filePoster&&r.removeChildView(e.ref.filePoster),e.ref.filePoster=r.appendChildView(r.createChildView(o,{id:a})),e.dispatch("DID_FILE_POSTER_CONTAINER_CREATE",{id:a})))},l=function(e){var t=e.root,r=t.query("GET_FILE_POSTER_HEIGHT");if(r)return r;var i=t.query("GET_FILE_POSTER_MIN_HEIGHT"),a=t.query("GET_FILE_POSTER_MAX_HEIGHT");if(i&&t.ref.imageHeight<i)return i;var o=t.rect.element.width*(t.ref.imageHeight/t.ref.imageWidth);return i&&o<i?i:a&&o>a?a:o};r.registerWriter(a({DID_LOAD_ITEM:function(e){var t=e.root,r=e.props;n(t,r)},DID_FILE_POSTER_CALCULATE_SIZE:function(e){var t=e.root,r=e.action;t.ref.filePoster&&(t.ref.imageWidth=r.width,t.ref.imageHeight=r.height,t.ref.shouldUpdatePanelHeight=!0,t.dispatch("KICK"))},DID_UPDATE_ITEM_METADATA:function(e){var t=e.root,r=e.props,i=e.action;/poster/.test(i.change.key)&&n(t,r)}},function(e){var t=e.root,r=e.props;t.ref.filePoster&&(t.rect.element.hidden||t.ref.shouldUpdatePanelHeight&&(t.dispatch("DID_UPDATE_PANEL_HEIGHT",{id:r.id,height:l({root:t})}),t.ref.shouldUpdatePanelHeight=!1))}))}}),{options:{allowFilePoster:[!0,i.BOOLEAN],filePosterHeight:[null,i.INT],filePosterMinHeight:[null,i.INT],filePosterMaxHeight:[null,i.INT],filePosterFilterItem:[function(){return!0},i.FUNCTION],filePosterCalculateAverageImageColor:[!1,i.BOOLEAN],filePosterCrossOriginAttributeValue:["Anonymous",i.STRING],filePosterItemOverlayShadowColor:[null,i.ARRAY],filePosterItemOverlayErrorColor:[null,i.ARRAY],filePosterItemOverlaySuccessColor:[null,i.ARRAY]}}};return"undefined"!=typeof window&&void 0!==window.document&&document.dispatchEvent(new CustomEvent("FilePond:pluginloaded",{detail:_})),_});
; return module.exports; })();
// Native PDF rendering with explicit ownership of temporary object URLs.
const pdfPreview = ({ addFilter, utils }) => {
    const { createView, createRoute, Type } = utils;
    const pdfView = createView({
        name: 'sirius-pdf-preview', ignoreRect: true,
        create: ({ root, props }) => {
            const item = root.query('GET_ITEM', props.id);
            const stored = item.getMetadata('existing');
            const url = stored?.url || URL.createObjectURL(item.file);
            root.ref.objectUrl = stored ? null : url;
            const object = document.createElement('object');
            object.type = 'application/pdf'; object.data = url;
            object.setAttribute('aria-label', item.filename);
            object.style.height = root.query('GET_PDF_PREVIEW_HEIGHT') + 'px';
            const link = document.createElement('a');
            link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = root.query('GET_LABEL_PDF_OPEN') + ': ' + item.filename;
            root.element.append(object, link);
        },
        destroy: ({ root }) => { if (root.ref.objectUrl) URL.revokeObjectURL(root.ref.objectUrl); },
    });
    addFilter('CREATE_VIEW', ({ is, view, query }) => {
        if (!is('file')) return;
        view.registerWriter(createRoute({ DID_LOAD_ITEM: ({ root, props }) => {
            const item = query('GET_ITEM', props.id);
            if (!query('GET_ALLOW_PDF_PREVIEW') || !item || item.file.type !== 'application/pdf' || root.ref.siriusPdf) return;
            if (item.getMetadata('existing') && !item.getMetadata('existing').url) return;
            root.ref.siriusPdf = view.appendChildView(view.createChildView(pdfView, { id: props.id }));
            root.ref.resizePdf = true;
        } }, ({ root, props }) => {
            if (root.ref.resizePdf && !root.rect.element.hidden) {
                root.dispatch('DID_UPDATE_PANEL_HEIGHT', { id: props.id, height: query('GET_PDF_PREVIEW_HEIGHT') + 90 });
                root.ref.resizePdf = false;
            }
        }));
    });
    return { options: { allowPdfPreview: [true, Type.BOOLEAN], pdfPreviewHeight: [240, Type.INT], labelPdfOpen: ['', Type.STRING] } };
};

const uploadOwner = Symbol.for('sirius.ui.file-upload');
if (!window[uploadOwner]) {
    window[uploadOwner] = true;
    FilePond.registerPlugin(validateType, validateSize, imagePreview, filePoster, pdfPreview);
    const states = new Map();
    const selector = '[data-sir-file-upload]';
    const locked = state => state.source.disabled || state.source.hasAttribute('readonly');
    const emit = (state, type, detail = {}) => state.source.dispatchEvent(new CustomEvent('file-upload:' + type, { bubbles: true, detail }));
    const existingFiles = config => config.value.map((file, index) => ({ source: 'existing-' + index, options: {
        type: 'local', file: { name: file.name, size: file.size, type: file.type },
        metadata: { existing: { name: file.name, size: file.size, url: file.url }, ...(file.url && file.type.startsWith('image/') ? { poster: file.url } : {}) },
    } }));

    function nativeFiles(state) {
        const items = state.pond.getFiles();
        const transfer = new DataTransfer();
        items.filter(item => item.origin !== FilePond.FileOrigin.LOCAL && item.file instanceof File && item.status !== FilePond.FileStatus.LOAD_ERROR).forEach(item => transfer.items.add(item.file));
        state.source.files = transfer.files;
        const required = state.config.required && !items.some(item => item.origin === FilePond.FileOrigin.LOCAL);
        if (state.source.required !== required) state.source.required = required;
    }

    function filesChanged(state) {
        if (state.disposed || state.resetting) return;
        nativeFiles(state);
        state.root.querySelector('[data-upload-error]').hidden = true;
        emit(state, 'change', { files: state.pond.getFiles().map(item => ({ name: item.filename, size: item.fileSize, status: item.status })) });
    }
    function reset(state, restoreExisting = true) {
        if (state.resetting) return;
        state.resetting = true;
        if (state.active) state.wire?.$cancelUpload(state.config.model);
        const remove = restoreExisting ? state.pond.removeFiles({ revert: false }) : Promise.all(state.pond.getFiles().filter(item => item.origin !== FilePond.FileOrigin.LOCAL).map(item => state.pond.removeFile(item.id, { revert: false })));
        remove.then(() => restoreExisting ? state.pond.addFiles(existingFiles(state.config)) : null).finally(() => {
            state.source.value = '';
            state.resetting = false;
            if (!state.disposed) nativeFiles(state);
        });
    }
    async function updateExisting(state) {
        state.syncingExisting = true;
        try {
            const wanted = [...existingFiles(state.config)];
            const key = file => JSON.stringify([file.name, file.size, file.url ?? null]);
            for (const item of state.pond.getFiles().filter(item => item.origin === FilePond.FileOrigin.LOCAL)) {
                const index = wanted.findIndex(file => key(file.options.metadata.existing) === key(item.getMetadata('existing')));
                if (index === -1) await state.pond.removeFile(item.id);
                else wanted.splice(index, 1);
            }
            await state.pond.addFiles(wanted);
        } finally { state.syncingExisting = false; }
    }
    function sync(state) {
        nativeFiles(state);
        const readOnly = state.source.hasAttribute('readonly');
        state.pond.setOptions({ disabled: state.source.disabled,
            allowBrowse: !readOnly && (state.config.options.allowBrowse ?? true),
            allowDrop: !readOnly && (state.config.options.allowDrop ?? true),
            allowPaste: !readOnly && (state.config.options.allowPaste ?? true),
            allowRemove: !readOnly, allowRevert: !readOnly, allowProcess: !readOnly });
        const browser = state.ui.querySelector('input[type=file]');
        if (browser) {
            browser.id = state.source.id + '-browse';
            const browseLabel = state.ui.querySelector('.filepond--drop-label label');
            if (browseLabel) browseLabel.htmlFor = browser.id;
            for (const name of ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'accept', 'capture']) {
                const value = state.source.getAttribute(name);
                if (value !== null) browser.setAttribute(name, value);
                else browser.removeAttribute(name);
            }
            if (!browser.hasAttribute('aria-label')) browser.setAttribute('aria-label', state.source.labels?.[0]?.textContent?.trim() || state.config.messages.idle);
            browser.setAttribute('aria-required', String(state.config.required));
            browser.setAttribute('aria-readonly', String(readOnly));
            browser.disabled = locked(state);
        }
    }
    function initialize(root) {
        const source = root.querySelector('[data-upload-source]');
        const config = JSON.parse(root.dataset.uploadConfig);
        let state = states.get(root);
        if (state) {
            state.source = source;
            const changed = state.config.reset !== config.reset;
            const valuesChanged = JSON.stringify(state.config.value) !== JSON.stringify(config.value);
            state.config = config;
            if (changed) reset(state);
            else if (valuesChanged) updateExisting(state);
            source.hidden = true;
            sync(state);
            return;
        }
        if (!FilePond.supported() || typeof DataTransfer === 'undefined') return;
        const wire = config.model ? window.Livewire?.find(root.closest('[wire\\:id]')?.getAttribute('wire:id')) : null;
        if (config.model && !wire) return;
        const ui = root.querySelector('[data-upload-ui]');
        const input = document.createElement('input'); input.type = 'file'; ui.append(input);
        state = { root, source, config, wire, ui, active: false, resetting: false, disposed: false };
        states.set(root, state);
        const m = config.messages;
        const server = wire ? {
            process: (_name, file, _metadata, load, error, progress, abort) => {
                state.active = true; emit(state, 'start');
                wire.$upload(config.model, file, id => {
                    state.active = false;
                    if (state.disposed || state.resetting) { wire.$removeUpload(config.model, id); abort(); return; }
                    load(id); emit(state, 'complete');
                }, () => { state.active = false; error(m.process_error); emit(state, 'error'); }, event => {
                    progress(true, event.detail.progress, 100); emit(state, 'progress', { progress: event.detail.progress });
                }, () => { state.active = false; abort(); emit(state, 'cancel'); });
                return { abort: () => wire.$cancelUpload(config.model) };
            },
            revert: (id, load, error) => wire.$removeUpload(config.model, id, load, () => error(m.revert_error)),
            load: null, restore: null, fetch: null,
        } : null;
        state.pond = FilePond.create(input, {
            ...config.options, name: '', credits: false, server,
            files: existingFiles(config),
            allowImagePreview: config.preview, imagePreviewHeight: config.previewHeight,
            allowFilePoster: config.preview, filePosterHeight: config.previewHeight,
            allowPdfPreview: config.preview, pdfPreviewHeight: config.previewHeight, labelPdfOpen: m.open_preview,
            allowMultiple: config.multiple, maxFiles: config.maxFiles, maxParallelUploads: 1,
            acceptedFileTypes: config.accept ? config.accept.split(',').map(type => type.trim()) : null,
            fileValidateTypeDetectType: (file, type) => Promise.resolve(config.accept?.split(',').map(item => item.trim()).find(item => item.startsWith('.') && file.name.toLowerCase().endsWith(item.toLowerCase())) || type),
            maxFileSize: config.maxSize ? config.maxSize * 1024 : null,
            instantUpload: !!wire, storeAsFile: false, allowReorder: false,
            labelIdle: m.idle, labelInvalidField: m.invalid, labelFileLoading: m.loading,
            labelFileLoadError: m.load_error, labelFileProcessing: m.processing,
            labelFileProcessingComplete: m.complete, labelFileProcessingAborted: m.cancelled,
            labelFileProcessingError: m.process_error, labelFileProcessingRevertError: m.revert_error,
            labelFileRemoveError: m.remove_error, labelTapToCancel: m.cancel, labelTapToRetry: m.retry,
            labelTapToUndo: m.undo, labelButtonRemoveItem: m.remove, labelButtonAbortItemLoad: m.cancel,
            labelButtonRetryItemLoad: m.retry, labelButtonAbortItemProcessing: m.cancel,
            labelButtonUndoItemProcessing: m.undo, labelButtonRetryItemProcessing: m.retry,
            labelButtonProcessItem: m.upload, labelMaxFileSizeExceeded: m.size, labelMaxFileSize: m.max_size,
            labelFileTypeNotAllowed: m.type, fileValidateTypeLabelExpectedTypes: m.types,
            beforeAddFile: item => !!item.getMetadata('existing') || !locked(state), beforeRemoveFile: () => state.resetting || state.syncingExisting || !locked(state),
            oninit: () => sync(state),
            onremovefile: (error, item) => {
                if (!error && !state.resetting && !state.syncingExisting && !state.disposed && item.getMetadata('existing')) emit(state, 'remove-existing', item.getMetadata('existing'));
            },
            onupdatefiles: () => { if (state.pond) filesChanged(state); },
        });
        source.hidden = true;
        root.dataset.uploadReady = 'true';
        sync(state);
        if (wire) state.unwatch = wire.$watch(config.model, value => {
            if (!state.active && !state.resetting && (value == null || Array.isArray(value) && value.length === 0)) reset(state, false);
        });
    }
    function scan() {
        for (const [root, state] of states) if (!root.isConnected) {
            state.disposed = true;
            state.unwatch?.();
            if (state.active) state.wire?.$cancelUpload(state.config.model);
            state.pond.destroy(); states.delete(root);
        }
        document.querySelectorAll(selector).forEach(initialize);
    }
    document.addEventListener('click', event => {
        const label = event.target.closest?.('label[for]');
        if (!label) return;
        for (const state of states.values()) if (label.htmlFor === state.source.id) {
            event.preventDefault(); if (!locked(state)) state.pond.browse();
        }
    });
    document.addEventListener('invalid', event => {
        const state = states.get(event.target.closest?.(selector));
        if (state && event.target === state.source) { event.preventDefault(); state.ui.querySelector('input[type=file]')?.focus(); }
    }, true);
    document.addEventListener('submit', event => {
        for (const state of states.values()) if (state.source.form === event.target && !state.source.disabled) {
            const invalid = state.pond.getFiles().some(item => item.origin !== FilePond.FileOrigin.LOCAL && (state.wire ? item.status !== FilePond.FileStatus.PROCESSING_COMPLETE : item.status !== FilePond.FileStatus.IDLE));
            if (invalid) { event.preventDefault(); event.stopImmediatePropagation();
                const error = state.root.querySelector('[data-upload-error]'); error.textContent = state.config.messages.busy; error.hidden = false;
            }
        }
    }, true);
    document.addEventListener('reset', event => setTimeout(() => {
        if (!event.defaultPrevented) for (const state of states.values()) if (state.source.form === event.target) {
            reset(state);
            if (state.wire) state.wire.$set(state.config.model, state.config.multiple ? [] : null);
        }
    }));
    let pending = false;
    new MutationObserver(records => {
        if (!records.some(record => !record.target.closest?.('[data-upload-ui]'))) return;
        if (!pending) { pending = true; queueMicrotask(() => { pending = false; scan(); }); }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-upload-config', 'disabled', 'readonly', 'required', 'aria-invalid', 'aria-describedby'] });
    document.addEventListener('livewire:navigated', scan);
    document.addEventListener('livewire:initialized', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
    else scan();
}

})();