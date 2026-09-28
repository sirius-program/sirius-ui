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

// Delegated actions survive Livewire navigation without per-component listeners.
const presentationOwner = Symbol.for('sirius.ui.presentation');
if (!window[presentationOwner]) {
    window[presentationOwner] = true;
    const dismissed = new WeakMap();
    const isLocked = element => element?.matches('[data-sir-button][aria-disabled="true"], [data-sir-button][aria-busy="true"], [data-sir-button][disabled]');
    const preventLocked = event => {
        const button = event.target instanceof Element ? event.target.closest('[data-sir-button]') : null;
        if (isLocked(button)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };
    document.addEventListener('click', preventLocked, true);
    document.addEventListener('auxclick', preventLocked, true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') preventLocked(event);
    }, true);
    document.addEventListener('click', event => {
        const trigger = event.target instanceof Element ? event.target.closest('[data-sir-message-dismiss]') : null;
        const message = trigger?.closest('[data-sir-message]');
        if (!message) return;
        dismissed.set(message, message.dataset.resetKey);
        message.hidden = true;
        message.dispatchEvent(new CustomEvent('message:dismiss', { bubbles: true, detail: { id: message.id } }));
    });
    new MutationObserver(records => {
        for (const record of records) {
            const message = record.target;
            if (!dismissed.has(message)) continue;
            if (dismissed.get(message) !== message.dataset.resetKey) {
                dismissed.delete(message);
                message.hidden = false;
            } else if (!message.hidden) {
                message.hidden = true;
            }
        }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-reset-key'] });
}
