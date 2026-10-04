(() => {
    const owner = Symbol.for('sirius.ui.tabs');
    if (window[owner]) return;
    window[owner] = true;
    const selector = '[data-sir-tabs]';
    const states = new Map();
    const owned = (root, query) => [...root.querySelectorAll(query)].filter(element => element.closest(selector) === root);
    const attr = (element, name, value) => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };
    const enabled = state => state.tabs.filter(tab => !tab.disabled && state.panels.some(panel => panel.dataset.sirTabPanel === tab.dataset.sirTab));
    function select(state, value, reason, focus = false, notify = true) {
        const available = enabled(state);
        const tab = available.find(tab => tab.dataset.sirTab === value) ?? available[0];
        const previous = state.active;
        state.active = tab?.dataset.sirTab ?? '';
        const losingFocus = state.panels.some(panel => panel.dataset.sirTabPanel !== state.active && panel.contains(document.activeElement));
        if (tab && (focus || losingFocus || state.restoreFocus)) tab.focus({ preventScroll: true });
        else if (!tab && (losingFocus || state.restoreFocus)) {
            if (!state.root.hasAttribute('tabindex')) state.root.tabIndex = -1;
            state.root.focus({ preventScroll: true });
        }
        state.restoreFocus = false;
        const roving = state.root.dataset.activation === 'manual' && state.tabs.includes(document.activeElement) ? document.activeElement : tab;
        for (const trigger of state.tabs) {
            const selected = trigger === tab;
            attr(trigger, 'aria-selected', String(selected));
            attr(trigger, 'tabindex', trigger === roving && !trigger.disabled ? '0' : '-1');
        }
        for (const panel of state.panels) {
            const hidden = panel.dataset.sirTabPanel !== state.active;
            if (panel.hidden !== hidden) panel.hidden = hidden;
            if (panel.inert !== hidden) panel.inert = hidden;
        }
        attr(state.root, 'data-selected', state.active);
        if (notify && previous !== state.active) state.root.dispatchEvent(new CustomEvent('tabs:change', { bubbles: true, detail: { id: state.root.id, value: state.active, previous, reason } }));
    }
    function scan() {
        for (const root of states.keys()) if (!root.isConnected) states.delete(root);
        document.querySelectorAll(selector).forEach(root => {
            const previous = states.get(root);
            const state = previous ?? { root, active: '', requested: root.dataset.active ?? '' };
            state.tabs = owned(root, '[data-sir-tab]');
            state.panels = owned(root, '[data-sir-tab-panel]');
            const requested = root.dataset.active ?? '';
            const changed = state.requested !== requested;
            state.requested = requested;
            states.set(root, state);
            select(state, !previous || changed ? requested : state.active, 'state', false, !!previous && !changed);
        });
    }
    let queued = false;
    function queueScan() {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; scan(); });
    }
    document.addEventListener('click', event => {
        const tab = event.target instanceof Element ? event.target.closest('[data-sir-tab]') : null;
        const state = states.get(tab?.closest(selector));
        if (state && !tab.disabled) select(state, tab.dataset.sirTab, 'click');
    });
    document.addEventListener('keydown', event => {
        const tab = event.target instanceof Element ? event.target.closest('[data-sir-tab]') : null;
        const state = states.get(tab?.closest(selector));
        if (!state || tab.disabled) return;
        const tabs = enabled(state);
        const vertical = state.root.dataset.orientation === 'vertical';
        const rtl = getComputedStyle(state.root).direction === 'rtl';
        const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
        const previous = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
        let index = tabs.indexOf(tab);
        if (event.key === next) index++;
        else if (event.key === previous) index--;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = tabs.length - 1;
        else return;
        event.preventDefault();
        const destination = tabs[(index + tabs.length) % tabs.length];
        if (!destination) return;
        if (state.root.dataset.activation !== 'manual') select(state, destination.dataset.sirTab, 'keyboard', true);
        else {
            for (const trigger of state.tabs) attr(trigger, 'tabindex', trigger === destination ? '0' : '-1');
            destination.focus({ preventScroll: true });
        }
    });
    let hooked = false;
    function hookLivewire() {
        if (hooked || !window.Livewire) return;
        hooked = true;
        window.Livewire.hook('morph.removing', ({ el }) => {
            for (const state of states.values()) {
                if (el.contains(document.activeElement) && state.root.contains(document.activeElement)) state.restoreFocus = true;
            }
        });
        window.Livewire.hook('morph.updated', queueScan);
    }
    document.addEventListener('livewire:init', hookLivewire);
    hookLivewire();
    document.addEventListener('livewire:navigating', () => states.clear());
    document.addEventListener('livewire:navigated', queueScan);
    const start = () => {
        scan();
        new MutationObserver(queueScan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-active', 'data-orientation', 'data-activation', 'disabled', 'hidden', 'inert', 'aria-selected'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
