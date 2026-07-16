import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { User } from '@/types/auth.types';
import { LoginInput } from '@/schemas/auth.schema';

export class AuthService extends BaseService {
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return this.createClientError(sessionError.message, 'UNAUTHORIZED');
    if (!session?.user) return this.createClientError('No active session', 'UNAUTHORIZED');

    return this.handleCall(
      supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
    );
  }

  async login(input: LoginInput): Promise<ApiResponse<{ user: User; session: any }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) return this.createClientError(error.message, 'UNAUTHORIZED');
      if (!data.user) return this.createClientError('User not found', 'NOT_FOUND');

      const profileRes = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileRes.error) {
        return this.createClientError(profileRes.error.message, 'NOT_FOUND');
      }

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: profileRes.data as User,
          session: data.session,
        },
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Login failed');
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    const { error } = await supabase.auth.signOut();
    if (error) return this.createClientError(error.message);
    return { success: true, message: 'Logged out successfully', data: null, error: null };
  }
}

export const authService = new AuthService();
