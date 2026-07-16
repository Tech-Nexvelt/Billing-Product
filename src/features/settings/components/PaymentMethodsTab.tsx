import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Edit2, Trash2, CreditCard } from 'lucide-react';
import { paymentService } from '@/services/payment.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useAuthStore } from '@/stores/auth.store';
import { PaymentMethod } from '@/types/payment.types';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_FORM = {
  name: '',
  icon: 'credit-card',
  display_order: 0,
  is_active: true,
  supports_partial: true,
  supports_split: true,
  supports_refund: true,
};

export function PaymentMethodsTab() {
  const { restaurant } = useRestaurantStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!restaurant) return;
    const res = await paymentService.getMethods(restaurant.id);
    if (res.success && res.data) setMethods(res.data);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, display_order: methods.length });
    setDialogOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      name: m.name,
      icon: m.icon,
      display_order: m.display_order,
      is_active: m.is_active,
      supports_partial: m.supports_partial,
      supports_split: m.supports_split,
      supports_refund: m.supports_refund,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurant || !form.name.trim()) return;
    setSaving(true);
    let res;
    if (editing) {
      res = await paymentService.updateMethod(editing.id, form, editing.version);
    } else {
      res = await paymentService.createMethod(restaurant.id, form);
    }
    if (res.success) {
      await load();
      toast({ title: editing ? 'Payment method updated' : 'Payment method created' });
      setDialogOpen(false);
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const res = await paymentService.deleteMethod(deleteTarget.id, user.id);
    if (res.success) {
      await load();
      toast({ title: 'Payment method deleted' });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Payment Methods</h3>
          <p className="text-sm text-muted-foreground">Configure accepted payment types</p>
        </div>
        <Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>
          <CreditCard className="w-4 h-4 mr-2" />Add Method
        </Button>
      </div>

      {methods.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment methods"
          description="Add payment methods to start billing."
          action={<Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>Add Method</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {methods.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                        {m.supports_split && <span>Split</span>}
                        {m.supports_partial && <span>Partial</span>}
                        {m.supports_refund && <span>Refund</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Payment Method' : 'New Payment Method'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Method Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. UPI, Cash, Card" />
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input type="number" min="0" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-3">
              {[
                { key: 'supports_split', label: 'Supports Split Payment' },
                { key: 'supports_partial', label: 'Supports Partial Payment' },
                { key: 'supports_refund', label: 'Supports Refund' },
                { key: 'is_active', label: 'Active' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Payment Method" description={`Delete "${deleteTarget?.name}"?`} onConfirm={handleDelete} variant="destructive" />
    </div>
  );
}
