import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Users, Plus, Search, Phone, Mail, Star, Building2, Ban, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { customerService } from '@/services/customer.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useAuthStore } from '@/stores/auth.store';
import { Customer, CustomerType } from '@/types/customer.types';
import { useToast } from '@/hooks/use-toast';

const CUSTOMER_TYPE_CONFIG: Record<CustomerType, { label: string; icon: any; className: string }> = {
  vip: { label: 'VIP', icon: Star, className: 'bg-amber-100 text-amber-800 border-amber-300' },
  regular: { label: 'Regular', icon: Users, className: 'bg-blue-100 text-blue-800 border-blue-300' },
  corporate: { label: 'Corporate', icon: Building2, className: 'bg-purple-100 text-purple-800 border-purple-300' },
  blocked: { label: 'Blocked', icon: Ban, className: 'bg-red-100 text-red-800 border-red-300' },
};

const DEFAULT_FORM: Omit<Customer, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'deleted_by' | 'created_at' | 'updated_at'> = {
  name: '',
  phone: null,
  email: null,
  gst_number: null,
  address: null,
  notes: null,
  dob: null,
  anniversary: null,
  food_preferences: null,
  allergies: null,
  customer_type: 'regular',
  tags: [],
};

export function CustomersPage() {
  const { restaurant } = useRestaurantStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = async (q?: string) => {
    if (!restaurant) return;
    setIsLoading(true);
    const res = await customerService.getAll(restaurant.id, q);
    if (res.success && res.data) setCustomers(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      gst_number: c.gst_number,
      address: c.address,
      notes: c.notes,
      dob: c.dob,
      anniversary: c.anniversary,
      food_preferences: c.food_preferences,
      allergies: c.allergies,
      customer_type: c.customer_type,
      tags: c.tags,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurant || !form.name.trim()) return;
    setSaving(true);
    if (editingCustomer) {
      const res = await customerService.update(editingCustomer.id, form, editingCustomer.version);
      if (res.success && res.data) {
        setCustomers((prev) => prev.map((c) => c.id === res.data!.id ? res.data! : c));
        toast({ title: 'Customer updated' });
      } else {
        toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
      }
    } else {
      const res = await customerService.create(restaurant.id, form);
      if (res.success && res.data) {
        setCustomers((prev) => [res.data!, ...prev]);
        toast({ title: 'Customer created' });
      } else {
        toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
      }
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const res = await customerService.delete(deleteTarget.id, user.id, deleteTarget.version);
    if (res.success) {
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast({ title: 'Customer deleted' });
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customer database and history"
        actions={
          <Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Search by name, phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your first customer to start tracking purchase history."
          action={<Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Customer</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => {
            const typeConfig = CUSTOMER_TYPE_CONFIG[customer.customer_type];
            const TypeIcon = typeConfig.icon;
            return (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{customer.name}</h3>
                      <Badge variant="outline" className={cn('mt-1 text-xs', typeConfig.className)}>
                        <TypeIcon className="w-3 h-3 mr-1" />{typeConfig.label}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(customer)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(customer)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {customer.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{customer.phone}</div>}
                    {customer.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{customer.email}</div>}
                    {customer.gst_number && <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />{customer.gst_number}</div>}
                  </div>

                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  {customer.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">{customer.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} placeholder="+91XXXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || null })} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Customer Type</Label>
                <Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v as CustomerType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gst_number ?? ''} onChange={(e) => setForm({ ...form, gst_number: e.target.value || null })} placeholder="27AABCS1429B1ZB" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Textarea value={form.address ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, address: e.target.value || null })} rows={2} placeholder="Address" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.dob ?? ''} onChange={(e) => setForm({ ...form, dob: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Anniversary</Label>
                <Input type="date" value={form.anniversary ?? ''} onChange={(e) => setForm({ ...form, anniversary: e.target.value || null })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Food Preferences</Label>
                <Input value={form.food_preferences ?? ''} onChange={(e) => setForm({ ...form, food_preferences: e.target.value || null })} placeholder="Vegetarian, No onion..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Allergies</Label>
                <Input value={form.allergies ?? ''} onChange={(e) => setForm({ ...form, allergies: e.target.value || null })} placeholder="Peanuts, Gluten..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, notes: e.target.value || null })} rows={2} placeholder="Internal notes..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Customer"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
