export type FeatureKey = 
  | 'inventory'
  | 'crm'
  | 'analytics'
  | 'qr_ordering'
  | 'multi_branch'
  | 'kds'
  | 'reports'
  | 'printer'
  | 'customers';

export interface FeatureFlag {
  id: string;
  restaurant_id: string;
  feature_key: FeatureKey | string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptCustomization {
  id: string;
  restaurant_id: string;
  show_logo: boolean;
  header_text: string | null;
  footer_text: string | null;
  thank_you_message: string;
  terms_and_conditions: string | null;
  receipt_width: '58mm' | '80mm';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  font_size: 'small' | 'medium' | 'large';
  show_qr_code: boolean;
  show_order_number: boolean;
  show_table_number: boolean;
  show_cashier_name: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReceiptNumberRule {
  id: string;
  restaurant_id: string;
  rule_type: 'bill' | 'invoice' | 'kot';
  prefix: string;
  starting_number: number;
  current_number: number;
  reset_frequency: 'daily' | 'monthly' | 'yearly' | 'never';
  last_reset_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscountRoleLimit {
  id: string;
  restaurant_id: string;
  role_id: string;
  max_discount_percentage: number;
  requires_approval_above: number;
  created_at: string;
  updated_at: string;
}
