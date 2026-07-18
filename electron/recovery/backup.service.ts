import { app } from 'electron'; import fs from 'node:fs/promises'; import path from 'node:path';
export class BackupService {
  private source() { return path.join(app.getPath('userData'), 'nexvelt-pos.db'); }
  async backup(target?: string) { const folder = target ?? path.join(app.getPath('userData'), 'backups'); await fs.mkdir(folder, { recursive: true }); const file = path.join(folder, `nexvelt-${Date.now()}.db`); await fs.copyFile(this.source(), file); return file; }
  async restore(file: string) { if (path.extname(file) !== '.db') throw new Error('Only SQLite backups may be restored'); await fs.copyFile(file, this.source()); }
}
