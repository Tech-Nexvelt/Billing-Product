import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
export class PluginService {
    async list() { const root = path.join(app.getPath('userData'), 'plugins'); const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []); return Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => JSON.parse(await fs.readFile(path.join(root, entry.name, 'manifest.json'), 'utf8')))); }
}
