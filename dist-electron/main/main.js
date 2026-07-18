import { app, clipboard, dialog, ipcMain, nativeTheme, Notification, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalDatabase } from '../database/local.db.js';
import { PrinterService } from '../services/printer.service.js';
import { SyncService } from '../services/sync.service.js';
import { createMainWindow } from './window.js';
import { FilesystemService } from '../services/filesystem.service.js';
import { KeyboardScannerService } from '../services/scanner.service.js';
import { OfflineService } from '../services/offline.service.js';
import { Logger } from '../logging/logger.js';
import { BackupService } from '../recovery/backup.service.js';
import { HealthService } from '../monitoring/health.service.js';
import { LicenseService } from '../licensing/license.service.js';
import { DiagnosticsService } from '../monitoring/diagnostics.service.js';
import { HardwareService } from '../services/hardware.service.js';
import { PluginService } from '../plugins/plugin.service.js';
import { installMenu } from './menu.js';
if (!app.requestSingleInstanceLock())
    app.quit();
let database;
function validText(value, limit = 1_000_000) { return typeof value === 'string' && value.length <= limit; }
app.on('second-instance', () => createMainWindow().focus());
app.whenReady().then(async () => {
    database = new LocalDatabase();
    const printer = new PrinterService();
    const files = new FilesystemService();
    const scanner = new KeyboardScannerService();
    const sync = new SyncService(database);
    const offline = new OfflineService(database);
    const logger = new Logger();
    const backup = new BackupService();
    const health = new HealthService(sync);
    const license = new LicenseService();
    const diagnostics = new DiagnosticsService(database);
    const hardware = new HardwareService();
    const plugins = new PluginService();
    scanner.start();
    nativeTheme.themeSource = 'system';
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self' https: data:; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:"] } }));
    ipcMain.handle('cache:get', (_, key) => validText(key, 200) ? database.cacheGet(key) : null);
    ipcMain.handle('cache:set', (_, input) => { if (!input || !validText(input.key, 200))
        throw new Error('Invalid cache key'); database.cacheSet(input.key, input.value); });
    ipcMain.handle('sync:queue', (_, input) => { if (!input || !validText(input.type, 100))
        throw new Error('Invalid sync request'); sync.queue(input.type, input.payload); });
    ipcMain.handle('offline:cache:get', (_, input) => input && validText(input.entity, 100) && validText(input.tenantId, 100) ? offline.cached(input.entity, input.tenantId) : null);
    ipcMain.handle('offline:cache:set', (_, input) => { if (!input || !validText(input.entity, 100) || !validText(input.tenantId, 100))
        throw new Error('Invalid cache request'); offline.cache(input.entity, input.tenantId, input.data); });
    ipcMain.handle('offline:queue', (_, input) => { if (!input || !validText(input.entity, 100) || !validText(input.tenantId, 100) || !['create', 'update', 'delete'].includes(input.operation))
        throw new Error('Invalid offline operation'); return offline.queue(input.entity, input.operation, input.tenantId, input.payload); });
    ipcMain.handle('sync:stats', () => database.queueStats());
    ipcMain.handle('health:check', () => health.check());
    ipcMain.handle('backup:create', () => backup.backup());
    ipcMain.handle('license:status', () => license.status());
    ipcMain.handle('license:activate', (_, value) => { if (!value || !validText(value.key, 500) || !Array.isArray(value.features))
        throw new Error('Invalid license'); return license.activate(value); });
    ipcMain.handle('diagnostics:report', () => diagnostics.report());
    ipcMain.handle('diagnostics:bundle', () => diagnostics.supportBundle());
    ipcMain.handle('database:maintain', () => database.maintain());
    ipcMain.handle('hardware:route', (_, role) => validText(role, 30) ? hardware.route(role) : []);
    ipcMain.handle('plugins:list', () => plugins.list());
    ipcMain.handle('printer:list', () => createMainWindow().webContents.getPrintersAsync());
    ipcMain.handle('printer:print', async (_, input) => { if (!input || !validText(input.html))
        throw new Error('Invalid print request'); await printer.printHtml(input.html, input.options ?? {}); });
    ipcMain.handle('backup:export', async () => { const target = await dialog.showSaveDialog({ defaultPath: `nexvelt-backup-${Date.now()}.db` }); if (target.canceled || !target.filePath)
        return null; await fs.copyFile(path.join(app.getPath('userData'), 'nexvelt-pos.db'), target.filePath); new Notification({ title: 'Backup completed', body: 'Your local POS backup was exported.' }).show(); return target.filePath; });
    ipcMain.handle('updater:check', async () => { if (app.isPackaged)
        await autoUpdater.checkForUpdates(); });
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('network:check', () => sync.isOnline());
    ipcMain.handle('clipboard:copy', (_, text) => { if (!validText(text, 10_000))
        throw new Error('Invalid clipboard text'); clipboard.writeText(text); });
    ipcMain.handle('clipboard:paste', () => clipboard.readText());
    ipcMain.handle('dialog:message', async (_, input) => { if (!input || !validText(input.message, 2_000))
        throw new Error('Invalid dialog'); return dialog.showMessageBox({ type: input.type === 'error' ? 'error' : 'info', message: input.message, buttons: ['OK'] }); });
    ipcMain.handle('filesystem:save', (_, input) => { if (!input || !validText(input.name, 255) || !validText(input.data))
        throw new Error('Invalid file request'); return files.save(input.name, input.data); });
    ipcMain.handle('filesystem:open', (_, extensions) => Array.isArray(extensions) && extensions.every((item) => validText(item, 20)) ? files.open(extensions) : Promise.reject(new Error('Invalid extension list')));
    ipcMain.handle('notification:show', (_, input) => { if (!input || !validText(input.title, 200) || !validText(input.message, 1_000))
        throw new Error('Invalid notification'); new Notification({ title: input.title, body: input.message }).show(); });
    ipcMain.on('scanner:input', (_, value) => { if (validText(value, 512))
        scanner.receive(value); });
    const window = createMainWindow();
    installMenu(window);
    await window.loadURL(process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(app.getAppPath(), 'dist/index.html')}`);
    if (app.isPackaged) {
        autoUpdater.autoDownload = true;
        autoUpdater.checkForUpdatesAndNotify().catch((error) => void logger.write('warn', 'updater', String(error)));
    }
    setInterval(() => void backup.backup().catch((error) => void logger.write('warn', 'backup', String(error))), 86_400_000);
    setInterval(() => void sync.sync(async () => undefined), 30_000);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    app.quit(); });
app.on('before-quit', () => database?.close());
process.on('uncaughtException', (error) => database?.log('error', error.stack ?? error.message));
process.on('unhandledRejection', (error) => database?.log('error', String(error)));
