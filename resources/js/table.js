(() => {
    const owner = Symbol.for('sirius.ui.table');
    if (window[owner]) return;
    window[owner] = true;
    const states = new Map();

    function scan() {
        for (const [root] of states) if (!root.isConnected) states.delete(root);
        for (const root of document.querySelectorAll('[data-sir-table]')) {
            let state = states.get(root);
            if (!state) { state = { busy: false, clientLoading: false, focus: null, caret: null }; states.set(root, state); }
            for (const input of root.querySelectorAll('input[data-table-checked]')) {
                input.checked = input.dataset.tableChecked === 'true';
                input.indeterminate = input.dataset.sirIndeterminate === 'true';
            }
            const region = root.querySelector(':scope > [data-table-region]');
            const content = region?.querySelector(':scope > [data-table-content]');
            const overlay = region?.querySelector(':scope > [data-table-loading]');
            if (!content || !overlay) continue;
            const busy = content.hasAttribute('data-table-request') || root.dataset.externalLoading === 'true' || state.clientLoading;
            const bulk = root.querySelector('[data-table-bulk]');
            const bulkTrigger = bulk?.querySelector('[data-sir-dropdown-trigger]');
            if (bulk && bulk.inert !== busy) bulk.inert = busy;
            if (bulkTrigger) {
                const disabled = busy || root.dataset.selectionCount === '0';
                if (bulkTrigger.disabled !== disabled) bulkTrigger.disabled = disabled;
            }
            if (busy && !state.busy && content.contains(document.activeElement)) {
                state.focus = document.activeElement;
                state.caret = typeof state.focus.selectionStart === 'number' ? [state.focus.selectionStart, state.focus.selectionEnd] : null;
            }
            if (root.getAttribute('aria-busy') !== String(busy)) root.setAttribute('aria-busy', String(busy));
            if (content.inert !== busy) content.inert = busy;
            if (overlay.hidden === busy) overlay.hidden = !busy;
            if (!busy && state.busy) {
                const focus = state.focus;
                const caret = state.caret;
                // Livewire morphing temporarily hides dropdown panels; wait for widget synchronization.
                requestAnimationFrame(() => {
                    if (!state.busy && focus?.isConnected && !focus.closest('[inert]') && [document.body, overlay].includes(document.activeElement)) {
                        focus.focus({ preventScroll: true });
                        if (caret && focus.setSelectionRange) focus.setSelectionRange(...caret);
                    }
                });
                state.focus = null;
                state.caret = null;
            }
            state.busy = busy;
        }
    }

    document.addEventListener('table:loading', event => {
        const { id, loading } = event.detail ?? {};
        const root = document.getElementById(id);
        if (!root?.matches('[data-sir-table]') || typeof loading !== 'boolean') return;
        if (!states.has(root)) scan();
        states.get(root).clientLoading = loading;
        scan();
    });
    // Capture before delegated handlers so a backdrop cannot be bypassed by synthetic clicks.
    for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
        if (!(event.target instanceof Element)) return;
        const root = event.target.closest('[data-sir-table]');
        if (root?.getAttribute('aria-busy') === 'true' && event.target.closest('[data-table-content], [data-table-bulk]')) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-table-request', 'data-external-loading', 'data-selection-count', 'data-table-checked', 'data-sir-indeterminate', 'inert', 'hidden'] });
    document.addEventListener('livewire:navigated', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
    else scan();
})();
