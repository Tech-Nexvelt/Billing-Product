export type AvailabilityStatus = 'available' | 'out_of_stock' | 'hidden' | 'seasonal';

export type SelectionType = 
  | 'single' 
  | 'multi' 
  | 'dropdown' 
  | 'quantity' 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'toggle' 
  | 'color' 
  | 'date' 
  | 'time'
  | 'slider'
  | 'rating';

export type PriceType = 'fixed' | 'delta' | 'percentage' | 'free' | 'market';

export interface Tag {
  id: string;
  restaurant_id: string | null;
  slug: string;
  label: string;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price_override?: number | null;
  cost_price?: number | null;
  stock_quantity?: number;
  prep_time_override?: number | null;
  kitchen_station_id?: string | null;
  is_active: boolean;
  display_order: number;
}

export interface ModifierOption {
  id: string;
  group_id: string;
  restaurant_id: string;
  name: string;
  price_type: PriceType;
  price_delta: number;
  is_default: boolean;
  max_quantity: number;
  display_order: number;
}

export interface ModifierDependency {
  id: string;
  target_group_id: string;
  target_option_id?: string | null;
  depends_on_group_id: string;
  depends_on_option_id?: string | null;
  condition_type: 'equals' | 'not_equals' | 'greater_than' | 'contains';
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'auto_select' | 'reset';
}

export interface ModifierGroup {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string | null;
  selection_type: SelectionType;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  is_template: boolean;
  display_order: number;
  options: ModifierOption[];
  dependencies?: ModifierDependency[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  cost_price: number | null;
  selling_price: number;
  image_url: string | null;
  image_medium_url: string | null;
  thumbnail_url: string | null;
  image_hash: string | null;
  image_size: number | null;
  mime_type: string | null;
  image_alt: string | null;
  is_veg: boolean;
  prep_time: number | null;
  availability_status: AvailabilityStatus;
  sku: string | null;
  barcode: string | null;
  display_order: number;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItemWithTags extends MenuItem {
  tags: Tag[];
  variants?: ProductVariant[];
  modifier_groups?: ModifierGroup[];
}

export type MenuItemWithVariantsAndModifiers = MenuItemWithTags;
