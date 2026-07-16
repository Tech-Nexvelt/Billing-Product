import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useTableStore } from '@/stores/table.store';
import { useFloorStore } from '@/stores/floor.store';
import { tableService } from '@/services/table.service';
import { floorService } from '@/services/floor.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Loader2, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableType, TableShape } from '@/types/table.types';

export function TablesConfigTab() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const { floors, setFloors } = useFloorStore();
  const { tables, isLoading, setTables, addTable, updateTable, removeTable, setLoading } = useTableStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [tableType, setTableType] = useState<TableType>('dining');
  const [tableShape, setTableShape] = useState<TableShape>('square');
  const [floorId, setFloorId] = useState('');

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadData();
  }, [user?.restaurant_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [floorsRes, tablesRes] = await Promise.all([
        floorService.getFloors(user!.restaurant_id),
        tableService.getTables(user!.restaurant_id),
      ]);
      if (floorsRes.data) setFloors(floorsRes.data);
      if (tablesRes.data) setTables(tablesRes.data);
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedTable(null);
    setTableNumber('');
    setCapacity(4);
    setTableType('dining');
    setTableShape('square');
    setFloorId(floors[0]?.id || '');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (table: Table) => {
    setSelectedTable(table);
    setTableNumber(table.table_number);
    setCapacity(table.capacity);
    setTableType(table.table_type);
    setTableShape(table.table_shape);
    setFloorId(table.floor_id);
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (table: Table) => {
    setSelectedTable(table);
    setIsConfirmOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim() || !floorId) return;

    setIsSubmitting(true);
    try {
      if (selectedTable) {
        const res = await tableService.updateTable(selectedTable.id, selectedTable.version, {
          tableNumber,
          capacity,
          floorId,
          tableType,
          tableShape,
          status: selectedTable.status,
          displayOrder: selectedTable.display_order,
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data) updateTable(res.data);
        toast({ title: 'Table updated successfully' });
      } else {
        const res = await tableService.createTable(user!.restaurant_id, {
          tableNumber,
          capacity,
          floorId,
          tableType,
          tableShape,
          status: 'available',
          displayOrder: tables.length + 1,
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data) addTable(res.data);
        toast({ title: 'Table created successfully' });
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTable) return;
    setIsSubmitting(true);
    try {
      const res = await tableService.deleteTable(selectedTable.id, user!.id);
      if (res.error) throw new Error(res.error.message);
      removeTable(selectedTable.id);
      toast({ title: 'Table deleted successfully' });
      setIsConfirmOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold">Tables Layout Configuration</h3>
          <p className="text-xs text-muted-foreground">Manage seating capacities and layout details</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/95 text-white font-bold h-9">
          <Plus className="w-4 h-4 mr-2" /> Add Table
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 border rounded-xl">
          <p className="text-sm text-muted-foreground">No tables configured.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-muted-foreground font-semibold">
                <th className="p-4">Table Number</th>
                <th className="p-4">Floor Zone</th>
                <th className="p-4">Capacity</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const floorName = floors.find((f) => f.id === table.floor_id)?.name || 'N/A';
                return (
                  <tr key={table.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{table.table_number}</td>
                    <td className="p-4 text-muted-foreground">{floorName}</td>
                    <td className="p-4 text-slate-700">{table.capacity} Guests</td>
                    <td className="p-4 uppercase font-bold tracking-wider text-[10px]">
                      {table.status}
                    </td>
                    <td className="p-4 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleOpenEdit(table)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-rose-500 hover:text-rose-600" onClick={() => handleOpenDelete(table)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTable ? 'Edit Table Settings' : 'Create New Table'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tableNum">Table Number / Label</Label>
                <Input id="tableNum" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap">Capacity (Guests)</Label>
                <Input id="cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type">Table Type / Zone</Label>
                <select
                  id="type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tableType}
                  onChange={(e) => setTableType(e.target.value as TableType)}
                >
                  <option value="dining">Dining</option>
                  <option value="vip">VIP Area</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="family">Family Section</option>
                  <option value="private">Private Room</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shape">Visual Shape</Label>
                <select
                  id="shape"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tableShape}
                  onChange={(e) => setTableShape(e.target.value as TableShape)}
                >
                  <option value="square">Square</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor">Floor Zone</Label>
              <select
                id="floor"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={floorId}
                onChange={(e) => setFloorId(e.target.value)}
                required
              >
                <option value="" disabled>Select floor</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedTable ? 'Save Settings' : 'Create Table'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Table"
        description="Are you sure you want to delete this table layout specification?"
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
