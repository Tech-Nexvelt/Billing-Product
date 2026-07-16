export interface Restaurant {
  id: string;
  organization_id: string;
  restaurant_code: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  currency: string;
  timezone: string;
  business_type: string | null;
  is_active: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantSettings {
  id: string;
  restaurant_id: string;
  tax_rate: number;
  service_charge: number;
  num_floors: number;
  num_tables: number;
  currency_symbol: string;
  decimal_places: number;
  date_format: string;
  time_format: string;
  language: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessType {
  slug: string;
  label: string;
}
