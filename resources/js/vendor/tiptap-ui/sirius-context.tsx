import * as React from 'react';
export const SiriusContext = React.createContext<{messages: Record<string, string>, portal: HTMLElement | null}>({messages: {}, portal: null});
export const safeEditorUrl = (value: string) => /^(https?:\/\/|mailto:|tel:)/i.test(value) && !/[\u0000-\u0020]/.test(value);
