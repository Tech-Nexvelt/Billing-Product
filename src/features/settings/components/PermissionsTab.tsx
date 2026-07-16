import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  name: string;
}

interface Permission {
  id: string;
  role_id: string;
  module: 'menu' | 'tables' | 'orders' | 'floors' | 'settings' | 'roles' | 'dashboard';
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export function PermissionsTab() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const modules: Permission['module'][] = ['menu', 'tables', 'orders', 'floors', 'settings', 'roles', 'dashboard'];

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadRoles();
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (selectedRoleId) {
      loadPermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .eq('restaurant_id', user!.restaurant_id)
        .is('deleted_at', null);

      if (error) throw error;
      if (data) {
        setRoles(data);
        if (data.length > 0) {
          setSelectedRoleId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadPermissions = async (roleId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('role_id', roleId);

      if (error) throw error;

      // Seed mock local permissions if none exist in DB for this role yet
      const mapped: Permission[] = modules.map((mod) => {
        const existing = data?.find((p) => p.module === mod);
        return {
          id: existing?.id || '',
          role_id: roleId,
          module: mod,
          can_view: existing?.can_view || false,
          can_create: existing?.can_create || false,
          can_update: existing?.can_update || false,
          can_delete: existing?.can_delete || false,
        };
      });

      setPermissions(mapped);
    } catch (err) {
      console.error('Error loading permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (moduleName: Permission['module'], action: 'can_view' | 'can_create' | 'can_update' | 'can_delete') => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.module === moduleName ? { ...p, [action]: !p[action] } : p
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upserts = permissions.map((p) => {
        const item: any = {
          role_id: p.role_id,
          restaurant_id: user!.restaurant_id,
          module: p.module,
          can_view: p.can_view,
          can_create: p.can_create,
          can_update: p.can_update,
          can_delete: p.can_delete,
        };
        if (p.id) item.id = p.id;
        return item;
      });

      const { error } = await supabase
        .from('permissions')
        .upsert(upserts, { onConflict: 'role_id,module' });

      if (error) throw error;

      toast({ title: 'Permissions saved successfully' });
      loadPermissions(selectedRoleId);
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = user?.role?.name === 'Owner';

  if (!isOwner) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 flex flex-col items-center gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-600" />
        <h3 className="text-base font-bold">Access Restrained</h3>
        <p className="text-sm text-center">Only restaurant owners can edit staff access permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold">Access Control Matrix</h3>
          <p className="text-xs text-muted-foreground">Modify module access parameters per role</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>Role: {r.name}</option>
            ))}
          </select>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/95 text-white font-bold h-9" disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Permissions
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-muted-foreground font-semibold">
                <th className="p-4">Module Name</th>
                <th className="p-4 text-center">View</th>
                <th className="p-4 text-center">Create</th>
                <th className="p-4 text-center">Update</th>
                <th className="p-4 text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.module} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-800 uppercase tracking-wide">{p.module}</td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={p.can_view}
                      onChange={() => handlePermissionToggle(p.module, 'can_view')}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={p.can_create}
                      onChange={() => handlePermissionToggle(p.module, 'can_create')}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={p.can_update}
                      onChange={() => handlePermissionToggle(p.module, 'can_update')}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={p.can_delete}
                      onChange={() => handlePermissionToggle(p.module, 'can_delete')}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
