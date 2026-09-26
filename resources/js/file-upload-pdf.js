// Native PDF rendering with explicit ownership of temporary object URLs.
const pdfPreview = ({ addFilter, utils }) => {
    const { createView, createRoute, Type } = utils;
    const pdfView = createView({
        name: 'sirius-pdf-preview', ignoreRect: true,
        create: ({ root, props }) => {
            const item = root.query('GET_ITEM', props.id);
            const stored = item.getMetadata('existing');
            const url = stored?.url || URL.createObjectURL(item.file);
            root.ref.objectUrl = stored ? null : url;
            const object = document.createElement('object');
            object.type = 'application/pdf'; object.data = url;
            object.setAttribute('aria-label', item.filename);
            object.style.height = root.query('GET_PDF_PREVIEW_HEIGHT') + 'px';
            const link = document.createElement('a');
            link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = root.query('GET_LABEL_PDF_OPEN') + ': ' + item.filename;
            root.element.append(object, link);
        },
        destroy: ({ root }) => { if (root.ref.objectUrl) URL.revokeObjectURL(root.ref.objectUrl); },
    });
    addFilter('CREATE_VIEW', ({ is, view, query }) => {
        if (!is('file')) return;
        view.registerWriter(createRoute({ DID_LOAD_ITEM: ({ root, props }) => {
            const item = query('GET_ITEM', props.id);
            if (!query('GET_ALLOW_PDF_PREVIEW') || !item || item.file.type !== 'application/pdf' || root.ref.siriusPdf) return;
            if (item.getMetadata('existing') && !item.getMetadata('existing').url) return;
            root.ref.siriusPdf = view.appendChildView(view.createChildView(pdfView, { id: props.id }));
            root.ref.resizePdf = true;
        } }, ({ root, props }) => {
            if (root.ref.resizePdf && !root.rect.element.hidden) {
                root.dispatch('DID_UPDATE_PANEL_HEIGHT', { id: props.id, height: query('GET_PDF_PREVIEW_HEIGHT') + 90 });
                root.ref.resizePdf = false;
            }
        }));
    });
    return { options: { allowPdfPreview: [true, Type.BOOLEAN], pdfPreviewHeight: [240, Type.INT], labelPdfOpen: ['', Type.STRING] } };
};
