import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useFloorStore } from '@/stores/floor.store';
import { floorService } from '@/services/floor.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Edit2, Trash2, Layers, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Floor } from '@/types/floor.types';

export function FloorsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { floors, isLoading, setFloors, addFloor, updateFloor, removeFloor, setLoading } = useFloorStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadFloors();
  }, [user?.restaurant_id]);

  const loadFloors = async () => {
    setLoading(true);
    const res = await floorService.getFloors(user!.restaurant_id);
    if (res.data) setFloors(res.data);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setSelectedFloor(null);
    setName('');
    setDisplayOrder(floors.length + 1);
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (floor: Floor) => {
    setSelectedFloor(floor);
    setName(floor.name);
    setDisplayOrder(floor.display_order);
    setIsActive(floor.is_active);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedFloor) {
        // Edit mode
        const res = await floorService.updateFloor(selectedFloor.id, selectedFloor.version, {
          name,
          displayOrder,
          isActive,
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data) updateFloor(res.data);
        toast({ title: 'Floor updated successfully' });
      } else {
        // Create mode
        const res = await floorService.createFloor(user!.restaurant_id, {
          name,
          displayOrder,
          isActive,
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data) addFloor(res.data);
        toast({ title: 'Floor created successfully' });
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFloor) return;
    setIsSubmitting(true);
    try {
      const res = await floorService.deleteFloor(selectedFloor.id, user!.id);
      if (res.error) throw new Error(res.error.message);
      removeFloor(selectedFloor.id);
      toast({ title: 'Floor deleted successfully' });
      setIsConfirmOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Floor>[] = [
    { key: 'name', header: 'Floor Name', className: 'font-semibold text-foreground' },
    { key: 'display_order', header: 'Display Order', className: 'text-muted-foreground' },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(row)}>
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFloor(row);
              setIsConfirmOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Floor Management"
        description="Configure dynamic floors for your layout planning"
        actions={
          <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-white font-semibold">
            <Plus className="w-4 h-4 mr-2" />
            Add Floor
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={floors}
        isLoading={isLoading}
        emptyIcon={Layers}
        emptyTitle="No floors configured"
        emptyDescription="Create floors to assign dining tables to layout zones."
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedFloor ? 'Edit Floor' : 'Create New Floor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="floorName">Floor Name</Label>
              <Input
                id="floorName"
                placeholder="e.g. Ground Floor, Rooftop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value))}
                />
              </div>

              <div className="flex items-center gap-2 pt-8">
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive">Active Status</Label>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedFloor ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Delete Floor"
        description={`Are you sure you want to delete floor "${selectedFloor?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
