export {};

declare global {
  interface Window {
    desktop?: {
      printer: { list: () => Promise<Electron.PrinterInfo[]>; printHtml: (html: string, options?: { deviceName?: string; silent?: boolean }) => Promise<void> };
      cache: { get: <T>(key: string) => Promise<T | null>; set: (key: string, value: unknown) => Promise<void> };
      sync: { queue: (type: string, payload: unknown) => Promise<void>; status: (listener: (status: { online: boolean }) => void) => void };
      offline: { get: <T>(entity: string, tenantId: string) => Promise<T | null>; set: (entity: string, tenantId: string, data: unknown) => Promise<void>; queue: (entity: string, operation: 'create' | 'update' | 'delete', tenantId: string, payload: unknown) => Promise<string>; stats: () => Promise<Array<{ status: string; count: number }>> };
      backup: { export: () => Promise<string | null> };
      updater: { check: () => Promise<void> };
      app: { version: () => Promise<string> };
      network: { check: () => Promise<boolean> };
      clipboard: { copy: (text: string) => Promise<void>; paste: () => Promise<string> };
      dialog: { show: (message: string, type?: 'info' | 'error') => Promise<void> };
      filesystem: { save: (name: string, data: string) => Promise<string | null>; open: (extensions: string[]) => Promise<string | null> };
      notification: { show: (title: string, message: string) => Promise<void> };
      scanner: { input: (value: string) => void; onScan: (listener: (event: unknown) => void) => void };
    };
  }
}
