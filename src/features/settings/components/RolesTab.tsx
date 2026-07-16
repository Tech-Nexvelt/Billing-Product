import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
}

export function RolesTab() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog configurations
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadRolesData();
  }, [user?.restaurant_id]);

  const loadRolesData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('restaurant_id', user!.restaurant_id)
        .is('deleted_at', null);

      if (error) throw error;
      if (data) setRoles(data);
    } catch (err) {
      console.error('Error loading roles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedRole(null);
    setName('');
    setDescription('');
    setIsOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setSelectedRole(role);
    setName(role.name);
    setDescription(role.description || '');
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            name,
            description: description || null,
          })
          .eq('id', selectedRole.id);

        if (error) throw error;
        toast({ title: 'Role updated successfully' });
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({
            restaurant_id: user!.restaurant_id,
            name,
            description: description || null,
          });

        if (error) throw error;
        toast({ title: 'Role created successfully' });
      }
      setIsOpen(false);
      loadRolesData();
    } catch (err: any) {
      toast({
        title: 'Error saving role',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('roles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Role deleted' });
      loadRolesData();
    } catch (err: any) {
      toast({
        title: 'Error deleting role',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const isOwner = user?.role?.name === 'Owner';

  if (!isOwner) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 flex flex-col items-center gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-600" />
        <h3 className="text-base font-bold">Access Restrained</h3>
        <p className="text-sm text-center">Only restaurant owners can view or manage operational roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold">Roles List</h3>
          <p className="text-xs text-muted-foreground">Manage user roles for restaurant control</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/95 text-white font-bold h-9">
          <Plus className="w-4 h-4 mr-2" /> Add Role
        </Button>
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
                <th className="p-4">Role Name</th>
                <th className="p-4">Description</th>
                <th className="p-4">System Role</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-semibold text-slate-800">{role.name}</td>
                  <td className="p-4 text-muted-foreground">{role.description || 'No description.'}</td>
                  <td className="p-4">
                    {role.is_system ? (
                      <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">System Default</span>
                    ) : (
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-bold">Custom</span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleOpenEdit(role)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!role.is_system && (
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRole ? 'Edit Role' : 'Create Custom Role'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={selectedRole?.is_system}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roleDesc">Description</Label>
              <Input id="roleDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
