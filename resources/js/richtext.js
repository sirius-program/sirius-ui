import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { renderToolbar } from './richtext-ui';
import { setupImageUpload, cancelImageUploads } from './richtext-upload';

const owner = Symbol.for('sirius.ui.richtext');
if (!window[owner]) {
    window[owner] = true;
    const states = new Map();
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const safeUrl = value => /^(https?:\/\/|mailto:|tel:)/i.test(value) && !/[\u0000-\u0020]/.test(value);
    function emit(state, type) {
        state.model.dispatchEvent(new Event(type, { bubbles: type !== 'blur' }));
        state.emitting = true;
        try { state.source.dispatchEvent(new Event(type, { bubbles: type !== 'blur' })); }
        finally { state.emitting = false; }
    }
    function write(state) {
        state.value = state.editor.isEmpty ? '' : state.editor.getHTML();
        state.source.value = state.value;
        const length = state.editor.getText().length;
        const { source, config } = state;
        source.setCustomValidity(state.uploading ? config.messages.upload_busy : source.maxLength >= 0 && length > source.maxLength ? config.messages.too_long
            : length && source.minLength > length ? config.messages.too_short : '');
        state.content.dataset.empty = String(state.editor.isEmpty);
    }
    function set(state, value) {
        const html = value == null ? '' : String(value);
        if (html !== state.value) {
            cancelImageUploads(state);
            state.editor.commands.setContent(html, { emitUpdate: false });
            write(state);
            refresh(state);
        }
    }
    function refresh(state) {
        const { source, editor, content, ui } = state;
        const editable = !source.disabled && !source.readOnly;
        state.toolbar.hidden = !editable || state.config.toolbar.length === 0;
        if (!editable && state.uploading) cancelImageUploads(state);
        write(state);
        if (editor.isEditable !== editable) editor.setEditable(editable, false);
        ui.dataset.readonly = String(source.readOnly);
        ui.dataset.disabled = String(source.disabled);
        ui.dataset.invalid = source.getAttribute('aria-invalid') || 'false';
        for (const attr of ['aria-describedby', 'aria-invalid', 'aria-label', 'aria-labelledby', 'tabindex', 'spellcheck', 'dir']) {
            if (source.hasAttribute(attr)) content.setAttribute(attr, source.getAttribute(attr));
            else content.removeAttribute(attr);
        }
        if (!source.hasAttribute('aria-label') && !source.hasAttribute('aria-labelledby')) {
            const label = source.labels?.[0];
            if (label) {
                label.id ||= source.id + '-label';
                content.setAttribute('aria-labelledby', label.id);
            }
        }
        content.setAttribute('aria-required', String(source.required));
        content.setAttribute('aria-readonly', String(source.readOnly));
        content.setAttribute('aria-disabled', String(source.disabled));
        if (!source.hasAttribute('tabindex')) content.tabIndex = source.disabled ? -1 : 0;
        content.dataset.placeholder = source.getAttribute('placeholder') || '';
        renderToolbar(state);
        source.dataset.richtextEnhanced = 'true';
        source.hidden = true;
    }
    function initialize(root) {
        const source = root.querySelector('[data-richtext-source]');
        const model = root.querySelector('[data-richtext-model]');
        const ui = root.querySelector('[data-richtext-ui]');
        if (!source || !model || !ui) return;
        const config = JSON.parse(root.dataset.richtextConfig);
        let state = states.get(root);
        let preserved;
        if (state && (state.source !== source || state.model !== model || state.ui !== ui || !same(config, state.config))) {
            preserved = config.resetKey !== state.config.resetKey ? model.value ?? config.value : config.value !== state.config.value ? config.value : state.value;
            destroy(state); state = null;
        }
        if (state) { refresh(state); return; }
        const initial = preserved ?? model.value ?? config.value;
        state = { root, source, model, ui, config, initial: config.value, value: '' };
        states.set(root, state);
        ui.replaceChildren(); ui.className = 'sir-richtext';
        ui.style.setProperty('--sir-richtext-height', config.height + 'px');
        state.toolbar = document.createElement('div');
        state.toolbar.hidden = config.toolbar.length === 0;
        const canvas = document.createElement('div');
        ui.append(state.toolbar, canvas);
        setupImageUpload(state, () => refresh(state));
        const options = config.options;
        state.editor = new Editor({
            element: canvas, content: initial,
            extensions: [Image.configure({ allowBase64: false }), StarterKit.configure({
                heading: { levels: options.headingLevels },
                undoRedo: { depth: options.undoDepth, newGroupDelay: options.newGroupDelay },
                link: { openOnClick: false, autolink: options.autolink, linkOnPaste: options.linkOnPaste,
                    isAllowedUri: safeUrl, HTMLAttributes: { rel: 'noopener noreferrer', target: null } },
            })],
            editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', lang: config.language, id: source.id + '-richtext' } },
            onUpdate: () => { write(state); refresh(state); emit(state, 'input'); emit(state, 'change'); },
            onSelectionUpdate: () => refresh(state),
            onBlur: () => emit(state, 'blur'),
        });
        state.content = state.editor.view.dom;
        Object.defineProperty(model, 'value', { configurable: true, get: () => state.value, set: value => set(state, value) });
        source.addEventListener('change', state.change = () => { if (!state.emitting) { set(state, source.value); emit(state, 'input'); emit(state, 'change'); } });
        source.addEventListener('invalid', state.invalid = event => {
            event.preventDefault(); state.editor.commands.focus();
            state.content.setAttribute('aria-invalid', 'true');
            state.uploadStatus.textContent = source.validationMessage;
        });
        write(state); refresh(state);
    }
    function destroy(state) {
        state.source.removeEventListener('change', state.change);
        state.source.removeEventListener('invalid', state.invalid);
        cancelImageUploads(state); state.reactRoot?.unmount();
        state.editor.destroy(); state.ui.replaceChildren(); delete state.model.value;
        state.source.hidden = false; delete state.source.dataset.richtextEnhanced;
        states.delete(state.root);
    }
    function scan() {
        for (const [root, state] of states) if (!root.isConnected) destroy(state);
        document.querySelectorAll('[data-sir-richtext]').forEach(initialize);
    }
    document.addEventListener('click', event => {
        const label = event.target.closest?.('label[for]');
        if (!label) return;
        for (const state of states.values()) if (state.source.id === label.htmlFor) { event.preventDefault(); state.editor.commands.focus(); }
    });
    document.addEventListener('reset', event => setTimeout(() => {
        if (event.defaultPrevented) return;
        for (const state of states.values()) if (state.source.form === event.target) { cancelImageUploads(state); set(state, state.initial); emit(state, 'input'); emit(state, 'change'); refresh(state); }
    }));
    let pending = false;
    new MutationObserver(records => {
        if (!records.some(record => !record.target.closest?.('[data-richtext-ui]'))) return;
        if (!pending) { pending = true; queueMicrotask(() => { pending = false; scan(); }); }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-richtext-config', 'disabled', 'readonly', 'required', 'aria-invalid', 'aria-describedby', 'placeholder', 'maxlength', 'minlength'] });
    document.addEventListener('livewire:navigated', scan);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
}
