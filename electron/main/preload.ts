import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  printer: { list: () => ipcRenderer.invoke('printer:list'), printHtml: (html: string, options: { deviceName?: string; silent?: boolean } = {}) => ipcRenderer.invoke('printer:print', { html, options }) },
  cache: { get: (key: string) => ipcRenderer.invoke('cache:get', key), set: (key: string, value: unknown) => ipcRenderer.invoke('cache:set', { key, value }) },
  sync: { queue: (type: string, payload: unknown) => ipcRenderer.invoke('sync:queue', { type, payload }), status: (listener: (status: { online: boolean }) => void) => ipcRenderer.on('network:status', (_, status) => listener(status)) },
  offline: { get: (entity: string, tenantId: string) => ipcRenderer.invoke('offline:cache:get', { entity, tenantId }), set: (entity: string, tenantId: string, data: unknown) => ipcRenderer.invoke('offline:cache:set', { entity, tenantId, data }), queue: (entity: string, operation: 'create' | 'update' | 'delete', tenantId: string, payload: unknown) => ipcRenderer.invoke('offline:queue', { entity, operation, tenantId, payload }), stats: () => ipcRenderer.invoke('sync:stats') },
  backup: { export: () => ipcRenderer.invoke('backup:export') },
  updater: { check: () => ipcRenderer.invoke('updater:check') },
  app: { version: () => ipcRenderer.invoke('app:version') },
  network: { check: () => ipcRenderer.invoke('network:check') },
  clipboard: { copy: (text: string) => ipcRenderer.invoke('clipboard:copy', text), paste: () => ipcRenderer.invoke('clipboard:paste') },
  dialog: { show: (message: string, type: 'info' | 'error' = 'info') => ipcRenderer.invoke('dialog:message', { message, type }) },
  filesystem: { save: (name: string, data: string) => ipcRenderer.invoke('filesystem:save', { name, data }), open: (extensions: string[]) => ipcRenderer.invoke('filesystem:open', extensions) },
  notification: { show: (title: string, message: string) => ipcRenderer.invoke('notification:show', { title, message }) },
  scanner: { input: (value: string) => ipcRenderer.send('scanner:input', value), onScan: (listener: (event: unknown) => void) => ipcRenderer.on('scanner:scan', (_, event) => listener(event)) },
});
