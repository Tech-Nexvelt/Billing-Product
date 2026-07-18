import Store from 'electron-store';
export class HardwareService {
    store = new Store({ defaults: { printers: {} } });
    route(role) { return (this.store.get('printers')[role] ?? []).filter((item) => item.enabled).sort((a, b) => a.priority - b.priority); }
    configure(role, devices) { this.store.set(`printers.${role}`, devices); }
}
