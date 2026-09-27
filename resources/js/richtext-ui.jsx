import React from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContext } from '@tiptap/react';
import { MarkButton } from './vendor/tiptap-ui/components/tiptap-ui/mark-button';
import { HeadingDropdownMenu } from './vendor/tiptap-ui/components/tiptap-ui/heading-dropdown-menu';
import { ListButton } from './vendor/tiptap-ui/components/tiptap-ui/list-button';
import { LinkPopover } from './vendor/tiptap-ui/components/tiptap-ui/link-popover';
import { UndoRedoButton } from './vendor/tiptap-ui/components/tiptap-ui/undo-redo-button';
import { BlockquoteButton } from './vendor/tiptap-ui/components/tiptap-ui/blockquote-button';
import { CodeBlockButton } from './vendor/tiptap-ui/components/tiptap-ui/code-block-button';
import { Toolbar } from './vendor/tiptap-ui/components/tiptap-ui-primitive/toolbar';
import { Button } from './vendor/tiptap-ui/components/tiptap-ui-primitive/button';
import { SiriusContext } from './vendor/tiptap-ui/sirius-context';
import './vendor/tiptap-ui/styles/_variables.scss';
import './vendor/tiptap-ui/styles/_keyframe-animations.scss';

export function renderToolbar(state) {
    state.reactRoot ||= createRoot(state.toolbar);
    const { config, editor, source } = state;
    const disabled = source.disabled || source.readOnly;
    if (disabled) { state.reactRoot.render(null); return; }
    const props = command => ({ editor, ...(disabled ? { disabled: true } : {}), 'data-richtext-command': command, 'aria-label': config.messages[command], tooltip: config.messages[command] });
    state.reactRoot.render(
        <SiriusContext.Provider value={{ messages: config.messages, portal: state.ui }}>
            <EditorContext.Provider value={{ editor }}>
                <Toolbar key={String(disabled)} aria-label={config.messages.toolbar}>
                    {config.toolbar.map(command => {
                        const common = { ...props(command), key: command };
                        if (['bold', 'italic', 'underline', 'strike'].includes(command)) return <MarkButton {...common} type={command} />;
                        if (command === 'heading') return <HeadingDropdownMenu {...common} levels={config.options.headingLevels} />;
                        if (['bulletList', 'orderedList'].includes(command)) return <ListButton {...common} type={command} />;
                        if (command === 'link') return <LinkPopover {...common} autoOpenOnLinkActive={false} />;
                        if (['undo', 'redo'].includes(command)) return <UndoRedoButton {...common} action={command} />;
                        if (command === 'blockquote') return <BlockquoteButton {...common} />;
                        if (command === 'codeBlock') return <CodeBlockButton {...common} />;
                        if (command === 'image') return <Button key={command} type="button" data-richtext-command="image" disabled={disabled || state.uploading} aria-label={config.messages.image} tooltip={config.messages.image} onClick={() => state.fileInput.click()}><span className="sir-richtext-image-icon" dangerouslySetInnerHTML={{ __html: state.imageIcon }} /></Button>;
                        return null;
                    })}
                </Toolbar>
            </EditorContext.Provider>
        </SiriusContext.Provider>
    );
}
