import { BrowserWindow, screen } from 'electron';
import Store from 'electron-store';
import path from 'node:path';
const store = new Store({ defaults: { window: { width: 1440, height: 900 } } });
export function createMainWindow() {
    const saved = store.get('window');
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const window = new BrowserWindow({ width: Math.min(saved.width, workArea.width), height: Math.min(saved.height, workArea.height), x: saved.x, y: saved.y, minWidth: 1024, minHeight: 700, show: false, title: 'NexVelt POS', backgroundColor: '#F8FAFC', webPreferences: { preload: path.join(import.meta.dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
    window.once('ready-to-show', () => { if (saved.maximized)
        window.maximize(); window.show(); });
    window.on('close', () => store.set('window', { ...window.getBounds(), maximized: window.isMaximized() }));
    window.webContents.setWindowOpenHandler(({ url }) => ({ action: url.startsWith('https://') ? 'allow' : 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('http://127.0.0.1') && !url.startsWith('file:'))
        event.preventDefault(); });
    return window;
}
