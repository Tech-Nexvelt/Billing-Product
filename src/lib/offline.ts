export type SyncStatus = 'queued' | 'syncing' | 'synced' | 'failed';

export interface OfflineOperation {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: number;
  retry_count: number;
  last_retry: number | null;
  sync_status: SyncStatus;
  sync_error: string | null;
}

const DB_NAME = 'nexvelt_offline';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const MAX_RETRIES = 5;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sync_status', 'sync_status');
        store.createIndex('created_at', 'created_at');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOperation(type: string, payload: Record<string, unknown>): Promise<string> {
  const db = await openDb();
  const id = crypto.randomUUID();
  const op: OfflineOperation = {
    id,
    type,
    payload,
    created_at: Date.now(),
    retry_count: 0,
    last_retry: null,
    sync_status: 'queued',
    sync_error: null,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(op);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOperations(): Promise<OfflineOperation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('sync_status').getAll('queued');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function markSynced(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const op = req.result as OfflineOperation;
      if (op) store.put({ ...op, sync_status: 'synced' });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const op = req.result as OfflineOperation;
      if (!op) return;
      const updated: OfflineOperation = {
        ...op,
        retry_count: op.retry_count + 1,
        last_retry: Date.now(),
        sync_status: op.retry_count + 1 >= MAX_RETRIES ? 'failed' : 'queued',
        sync_error: error,
      };
      store.put(updated);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueLength(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('sync_status').count(IDBKeyRange.only('queued'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSynced(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.index('sync_status').openCursor(IDBKeyRange.only('synced'));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
