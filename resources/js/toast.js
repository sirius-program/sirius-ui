(() => {
    const owner = Symbol.for('sirius.ui.toast');
    if (window[owner]) return;
    window[owner] = true;
    const selector = '[data-sir-toast]';
    const states = new Map();
    const queue = [];
    const visible = new Set();
    const queueLimit = 20;
    let navigating = false;
    let scanning = false;
    let scheduled = false;
    let announcementId = 0;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const modal = () => [...document.querySelectorAll('dialog:modal')].at(-1);
    const nativeOpen = panel => panel?.matches(':popover-open');
    const emit = (state, name, reason) => state.root.dispatchEvent(new CustomEvent(`toast:${name}`, { bubbles: true, detail: { id: state.root.id, reason } }));
    const paused = state => document.hidden || state.hovered || state.panel.contains(document.activeElement);

    function stopTimer(state) {
        if (state.timer !== null) {
            clearTimeout(state.timer);
            state.remaining = Math.max(0, state.remaining - (performance.now() - state.started));
            state.timer = null;
        }
    }
    function startTimer(state) {
        stopTimer(state);
        if (state.status !== 'visible' || !state.duration || paused(state)) return;
        state.started = performance.now();
        state.timer = setTimeout(() => { state.timer = null; close(state, 'timeout'); }, state.remaining);
    }
    function restart(state) {
        stopTimer(state);
        state.duration = Number(state.root.dataset.duration);
        state.remaining = state.duration;
        startTimer(state);
    }
    function home(state) {
        if (state.panel.parentElement !== state.root) {
            if (nativeOpen(state.panel)) state.panel.hidePopover();
            state.root.append(state.panel);
        }
        delete state.panel._x_teleportBack;
    }
    function place(state) {
        // Modal inertness follows DOM ancestry, even for a top-layer popover.
        const destination = modal() || state.root;
        if (state.panel.parentElement !== destination) {
            if (nativeOpen(state.panel)) state.panel.hidePopover();
            // Preserve the original Alpine/Livewire ancestry using their teleport protocol.
            if (destination !== state.root) state.panel._x_teleportBack = state.root;
            else delete state.panel._x_teleportBack;
            destination.append(state.panel);
        }
        const direction = getComputedStyle(state.root).direction;
        if (state.panel.dir !== direction) state.panel.dir = direction;
        if (state.panel.dataset.position !== state.root.dataset.position) state.panel.dataset.position = state.root.dataset.position;
        if (!nativeOpen(state.panel)) {
            const focused = document.activeElement;
            state.panel.showPopover();
            if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
        }
        const announcementParent = modal() || document.body;
        if (state.announcement && state.announcement.parentElement !== announcementParent) announcementParent.append(state.announcement);
    }
    function layout() {
        const offsets = new Map();
        for (const state of visible) {
            if (!state.panel.isConnected) continue;
            const key = state.root.dataset.position;
            const offset = offsets.get(key) || 0;
            const value = `${offset}px`;
            if (state.panel.style.getPropertyValue('--sir-toast-offset') !== value) state.panel.style.setProperty('--sir-toast-offset', value);
            offsets.set(key, offset + state.panel.getBoundingClientRect().height + 12);
        }
    }
    function announce(state) {
        state.announcement?.remove();
        const region = document.createElement('div');
        region.className = 'sir-toast-announcement';
        region.dataset.sirToastAnnouncement = String(++announcementId);
        const urgent = state.root.dataset.variant === 'danger';
        region.setAttribute('role', urgent ? 'alert' : 'status');
        region.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
        region.setAttribute('aria-atomic', 'true');
        (modal() || document.body).append(region);
        state.announcement = region;
        // Populate an already mounted live region, without making footer controls live.
        queueMicrotask(() => { if (state.status === 'visible' && state.announcement === region) region.textContent = state.panel.querySelector('[data-sir-toast-copy]')?.textContent.trim() || ''; });
    }
    function activate(state) {
        state.status = 'visible';
        state.panel.inert = false;
        delete state.panel.dataset.closing;
        visible.add(state);
        place(state);
        layout();
        restart(state);
        announce(state);
        emit(state, 'open', 'show');
    }
    function drain() {
        if (navigating) return;
        while (visible.size < 3 && queue.length) {
            const state = queue.shift();
            if (state.root.isConnected) activate(state);
            else { state.status = 'hidden'; emit(state, 'close', 'removed'); }
        }
    }
    function show(state, opener = document.activeElement) {
        if (!state || !state.root.isConnected || navigating) return;
        if (state.status === 'closing') {
            clearTimeout(state.closing);
            state.closing = null;
            state.status = 'visible';
            state.focusedClosing = false;
            state.panel.inert = false;
            delete state.panel.dataset.closing;
        }
        if (state.status === 'visible') { restart(state); announce(state); return; }
        if (state.status === 'queued') return;
        state.opener = opener;
        if (visible.size < 3) activate(state);
        else {
            if (queue.length === queueLimit) close(queue[0], 'overflow', true);
            state.status = 'queued';
            queue.push(state);
        }
    }
    function finish(state, reason, returnFocus = true, refill = true) {
        clearTimeout(state.closing);
        state.closing = null;
        delete state.panel.dataset.closing;
        const focused = state.focusedClosing || state.panel.contains(document.activeElement);
        state.focusedClosing = false;
        if (nativeOpen(state.panel)) state.panel.hidePopover();
        state.panel.inert = true;
        state.announcement?.remove();
        state.announcement = null;
        state.status = 'hidden';
        state.hovered = false;
        visible.delete(state);
        home(state);
        if (focused && returnFocus) {
            const target = state.opener?.isConnected && (!modal() || modal().contains(state.opener)) ? state.opener : modal();
            target?.focus({ preventScroll: true });
        }
        emit(state, 'close', reason);
        if (refill) drain();
        layout();
    }
    function close(state, reason = 'api', immediate = false) {
        if (!state || state.status === 'hidden') return;
        if (state.status === 'closing' && !immediate) return;
        stopTimer(state);
        state.focusedClosing = state.panel.contains(document.activeElement);
        if (state.status === 'queued') {
            const index = queue.indexOf(state);
            if (index >= 0) queue.splice(index, 1);
            state.status = 'hidden';
            emit(state, 'close', reason);
            return;
        }
        if (!immediate && !reduced() && state.panel.isConnected) {
            state.status = 'closing';
            state.panel.inert = true;
            state.panel.dataset.closing = 'true';
            state.closing = setTimeout(() => finish(state, reason), 140);
        } else finish(state, reason, !['navigation', 'removed'].includes(reason));
    }
    const resize = new ResizeObserver(layout);
    function initialize(root) {
        if (document.getElementById(root.id) !== root) return null;
        const panel = root.querySelector(':scope > [data-sir-toast-panel]');
        if (!panel) return null;
        const state = { root, panel, declared: root.dataset.open, duration: Number(root.dataset.duration), status: 'hidden', timer: null, remaining: 0, started: 0, closing: null, opener: null, hovered: false, announcement: null };
        states.set(root, state);
        panel.addEventListener('pointerenter', () => { state.hovered = true; stopTimer(state); });
        panel.addEventListener('pointerleave', () => { state.hovered = false; startTimer(state); });
        panel.addEventListener('focusin', () => stopTimer(state));
        panel.addEventListener('focusout', () => queueMicrotask(() => startTimer(state)));
        panel.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            if (panel.querySelector('.sir-toast-dismiss')) close(state, 'escape');
        });
        resize.observe(panel);
        if (state.declared === 'true') show(state);
        return state;
    }
    function scan() {
        if (scanning || navigating) return;
        scanning = true;
        for (const [root, state] of states) {
            if (!root.isConnected) {
                close(state, 'removed', true);
                resize.unobserve(state.panel);
                states.delete(root);
            }
        }
        for (const root of document.querySelectorAll(selector)) {
            const previous = states.get(root);
            const state = previous || initialize(root);
            if (!state || !previous) continue;
            if (state.declared !== root.dataset.open) {
                state.declared = root.dataset.open;
                if (state.declared === 'true') show(state); else close(state, 'state');
            }
            if (state.status === 'visible' || state.status === 'closing') {
                place(state);
                if (state.duration !== Number(root.dataset.duration)) restart(state);
            }
        }
        layout();
        scanning = false;
    }
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; scan(); });
    }
    function find(id) {
        const root = document.getElementById(id);
        return root?.matches(selector) ? states.get(root) || initialize(root) : null;
    }
    document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-sir-toast-open], [data-sir-toast-close]');
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        const opening = button.hasAttribute('data-sir-toast-open');
        const state = find(opening ? button.dataset.sirToastOpen : button.dataset.sirToastClose || button.closest('[data-sir-toast-panel]')?.id.replace(/-panel$/, ''));
        if (state) { event.preventDefault(); if (opening) show(state, button); else close(state, 'button'); }
    });
    document.addEventListener('toast:show', event => { scan(); show(find(event.detail?.id)); });
    document.addEventListener('toast:hide', event => close(find(event.detail?.id)));
    document.addEventListener('visibilitychange', () => { for (const state of visible) startTimer(state); });
    document.addEventListener('dialog:open', schedule);
    document.addEventListener('dialog:close', schedule);
    window.addEventListener('resize', layout);
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-open', 'data-duration', 'data-position', 'dir'] });
    let hooked = false;
    let restoreFocus = null;
    function hookLivewire() {
        if (hooked || !window.Livewire) return;
        hooked = true;
        window.Livewire.hook('morph', () => {
            restoreFocus = document.activeElement;
            for (const state of visible) home(state);
        });
        window.Livewire.hook('morphed', () => {
            scan();
            if (restoreFocus?.isConnected && [...visible].some(state => state.panel.contains(restoreFocus))) restoreFocus.focus({ preventScroll: true });
            restoreFocus = null;
        });
        // Panel runtime attributes must survive server renders without reviving expired Toasts.
        window.Livewire.hook('morph.updating', ({ el, toEl }) => {
            if (!el.matches?.('[data-sir-toast-panel]')) return;
            toEl.inert = el.inert;
            for (const name of ['dir', 'data-position', 'data-closing']) {
                if (el.hasAttribute(name)) toEl.setAttribute(name, el.getAttribute(name)); else toEl.removeAttribute(name);
            }
        });
    }
    document.addEventListener('livewire:init', hookLivewire);
    hookLivewire();
    document.addEventListener('livewire:navigating', () => {
        navigating = true;
        for (const state of states.values()) close(state, 'navigation', true);
        queue.length = 0;
        states.clear();
        resize.disconnect();
    });
    document.addEventListener('livewire:navigated', () => { navigating = false; scan(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
})();
