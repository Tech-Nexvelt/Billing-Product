import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
export class HealthService {
    sync;
    constructor(sync) {
        this.sync = sync;
    }
    async check() { const db = path.join(app.getPath('userData'), 'nexvelt-pos.db'); const stat = await fs.stat(db).catch(() => null); const online = await this.sync.isOnline(); return { status: stat && online ? 'healthy' : 'warning', online, databaseBytes: stat?.size ?? 0, memory: process.memoryUsage(), checkedAt: new Date().toISOString() }; }
}
