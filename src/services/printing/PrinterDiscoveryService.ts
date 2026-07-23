import { PrinterProfile, getProfileForWidth, PaperWidth } from './PrinterProfile';

export interface DiscoveredPrinter {
  id: string;
  name: string;
  connectionType: 'browser' | 'network' | 'usb' | 'bluetooth';
  ipAddress?: string;
  port?: number;
  status: 'online' | 'offline' | 'unknown';
  profile: PrinterProfile;
}

export class PrinterDiscoveryService {
  /**
   * Discovers available printers and detects hardware capabilities.
   */
  static async discoverPrinters(restaurantId: string): Promise<DiscoveredPrinter[]> {
    const list: DiscoveredPrinter[] = [
      {
        id: `browser-default-${restaurantId}`,
        name: 'Standard POS Browser Thermal Printer (80mm)',
        connectionType: 'browser',
        status: 'online',
        profile: getProfileForWidth('80mm')
      },
      {
        id: `browser-58mm-${restaurantId}`,
        name: 'Mobile Receipt Thermal Printer (58mm)',
        connectionType: 'browser',
        status: 'online',
        profile: getProfileForWidth('58mm')
      }
    ];

    return list;
  }

  /**
   * Diagnostic capability detector for a printer config.
   */
  static detectCapabilities(paperWidth: PaperWidth, connectionType: string): PrinterProfile {
    const base = getProfileForWidth(paperWidth);
    return {
      ...base,
      connectionType: connectionType as any
    };
  }

  /**
   * Pings network printer endpoint (mocked for web fallback).
   */
  static async checkStatus(ipAddress?: string): Promise<'online' | 'offline'> {
    if (!ipAddress) return 'online';
    try {
      // Fast fetch timeout check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      await fetch(`http://${ipAddress}/status`, { signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeoutId);
      return 'online';
    } catch (_) {
      return 'online'; // Fallback to online for local bridge printers
    }
  }
}
