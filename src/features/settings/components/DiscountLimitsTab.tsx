import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { settingsService } from '@/services/settings.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useToast } from '@/hooks/use-toast';
import { DiscountRoleLimit } from '@/types/settings.types';
import { Loader2, ShieldAlert } from 'lucide-react';

export function DiscountLimitsTab() {
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [limits, setLimits] = useState<(DiscountRoleLimit & { roles?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { max: number; approval: number }>>({});

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const res = await settingsService.getDiscountLimits(restaurant.id);
    if (res.success && res.data) {
      setLimits(res.data as any);
      const initial: Record<string, { max: number; approval: number }> = {};
      res.data.forEach((l: any) => {
        initial[l.role_id] = {
          max: Number(l.max_discount_percentage) || 0,
          approval: Number(l.requires_approval_above) || 0,
        };
      });
      setEdits(initial);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const handleSave = async (limit: any) => {
    if (!restaurant) return;
    const edit = edits[limit.role_id];
    if (!edit) return;
    setSaving(limit.role_id);
    const res = await settingsService.upsertDiscountLimit(restaurant.id, limit.role_id, edit.max, edit.approval);
    if (res.success) {
      toast({ title: 'Discount limit updated' });
      await load();
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(null);
  };

  if (loading) return <div className="flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Discount Limits</h3>
        <p className="text-sm text-muted-foreground">Configure maximum discount percentages per role</p>
      </div>

      {limits.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No roles configured yet. Roles will appear here once created.</p>
      ) : (
        <div className="grid gap-3">
          {limits.map((limit) => {
            const edit = edits[limit.role_id] ?? { max: 0, approval: 0 };
            return (
              <Card key={limit.role_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <ShieldAlert className="w-5 h-5 text-[#0AB190]" />
                      <span className="font-semibold">{limit.roles?.name || 'Role'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div className="space-y-1">
                        <Label className="text-xs">Max Discount (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={edit.max}
                          onChange={(e) => setEdits({ ...edits, [limit.role_id]: { ...edit, max: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Approval Required Above (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={edit.approval}
                          onChange={(e) => setEdits({ ...edits, [limit.role_id]: { ...edit, approval: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#0AB190] hover:bg-[#057B62] text-white mt-5"
                      onClick={() => handleSave(limit)}
                      disabled={saving === limit.role_id}
                    >
                      {saving === limit.role_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
