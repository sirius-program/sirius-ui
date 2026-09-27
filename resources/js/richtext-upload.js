const uploading = new Set();
export function cancelImageUploads(state) {
    state.uploadSequence = (state.uploadSequence || 0) + 1;
    state.uploadRequest?.abort(); state.uploadRequest = null;
    state.uploading = false; uploading.delete(state);
    state.source?.setCustomValidity('');
    if (state.uploadStatus) state.uploadStatus.textContent = '';
    if (state.cancelUpload) state.cancelUpload.hidden = true;
}
export function setupImageUpload(state, refresh) {
    const { config, source, ui } = state;
    state.imageIcon = state.root.querySelector('[data-richtext-image-icon]')?.innerHTML || '';
    const file = state.fileInput = document.createElement('input');
    file.type = 'file'; file.accept = config.upload.accept.join(','); file.hidden = true;
    const status = state.uploadStatus = document.createElement('p'); status.setAttribute('role', 'status');
    status.className = 'sir-richtext-upload-status';
    const cancel = state.cancelUpload = document.createElement('button');
    cancel.type = 'button'; cancel.hidden = true; cancel.textContent = config.messages.cancel;
    cancel.addEventListener('click', () => { cancelImageUploads(state); refresh(); });
    ui.append(file, status, cancel);
    file.addEventListener('change', () => {
        const image = file.files[0]; file.value = '';
        if (!image || source.disabled || source.readOnly || !config.toolbar.includes('image')) return;
        cancelImageUploads(state);
        if (!config.upload.accept.includes(image.type) || image.size > config.upload.maxSize * 1024) {
            status.textContent = config.messages.invalid_image; refresh(); return;
        }
        let endpoint;
        try { endpoint = new URL(config.upload.url, document.baseURI); }
        catch { status.textContent = config.messages.upload_error; refresh(); return; }
        if (endpoint.origin !== location.origin || !['http:', 'https:'].includes(endpoint.protocol)) {
            status.textContent = config.messages.upload_error; refresh(); return;
        }
        const sequence = state.uploadSequence;
        const request = state.uploadRequest = new XMLHttpRequest();
        request.open('POST', endpoint.href); request.timeout = 120000;
        request.setRequestHeader('Accept', 'application/json');
        const token = document.querySelector('meta[name="csrf-token"]')?.content || source.form?.querySelector('input[name="_token"]')?.value;
        if (token) request.setRequestHeader('X-CSRF-TOKEN', token);
        else {
            const cookie = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));
            if (cookie) request.setRequestHeader('X-XSRF-TOKEN', decodeURIComponent(cookie.slice(11)));
        }
        state.uploading = true; uploading.add(state); cancel.hidden = false;
        status.textContent = config.messages.uploading;
        source.setCustomValidity(config.messages.upload_busy); refresh();
        const current = () => state.uploadSequence === sequence && state.root.isConnected;
        const failed = () => {
            if (!current()) return;
            state.uploading = false; state.uploadRequest = null; uploading.delete(state); cancel.hidden = true;
            source.setCustomValidity(''); status.textContent = config.messages.upload_error; refresh();
        };
        request.upload.onprogress = event => {
            if (current() && event.lengthComputable) status.textContent = config.messages.uploading + ' ' + Math.round(event.loaded / event.total * 100) + '%';
        };
        request.onerror = request.ontimeout = failed;
        request.onload = () => {
            if (!current()) return;
            let url;
            try {
                const result = JSON.parse(request.responseText);
                if (typeof result.url !== 'string' || result.url.trim() === '') throw new Error('Invalid image URL');
                url = new URL(result.url, document.baseURI);
            }
            catch { failed(); return; }
            if (request.status < 200 || request.status >= 300 || !['http:', 'https:'].includes(url.protocol)) { failed(); return; }
            state.uploading = false; state.uploadRequest = null; uploading.delete(state); cancel.hidden = true; source.setCustomValidity('');
            if (!source.disabled && !source.readOnly) state.editor.chain().focus().setImage({ src: url.href, alt: image.name }).run();
            status.textContent = config.messages.upload_complete; refresh();
        };
        const data = new FormData(); data.append('image', image);
        request.send(data);
    });
}

document.addEventListener('submit', event => {
    for (const state of uploading) {
        if (state.source.form !== event.target) continue;
        event.preventDefault(); event.stopImmediatePropagation();
        state.uploadStatus.textContent = state.config.messages.upload_busy;
        state.editor.commands.focus(); return;
    }
}, true);
