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
