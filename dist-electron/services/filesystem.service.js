import fs from 'node:fs/promises';
import path from 'node:path';
import { app, dialog } from 'electron';
export class FilesystemService {
    root = path.join(app.getPath('userData'), 'exports');
    safe(name) { const file = path.basename(name); if (!file || file !== name)
        throw new Error('Invalid filename'); return path.join(this.root, file); }
    async save(name, data) { await fs.mkdir(this.root, { recursive: true }); const target = await dialog.showSaveDialog({ defaultPath: this.safe(name) }); if (!target.canceled && target.filePath)
        await fs.writeFile(target.filePath, data, 'utf8'); return target.filePath ?? null; }
    async open(extensions) { const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Supported files', extensions }] }); return result.canceled ? null : fs.readFile(result.filePaths[0], 'utf8'); }
}
