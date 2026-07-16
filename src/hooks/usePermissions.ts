import { useAuthStore } from '@/stores/auth.store';
import { PermissionModule, PermissionAction } from '@/constants/permissions';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

interface DBPermission {
  module: PermissionModule;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export function usePermissions() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<DBPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.role_id) {
      setIsLoading(false);
      return;
    }

    async function fetchPermissions() {
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('module, can_view, can_create, can_update, can_delete')
          .eq('role_id', user!.role_id);

        if (error) throw error;
        setPermissions(data as DBPermission[]);
      } catch (err) {
        console.error('Error fetching permissions:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, [user?.role_id]);

  const hasPermission = (module: PermissionModule, action: PermissionAction): boolean => {
    if (!user) return false;
    
    const perm = permissions.find((p) => p.module === module);
    if (!perm) return false;

    switch (action) {
      case 'view':
        return perm.can_view;
      case 'create':
        return perm.can_create;
      case 'update':
        return perm.can_update;
      case 'delete':
        return perm.can_delete;
      default:
        return false;
    }
  };

  return {
    hasPermission,
    isLoading,
  };
}
