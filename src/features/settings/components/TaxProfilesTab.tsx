import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Plus, Edit2, Trash2, Star, Percent } from 'lucide-react';
import { taxService } from '@/services/tax.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useAuthStore } from '@/stores/auth.store';
import { TaxProfile, TaxType } from '@/types/tax.types';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_FORM = {
  name: '',
  tax_type: 'cgst_sgst' as TaxType,
  cgst: 2.5,
  sgst: 2.5,
  igst: 0,
  custom_rate: 0,
  is_inclusive: false,
  is_default: false,
};

export function TaxProfilesTab() {
  const { restaurant } = useRestaurantStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<TaxProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaxProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxProfile | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!restaurant) return;
    const res = await taxService.getAll(restaurant.id);
    if (res.success && res.data) setProfiles(res.data);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: TaxProfile) => {
    setEditing(p);
    setForm({
      name: p.name,
      tax_type: p.tax_type,
      cgst: p.cgst,
      sgst: p.sgst,
      igst: p.igst,
      custom_rate: p.custom_rate,
      is_inclusive: p.is_inclusive,
      is_default: p.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurant || !form.name.trim()) return;
    setSaving(true);
    let res;
    if (editing) {
      res = await taxService.update(editing.id, form, editing.version);
    } else {
      res = await taxService.create(restaurant.id, form);
    }
    if (res.success) {
      await load();
      toast({ title: editing ? 'Tax profile updated' : 'Tax profile created' });
      setDialogOpen(false);
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSetDefault = async (p: TaxProfile) => {
    if (!restaurant) return;
    await taxService.setDefault(p.id, restaurant.id);
    await load();
    toast({ title: 'Default tax profile updated' });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const res = await taxService.delete(deleteTarget.id, user.id, deleteTarget.version);
    if (res.success) {
      await load();
      toast({ title: 'Tax profile deleted' });
    }
    setDeleteTarget(null);
  };

  const totalRate = (p: TaxProfile) => {
    if (p.tax_type === 'cgst_sgst') return p.cgst + p.sgst;
    if (p.tax_type === 'igst') return p.igst;
    if (p.tax_type === 'custom') return p.custom_rate;
    return 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Tax Profiles</h3>
          <p className="text-sm text-muted-foreground">Configure tax rates for your menu items</p>
        </div>
        <Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />Add Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No tax profiles"
          description="Create a tax profile to assign to menu items."
          action={<Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>Add Profile</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {profiles.map((p) => (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0AB190]/10 flex items-center justify-center">
                      <Percent className="w-5 h-5 text-[#0AB190]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        {p.is_default && <Badge className="bg-[#0AB190]/10 text-[#0AB190] border-[#0AB190]/20">Default</Badge>}
                        <Badge variant="outline" className="text-xs">{p.tax_type.replace('_', ' ').toUpperCase()}</Badge>
                        {p.is_inclusive && <Badge variant="secondary" className="text-xs">Inclusive</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {p.tax_type === 'cgst_sgst' && `CGST ${p.cgst}% + SGST ${p.sgst}%`}
                        {p.tax_type === 'igst' && `IGST ${p.igst}%`}
                        {p.tax_type === 'custom' && `Custom ${p.custom_rate}%`}
                        {p.tax_type === 'none' && 'No Tax'}
                        {' '}= <strong>{totalRate(p)}% total</strong>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.is_default && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(p)}>
                        <Star className="w-3 h-3 mr-1" />Set Default
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(p)}>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Tax Profile' : 'New Tax Profile'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Profile Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GST 5%" />
            </div>
            <div className="space-y-1.5">
              <Label>Tax Type</Label>
              <Select value={form.tax_type} onValueChange={(v) => setForm({ ...form, tax_type: v as TaxType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cgst_sgst">CGST + SGST</SelectItem>
                  <SelectItem value="igst">IGST</SelectItem>
                  <SelectItem value="custom">Custom Rate</SelectItem>
                  <SelectItem value="none">No Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tax_type === 'cgst_sgst' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CGST (%)</Label>
                  <Input type="number" step="0.25" min="0" max="50" value={form.cgst} onChange={(e) => setForm({ ...form, cgst: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>SGST (%)</Label>
                  <Input type="number" step="0.25" min="0" max="50" value={form.sgst} onChange={(e) => setForm({ ...form, sgst: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            {form.tax_type === 'igst' && (
              <div className="space-y-1.5">
                <Label>IGST (%)</Label>
                <Input type="number" step="0.25" min="0" max="100" value={form.igst} onChange={(e) => setForm({ ...form, igst: parseFloat(e.target.value) || 0 })} />
              </div>
            )}
            {form.tax_type === 'custom' && (
              <div className="space-y-1.5">
                <Label>Custom Rate (%)</Label>
                <Input type="number" step="0.25" min="0" max="100" value={form.custom_rate} onChange={(e) => setForm({ ...form, custom_rate: parseFloat(e.target.value) || 0 })} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Tax Inclusive</Label>
              <Switch checked={form.is_inclusive} onCheckedChange={(v) => setForm({ ...form, is_inclusive: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Set as Default</Label>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
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

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Tax Profile" description={`Delete "${deleteTarget?.name}"? This may affect menu items using this profile.`} onConfirm={handleDelete} variant="destructive" />
    </div>
  );
}
