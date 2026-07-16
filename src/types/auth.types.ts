import type { Session } from '@supabase/supabase-js';

export interface User {
  id: string;
  restaurant_id: string;
  role_id: string | null;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  role?: {
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    is_system: boolean;
  } | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export { Session };
