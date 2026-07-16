export type ConnectionType = 'usb' | 'bluetooth' | 'network' | 'browser';
export type PaperSize = '58mm' | '80mm';
export type PrinterStatus = 'online' | 'offline' | 'error' | 'unknown';
export type PrintTemplate = 'kitchen' | 'customer' | 'restaurant';
export type PrintJobType = 'kot' | 'customer_receipt' | 'restaurant_receipt' | 'test';
export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';

export interface Printer {
  id: string;
  restaurant_id: string;
  name: string;
  connection_type: ConnectionType;
  ip_address: string | null;
  port: number | null;
  paper_size: PaperSize;
  dpi: number;
  characters_per_line: number;
  auto_cut: boolean;
  cash_drawer: boolean;
  copies: number;
  encoding: string;
  default_template: PrintTemplate;
  printer_status: PrinterStatus;
  is_default_billing: boolean;
  is_default_kitchen: boolean;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrinterJob {
  id: string;
  printer_id: string;
  restaurant_id: string;
  order_id: string | null;
  job_type: PrintJobType;
  payload: Record<string, unknown>;
  status: PrintJobStatus;
  copies: number;
  retry_count: number;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
