import Store from 'electron-store';
import { createHash } from 'node:crypto';
import os from 'node:os';
export class LicenseService {
    store = new Store();
    fingerprint() { return createHash('sha256').update(`${os.hostname()}-${os.platform()}-${os.arch()}`).digest('hex'); }
    activate(license) { const value = { ...license, machine: this.fingerprint() }; this.store.set('license', value); return value; }
    status() { const license = this.store.get('license'); return { active: !!license && license.machine === this.fingerprint() && (!license.expiresAt || new Date(license.expiresAt) > new Date()), license }; }
}
