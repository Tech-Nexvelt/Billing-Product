import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class ManagerAuthorizationService {
  async authorize(email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Create isolated client that does not persist session
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Authentication failed' };
      }

      // Check if user is manager or owner
      const { data: userProfile, error: profileErr } = await authClient
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role_id,
          role:roles (
            name
          )
        `)
        .eq('id', data.user.id)
        .single();

      if (profileErr || !userProfile) {
        return { success: false, error: 'Could not fetch user profile details.' };
      }

      const roleName = (userProfile.role as any)?.name;
      if (roleName !== 'Owner' && roleName !== 'Manager') {
        return { success: false, error: 'Access denied: Only Managers or Owners can authorize this override.' };
      }

      return { success: true, user: userProfile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authorization error' };
    }
  }
}

export const managerAuthService = new ManagerAuthorizationService();
