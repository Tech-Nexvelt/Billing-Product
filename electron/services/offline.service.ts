import { randomUUID } from 'node:crypto';
import { LocalDatabase } from '../database/local.db.js';

export class OfflineService {
  constructor(private readonly db: LocalDatabase) {}
  cache<T>(entity: string, tenantId: string, data: T) { this.db.cacheSet(`${tenantId}:${entity}`, { data, updated_at: new Date().toISOString() }); }
  cached<T>(entity: string, tenantId: string): T | null { const value = this.db.cacheGet<{ data: T }>(`${tenantId}:${entity}`); return value?.data ?? null; }
  queue(entity: string, operation: 'create' | 'update' | 'delete', tenantId: string, payload: unknown) { const id = randomUUID(); this.db.enqueue({ id, type: `${entity}:${operation}`, payload: JSON.stringify({ id, tenantId, version: 1, updated_at: new Date().toISOString(), payload }), attempts: 0, created_at: new Date().toISOString() }); return id; }
  resolveConflict(entity: string, local: unknown, server: unknown, strategy: 'server-wins' | 'client-wins' | 'manual-review') { const id = randomUUID(); this.db.conflict(id, entity, local, server, strategy); return strategy === 'server-wins' ? server : local; }
}
