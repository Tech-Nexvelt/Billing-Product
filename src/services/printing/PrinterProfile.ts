export type PaperWidth = '80mm' | '58mm';
export type PrinterConnectionType = 'browser' | 'network' | 'usb' | 'bluetooth';

export interface PrinterProfile {
  id: string;
  name: string;
  paperWidth: PaperWidth;
  printableWidthMm: number;    // 74mm for 80mm, 52mm for 58mm
  charPerLine: number;         // 42 chars for 80mm, 32 chars for 58mm
  dpi: number;                  // 203 DPI standard
  thermalDensity: 'normal' | 'dark' | 'high-contrast';
  fontFamily: string;
  hasCutter: boolean;
  hasCashDrawer: boolean;
  connectionType: PrinterConnectionType;
  ipAddress?: string;
  port?: number;
}

export const DEFAULT_80MM_PROFILE: PrinterProfile = {
  id: 'profile-80mm',
  name: 'Standard 80mm Thermal Printer',
  paperWidth: '80mm',
  printableWidthMm: 74,
  charPerLine: 42,
  dpi: 203,
  thermalDensity: 'high-contrast',
  fontFamily: "'Courier New', Courier, monospace",
  hasCutter: true,
  hasCashDrawer: true,
  connectionType: 'browser'
};

export const DEFAULT_58MM_PROFILE: PrinterProfile = {
  id: 'profile-58mm',
  name: 'Compact 58mm Mobile Thermal Printer',
  paperWidth: '58mm',
  printableWidthMm: 52,
  charPerLine: 32,
  dpi: 203,
  thermalDensity: 'high-contrast',
  fontFamily: "'Courier New', Courier, monospace",
  hasCutter: false,
  hasCashDrawer: false,
  connectionType: 'browser'
};

export function getProfileForWidth(paperSize: PaperWidth = '80mm'): PrinterProfile {
  return paperSize === '58mm' ? DEFAULT_58MM_PROFILE : DEFAULT_80MM_PROFILE;
}
