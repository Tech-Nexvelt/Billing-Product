export type ReceiptType = 'kot' | 'customer' | 'restaurant';

export interface KotReceiptData {
  restaurant_name: string;
  order_number: string;
  token_number: number;
  table_number: string;
  floor_name: string;
  date: string;
  time: string;
  cashier_name: string;
  items: KotItem[];
  is_reprint: boolean;
  kitchen_notes: string | null;
}

export interface KotItem {
  name: string;
  quantity: number;
  selected_variant_text?: string | null;
  special_notes: string | null;
}

export interface BillReceiptData {
  restaurant_name: string;
  restaurant_logo_url: string | null;
  restaurant_address: string | null;
  restaurant_phone: string | null;
  restaurant_email: string | null;
  gst_number: string | null;
  bill_number: string;
  invoice_number: string;
  order_number: string;
  date: string;
  time: string;
  cashier_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gst: string | null;
  table_number: string;
  floor_name: string;
  items: BillItem[];
  subtotal: number;
  discount_type: string | null;
  discount_rate: number | null;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  payments: BillPayment[];
  footer_message: string;
  currency_symbol: string;
  internal_notes?: string | null;
  is_reprint?: boolean;
}

export interface BillItem {
  name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  selected_variant_text?: string | null;
  special_notes: string | null;
}

export interface BillPayment {
  method: string;
  amount: number;
}
