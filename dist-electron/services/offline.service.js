import { randomUUID } from 'node:crypto';
export class OfflineService {
    db;
    constructor(db) {
        this.db = db;
    }
    cache(entity, tenantId, data) { this.db.cacheSet(`${tenantId}:${entity}`, { data, updated_at: new Date().toISOString() }); }
    cached(entity, tenantId) { const value = this.db.cacheGet(`${tenantId}:${entity}`); return value?.data ?? null; }
    queue(entity, operation, tenantId, payload) { const id = randomUUID(); this.db.enqueue({ id, type: `${entity}:${operation}`, payload: JSON.stringify({ id, tenantId, version: 1, updated_at: new Date().toISOString(), payload }), attempts: 0, created_at: new Date().toISOString() }); return id; }
    resolveConflict(entity, local, server, strategy) { const id = randomUUID(); this.db.conflict(id, entity, local, server, strategy); return strategy === 'server-wins' ? server : local; }
}
