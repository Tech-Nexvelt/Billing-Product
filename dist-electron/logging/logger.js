import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
export class Logger {
    async write(level, module, message, metadata = {}) {
        const dir = path.join(app.getPath('userData'), 'logs');
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
        await fs.appendFile(file, `${JSON.stringify({ timestamp: new Date().toISOString(), level, module, message, version: app.getVersion(), ...metadata })}\n`);
    }
}
