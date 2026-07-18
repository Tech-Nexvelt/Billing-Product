import { BrowserWindow } from 'electron';
export class PrinterService {
    async printHtml(html, options) {
        if (html.length > 1_000_000)
            throw new Error('Receipt is too large to print');
        const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
        await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        await new Promise((resolve, reject) => window.webContents.print({ silent: options.silent ?? false, printBackground: true, deviceName: options.deviceName }, (ok, reason) => ok ? resolve() : reject(new Error(reason))));
        window.destroy();
    }
}
