export type AvailabilityStatus = 'available' | 'out_of_stock' | 'hidden' | 'seasonal';

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
}
