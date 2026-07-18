import { BrowserWindow } from 'electron';
import { ScanEvent, ScannerAdapter } from '../interfaces/scanner.interface.js';

export class KeyboardScannerService implements ScannerAdapter {
  private buffer = ''; private timer?: NodeJS.Timeout; private listeners = new Set<(event: ScanEvent) => void>();
  start() {} stop() { this.buffer = ''; if (this.timer) clearTimeout(this.timer); }
  onScan(listener: (event: ScanEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  receive(value: string) { if (!value || value.length > 512) return; this.buffer += value; if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { const event: ScanEvent = { value: this.buffer, symbology: 'barcode', timestamp: new Date().toISOString() }; this.listeners.forEach((listener) => listener(event)); BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('scanner:scan', event)); this.buffer = ''; }, 40); }
}
