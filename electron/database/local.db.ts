import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

export type QueueRecord = { id: string; type: string; payload: string; attempts: number; created_at: string };

export class LocalDatabase {
  private readonly db: Database.Database;

  constructor() {
    this.db = new Database(path.join(app.getPath('userData'), 'nexvelt-pos.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, next_retry_at TEXT, tenant_id TEXT, status TEXT NOT NULL DEFAULT 'queued');
      CREATE TABLE IF NOT EXISTS print_queue (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS failed_jobs (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, error TEXT NOT NULL, failed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY, entity TEXT NOT NULL, local_payload TEXT NOT NULL, server_payload TEXT NOT NULL, strategy TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_ready ON sync_queue(status, next_retry_at, created_at);
    `);
  }

  cacheSet(key: string, value: unknown) { this.db.prepare('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)').run(key, JSON.stringify(value), new Date().toISOString()); }
  cacheGet<T>(key: string): T | null { const row = this.db.prepare('SELECT value FROM cache WHERE key = ?').get(key) as { value: string } | undefined; return row ? JSON.parse(row.value) as T : null; }
  enqueue(record: QueueRecord) { this.db.prepare('INSERT OR REPLACE INTO sync_queue (id,type,payload,attempts,created_at,status) VALUES (?, ?, ?, ?, ?, ?)').run(record.id, record.type, record.payload, record.attempts, record.created_at, 'queued'); }
  pending(): QueueRecord[] { return this.db.prepare("SELECT * FROM sync_queue WHERE status IN ('queued','retrying') AND (next_retry_at IS NULL OR next_retry_at <= ?) ORDER BY created_at LIMIT 50").all(new Date().toISOString()) as QueueRecord[]; }
  complete(id: string) { this.db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id); }
  retry(id: string, error = 'Sync failed') { const row = this.db.prepare('SELECT attempts,type,payload FROM sync_queue WHERE id = ?').get(id) as QueueRecord | undefined; if (!row) return; const attempts = row.attempts + 1; if (attempts > 6) { this.db.prepare('INSERT OR REPLACE INTO failed_jobs VALUES (?, ?, ?, ?, ?)').run(id, row.type, row.payload, error, new Date().toISOString()); this.complete(id); return; } const delay = [1000,5000,15000,30000,60000,300000][attempts - 1]; this.db.prepare("UPDATE sync_queue SET attempts=?, status='retrying', next_retry_at=? WHERE id=?").run(attempts, new Date(Date.now() + delay).toISOString(), id); }
  queueStats() { return this.db.prepare("SELECT status, COUNT(*) count FROM sync_queue GROUP BY status").all(); }
  maintain() { this.db.exec('PRAGMA optimize; ANALYZE; VACUUM;'); return this.db.pragma('integrity_check', { simple: true }); }
  conflict(id: string, entity: string, local: unknown, server: unknown, strategy: string) { this.db.prepare('INSERT OR REPLACE INTO conflicts VALUES (?, ?, ?, ?, ?, ?)').run(id, entity, JSON.stringify(local), JSON.stringify(server), strategy, new Date().toISOString()); }
  log(level: string, message: string) { this.db.prepare('INSERT INTO logs (level, message, created_at) VALUES (?, ?, ?)').run(level, message, new Date().toISOString()); }
  close() { this.db.close(); }
}
