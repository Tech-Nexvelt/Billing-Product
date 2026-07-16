export interface Floor {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}
