// Shared owner for modal overlays; native dialog supplies focus containment and background inertness.
(() => {
    const owner = Symbol.for('sirius.ui.overlays');
    if (window[owner]) return;
    window[owner] = true;
    const selector = 'dialog[data-sir-dialog]';
    const states = new WeakMap();
    let active = null;
    let scrollLock = null;

    function remember(style, properties) {
        return properties.map(property => [property, style.getPropertyValue(property), style.getPropertyPriority(property)]);
    }
    function restore(style, properties) {
        properties.forEach(([property, value, priority]) => value ? style.setProperty(property, value, priority) : style.removeProperty(property));
    }
    function lockScroll() {
        if (scrollLock) return;
        const root = document.documentElement;
        const body = document.body;
        const gap = Math.max(0, innerWidth - root.clientWidth);
        const fixed = Array.from(body.querySelectorAll('*')).filter(el => !el.closest(selector) && getComputedStyle(el).position === 'fixed').map(el => ({ el, rect: el.getBoundingClientRect(), properties: remember(el.style, ['left', 'right']) }));
        scrollLock = { root: remember(root.style, ['overflow', 'overflow-x', 'overflow-y', 'scrollbar-gutter', 'padding-right']), fixed, x: scrollX, y: scrollY };
        if (gap && CSS.supports('scrollbar-gutter', 'stable')) {
            const gutter = getComputedStyle(root).scrollbarGutter;
            root.style.setProperty('scrollbar-gutter', gutter.includes('stable') ? gutter : 'stable', 'important');
        }
        const padding = parseFloat(getComputedStyle(root).paddingRight) || 0;
        // clientWidth on the root reports viewport width, which can omit a reserved gutter.
        const width = root.getBoundingClientRect().width;
        root.style.setProperty('overflow', 'hidden', 'important');
        const lostGutter = Math.max(0, root.getBoundingClientRect().width - width);
        if (lostGutter) root.style.setProperty('padding-right', `${padding + lostGutter}px`, 'important');
        // Fixed descendants use viewport geometry rather than root padding in fallback browsers.
        fixed.forEach(({ el, rect }) => {
            const current = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (style.right !== 'auto' && Math.abs(current.right - rect.right) > .5) el.style.setProperty('right', `${parseFloat(style.right) + current.right - rect.right}px`, 'important');
            if (style.left !== 'auto' && Math.abs(current.left - rect.left) > .5) el.style.setProperty('left', `${parseFloat(style.left) + rect.left - current.left}px`, 'important');
        });
    }
    function unlockScroll() {
        if (!scrollLock) return;
        const saved = scrollLock;
        scrollLock = null;
        restore(document.documentElement.style, saved.root);
        saved.fixed.forEach(({ el, properties }) => restore(el.style, properties));
        window.scrollTo(saved.x, saved.y);
    }
    function emit(dialog, name, reason) {
        dialog.dispatchEvent(new CustomEvent(`dialog:${name}`, { bubbles: true, detail: { id: dialog.id, reason } }));
    }
    function focusInitial(dialog) {
        let target;
        try { target = dialog.dataset.initialFocus ? dialog.querySelector(dialog.dataset.initialFocus) : null; } catch { /* Invalid selectors fall back to native focus. */ }
        target ||= dialog.querySelector('[autofocus]');
        if (target && !target.disabled && target.getClientRects().length) target.focus({ preventScroll: true });
    }
    function cancelClose(dialog, state) {
        const closing = state.closing;
        state.closing = null;
        closing?.animations.forEach(animation => animation.cancel());
        delete dialog.dataset.closing;
    }
    function finishClose(dialog, state, reason, returnFocus) {
        cancelClose(dialog, state);
        if (dialog.open) dialog.close();
        if (active !== dialog) return;
        active = null;
        unlockScroll();
        if (returnFocus && state.opener?.isConnected && !state.opener.closest('dialog:not([open])')) state.opener.focus({ preventScroll: true });
        emit(dialog, 'close', reason);
    }
    function close(dialog, reason = 'api', returnFocus = true) {
        const state = states.get(dialog);
        if (!state) return;
        if (dialog.dataset.open !== 'false') dialog.dataset.open = 'false';
        const immediate = !dialog.isConnected || !dialog.open || ['replaced', 'removed', 'navigation', 'native'].includes(reason) || matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (state.closing && !immediate) return;
        if (!immediate && active === dialog) {
            dialog.dataset.closing = 'true';
            const animations = dialog.getAnimations().filter(animation => ['sir-dialog-out', 'sir-alert-out', 'sir-slideover-out'].includes(animation.animationName));
            if (animations.length) {
                const closing = state.closing = { animations };
                Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
                    if (state.closing === closing) finishClose(dialog, state, reason, returnFocus);
                });
                return;
            }
        }
        finishClose(dialog, state, reason, returnFocus);
    }
    function open(dialog, opener = document.activeElement) {
        if (!dialog?.matches(selector) || !dialog.isConnected) return;
        initialize(dialog);
        if (active === dialog) {
            if (states.get(dialog).closing) {
                cancelClose(dialog, states.get(dialog));
                dialog.dataset.open = 'true';
            }
            return;
        }
        if (dialog.parentElement.closest(selector)) {
            dialog.dataset.open = 'false';
            emit(dialog, 'blocked', 'nested');
            return;
        }
        if (active) {
            if (active.contains(opener)) opener = states.get(active).opener;
            close(active, 'replaced', false);
        }
        const state = states.get(dialog);
        state.opener = opener;
        active = dialog;
        dialog.dataset.open = 'true';
        lockScroll();
        if (dialog.open) dialog.close();
        dialog.showModal();
        focusInitial(dialog);
        emit(dialog, 'open', 'show');
    }
    function initialize(dialog) {
        if (states.has(dialog)) return;
        states.set(dialog, { opener: null, closing: null, declared: dialog.dataset.open });
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            if (dialog.dataset.closeOnEscape === 'true') close(dialog, 'escape');
        });
        dialog.addEventListener('close', () => { if (!dialog.open && active === dialog) close(dialog, 'native'); });
        dialog.addEventListener('keydown', event => {
            if (event.key !== 'Tab' || active !== dialog) return;
            const focusable = Array.from(dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')).filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length);
            const first = focusable[0];
            const last = focusable.at(-1);
            if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
        });
        // Pointer down and up must both be outside to avoid closing after a drag from content.
        let outside = false;
        const onBackdrop = event => {
            const rect = dialog.getBoundingClientRect();
            return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
        };
        dialog.addEventListener('pointerdown', event => { outside = onBackdrop(event); });
        dialog.addEventListener('click', event => {
            if (outside && onBackdrop(event) && dialog.dataset.closeOnBackdrop === 'true') close(dialog, 'backdrop');
            outside = false;
        });
    }
    function scan() {
        if (active && !active.isConnected) close(active, 'removed');
        document.querySelectorAll(selector).forEach(dialog => {
            initialize(dialog);
            const requested = dialog.dataset.open === 'true';
            if (requested && active !== dialog) open(dialog);
            else if (requested && states.get(dialog).closing) open(dialog);
            else if (!requested && active === dialog) close(dialog, 'state');
        });
    }
    document.addEventListener('click', event => {
        const trigger = event.target.closest?.('[data-sir-dialog-open], [data-sir-dialog-close]');
        if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
        if (trigger.hasAttribute('data-sir-dialog-open')) {
            const dialog = document.getElementById(trigger.dataset.sirDialogOpen);
            if (dialog?.matches(selector)) { event.preventDefault(); open(dialog, trigger); }
        } else {
            const target = trigger.dataset.sirDialogClose;
            const dialog = target && target !== 'data-sir-dialog-close' ? document.getElementById(target) : trigger.closest(selector);
            if (dialog?.matches(selector)) { event.preventDefault(); close(dialog, 'button'); }
        }
    });
    document.addEventListener('dialog:show', event => open(document.getElementById(event.detail?.id)));
    document.addEventListener('dialog:hide', event => {
        const dialog = document.getElementById(event.detail?.id);
        if (dialog?.matches(selector)) close(dialog);
    });
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; scan(); });
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-open'] });
    // Keep native modal state through attribute morphs; data-open remains server/Alpine-owned.
    let hooked = false;
    function hookLivewire() {
        if (hooked || !window.Livewire) return;
        hooked = true;
        window.Livewire.hook('morph.updating', ({ el, toEl }) => {
            if (el.matches?.(selector) && states.has(el)) {
                const state = states.get(el);
                const declared = toEl.dataset.open;
                // Unchanged server markup must not undo an event-triggered open/close.
                if (declared === state.declared) toEl.dataset.open = el.dataset.open;
                state.declared = declared;
            }
            if (el.matches?.(selector) && el === active && el.open) {
                toEl.setAttribute('open', '');
                if (states.get(el).closing) toEl.setAttribute('data-closing', 'true');
            }
        });
    }
    document.addEventListener('livewire:init', hookLivewire);
    hookLivewire();
    document.addEventListener('livewire:navigating', () => { if (active) close(active, 'navigation', false); });
    document.addEventListener('livewire:navigated', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
    else scan();
})();
