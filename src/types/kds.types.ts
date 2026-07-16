import type { OrderItem } from './order.types';

export type KdsStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type KdsPriority = 'normal' | 'rush' | 'vip';

export interface KdsOrder {
  id: string;
  restaurant_id: string;
  table_id: string;
  floor_id: string;
  status: KdsStatus;
  kitchen_notes: string | null;
  special_instructions: string | null;
  priority: KdsPriority;
  chef_name: string | null;
  bill_number: string | null;
  created_at: string;
  updated_at: string;
  table_number?: string;
  floor_name?: string;
  items: OrderItem[];
  version: number;
}

export interface KdsColumn {
  status: KdsStatus;
  label: string;
  color: string;
  orders: KdsOrder[];
}
