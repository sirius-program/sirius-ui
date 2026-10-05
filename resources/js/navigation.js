(() => {
    const owner = Symbol.for('sirius.ui.navigation');
    if (window[owner]) return;
    window[owner] = true;
    const roots = new Map();
    const closing = new Map();
    const rootSelector = '[data-sir-menu], [data-sir-dropdown]';
    const itemSelector = '[data-sir-nav-item]';
    const clickDismissal = state => state.root.dataset.sirDropdownDismiss === 'click';
    const rootFor = target => {
        if (!(target instanceof Element)) return null;
        const calendar = target.closest('[data-sir-date-calendar]');
        const field = calendar && document.getElementById(calendar.dataset.sirDateCalendar);
        return (field || target).closest(rootSelector);
    };
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const set = (node, key, value) => { if (node.getAttribute(key) !== value) node.setAttribute(key, value); };
    const triggerFor = panel => panel.previousElementSibling;
    const items = panel => [...panel.querySelectorAll(itemSelector)].filter(item => item.closest('[data-sir-nav-list]') === panel);
    const focusItem = (panel, last = false) => {
        const list = panel.getAttribute('role') === 'dialog'
            ? [...panel.querySelectorAll('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]')].filter(control => control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden')
            : items(panel);
        list[last ? list.length - 1 : 0]?.focus({ preventScroll: true });
    };
    const notify = (root, open) => root.dispatchEvent(new CustomEvent(open ? 'dropdown:open' : 'dropdown:close', { bubbles: true, detail: { id: root.id } }));

    function visibility(panel, open, animate = false) {
        if (open) {
            clearTimeout(closing.get(panel));
            closing.delete(panel);
            delete panel.dataset.closing;
            panel.inert = false;
            if (panel.hidden) panel.hidden = false;
        } else {
            panel.inert = true;
            if (closing.has(panel)) return;
            if (animate && !panel.hidden && !reducedMotion()) {
                panel.dataset.closing = 'true';
                closing.set(panel, setTimeout(() => {
                    closing.delete(panel);
                    delete panel.dataset.closing;
                    if (!panel.hidden) panel.hidden = true;
                }, 120));
            } else {
                if (!panel.hidden) panel.hidden = true;
                delete panel.dataset.closing;
            }
        }
    }

    function position(panel, anchor, submenu, align = 'start') {
        if (panel.hidden || panel.inert || !anchor.isConnected) return;
        const gap = 6;
        const margin = 8;
        const viewport = window.visualViewport;
        const width = viewport?.width ?? innerWidth;
        const height = viewport?.height ?? innerHeight;
        const offsetX = viewport?.offsetLeft ?? 0;
        const offsetY = viewport?.offsetTop ?? 0;
        const rect = anchor.getBoundingClientRect();
        panel.style.maxWidth = `${Math.max(0, width - margin * 2)}px`;
        panel.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
        const bounds = panel.getBoundingClientRect();
        const rtl = getComputedStyle(anchor).direction === 'rtl';
        let left = submenu ? (rtl ? rect.left - bounds.width - gap : rect.right + gap)
            : (align === 'end') !== rtl ? rect.right - bounds.width : rect.left;
        if (submenu && (left + bounds.width > offsetX + width - margin || left < offsetX + margin)) {
            left = rtl ? rect.right + gap : rect.left - bounds.width - gap;
        }
        let top = submenu ? rect.top : rect.bottom + gap;
        if (!submenu && top + bounds.height > offsetY + height - margin && rect.top - gap - bounds.height >= offsetY + margin) {
            top = rect.top - gap - bounds.height;
        }
        panel.style.left = `${Math.max(offsetX + margin, Math.min(left, offsetX + width - bounds.width - margin))}px`;
        panel.style.top = `${Math.max(offsetY + margin, Math.min(top, offsetY + height - bounds.height - margin))}px`;
    }

    function sync(state) {
        const { root, dropdown } = state;
        if (dropdown) {
            const trigger = root.querySelector(':scope > [data-sir-dropdown-trigger]');
            const panel = root.querySelector(':scope > [data-sir-nav-list]');
            if (!trigger || !panel) return;
            state.trigger = trigger;
            state.panel = panel;
            if (trigger.disabled) state.open = false;
            set(trigger, 'aria-expanded', String(state.open));
            visibility(panel, state.open);
            if (state.open) position(panel, trigger, false, root.dataset.align);
        }
        for (const [trigger, panel] of state.submenus) {
            if (!root.contains(trigger) || !root.contains(panel)) state.submenus.delete(trigger);
        }
        for (const trigger of root.querySelectorAll('[data-sir-submenu-trigger]')) {
            if (trigger.closest(rootSelector) !== root) continue;
            const panel = trigger.nextElementSibling;
            if (!panel?.matches('[data-sir-nav-list]')) continue;
            const parent = trigger.closest('[data-sir-nav-list]');
            const parentVisible = !parent.hidden && !parent.inert;
            if (!parentVisible || trigger.getAttribute('aria-disabled') === 'true') state.submenus.delete(trigger);
            const expanded = state.submenus.has(trigger);
            set(trigger, 'aria-expanded', String(expanded));
            visibility(panel, expanded);
            if (expanded && dropdown) position(panel, trigger, true);
        }
        if (dropdown) {
            for (const item of root.querySelectorAll(itemSelector)) set(item, 'tabindex', '-1');
        }
    }

    function collapse(state, trigger, focus = false) {
        const panel = state.submenus.get(trigger);
        if (!panel) return;
        for (const nested of [...state.submenus.keys()]) {
            if (panel.contains(nested)) collapse(state, nested);
        }
        state.submenus.delete(trigger);
        set(trigger, 'aria-expanded', 'false');
        visibility(panel, false, state.dropdown);
        if (focus) trigger.focus({ preventScroll: true });
    }

    function close(state, focus = false) {
        for (const trigger of [...state.submenus.keys()]) collapse(state, trigger);
        if (!state.dropdown || !state.open) return;
        state.open = false;
        set(state.trigger, 'aria-expanded', 'false');
        if (focus && state.trigger.isConnected) state.trigger.focus({ preventScroll: true });
        visibility(state.panel, false, true);
        notify(state.root, false);
    }

    function open(state, last = false, focus = true) {
        for (const other of roots.values()) if (other !== state && other.dropdown) close(other);
        const changed = !state.open;
        state.open = true;
        sync(state);
        if (!state.open) return;
        if (focus) focusItem(state.panel, last);
        if (changed) notify(state.root, true);
    }

    function expand(state, trigger, focus = false) {
        if (trigger.getAttribute('aria-disabled') === 'true') return;
        const panel = trigger.nextElementSibling;
        if (!panel?.matches('[data-sir-nav-list]')) return;
        for (const sibling of [...state.submenus.keys()]) {
            if (sibling !== trigger && sibling.closest('[data-sir-nav-list]') === trigger.closest('[data-sir-nav-list]')) collapse(state, sibling);
        }
        state.submenus.set(trigger, panel);
        sync(state);
        if (focus) focusItem(panel);
    }

    function scan() {
        for (const [root, state] of roots) {
            if (!root.isConnected) {
                roots.delete(root);
                for (const panel of [state.panel, ...state.submenus.values()]) {
                    clearTimeout(closing.get(panel));
                    closing.delete(panel);
                }
            }
        }
        for (const root of document.querySelectorAll(rootSelector)) {
            let state = roots.get(root);
            const declared = root.dataset.initialOpen === 'true';
            if (!state) {
                state = { root, dropdown: root.hasAttribute('data-sir-dropdown'), open: false, declared, submenus: new Map(), search: '', searchAt: 0 };
                roots.set(root, state);
                sync(state);
                if (declared && state.dropdown) open(state);
            } else if (state.declared !== declared) {
                state.declared = declared;
                if (declared) open(state); else close(state, root.contains(document.activeElement));
            }
            sync(state);
        }
    }

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const root = rootFor(target);
        for (const state of roots.values()) if (state.dropdown && state.open && state.root !== root) close(state);
        const state = roots.get(root);
        if (!state) return;
        const trigger = target.closest('[data-sir-dropdown-trigger]');
        if (trigger && trigger.closest(rootSelector) === root) {
            if (trigger.disabled) return;
            state.open ? close(state, true) : open(state);
            return;
        }
        const item = target.closest(itemSelector);
        if (!item) return;
        if (item.getAttribute('aria-disabled') === 'true') {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (item.hasAttribute('data-sir-submenu-trigger')) {
            state.submenus.has(item) ? collapse(state, item) : expand(state, item);
        } else if (state.dropdown) close(state, true);
    }, true);

    document.addEventListener('keydown', event => {
        const target = event.target instanceof Element ? event.target : null;
        const state = roots.get(target?.closest(rootSelector));
        if (!state) return;
        if (target === state.trigger && event.key === 'Escape' && state.open && !clickDismissal(state)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            close(state, true);
            return;
        }
        if (target === state.trigger && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (!state.trigger.disabled) {
                if (clickDismissal(state) && state.open && ['Enter', ' '].includes(event.key)) close(state, true);
                else open(state, event.key === 'ArrowUp');
            }
            return;
        }
        const item = target.closest(itemSelector);
        if (!item && state.dropdown && state.open && state.panel.contains(target) && event.key === 'Escape') {
            if (clickDismissal(state)) return;
            if (target.closest('[data-sir-select]')?.querySelector('.ts-wrapper.dropdown-active')
                || target.closest('[data-sir-datetime-picker]')?.querySelector('.flatpickr-calendar.open')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            close(state, true);
            return;
        }
        if (!item) return;
        const panel = item.closest('[data-sir-nav-list]');
        const submenu = panel.classList.contains('sir-nav-submenu');
        const rtl = getComputedStyle(item).direction === 'rtl';
        const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
        const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
        if (event.key === 'Tab' && state.dropdown) {
            close(state, true);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (submenu) collapse(state, triggerFor(panel), true);
            else if (state.dropdown) close(state, true);
            else if (item.hasAttribute('data-sir-submenu-trigger')) collapse(state, item);
            return;
        }
        if (event.key === backward && submenu) {
            event.preventDefault();
            collapse(state, triggerFor(panel), true);
            return;
        }
        if (event.key === forward && item.hasAttribute('data-sir-submenu-trigger')) {
            event.preventDefault();
            expand(state, item, true);
            return;
        }
        if (['Enter', ' '].includes(event.key)) {
            if (item.getAttribute('aria-disabled') === 'true') {
                event.preventDefault();
                event.stopImmediatePropagation();
            } else if (item.hasAttribute('data-sir-submenu-trigger')) {
                event.preventDefault();
                expand(state, item, state.dropdown);
            } else if (event.key === ' ' || item.tagName === 'A') {
                event.preventDefault();
                item.click();
            }
            return;
        }
        if (!state.dropdown) return;
        const list = items(panel);
        const index = list.indexOf(item);
        let next;
        if (event.key === 'ArrowDown') next = list[(index + 1) % list.length];
        if (event.key === 'ArrowUp') next = list[(index - 1 + list.length) % list.length];
        if (event.key === 'Home') next = list[0];
        if (event.key === 'End') next = list.at(-1);
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now();
            state.search = now - state.searchAt > 500 ? event.key : state.search + event.key;
            state.searchAt = now;
            const search = state.search.toLocaleLowerCase();
            next = [...list.slice(index + 1), ...list.slice(0, index + 1)].find(candidate => candidate.querySelector('.sir-nav-name')?.textContent.trim().toLocaleLowerCase().startsWith(search));
        }
        if (next) {
            event.preventDefault();
            next.focus({ preventScroll: true });
            next.scrollIntoView({ block: 'nearest' });
        }
    }, true);

    document.addEventListener('focusin', event => {
        for (const state of roots.values()) {
            if (clickDismissal(state) || state.root.closest('[data-sir-table][aria-busy="true"]')) continue;
            if (state.dropdown && state.open && !state.root.contains(event.target) && rootFor(event.target) !== state.root) close(state);
        }
    });
    function reposition() { for (const state of roots.values()) sync(state); }
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('livewire:navigating', () => { for (const state of roots.values()) close(state); });
    document.addEventListener('livewire:navigated', scan);
    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; scan(); });
    });
    const start = () => {
        scan();
        observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-initial-open', 'data-align', 'aria-expanded', 'aria-disabled', 'hidden', 'disabled'] });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
