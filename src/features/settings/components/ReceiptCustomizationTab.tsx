import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { settingsService } from '@/services/settings.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { ReceiptCustomization } from '@/types/settings.types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const DEFAULTS: Omit<ReceiptCustomization, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'> = {
  show_logo: true,
  header_text: null,
  footer_text: null,
  thank_you_message: 'Thank you for dining with us!',
  terms_and_conditions: null,
  receipt_width: '80mm',
  margin_top: 4,
  margin_bottom: 4,
  margin_left: 4,
  margin_right: 4,
  font_size: 'medium',
  show_qr_code: false,
  show_order_number: true,
  show_table_number: true,
  show_cashier_name: true,
};

export function ReceiptCustomizationTab() {
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!restaurant) return;
      const res = await settingsService.getReceiptCustomization(restaurant.id);
      if (res.success && res.data) setForm({ ...DEFAULTS, ...res.data });
      setLoading(false);
    };
    load();
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    const res = await settingsService.upsertReceiptCustomization(restaurant.id, form);
    if (res.success) {
      toast({ title: 'Receipt settings saved' });
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div>;

  const toggles = [
    { key: 'show_logo', label: 'Show Restaurant Logo' },
    { key: 'show_order_number', label: 'Show Order Number' },
    { key: 'show_table_number', label: 'Show Table Number' },
    { key: 'show_cashier_name', label: 'Show Cashier Name' },
    { key: 'show_qr_code', label: 'Show QR Code' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Receipt Customization</h3>
        <p className="text-sm text-muted-foreground">Customize your receipt layout and content</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Receipt Width</Label>
          <Select value={form.receipt_width} onValueChange={(v) => setForm({ ...form, receipt_width: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm</SelectItem>
              <SelectItem value="58mm">58mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Font Size</Label>
          <Select value={form.font_size} onValueChange={(v) => setForm({ ...form, font_size: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Header Text</Label>
          <Input value={form.header_text ?? ''} onChange={(e) => setForm({ ...form, header_text: e.target.value || null })} placeholder="Custom header" />
        </div>
        <div className="space-y-1.5">
          <Label>Thank You Message</Label>
          <Input value={form.thank_you_message} onChange={(e) => setForm({ ...form, thank_you_message: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Footer Text</Label>
          <Textarea value={form.footer_text ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, footer_text: e.target.value || null })} rows={2} placeholder="Footer message..." />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Terms & Conditions</Label>
          <Textarea value={form.terms_and_conditions ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, terms_and_conditions: e.target.value || null })} rows={3} placeholder="Terms..." />
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Display Options</h4>
        <div className="space-y-3">
          {toggles.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
            </div>
          ))}
        </div>
      </div>

      <Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Settings'}
      </Button>
    </div>
  );
}
