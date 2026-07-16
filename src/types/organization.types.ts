export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}
