import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useFloorStore } from '@/stores/floor.store';
import { useTableStore } from '@/stores/table.store';
import { floorService } from '@/services/floor.service';
import { tableService } from '@/services/table.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Edit2, Trash2, Armchair, Loader2, Clock, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTopbarContent } from '@/components/shared/TopbarContext';
import { Table, TableType, TableShape } from '@/types/table.types';
import { supabase } from '@/lib/supabase';

export function TablesPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setTopbarContent } = useTopbarContent();

  const [tableSearch, setTableSearch] = useState('');

  const { floors, setFloors } = useFloorStore();
  const { tables, isLoading, error, setTables, addTable, updateTable, removeTable, setLoading, setError } = useTableStore();

  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
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

  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadInitialData();
  }, [user?.restaurant_id]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [floorsRes, tablesRes, ordersRes] = await Promise.all([
        floorService.getFloors(user!.restaurant_id),
        tableService.getTables(user!.restaurant_id),
        supabase
          .from('orders')
          .select('id, table_id, created_at, grand_total, status')
          .eq('restaurant_id', user!.restaurant_id)
          .in('status', ['draft', 'pending', 'preparing']),
      ]);

      if (floorsRes.error) throw new Error(floorsRes.error.message);
      if (tablesRes.error) throw new Error(tablesRes.error.message);
      if (ordersRes.error) throw ordersRes.error;

      if (floorsRes.data) {
        setFloors(floorsRes.data);
        if (floorsRes.data.length > 0) {
          setSelectedFloorId(floorsRes.data[0].id);
        }
      }
      if (tablesRes.data) {
        setTables(tablesRes.data);
      }
      if (ordersRes.data) {
        setActiveOrders(ordersRes.data);
      }
    } catch (err) {
      console.error('Error loading tables page data:', err);
      setError(err instanceof Error ? err.message : 'Unable to load the restaurant tables.');
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
    setFloorId(selectedFloorId || '');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route/action
    setSelectedTable(table);
    setTableNumber(table.table_number);
    setCapacity(table.capacity);
    setTableType(table.table_type);
    setTableShape(table.table_shape);
    setFloorId(table.floor_id);
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTable(table);
    setIsConfirmOpen(true);
  };

  const handleTableClick = (table: Table) => {
    if (table.status === 'closed') return;

    // A balance means this table already has a bill. Open it in resume mode so
    // the order screen restores the saved items rather than showing a new cart.
    if (table.current_bill > 0) {
      navigate(`/orders?table=${table.id}&resumeBill=true`);
      return;
    }

    navigate(table.status === 'occupied'
      ? `/orders?table=${table.id}`
      : `/orders?new=true&table=${table.id}`);
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

  const activeFloor = floors.find((f) => f.id === selectedFloorId);
  const filteredTables = tables.filter((t) => {
    const matchesFloor = t.floor_id === selectedFloorId;
    const matchesSearch = t.table_number.toLowerCase().includes(tableSearch.toLowerCase());
    return matchesFloor && matchesSearch;
  });

  const getStatusStyles = (status: Table['status']) => {
    switch (status) {
      case 'occupied':
        return 'bg-[#0AB190]/10 hover:bg-[#0AB190]/25 text-[#057B62] border-[#0AB190]';
      case 'reserved':
        return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200';
      case 'cleaning':
        return 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200';
      case 'closed':
        return 'bg-zinc-200 border-zinc-300 text-zinc-500 cursor-not-allowed opacity-60';
      default: // available
        return 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200';
    }
  };

  const isCashier = user?.role?.name === 'Cashier';

  useEffect(() => {
    setTopbarContent({
      center: (
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search table number..."
            className="h-10 rounded-xl pl-9 text-sm font-semibold"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
          />
        </div>
      ),
      right: (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadInitialData} disabled={isLoading} className="h-10 w-10 shrink-0 rounded-xl" aria-label="Refresh tables">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {!isCashier && (
            <Button onClick={handleOpenCreate} className="hidden h-10 shrink-0 rounded-xl bg-primary px-4 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-primary/95 sm:inline-flex">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Table
            </Button>
          )}
        </div>
      ),
    });

    return () => setTopbarContent(null);
  }, [isCashier, isLoading, selectedFloorId, setTopbarContent, tableSearch, user?.restaurant_id]);

  return (
    <div className="space-y-4">
      {/*
              <span className="hidden sm:inline">•</span>
              <span className="font-semibold text-primary">{currentTime}</span>
            </div>
          </div>
        </div>

        Right Side: Search, Refresh & Add Actions
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
          <div className="relative flex-1 md:flex-initial md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search table number..."
              className="pl-9 h-10 text-sm font-semibold rounded-xl"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadInitialData} 
            disabled={isLoading}
            className="w-10 h-10 shrink-0 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {!isCashier && (
            <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/95 text-white font-extrabold h-10 px-4 rounded-xl text-xs uppercase tracking-wider shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>
          )}
        </div>
      </div>

      */}
      {/* Floor Tab Selector */}
      {floors.length > 0 && (
        <div className="flex gap-2 border-b border-border pb-px overflow-x-auto scrollbar-hide">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                selectedFloorId === floor.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Table Grid (Fully responsive auto-fit CSS Grid) */}
      {isLoading ? (
        <div className="table-grid grid gap-3 sm:gap-4 lg:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <Armchair className="w-12 h-12 text-destructive/40 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground">Unable to load tables</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Armchair className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground">No tables found</h3>
          <p className="text-sm text-muted-foreground mt-1">Configure layout tables for {activeFloor?.name || 'this floor'}.</p>
        </div>
      ) : (
        <div className="table-grid grid gap-3 sm:gap-4 lg:gap-6">
          {filteredTables.map((table) => {
            const activeOrder = activeOrders.find((o) => o.table_id === table.id);
            const isOccupied = table.status === 'occupied';
            const isAvailable = table.status === 'available';

            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`relative flex flex-col justify-between p-3 sm:p-4 lg:p-5 border rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 aspect-square group ${getStatusStyles(
                  table.status
                )}`}
              >
                {/* Table Header */}
                <div className="flex justify-between items-start">
                  <span className="text-xl font-extrabold tracking-tight">
                    {table.table_number.startsWith('T') || table.table_number.startsWith('Table') ? table.table_number : `Table ${table.table_number}`}
                  </span>
                  
                  {/* Action Buttons (Hidden for Cashier) */}
                  {!isCashier && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 bg-white/90 backdrop-blur rounded-lg p-1 border border-border">
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={(e) => handleOpenEdit(table, e)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive hover:text-destructive" onClick={(e) => handleOpenDelete(table, e)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {isAvailable ? (
                  /* Available layout */
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Available</span>
                  </div>
                ) : (
                  /* Occupied/Reserved/Cleaning/Disabled layout */
                  <>
                    <div className="flex-1 flex flex-col justify-center py-2 space-y-1">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-95">
                        {table.status}
                      </span>
                      {isOccupied && activeOrder && (
                        <span className="text-xs font-semibold flex items-center gap-1 opacity-90">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <ElapsedTimeCounter createdAt={activeOrder.created_at} />
                        </span>
                      )}
                      <span className="text-xs font-medium opacity-85">
                        {table.customer_count || table.capacity} Guests
                      </span>
                    </div>

                    {/* Footer: Bill total */}
                    {(isOccupied || table.current_bill > 0) && (
                      <div className="border-t border-current/10 pt-2 flex justify-between items-center mt-auto">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Bill Due</span>
                        <span className="text-lg font-extrabold">
                          ₹{activeOrder ? activeOrder.grand_total : table.current_bill}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTable ? 'Edit Table Settings' : 'Create New Dining Table'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableNumber">Table Number / Label</Label>
                <Input
                  id="tableNumber"
                  placeholder="e.g. T-1, Table 10"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (Guests)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tableType">Table Category / Zone</Label>
                <select
                  id="tableType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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

              <div className="space-y-2">
                <Label htmlFor="tableShape">Visual Shape</Label>
                <select
                  id="tableShape"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={tableShape}
                  onChange={(e) => setTableShape(e.target.value as TableShape)}
                >
                  <option value="square">Square</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="floorId">Floor Zone</Label>
              <select
                id="floorId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={floorId}
                onChange={(e) => setFloorId(e.target.value)}
                required
              >
                <option value="" disabled>Select floor zone</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Dining Table"
        description={`Are you sure you want to delete table "${selectedTable?.table_number}"? This will soft delete the configuration.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ElapsedTimeCounter({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const created = new Date(createdAt).getTime();
      const diffMs = Date.now() - created;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        setElapsed('Just now');
      } else if (diffMins < 60) {
        setElapsed(`${diffMins}m`);
      } else {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsed(`${hrs}h ${mins}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return <span>{elapsed}</span>;
}
