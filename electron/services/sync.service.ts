import { BrowserWindow, net } from 'electron';
import { randomUUID } from 'node:crypto';
import { LocalDatabase } from '../database/local.db.js';

export class SyncService {
  private online = true;
  private syncing = false;
  constructor(private readonly db: LocalDatabase) {}
  async isOnline() { return new Promise<boolean>((resolve) => { const request = net.request('https://clients3.google.com/generate_204'); request.on('response', () => resolve(true)); request.on('error', () => resolve(false)); request.end(); }); }
  queue(type: string, payload: unknown) { this.db.enqueue({ id: randomUUID(), type, payload: JSON.stringify(payload), attempts: 0, created_at: new Date().toISOString() }); }
  async sync(send: (record: { type: string; payload: unknown }) => Promise<void>) {
    if (this.syncing || !(this.online = await this.isOnline())) return;
    this.syncing = true;
    try { for (const item of this.db.pending()) { try { await send({ type: item.type, payload: JSON.parse(item.payload) }); this.db.complete(item.id); } catch (error) { this.db.retry(item.id, String(error)); break; } } }
    finally { this.syncing = false; BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('network:status', { online: this.online })); }
  }
}
