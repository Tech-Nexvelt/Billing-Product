export type PrinterRole = 'billing' | 'kitchen' | 'label' | 'customer';
export type PrintRequest = { html: string; role?: PrinterRole; deviceName?: string; silent?: boolean; copies?: number };
export type DesktopResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
