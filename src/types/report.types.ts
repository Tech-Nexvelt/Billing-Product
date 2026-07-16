export interface SalesSummary {
  total_orders: number;
  total_revenue: number;
  total_tax: number;
  total_discounts: number;
  average_order_value: number;
  period: string;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
  tax: number;
  discounts: number;
}

export interface HourlySalesData {
  hour: number;
  revenue: number;
  orders: number;
}

export interface TopMenuItem {
  menu_item_id: string;
  name: string;
  category_name: string;
  quantity_sold: number;
  revenue: number;
  image_url?: string;
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface KitchenPerformanceData {
  average_prep_time_minutes: number;
  orders_completed: number;
  orders_on_time: number;
  orders_delayed: number;
}

export interface CashierPerformance {
  user_id: string;
  cashier_name: string;
  orders_handled: number;
  total_billed: number;
  average_billing_time_minutes: number;
}

export type ReportPeriod = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';
