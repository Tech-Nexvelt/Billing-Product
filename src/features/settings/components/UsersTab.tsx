import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  ShieldAlert, 
  Activity, 
  FileSpreadsheet, 
  RefreshCw, 
  Monitor, 
  AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  role_id: string | null;
  role?: Role | null;
  version: number;
  updated_at: string;
}

interface UserSession {
  id: string;
  session_id: string;
  browser: string;
  operating_system: string;
  device_type: string;
  ip_address: string;
  last_seen: string;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  
  // Lists
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selected user for editing
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Bulk Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [rollbackOnFailure, setRollbackOnFailure] = useState(true);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    if (!currentUser?.restaurant_id) return;
    loadData();
  }, [currentUser?.restaurant_id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, archivedRes, rolesRes, sessionsRes] = await Promise.all([
        supabase
          .from('users')
          .select('*, role:roles(*)')
          .eq('restaurant_id', currentUser!.restaurant_id)
          .is('deleted_at', null),
        supabase
          .from('users')
          .select('*, role:roles(*)')
          .eq('restaurant_id', currentUser!.restaurant_id)
          .not('deleted_at', 'is', null),
        supabase
          .from('roles')
          .select('id, name')
          .eq('restaurant_id', currentUser!.restaurant_id),
        supabase.rpc('get_active_sessions')
      ]);

      if (usersRes.data) setActiveUsers(usersRes.data);
      if (archivedRes.data) setArchivedUsers(archivedRes.data);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
    } catch (err) {
      console.error('Error loading users data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Centralized Error Mapping
  const mapBackendError = (code: string, fallback: string): string => {
    switch (code) {
      case 'AUTH_PERMISSION_DENIED':
        return 'Permission Denied: You do not have permission to manage staff.';
      case 'VERSION_CONFLICT':
        return 'Update Rejected: This staff record has been modified by another admin. Please refresh and try again.';
      case 'ROLE_NOT_ALLOWED':
        return 'Restricted Action: Modifying or creating Owner accounts is not permitted.';
      case 'USER_NOT_FOUND':
        return 'Staff profile could not be found.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a minute before creating more staff.';
      case 'EMAIL_EXISTS':
        return 'An active staff member is already registered with this email address.';
      default:
        return fallback;
    }
  };

  const handleOpenCreate = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setRoleId(roles.find(r => r.name !== 'Owner')?.id || roles[0]?.id || '');
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setFullName(user.full_name);
    setPhone(user.phone || '');
    setRoleId(user.role_id || '');
    setIsActive(user.is_active);
    setIsEditOpen(true);
  };

  // CREATE STAFF via Edge Function
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !roleId) return;

    setIsSubmitting(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email,
          password: password || undefined, // invitation onboarding fallback if empty
          fullName,
          phone: phone || null,
          roleId
        },
        headers: {
          'idempotency-key': idempotencyKey
        }
      });

      if (error || (data && !data.success)) {
        const errCode = data?.code || 'CREATE_FAILED';
        const errMsg = data?.message || error?.message || 'Failed to register account.';
        throw new Error(mapBackendError(errCode, errMsg));
      }

      toast({
        title: data?.code === 'INVITATION_SENT' ? 'Invitation Email Sent' : 'Staff Profile Created',
        description: data?.message || 'New staff profile registered successfully.',
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Registration failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPDATE STAFF via transaction-safe RPC
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !fullName || !roleId) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('update_staff', {
        p_user_id: selectedUser.id,
        p_full_name: fullName,
        p_phone: phone || null,
        p_role_id: roleId,
        p_is_active: isActive,
        p_version: selectedUser.version,
        p_metadata: {
          browser: navigator.userAgent,
          operating_system: navigator.platform
        }
      });

      if (error || (data && !data.success)) {
        const errCode = data?.code || 'UPDATE_FAILED';
        const errMsg = data?.message || error?.message || 'Failed to save changes.';
        throw new Error(mapBackendError(errCode, errMsg));
      }

      toast({ title: 'Profile Updated', description: 'Changes saved successfully.' });
      setIsEditOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to update user',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ARCHIVE STAFF via RPC (Soft delete + Revoke session)
  const handleArchiveUser = async (id: string) => {
    if (!confirm('Are you sure you want to archive this staff member? Historical records will remain intact but all active sessions will be revoked.')) return;

    try {
      const { data, error } = await supabase.rpc('archive_staff', {
        p_user_id: id,
        p_metadata: {
          browser: navigator.userAgent,
          operating_system: navigator.platform
        }
      });

      if (error || (data && !data.success)) {
        const errCode = data?.code || 'ARCHIVE_FAILED';
        const errMsg = data?.message || error?.message || 'Failed to archive user.';
        throw new Error(mapBackendError(errCode, errMsg));
      }

      toast({ title: 'Staff Archived', description: 'Profile archived and sessions revoked successfully.' });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to archive user',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // RESTORE STAFF via RPC
  const handleRestoreUser = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('restore_staff', {
        p_user_id: id,
        p_metadata: {
          browser: navigator.userAgent,
          operating_system: navigator.platform
        }
      });

      if (error || (data && !data.success)) {
        const errCode = data?.code || 'RESTORE_FAILED';
        const errMsg = data?.message || error?.message || 'Failed to restore user.';
        throw new Error(mapBackendError(errCode, errMsg));
      }

      toast({ title: 'Staff Restored', description: 'Profile reactivated successfully.' });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Failed to restore user',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // REVOKE ACTIVE SESSION
  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this active session? The device will be signed out immediately.')) return;

    try {
      const { error } = await supabase.rpc('revoke_user_session', {
        p_session_id: sessionId,
        p_reason: 'revoked_by_owner'
      });

      if (error) throw error;

      toast({ title: 'Session Revoked' });
      // Reload sessions list
      const sessionsRes = await supabase.rpc('get_active_sessions');
      if (sessionsRes.data) setSessions(sessionsRes.data);
    } catch (err: any) {
      toast({
        title: 'Revoke failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // BULK CSV STAFF IMPORT
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const rows: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(',').map(c => c.trim());
        const rowData: any = {};
        
        headers.forEach((h, index) => {
          rowData[h] = columns[index];
        });

        // Basic Validations
        if (!rowData.email || !rowData.name || !rowData.role) {
          errors.push(`Row ${i}: Missing required fields (email, name, or role)`);
        }
        rows.push(rowData);
      }

      setImportPreview(rows);
      setImportErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    if (importPreview.length === 0) return;
    setIsSubmitting(true);
    setImportProgress(1);

    let successCount = 0;
    let failedCount = 0;
    
    // Create Job Registry row
    const { data: jobData } = await supabase.rpc('create_batch_import_job', {
      p_job_type: 'bulk_import',
      p_total_rows: importPreview.length,
      p_rollback_on_failure: rollbackOnFailure
    });

    const jobId = jobData?.id;

    // Process chunk-by-chunk for progress bar UI
    for (let i = 0; i < importPreview.length; i++) {
      const staff = importPreview[i];
      const selectedRole = roles.find(r => r.name.toLowerCase() === staff.role.toLowerCase());
      
      if (!selectedRole) {
        failedCount++;
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke('create-staff-user', {
          body: {
            email: staff.email,
            password: staff.password || undefined,
            fullName: staff.name,
            phone: staff.phone || null,
            roleId: selectedRole.id
          },
          headers: {
            'idempotency-key': crypto.randomUUID()
          }
        });

        if (error || (data && !data.success)) {
          failedCount++;
          if (rollbackOnFailure) {
            throw new Error(data?.message || 'Import aborted.');
          }
        } else {
          successCount++;
        }
      } catch (err: any) {
        failedCount++;
        toast({
          title: 'Import Interrupted',
          description: err.message,
          variant: 'destructive',
        });
        if (rollbackOnFailure) break;
      }
      
      setImportProgress(Math.round(((i + 1) / importPreview.length) * 100));
    }

    // Update job status
    if (jobId) {
      await supabase
        .from('background_jobs')
        .update({
          status: failedCount === 0 ? 'completed' : (successCount > 0 ? 'completed_with_warnings' : 'failed'),
          processed_rows: successCount,
          failed_rows: failedCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }

    toast({
      title: 'Import process finished',
      description: `Successfully imported ${successCount} staff accounts. ${failedCount} failures.`
    });
    
    setIsImportOpen(false);
    setCsvFile(null);
    setImportPreview([]);
    setImportErrors([]);
    setImportProgress(0);
    loadData();
    setIsSubmitting(false);
  };

  // Filters & Search
  const filteredUsers = (currentTab === 'active' ? activeUsers : archivedUsers).filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === '' || u.role_id === roleFilter;
    return matchesSearch && matchesRole;
  });

  const isOwner = currentUser?.role?.name === 'Owner';

  // Stats Counters
  const totalActive = activeUsers.length;
  const totalArchived = archivedUsers.length;
  const managersCount = activeUsers.filter(u => u.role?.name === 'Manager').length;
  const cashiersCount = activeUsers.filter(u => u.role?.name === 'Cashier').length;
  const kitchenCount = activeUsers.filter(u => u.role?.name === 'Kitchen').length;
  const activeSessionsCount = sessions.length;

  if (!isOwner) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 flex flex-col items-center gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-600" />
        <h3 className="text-base font-bold">Access Restrained</h3>
        <p className="text-sm text-center">Only restaurant owners can view or manage staff accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Stats Dashboard Header */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Staff</span>
          <span className="text-xl font-extrabold text-slate-800">{totalActive}</span>
        </div>
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Archived Staff</span>
          <span className="text-xl font-extrabold text-slate-850">{totalArchived}</span>
        </div>
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Managers</span>
          <span className="text-xl font-extrabold text-primary">{managersCount}</span>
        </div>
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Cashiers</span>
          <span className="text-xl font-extrabold text-indigo-650">{cashiersCount}</span>
        </div>
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Kitchen Staff</span>
          <span className="text-xl font-extrabold text-slate-600">{kitchenCount}</span>
        </div>
        <div className="bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Sessions</span>
          <span className="text-xl font-extrabold text-[#0AB190]">{activeSessionsCount}</span>
        </div>
      </div>

      {/* 2. Controls & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2">
          <Button 
            variant={currentTab === 'active' ? 'default' : 'outline'} 
            onClick={() => setCurrentTab('active')}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Active Staff
          </Button>
          <Button 
            variant={currentTab === 'archived' ? 'default' : 'outline'} 
            onClick={() => setCurrentTab('archived')}
            className="h-8 text-xs font-bold rounded-lg"
          >
            Archived Staff
          </Button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={() => setIsSessionsOpen(true)} className="h-8 text-xs font-semibold rounded-lg">
            <Activity className="w-3.5 h-3.5 mr-1 text-[#0AB190]" /> Sessions
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="h-8 text-xs font-semibold rounded-lg">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Import CSV
          </Button>
          <Button onClick={handleOpenCreate} className="h-8 text-xs font-bold rounded-lg bg-primary hover:bg-primary/95 text-white">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Staff
          </Button>
        </div>
      </div>

      {/* 3. Advanced Filters Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border p-3 rounded-xl shadow-sm">
        <Input 
          placeholder="Search by name or phone..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 text-xs"
        />
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
        >
          <option value="">All Roles</option>
          {roles.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <Button variant="ghost" size="sm" onClick={loadData} className="h-9 text-xs justify-center hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh List
        </Button>
      </div>

      {/* 4. Table Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 bg-white border rounded-xl shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-xl shadow-sm">
          <p className="text-sm text-muted-foreground font-semibold">No staff members found matching criteria.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-muted-foreground font-semibold">
                <th className="p-4">Name</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((profile) => {
                const isTargetOwner = profile.role?.name === 'Owner';
                return (
                  <tr key={profile.id} className="border-b border-border hover:bg-slate-50/30 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{profile.full_name}</td>
                    <td className="p-4 text-muted-foreground">{profile.phone || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md font-bold ${
                        isTargetOwner ? 'bg-amber-100 text-amber-800' : 'bg-slate-150 text-slate-800'
                      }`}>
                        {profile.role?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4">
                      {profile.is_active ? (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">Active</span>
                      ) : (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md font-bold">Inactive</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-1">
                      {/* Owners cannot be modified or deleted/archived */}
                      {!isTargetOwner && (
                        <>
                          {currentTab === 'active' ? (
                            <>
                              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={() => handleOpenEdit(profile)}>
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-rose-500 hover:bg-rose-50 rounded-lg" onClick={() => handleArchiveUser(profile.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-lg border-emerald-500 text-emerald-600 hover:bg-emerald-55" onClick={() => handleRestoreUser(profile.id)}>
                              Restore
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* dialog forms */}
      
      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Staff Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Initial Password (Optional)</Label>
              <Input id="password" type="password" placeholder="Leave empty to send email invitation" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Assign Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
              >
                <option value="" disabled>Select role</option>
                {roles.filter(r => r.name !== 'Owner').map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {password ? 'Register Account' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Full Name</Label>
              <Input id="editName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editPhone">Phone Number</Label>
              <Input id="editPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editRole">Assign Role</Label>
              <select
                id="editRole"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
              >
                <option value="" disabled>Select role</option>
                {roles.filter(r => r.name !== 'Owner').map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-primary border-slate-350 rounded focus:ring-primary"
              />
              <Label htmlFor="isActive">Account Active & Enabled</Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Session Manager Dialog */}
      <Dialog open={isSessionsOpen} onOpenChange={setIsSessionsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Active Device Sessions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[350px] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active session registries found.</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="flex justify-between items-center border-b pb-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{s.users?.full_name || 'Staff Member'}</p>
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Monitor className="w-3 h-3 text-[#0AB190]" /> {s.browser} on {s.operating_system}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">IP: {s.ip_address || '127.0.0.1'} | Active: {new Date(s.last_seen).toLocaleString()}</p>
                  </div>
                  {/* Prevent self session revoking directly here */}
                  <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-7 text-[10px] font-bold rounded-lg" onClick={() => handleRevokeSession(s.id)}>
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSessionsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk CSV Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Staff CSV Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="border border-dashed p-4 rounded-xl text-center space-y-2">
              <input type="file" accept=".csv" id="csvFile" className="hidden" onChange={handleCsvChange} />
              <Label htmlFor="csvFile" className="cursor-pointer flex flex-col items-center justify-center text-xs gap-1 font-bold text-slate-500">
                <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-1" />
                {csvFile ? csvFile.name : 'Click to upload your .csv file'}
              </Label>
              <p className="text-[10px] text-slate-400">CSV must contain headers: name, email, role, phone, password</p>
            </div>

            {importErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-lg text-[10px] space-y-1">
                <p className="font-bold flex items-center"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Validation errors found:</p>
                <div className="max-h-[80px] overflow-y-auto">
                  {importErrors.map((err, i) => <p key={i}>• {err}</p>)}
                </div>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-800">Preview ({importPreview.length} records found):</p>
                <div className="border rounded-lg max-h-[120px] overflow-y-auto text-[10px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.role}</td>
                        </tr>
                      ))}
                      {importPreview.length > 3 && (
                        <tr>
                          <td colSpan={3} className="p-2 text-slate-400 italic">and {importPreview.length - 3} more rows...</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 text-xs">
              <input
                type="checkbox"
                id="rollback"
                checked={rollbackOnFailure}
                onChange={(e) => setRollbackOnFailure(e.target.checked)}
                className="w-4 h-4 text-primary border-slate-350 rounded focus:ring-primary"
              />
              <Label htmlFor="rollback">Rollback Entire Batch (Stop and abort on first row error)</Label>
            </div>

            {importProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-primary">
                  <span>Processing batch...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleProcessImport} disabled={isSubmitting || importPreview.length === 0 || importErrors.length > 0}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
