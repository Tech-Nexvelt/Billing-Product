export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'disabled';
export type TableType = 'dining' | 'vip' | 'outdoor' | 'family' | 'private';
export type TableShape = 'square' | 'rectangle' | 'circle';

export interface Table {
  id: string;
  restaurant_id: string;
  floor_id: string;
  table_number: string;
  capacity: number;
  customer_count: number | null;
  current_bill: number;
  table_type: TableType;
  table_shape: TableShape;
  status: TableStatus;
  position_x: number | null;
  position_y: number | null;
  qr_code: string | null;
  qr_url: string | null;
  display_order: number;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableWithOrder extends Table {
  currentOrder?: {
    id: string;
    created_at: string;
    status: string;
  };
}
