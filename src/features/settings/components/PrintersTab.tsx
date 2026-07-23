import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Printer, Plus, Edit2, Trash2, Wifi, Bluetooth, Usb, Monitor, AlertCircle, CheckCircle2 } from 'lucide-react';
import { printerService } from '@/services/printer.service';
import { printManager } from '@/services/printing/PrintManager';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useAuthStore } from '@/stores/auth.store';
import { Printer as PrinterType, ConnectionType, PaperSize, PrintTemplate, PrinterStatus } from '@/types/printer.types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/utils/cn';

const CONN_ICONS: Record<ConnectionType, any> = {
  network: Wifi,
  bluetooth: Bluetooth,
  usb: Usb,
  browser: Monitor,
};

const STATUS_STYLES: Record<string, string> = {
  online: 'text-green-600',
  offline: 'text-red-500',
  error: 'text-orange-500',
  unknown: 'text-muted-foreground',
};

const DEFAULT_FORM = {
  name: '',
  connection_type: 'browser' as ConnectionType,
  ip_address: null as string | null,
  port: null as number | null,
  paper_size: '80mm' as PaperSize,
  dpi: 203,
  characters_per_line: 42,
  auto_cut: true,
  cash_drawer: false,
  copies: 1,
  encoding: 'UTF-8',
  default_template: 'customer' as PrintTemplate,
  printer_status: 'unknown' as PrinterStatus,
  is_default_billing: false,
  is_default_kitchen: false,
};

export function PrintersTab() {
  const { restaurant } = useRestaurantStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrinterType | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!restaurant) return;
    const res = await printerService.getAll(restaurant.id);
    if (res.success && res.data) setPrinters(res.data);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: PrinterType) => {
    setEditing(p);
    setForm({
      name: p.name,
      connection_type: p.connection_type,
      ip_address: p.ip_address,
      port: p.port,
      paper_size: p.paper_size,
      dpi: p.dpi,
      characters_per_line: p.characters_per_line,
      auto_cut: p.auto_cut,
      cash_drawer: p.cash_drawer,
      copies: p.copies,
      encoding: p.encoding,
      default_template: p.default_template,
      printer_status: p.printer_status,
      is_default_billing: p.is_default_billing,
      is_default_kitchen: p.is_default_kitchen,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!restaurant || !form.name.trim()) return;
    setSaving(true);
    let res;
    if (editing) {
      res = await printerService.update(editing.id, form as any, editing.version);
    } else {
      res = await printerService.create(restaurant.id, form as any);
    }
    if (res.success) {
      await load();
      toast({ title: editing ? 'Printer updated' : 'Printer added' });
      setDialogOpen(false);
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    const res = await printerService.delete(deleteTarget.id, user.id);
    if (res.success) {
      await load();
      toast({ title: 'Printer deleted' });
    }
    setDeleteTarget(null);
  };

  const testPrint = (printer: PrinterType) => {
    printManager.printTestPage(printer.paper_size, printer.name);
    toast({ title: 'Hardware Diagnostic Test Page Dispatched', description: `Printed alignment test page for ${printer.name}` });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Printers</h3>
          <p className="text-sm text-muted-foreground">Manage your printer connections</p>
        </div>
        <Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />Add Printer
        </Button>
      </div>

      {printers.length === 0 ? (
        <EmptyState
          icon={Printer}
          title="No printers configured"
          description="Add a printer for KOT and receipt printing."
          action={<Button className="bg-[#0AB190] hover:bg-[#057B62] text-white" onClick={openCreate}>Add Printer</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {printers.map((p) => {
            const ConnIcon = CONN_ICONS[p.connection_type];
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Printer className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.name}</span>
                          {p.is_default_billing && <Badge className="text-xs bg-blue-100 text-blue-800">Billing</Badge>}
                          {p.is_default_kitchen && <Badge className="text-xs bg-orange-100 text-orange-800">Kitchen</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><ConnIcon className="w-3.5 h-3.5" />{p.connection_type}</span>
                          <span>{p.paper_size}</span>
                          {p.ip_address && <span>{p.ip_address}:{p.port}</span>}
                          <span className={cn('flex items-center gap-1', STATUS_STYLES[p.printer_status])}>
                            {p.printer_status === 'online' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {p.printer_status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => testPrint(p)}>Test Print</Button>
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
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Printer' : 'Add Printer'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Printer Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kitchen Printer" />
              </div>
              <div className="space-y-1.5">
                <Label>Connection Type</Label>
                <Select value={form.connection_type} onValueChange={(v) => setForm({ ...form, connection_type: v as ConnectionType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">Browser Print</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="usb">USB</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Paper Size</Label>
                <Select value={form.paper_size} onValueChange={(v) => setForm({ ...form, paper_size: v as PaperSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm</SelectItem>
                    <SelectItem value="58mm">58mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.connection_type === 'network' && (
                <>
                  <div className="space-y-1.5">
                    <Label>IP Address</Label>
                    <Input value={form.ip_address ?? ''} onChange={(e) => setForm({ ...form, ip_address: e.target.value || null })} placeholder="192.168.1.100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Port</Label>
                    <Input type="number" value={form.port ?? ''} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || null })} placeholder="9100" />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Default Template</Label>
                <Select value={form.default_template} onValueChange={(v) => setForm({ ...form, default_template: v as PrintTemplate })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer Copy</SelectItem>
                    <SelectItem value="kitchen">Kitchen Copy</SelectItem>
                    <SelectItem value="restaurant">Restaurant Copy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Copies</Label>
                <Input type="number" min="1" max="5" value={form.copies} onChange={(e) => setForm({ ...form, copies: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { key: 'auto_cut', label: 'Auto Cut' },
                { key: 'cash_drawer', label: 'Cash Drawer' },
                { key: 'is_default_billing', label: 'Default for Billing' },
                { key: 'is_default_kitchen', label: 'Default for Kitchen' },
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
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Printer" description={`Delete "${deleteTarget?.name}"?`} onConfirm={handleDelete} variant="destructive" />
    </div>
  );
}
