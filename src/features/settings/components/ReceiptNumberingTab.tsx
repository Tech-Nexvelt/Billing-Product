import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { settingsService } from '@/services/settings.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useToast } from '@/hooks/use-toast';
import { ReceiptNumberRule } from '@/types/settings.types';
import { Loader2, Hash } from 'lucide-react';

const RULE_TYPES = [
  { key: 'bill', label: 'Bill Numbers', example: 'BILL-2026-000001' },
  { key: 'invoice', label: 'Invoice Numbers', example: 'INV-2026-000001' },
  { key: 'kot', label: 'KOT Numbers', example: 'KOT-2026-000001' },
];

export function ReceiptNumberingTab() {
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<ReceiptNumberRule>>>({});

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const res = await settingsService.getReceiptNumberRules(restaurant.id);
    if (res.success && res.data) {
      const init: Record<string, Partial<ReceiptNumberRule>> = {};
      res.data.forEach((r) => { init[r.rule_type] = { ...r }; });
      setEdits(init);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const handleSave = async (ruleType: string) => {
    if (!restaurant) return;
    const edit = edits[ruleType];
    if (!edit) return;
    setSaving(ruleType);
    const res = await settingsService.updateReceiptNumberRule(restaurant.id, ruleType, edit);
    if (res.success) {
      toast({ title: 'Numbering rule updated' });
      await load();
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(null);
  };

  const getRuleEdit = (key: string) => edits[key] ?? { prefix: '', starting_number: 1, reset_frequency: 'never' };

  if (loading) return <div className="flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Receipt Numbering</h3>
        <p className="text-sm text-muted-foreground">Configure how bills, invoices and KOTs are numbered</p>
      </div>

      <div className="grid gap-4">
        {RULE_TYPES.map(({ key, label, example }) => {
          const edit = getRuleEdit(key);
          return (
            <Card key={key}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-[#0AB190]" />
                  <div>
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">Example: {example}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prefix</Label>
                    <Input
                      value={edit.prefix ?? ''}
                      onChange={(e) => setEdits({ ...edits, [key]: { ...edit, prefix: e.target.value.toUpperCase() } })}
                      placeholder="BILL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Starting Number</Label>
                    <Input
                      type="number"
                      min="1"
                      value={edit.starting_number ?? 1}
                      onChange={(e) => setEdits({ ...edits, [key]: { ...edit, starting_number: parseInt(e.target.value) || 1 } })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reset Frequency</Label>
                    <Select value={edit.reset_frequency ?? 'never'} onValueChange={(v) => setEdits({ ...edits, [key]: { ...edit, reset_frequency: v as any } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#0AB190] hover:bg-[#057B62] text-white"
                  onClick={() => handleSave(key)}
                  disabled={saving === key}
                >
                  {saving === key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
