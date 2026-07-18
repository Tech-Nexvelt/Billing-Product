import { BrowserWindow } from 'electron';
export class KeyboardScannerService {
    buffer = '';
    timer;
    listeners = new Set();
    start() { }
    stop() { this.buffer = ''; if (this.timer)
        clearTimeout(this.timer); }
    onScan(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    receive(value) { if (!value || value.length > 512)
        return; this.buffer += value; if (this.timer)
        clearTimeout(this.timer); this.timer = setTimeout(() => { const event = { value: this.buffer, symbology: 'barcode', timestamp: new Date().toISOString() }; this.listeners.forEach((listener) => listener(event)); BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('scanner:scan', event)); this.buffer = ''; }, 40); }
}
