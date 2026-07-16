export type CustomerType = 'vip' | 'regular' | 'corporate' | 'blocked';

export interface Customer {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  address: string | null;
  notes: string | null;
  dob: string | null;
  anniversary: string | null;
  food_preferences: string | null;
  allergies: string | null;
  customer_type: CustomerType;
  tags: string[];
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithHistory extends Customer {
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  last_visit: string | null;
}
