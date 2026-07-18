import { BrowserWindow, net } from 'electron';
import { randomUUID } from 'node:crypto';
export class SyncService {
    db;
    online = true;
    syncing = false;
    constructor(db) {
        this.db = db;
    }
    async isOnline() { return new Promise((resolve) => { const request = net.request('https://clients3.google.com/generate_204'); request.on('response', () => resolve(true)); request.on('error', () => resolve(false)); request.end(); }); }
    queue(type, payload) { this.db.enqueue({ id: randomUUID(), type, payload: JSON.stringify(payload), attempts: 0, created_at: new Date().toISOString() }); }
    async sync(send) {
        if (this.syncing || !(this.online = await this.isOnline()))
            return;
        this.syncing = true;
        try {
            for (const item of this.db.pending()) {
                try {
                    await send({ type: item.type, payload: JSON.parse(item.payload) });
                    this.db.complete(item.id);
                }
                catch (error) {
                    this.db.retry(item.id, String(error));
                    break;
                }
            }
        }
        finally {
            this.syncing = false;
            BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('network:status', { online: this.online }));
        }
    }
}
