import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
    printer: { list: () => ipcRenderer.invoke('printer:list'), printHtml: (html, options = {}) => ipcRenderer.invoke('printer:print', { html, options }) },
    cache: { get: (key) => ipcRenderer.invoke('cache:get', key), set: (key, value) => ipcRenderer.invoke('cache:set', { key, value }) },
    sync: { queue: (type, payload) => ipcRenderer.invoke('sync:queue', { type, payload }), status: (listener) => ipcRenderer.on('network:status', (_, status) => listener(status)) },
    offline: { get: (entity, tenantId) => ipcRenderer.invoke('offline:cache:get', { entity, tenantId }), set: (entity, tenantId, data) => ipcRenderer.invoke('offline:cache:set', { entity, tenantId, data }), queue: (entity, operation, tenantId, payload) => ipcRenderer.invoke('offline:queue', { entity, operation, tenantId, payload }), stats: () => ipcRenderer.invoke('sync:stats') },
    backup: { export: () => ipcRenderer.invoke('backup:export') },
    updater: { check: () => ipcRenderer.invoke('updater:check') },
    app: { version: () => ipcRenderer.invoke('app:version') },
    network: { check: () => ipcRenderer.invoke('network:check') },
    clipboard: { copy: (text) => ipcRenderer.invoke('clipboard:copy', text), paste: () => ipcRenderer.invoke('clipboard:paste') },
    dialog: { show: (message, type = 'info') => ipcRenderer.invoke('dialog:message', { message, type }) },
    filesystem: { save: (name, data) => ipcRenderer.invoke('filesystem:save', { name, data }), open: (extensions) => ipcRenderer.invoke('filesystem:open', extensions) },
    notification: { show: (title, message) => ipcRenderer.invoke('notification:show', { title, message }) },
    scanner: { input: (value) => ipcRenderer.send('scanner:input', value), onScan: (listener) => ipcRenderer.on('scanner:scan', (_, event) => listener(event)) },
});
