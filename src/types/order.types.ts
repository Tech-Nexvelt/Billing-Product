export type OrderStatus = 'draft' | 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string;
  floor_id: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  special_instructions: string | null;
  kitchen_notes: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  restaurant_id: string;
  item_name: string;
  category_name: string | null;
  unit_price: number;
  quantity: number;
  item_total: number;
  special_notes: string | null;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem {
  db_id?: string;          // DB order_item.id — set after INSERT, used for targeted UPDATE/DELETE
  menu_item_id: string;
  item_name: string;
  category_name: string | null;
  unit_price: number;
  quantity: number;
  item_total: number;
  special_notes?: string;
  image_url?: string;
  is_veg?: boolean;
}
