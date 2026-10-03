const avatarOwner = Symbol.for('sirius.ui.avatar');
if (!window[avatarOwner]) {
    window[avatarOwner] = true;
    function syncAvatar(root) {
        if (!root?.matches?.('[data-sir-avatar]')) return;
        const image = root.querySelector('[data-avatar-image]');
        const ready = String(!!image && image.complete && image.naturalWidth > 0);
        if (root.dataset.imageReady !== ready) root.dataset.imageReady = ready;
    }
    function scanAvatars(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        syncAvatar(root);
        root.querySelectorAll('[data-sir-avatar]').forEach(syncAvatar);
    }
    for (const event of ['load', 'error']) {
        document.addEventListener(event, event => {
            if (event.target?.matches?.('[data-avatar-image]')) syncAvatar(event.target.closest('[data-sir-avatar]'));
        }, true);
    }
    new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'childList') {
                syncAvatar(record.target.closest?.('[data-sir-avatar]'));
                record.addedNodes.forEach(scanAvatars);
            } else syncAvatar(record.target.closest?.('[data-sir-avatar]'));
        }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'data-image-ready'] });
    document.addEventListener('livewire:navigated', () => scanAvatars(document));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scanAvatars(document), { once: true });
    else scanAvatars(document);
}
