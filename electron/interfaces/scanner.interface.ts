export type ScanEvent = { value: string; symbology: 'barcode' | 'qr' | 'datamatrix' | 'pdf417'; timestamp: string };
export interface ScannerAdapter { start(): void; stop(): void; onScan(listener: (event: ScanEvent) => void): () => void; }
