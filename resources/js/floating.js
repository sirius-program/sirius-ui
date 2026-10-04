(() => {
    const owner = Symbol.for('sirius.ui.floating');
    if (window[owner]) return;
    window[owner] = true;
    if (!('showPopover' in HTMLElement.prototype)) return;
    const selector = '[data-sir-floating]';
    const panelSelector = '[data-sir-floating-panel]';
    const focusable = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';
    const states = new Map();
    let sequence = 0;
    let queued = false;
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const set = (element, key, value) => { if (element.getAttribute(key) !== value) element.setAttribute(key, value); };
    const tokens = value => (value ?? '').split(/\s+/).filter(Boolean);
    const nativeOpen = panel => panel?.matches(':popover-open');
    const emit = (state, open, reason) => state.root.dispatchEvent(new CustomEvent(`${state.kind}:${open ? 'open' : 'close'}`, { bubbles: true, detail: { id: state.root.id, reason } }));

    function allowed(state) {
        if (!state.trigger?.isConnected || !state.panel?.isConnected || state.trigger.matches(':disabled') || state.trigger.getAttribute('aria-disabled') === 'true' || state.trigger.closest('[hidden], [inert]')) return false;
        const dialog = state.trigger.closest('dialog');
        const modal = document.querySelector('dialog:modal');
        if (modal && modal !== dialog) return false;
        if (dialog && (!dialog.open || dialog.dataset.open === 'false' || dialog.dataset.closing === 'true')) return false;
        return state.trigger.getClientRects().length > 0;
    }

    function position(state) {
        if (!state.open || !nativeOpen(state.panel)) return;
        const { trigger, panel, root } = state;
        const viewport = window.visualViewport;
        const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
        const topEdge = (viewport?.offsetTop ?? 0) + 8;
        const width = viewport?.width ?? innerWidth;
        const height = viewport?.height ?? innerHeight;
        const rightEdge = leftEdge + width - 16;
        const bottomEdge = topEdge + height - 16;
        panel.style.setProperty('--sir-floating-available-width', `${Math.max(0, width - 16)}px`);
        panel.style.setProperty('--sir-floating-available-height', `${Math.max(0, height - 16)}px`);
        const anchor = trigger.getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        const gap = 8;
        const room = { top: anchor.top - topEdge, bottom: bottomEdge - anchor.bottom, left: anchor.left - leftEdge, right: rightEdge - anchor.right };
        const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
        let placement = root.dataset.placement;
        if (!Object.hasOwn(opposite, placement)) placement = state.kind === 'tooltip' ? 'top' : 'bottom';
        const required = (placement === 'top' || placement === 'bottom' ? bounds.height : bounds.width) + gap;
        if (room[placement] < required && room[opposite[placement]] > room[placement]) placement = opposite[placement];
        let left = anchor.left + (anchor.width - bounds.width) / 2;
        let top = anchor.top + (anchor.height - bounds.height) / 2;
        if (placement === 'top') top = anchor.top - bounds.height - gap;
        if (placement === 'bottom') top = anchor.bottom + gap;
        if (placement === 'left') left = anchor.left - bounds.width - gap;
        if (placement === 'right') left = anchor.right + gap;
        left = Math.max(leftEdge, Math.min(left, rightEdge - bounds.width));
        top = Math.max(topEdge, Math.min(top, bottomEdge - bounds.height));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        const vertical = placement === 'top' || placement === 'bottom';
        const length = vertical ? panel.clientWidth : panel.clientHeight;
        const inset = Math.min(14, length / 2);
        const center = vertical ? anchor.left + anchor.width / 2 - left - panel.clientLeft : anchor.top + anchor.height / 2 - top - panel.clientTop;
        panel.style.setProperty('--sir-floating-arrow-offset', `${Math.max(inset, Math.min(center, length - inset))}px`);
        set(panel, 'data-resolved-placement', placement);
    }

    function associate(state) {
        const { trigger, panel, kind } = state;
        if (!trigger || !panel) return;
        const key = kind === 'tooltip' ? 'aria-describedby' : 'aria-controls';
        const references = tokens(trigger.getAttribute(key)).filter(id => id !== state.association);
        state.association = panel.id;
        if (!references.includes(panel.id)) references.push(panel.id);
        set(trigger, key, references.join(' '));
        if (kind === 'popover') {
            set(trigger, 'aria-haspopup', 'dialog');
            set(trigger, 'aria-expanded', String(state.open));
        }
        set(state.root, 'data-open', String(state.open));
    }

    function restoreTrigger(state) {
        const trigger = state.trigger;
        if (!trigger) return;
        const key = state.kind === 'tooltip' ? 'aria-describedby' : 'aria-controls';
        const references = tokens(trigger.getAttribute(key)).filter(id => id !== state.association);
        if (references.length) set(trigger, key, references.join(' ')); else trigger.removeAttribute(key);
        if (state.kind === 'popover') {
            for (const key of ['aria-haspopup', 'aria-expanded']) {
                const original = state.original[key];
                if (original === null) trigger.removeAttribute(key); else set(trigger, key, original);
            }
        }
    }

    function finishClose(state) {
        clearTimeout(state.closing);
        state.closing = null;
        delete state.panel?.dataset.closing;
        if (nativeOpen(state.panel)) state.panel.hidePopover();
    }

    function close(state, reason = 'dismiss', returnFocus = false, immediate = false) {
        clearTimeout(state.leaveTimer);
        state.leaveTimer = null;
        for (const child of states.values()) if (child !== state && state.panel?.contains(child.root)) close(child, reason, false, true);
        if (!state.open) { if (immediate) finishClose(state); return; }
        state.open = false;
        if (reason === 'escape' && state.kind === 'tooltip') state.dismissed = true;
        if (returnFocus && state.trigger?.isConnected && allowed(state)) state.trigger.focus({ preventScroll: true });
        if (state.panel) state.panel.inert = true;
        associate(state);
        if (!immediate && nativeOpen(state.panel) && !reducedMotion()) {
            state.panel.dataset.closing = 'true';
            state.closing = setTimeout(() => finishClose(state), state.kind === 'tooltip' ? 60 : 120);
        } else finishClose(state);
        emit(state, false, reason);
    }

    function enterFocus(state) {
        const candidates = [...state.panel.querySelectorAll(focusable)].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length);
        (candidates.find(element => element.hasAttribute('autofocus')) ?? candidates[0] ?? state.panel).focus({ preventScroll: true });
    }

    function show(state, reason, focus = false) {
        if (!allowed(state) || (state.kind === 'tooltip' && state.dismissed)) return;
        clearTimeout(state.leaveTimer);
        state.leaveTimer = null;
        clearTimeout(state.closing);
        state.closing = null;
        delete state.panel.dataset.closing;
        if (state.kind === 'popover') {
            for (const other of states.values()) {
                if (other !== state && other.kind === 'popover' && other.open && !other.panel.contains(state.root) && !state.panel.contains(other.root)) close(other, 'replaced');
            }
        }
        const changed = !state.open;
        state.panel.inert = false;
        if (!nativeOpen(state.panel)) state.panel.showPopover();
        state.open = true;
        state.order = ++sequence;
        associate(state);
        position(state);
        if (focus && state.kind === 'popover') enterFocus(state);
        if (changed) emit(state, true, reason);
    }

    function refresh(state) {
        const anchor = state.root.querySelector(':scope > [data-sir-floating-anchor]');
        const trigger = anchor?.querySelector(focusable);
        const panel = state.root.querySelector(`:scope > ${panelSelector}`);
        if (trigger !== state.trigger || panel !== state.panel) {
            restoreTrigger(state);
            if (state.panel) {
                resizeObserver?.unobserve(state.panel);
                finishClose(state);
            }
            if (state.trigger) resizeObserver?.unobserve(state.trigger);
            state.trigger = trigger;
            state.panel = panel;
            state.association = null;
            state.original = trigger ? { 'aria-haspopup': trigger.getAttribute('aria-haspopup'), 'aria-expanded': trigger.getAttribute('aria-expanded') } : {};
            if (trigger) resizeObserver?.observe(trigger);
            if (panel) resizeObserver?.observe(panel);
        }
        if (!trigger || !panel) return;
        associate(state);
        if (!allowed(state)) close(state, 'hidden', false, true);
        else if (state.open) {
            panel.inert = false;
            if (!nativeOpen(panel)) panel.showPopover();
            position(state);
        }
    }

    function scan() {
        for (const [root, state] of states) {
            if (!root.isConnected) {
                clearTimeout(state.leaveTimer);
                clearTimeout(state.closing);
                if (state.trigger?.isConnected) restoreTrigger(state);
                if (state.panel?.isConnected) finishClose(state);
                if (state.trigger) resizeObserver?.unobserve(state.trigger);
                if (state.panel) resizeObserver?.unobserve(state.panel);
                states.delete(root);
            }
        }
        for (const root of document.querySelectorAll(selector)) {
            let state = states.get(root);
            const declared = root.dataset.initialOpen === 'true';
            if (!state) {
                state = { root, kind: root.dataset.sirFloating, open: false, declared, trigger: null, panel: null, association: null, original: {}, dismissed: false, hovering: false, leaveTimer: null, closing: null, order: 0 };
                states.set(root, state);
                refresh(state);
                if (declared && state.kind === 'popover') show(state, 'state', true);
            } else {
                refresh(state);
                if (state.declared !== declared) {
                    state.declared = declared;
                    if (declared) show(state, 'state', true); else close(state, 'state', root.contains(document.activeElement));
                }
            }
        }
    }

    function queueScan() {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; scan(); });
    }
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(() => { for (const state of states.values()) position(state); }) : null;
    const stateFor = target => target instanceof Element ? states.get(target.closest(selector)) : null;

    document.addEventListener('pointerover', event => {
        if (event.pointerType === 'touch') return;
        const state = stateFor(event.target);
        if (!state || state.kind !== 'tooltip') return;
        if (state.trigger?.contains(event.target) || state.panel?.contains(event.target)) {
            if (!state.root.contains(event.relatedTarget)) state.dismissed = false;
            state.hovering = true;
            show(state, 'hover');
        }
    });
    document.addEventListener('pointerout', event => {
        const state = stateFor(event.target);
        if (!state || state.kind !== 'tooltip' || state.root.contains(event.relatedTarget)) return;
        state.hovering = false;
        clearTimeout(state.leaveTimer);
        state.leaveTimer = setTimeout(() => {
            if (!state.hovering && !state.trigger?.contains(document.activeElement)) { close(state, 'leave'); state.dismissed = false; }
        }, 40);
    });
    document.addEventListener('focusin', event => {
        for (const state of states.values()) {
            if (state.kind === 'popover' && state.open && !state.root.contains(event.target)) close(state, 'blur');
        }
        const state = stateFor(event.target);
        if (state?.kind === 'tooltip' && state.trigger?.contains(event.target)) show(state, 'focus');
    });
    document.addEventListener('focusout', event => {
        const state = stateFor(event.target);
        if (state?.kind !== 'tooltip') return;
        queueMicrotask(() => {
            if (!state.trigger?.contains(document.activeElement) && !state.hovering) { close(state, 'blur'); state.dismissed = false; }
        });
    });
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        for (const state of [...states.values()].sort((a, b) => b.order - a.order)) {
            if (state.kind === 'popover' && state.open && !state.root.contains(target)) close(state, 'outside');
        }
        const state = stateFor(target);
        if (state?.kind !== 'popover') return;
        if (target.closest('[data-sir-popover-close]') && state.panel?.contains(target)) {
            event.preventDefault();
            close(state, 'button', true);
        } else if (state.trigger?.contains(target) && allowed(state)) {
            event.preventDefault();
            state.open ? close(state, 'trigger', true) : show(state, 'trigger', true);
        }
    }, true);
    document.addEventListener('keydown', event => {
        const activated = stateFor(event.target);
        if ((event.key === 'Enter' || event.key === ' ') && activated?.kind === 'popover' && event.target === activated.trigger && allowed(activated)) {
            event.preventDefault();
            if (!event.repeat) activated.trigger.click();
            return;
        }
        if (event.key !== 'Escape') return;
        const opened = [...states.values()].filter(state => state.open && allowed(state)).sort((a, b) => b.order - a.order);
        if (!opened.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const state = opened[0];
        close(state, 'escape', state.kind === 'popover');
    }, true);
    document.addEventListener('toggle', event => {
        if (event.target instanceof Element && event.target.matches(panelSelector)) queueScan();
    }, true);
    function reposition() { for (const state of states.values()) { if (state.open && !allowed(state)) close(state, 'hidden', false, true); else position(state); } }
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('dialog:close', queueScan);
    document.addEventListener('livewire:navigating', () => { for (const state of states.values()) close(state, 'navigation', false, true); });
    document.addEventListener('livewire:navigated', queueScan);
    const start = () => {
        scan();
        new MutationObserver(queueScan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-initial-open', 'data-placement', 'data-open', 'open', 'hidden', 'inert', 'disabled', 'aria-disabled', 'aria-describedby', 'aria-controls', 'aria-expanded', 'aria-haspopup'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
