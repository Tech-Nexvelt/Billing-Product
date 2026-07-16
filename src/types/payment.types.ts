export type PaymentStatus = 'success' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
export type RefundStatus = 'pending' | 'completed' | 'failed';
export type PaymentOrderStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface PaymentMethod {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  icon: string;
  is_active: boolean;
  supports_partial: boolean;
  supports_split: boolean;
  supports_refund: boolean;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  restaurant_id: string;
  order_id: string;
  payment_method_id: string | null;
  payment_method_name: string;
  amount: number;
  status: PaymentStatus;
  transaction_reference: string | null;
  refund_amount: number | null;
  refund_method: string | null;
  refund_status: RefundStatus | null;
  refund_reason: string | null;
  refund_notes: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
  refund_approved_by: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SplitPaymentEntry {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
}

export interface ProcessPaymentInput {
  order_id: string;
  splits: SplitPaymentEntry[];
  total_amount: number;
}

export interface RefundInput {
  payment_id: string;
  refund_amount: number;
  refund_method: string;
  refund_reason: string;
  refund_notes?: string;
  approved_by?: string;
}
