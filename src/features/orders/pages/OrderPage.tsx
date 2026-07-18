import { useEffect, useState, useRef, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useMenuStore } from '@/stores/menu.store';
import { useTableStore } from '@/stores/table.store';
import { useOrderStore } from '@/stores/order.store';
import { menuService } from '@/services/menu.service';
import { tableService } from '@/services/table.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  Search, 
  Loader2, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Printer,
  History,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MenuItemWithTags } from '@/types/menu.types';
import { CartItem } from '@/types/order.types';
import { formatCurrency } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { CheckoutDialog } from '../components/CheckoutDialog';
import { unifiedPrintReceipt } from '@/services/print.service';
import { managerAuthService } from '@/services/managerAuthorization.service';
import { printerService } from '@/services/printer.service';
import { useTopbarContent } from '@/components/shared/TopbarContext';
import { useRestaurant } from '@/hooks/useRestaurant';
import { MenuItemImage } from '@/components/shared/MenuItemImage';
import { TableStatus } from '@/types/table.types';
import { tableStatusValidationService } from '@/services/tableStatusValidation.service';
import { TableStatusValidationDialog } from '@/components/shared/TableStatusValidationDialog';

const VirtualCard = memo(({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '200px' });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="h-full">{isVisible ? children : <div className="aspect-[4/3] bg-muted/20 rounded-2xl" />}</div>;
});

export function OrderPage() {
  const { user } = useAuthStore();
  const { restaurant, settings } = useRestaurant();
  const { items, categories, setItems, setCategories } = useMenuStore();
  const { tables, updateTable, setTables } = useTableStore();
  const { addOrder } = useOrderStore();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setTopbarContent } = useTopbarContent();

  const selectedTableId = searchParams.get('table');
  const shouldResumeBill = searchParams.get('resumeBill') === 'true';

  // Local Page State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep activeOrderId in a ref so async handlers always read the current value
  // without stale closure problems (React state updates are async).
  const activeOrderIdRef = useRef<string | null>(null);
  useEffect(() => { activeOrderIdRef.current = activeOrderId; }, [activeOrderId]);

  // Enterprise Modals
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isVoidAuthOpen, setIsVoidAuthOpen] = useState(false);
  const [voidOrderId, setVoidOrderId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('Duplicate Print');
  const [otherVoidReason, setOtherVoidReason] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [isVerifyingVoid, setIsVerifyingVoid] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [printHistory, setPrintHistory] = useState<any[]>([]);
  const [completedPaymentMethod, setCompletedPaymentMethod] = useState('CASH');

  // KOT tracking: maps menu_item_id → qty already sent to kitchen for this order.
  // Persisted to localStorage so it survives page refresh.
  const [kotPrintedQtys, setKotPrintedQtys] = useState<Record<string, number>>({});

  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationParams, setValidationParams] = useState<{
    tableId: string;
    newStatus: string;
    reason?: string;
    errorMessage?: string;
    suggestedAction?: 'checkout' | 'kitchen' | 'resume' | 'cancel' | 'none';
  }>({ tableId: '', newStatus: '' });

  const activeTable = tables.find((t) => t.id === selectedTableId);

  // Load screen data
  useEffect(() => {
    if (user?.restaurant_id) {
      loadOrderScreenData();
      fetchManagers();
    }
  }, [user?.restaurant_id]);

  // Load / Restore active order or recovered local cart
  useEffect(() => {
    async function checkActiveOrder() {
      if (!selectedTableId || !user?.restaurant_id) return;
      try {
        const { data: activeOrders, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('table_id', selectedTableId)
          .eq('restaurant_id', user.restaurant_id)
          .in('status', ['draft', 'pending', 'preparing', 'ready', 'hold'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (activeOrders && activeOrders.length > 0) {
          const activeOrder = activeOrders[0];
          setActiveOrderId(activeOrder.id);
          setSpecialInstructions(activeOrder.special_instructions || '');

          // Load cart — each item carries its own DB row id (db_id) for targeted ops
          const loadedCart: CartItem[] = activeOrder.order_items
            .filter((oi: any) => !oi.deleted_at)
            .map((oi: any) => ({
              db_id: oi.id,
              menu_item_id: oi.menu_item_id,
              item_name: oi.item_name,
              category_name: oi.category_name || '',
              unit_price: Number(oi.unit_price),
              quantity: oi.quantity,
              item_total: Number(oi.item_total),
              special_notes: oi.special_notes || '',
            }));
          setCart(loadedCart);
          setHasUnsavedChanges(false);

          // Restore KOT-printed quantities for this order from localStorage
          try {
            const savedKot = localStorage.getItem(`nexvelt_pos_kot_${activeOrder.id}`);
            if (savedKot) setKotPrintedQtys(JSON.parse(savedKot));
            else setKotPrintedQtys({});
          } catch (_) {
            setKotPrintedQtys({});
          }

          toast({
            title: shouldResumeBill ? 'Resumed Bill' : 'Resumed Order',
            description: `Loaded order details for Table ${activeTable?.table_number || ''}`,
          });
        } else {
          // If no active order, check if we have a recovered cart state locally
          const cachedCart = localStorage.getItem(`nexvelt_pos_cart_${selectedTableId}`);
          const cachedNotes = localStorage.getItem(`nexvelt_pos_notes_${selectedTableId}`);
          if (cachedCart) {
            setCart(JSON.parse(cachedCart));
            setSpecialInstructions(cachedNotes || '');
            setActiveOrderId(null);
            activeOrderIdRef.current = null;
            setKotPrintedQtys({});
            setHasUnsavedChanges(true);
            toast({
              title: 'Recovered Cart',
              description: `Restored unsaved draft items for Table ${activeTable?.table_number || ''}`
            });
          } else {
            setCart([]);
            setSpecialInstructions('');
            setActiveOrderId(null);
            activeOrderIdRef.current = null;
            setKotPrintedQtys({});
            setHasUnsavedChanges(false);
          }
        }
      } catch (err) {
        console.error('Error checking active order:', err);
      }
    }

    checkActiveOrder();
  }, [selectedTableId, shouldResumeBill, tables, user?.restaurant_id]);

  // Persist unsaved changes locally for unexpected tab close recovery
  useEffect(() => {
    if (selectedTableId && cart.length > 0) {
      localStorage.setItem(`nexvelt_pos_cart_${selectedTableId}`, JSON.stringify(cart));
      localStorage.setItem(`nexvelt_pos_notes_${selectedTableId}`, specialInstructions);
    } else if (selectedTableId) {
      localStorage.removeItem(`nexvelt_pos_cart_${selectedTableId}`);
      localStorage.removeItem(`nexvelt_pos_notes_${selectedTableId}`);
    }
  }, [cart, selectedTableId, specialInstructions]);

  // Topbar setup with dropdown table status
  useEffect(() => {
    const hour = new Date().getHours();
    const shiftName = hour >= 6 && hour < 14 ? 'Morning Shift' : hour >= 14 && hour < 22 ? 'Evening Shift' : 'Night Shift';

    setTopbarContent({
      left: (
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={handleBackToTables}
            className="h-11 shrink-0 rounded-xl px-3 font-bold text-primary transition-transform hover:-translate-x-0.5 hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back to Tables</span>
            <span className="sm:hidden">Tables</span>
          </Button>
          <div className="hidden min-w-0 lg:block">
            <p className="max-w-32 truncate text-sm font-extrabold text-foreground">{restaurant?.name || 'NexVelt POS'}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-primary/20 bg-primary/10 px-2 sm:px-2.5 py-1 flex items-center gap-1.5">
            <div className="text-left">
              <p className="whitespace-nowrap text-[11px] font-extrabold text-primary">Table {activeTable?.table_number || '—'}</p>
              <p className="hidden whitespace-nowrap text-[9px] font-semibold text-[#057B62] sm:block">
                {activeTable ? `${activeTable.customer_count || activeTable.capacity} guests` : 'Loading...'}
              </p>
            </div>
            {activeTable && (
              <Select
                value={activeTable.status}
                onValueChange={async (newStatus) => {
                  try {
                    const validation = await tableStatusValidationService.validateStatusChange(activeTable.id, newStatus, user!.restaurant_id, user!);
                    if (!validation.allowed) {
                      setValidationParams({
                        tableId: activeTable.id,
                        newStatus,
                        reason: validation.reason,
                        errorMessage: validation.errorMessage,
                        suggestedAction: validation.suggestedAction,
                      });
                      setIsValidationOpen(true);
                      return;
                    }

                    const res = await tableService.updateTableStatusValidated(activeTable.id, newStatus as TableStatus, user!);
                    if (!res.success) throw new Error(res.message);
                    if (res.data) {
                      updateTable(res.data);
                      toast({ title: 'Status Updated', description: `Table status changed to ${newStatus}.` });
                    }
                  } catch (err: any) {
                    toast({ title: 'Status Error', description: err.message, variant: 'destructive' });
                  }
                }}
              >
                <SelectTrigger className="h-6 w-20 text-[9px] font-black uppercase tracking-wider bg-white/70 hover:bg-white border-none focus:ring-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="out_of_service">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      ),
      center: (
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dishes, barcode, SKU..."
            className="h-10 rounded-xl pl-9 text-sm font-semibold"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      ),
      right: (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchPrintHistory(); setIsHistoryDialogOpen(true); }} className="h-10 rounded-xl font-bold">
            <History className="w-4 h-4 mr-2" /> History
          </Button>
          <span className="hidden whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-[10px] font-extrabold uppercase text-primary lg:inline">{shiftName}</span>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={loadOrderScreenData} aria-label="Refresh order screen">
            <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      ),
    });

    return () => setTopbarContent(null);
  }, [activeTable, hasUnsavedChanges, isLoading, restaurant, searchQuery, setTopbarContent]);

  const loadOrderScreenData = async () => {
    setIsLoading(true);
    try {
      const [catsRes, itemsRes, tablesRes] = await Promise.all([
        menuService.getCategories(user!.restaurant_id),
        menuService.getMenuItems(user!.restaurant_id),
        tableService.getTables(user!.restaurant_id),
      ]);

      if (catsRes.data) {
        setCategories(catsRes.data);
        if (catsRes.data.length > 0) {
          setSelectedCategoryId(catsRes.data[0].id);
        }
      }
      if (itemsRes.data) setItems(itemsRes.data);
      if (tablesRes.data) setTables(tablesRes.data);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, role:roles(name)')
        .is('deleted_at', null);

      const mList = (data || []).filter((u: any) => u.role?.name === 'Owner' || u.role?.name === 'Manager');
      setManagers(mList);
      if (mList.length > 0) setManagerEmail(mList[0].email);
    } catch (err) {
      console.error('Failed to load manager list:', err);
    }
  };

  const fetchPrintHistory = async () => {
    try {
      const { data } = await supabase
        .from('receipt_print_history')
        .select('*')
        .eq('restaurant_id', user!.restaurant_id)
        .order('printed_at', { ascending: false })
        .limit(50);
      setPrintHistory(data || []);
    } catch (_) {
      // Fallback
      setPrintHistory([]);
    }
  };

  // Calculations
  const taxRate = 5; // Default 5% GST
  const serviceChargeRate = 0;
  const subtotal = cart.reduce((sum, item) => sum + item.item_total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const serviceChargeAmount = (subtotal * serviceChargeRate) / 100;
  const grandTotal = subtotal + taxAmount + serviceChargeAmount;



  // ─────────────────────────────────────────────────────────────────────────
  // TARGETED CART OPERATIONS
  // Each function touches exactly ONE DB row. No cross-item comparison.
  // Race conditions between rapid taps are impossible.
  // ─────────────────────────────────────────────────────────────────────────

  /** Creates a new draft order if one doesn't exist. Returns the orderId. */
  const ensureOrder = async (): Promise<string | null> => {
    if (!selectedTableId) return null;

    // Use ref for immediate value — React state may not have committed yet
    const existingId = activeOrderIdRef.current;
    if (existingId) return existingId;

    const activeTableObj = tables.find((t) => t.id === selectedTableId);
    if (!activeTableObj) return null;

    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert({
        restaurant_id: user!.restaurant_id,
        created_by: user!.id,
        table_id: selectedTableId,
        floor_id: activeTableObj.floor_id,
        status: 'draft',
        subtotal: 0,
        tax_amount: 0,
        grand_total: 0,
      })
      .select()
      .single();

    if (error || !newOrder) return null;

    setActiveOrderId(newOrder.id);
    activeOrderIdRef.current = newOrder.id;
    addOrder(newOrder);

    // Mark table occupied
    const res = await tableService.updateTableStatusValidated(selectedTableId, 'occupied', user!);
    if (res.data) updateTable(res.data);

    return newOrder.id;
  };

  /** Recalculates and persists order + table totals from the given cart. */
  const updateOrderTotals = async (currentCart: CartItem[], orderId: string) => {
    const newSubtotal = currentCart.reduce((s, i) => s + i.item_total, 0);
    const newTax = newSubtotal * 0.05;
    const newTotal = newSubtotal + newTax;

    await supabase
      .from('orders')
      .update({ subtotal: newSubtotal, tax_amount: newTax, grand_total: newTotal, updated_by: user!.id })
      .eq('id', orderId);

    await supabase
      .from('tables')
      .update({ current_bill: newTotal })
      .eq('id', selectedTableId);
  };

  const handleAddToCart = async (item: MenuItemWithTags) => {
    if (!selectedTableId) {
      toast({ title: 'Select Table', description: 'Assign a table first.', variant: 'destructive' });
      return;
    }

    // Optimistic update — compute next cart before any async work
    const existing = cart.find((i) => i.menu_item_id === item.id);
    const nextCart: CartItem[] = existing
      ? cart.map((i) =>
          i.menu_item_id === item.id
            ? { ...i, quantity: i.quantity + 1, item_total: (i.quantity + 1) * i.unit_price }
            : i
        )
      : [
          ...cart,
          {
            // db_id will be filled in after the INSERT returns
            menu_item_id: item.id,
            item_name: item.name,
            category_name: categories.find((c) => c.id === item.category_id)?.name || '',
            unit_price: item.selling_price,
            quantity: 1,
            item_total: item.selling_price,
          },
        ];

    setCart(nextCart);
    toast({ title: 'Added to cart', description: `${item.name} has been added.` });

    try {
      const orderId = await ensureOrder();
      if (!orderId) return;

      if (existing?.db_id) {
        // TARGETED UPDATE — only this row by its stable DB id
        const newQty = existing.quantity + 1;
        await supabase
          .from('order_items')
          .update({ quantity: newQty, item_total: newQty * item.selling_price })
          .eq('id', existing.db_id);
        // db_id unchanged — already set on the CartItem
      } else {
        // TARGETED INSERT — one new row, capture the returned DB id
        const { data: inserted, error: insErr } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            menu_item_id: item.id,
            restaurant_id: user!.restaurant_id,
            item_name: item.name,
            category_name: categories.find((c) => c.id === item.category_id)?.name || null,
            unit_price: item.selling_price,
            quantity: 1,
            item_total: item.selling_price,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        // Stamp the db_id onto the cart item so future ops use it
        if (inserted) {
          setCart((prev) =>
            prev.map((ci) =>
              ci.menu_item_id === item.id && !ci.db_id
                ? { ...ci, db_id: inserted.id }
                : ci
            )
          );
        }
      }

      await updateOrderTotals(nextCart, orderId);
    } catch (err: any) {
      setCart(cart); // rollback
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateQuantity = async (itemId: string, delta: number) => {
    const originalCart = [...cart];
    const targetItem = cart.find((i) => i.menu_item_id === itemId);
    if (!targetItem) return;

    const nextQty = targetItem.quantity + delta;
    const nextCart =
      nextQty <= 0
        ? cart.filter((i) => i.menu_item_id !== itemId)
        : cart.map((i) =>
            i.menu_item_id === itemId
              ? { ...i, quantity: nextQty, item_total: nextQty * i.unit_price }
              : i
          );

    setCart(nextCart);

    try {
      const orderId = activeOrderIdRef.current;
      const dbId = targetItem.db_id;   // stable DB row id from CartItem itself

      if (orderId && dbId) {
        if (nextQty <= 0) {
          // TARGETED SOFT-DELETE — only this row
          await supabase
            .from('order_items')
            .update({ deleted_at: new Date().toISOString(), deleted_by: user!.id })
            .eq('id', dbId);

          await supabase.from('activity_logs').insert({
            restaurant_id: user!.restaurant_id,
            user_id: user!.id,
            action: 'cart_item_deleted',
            entity_type: 'order_item',
            entity_id: dbId,
            metadata: { order_id: orderId, item_name: targetItem.item_name, quantity: targetItem.quantity, cashier: user!.full_name || 'Cashier' }
          });
        } else {
          // TARGETED UPDATE — only this row
          await supabase
            .from('order_items')
            .update({ quantity: nextQty, item_total: nextQty * targetItem.unit_price })
            .eq('id', dbId);
        }

        if (nextCart.length === 0) {
          await supabase
            .from('orders')
            .update({ deleted_at: new Date().toISOString(), deleted_by: user!.id, status: 'cancelled' })
            .eq('id', orderId);
          setActiveOrderId(null);
          activeOrderIdRef.current = null;
          await supabase.from('tables').update({ current_bill: 0 }).eq('id', selectedTableId!);
          const res = await tableService.updateTableStatusValidated(selectedTableId!, 'available', user!);
          if (res.data) updateTable(res.data);
        } else {
          await updateOrderTotals(nextCart, orderId);
        }
      }
    } catch (err: any) {
      setCart(originalCart);
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveFromCart = async (itemId: string) => {
    const originalCart = [...cart];
    const targetItem = cart.find((i) => i.menu_item_id === itemId);
    if (!targetItem) return;

    const nextCart = cart.filter((i) => i.menu_item_id !== itemId);
    setCart(nextCart);

    try {
      const orderId = activeOrderIdRef.current;
      const dbId = targetItem.db_id;   // stable DB row id from CartItem itself

      if (orderId && dbId) {
        // TARGETED SOFT-DELETE — exactly this one row
        await supabase
          .from('order_items')
          .update({ deleted_at: new Date().toISOString(), deleted_by: user!.id })
          .eq('id', dbId);

        await supabase.from('activity_logs').insert({
          restaurant_id: user!.restaurant_id,
          user_id: user!.id,
          action: 'cart_item_deleted',
          entity_type: 'order_item',
          entity_id: dbId,
          metadata: { order_id: orderId, item_name: targetItem.item_name, quantity: targetItem.quantity, cashier: user!.full_name || 'Cashier' }
        });

        if (nextCart.length === 0) {
          await supabase
            .from('orders')
            .update({ deleted_at: new Date().toISOString(), deleted_by: user!.id, status: 'cancelled' })
            .eq('id', orderId);
          setActiveOrderId(null);
          activeOrderIdRef.current = null;
          await supabase.from('tables').update({ current_bill: 0 }).eq('id', selectedTableId!);
          const res = await tableService.updateTableStatusValidated(selectedTableId!, 'available', user!);
          if (res.data) updateTable(res.data);
          await supabase.from('activity_logs').insert({
            restaurant_id: user!.restaurant_id,
            user_id: user!.id,
            action: 'order_emptied',
            entity_type: 'order',
            entity_id: orderId,
            metadata: { table_id: selectedTableId, cashier: user!.full_name || 'Cashier' }
          });
        } else {
          await updateOrderTotals(nextCart, orderId);
        }
      }
    } catch (err: any) {
      setCart(originalCart);
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' });
    }
  };

  // Back trigger
  const handleBackToTables = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm('You have unsaved cart items. Do you want to leave?');
      if (!confirmLeave) return;
    }
    navigate('/');
  };

  // 1. KOT Action: Incremental Print
  // Delta is computed against kotPrintedQtys (what was previously sent to kitchen),
  // NOT against DB quantities. DB and cart are already synced by syncCartToDb on every
  // item change, so comparing cart vs DB always yields zero delta — wrong!
  const handlePrintKotClick = async () => {
    if (!selectedTableId) {
      toast({ title: 'Select Table', description: 'Assign a table first.', variant: 'destructive' });
      return;
    }
    if (cart.length === 0) {
      toast({ title: 'Cart Empty', description: 'Add items first.', variant: 'destructive' });
      return;
    }

    setIsPlacingOrder(true);
    try {
      const activeTable = tables.find((t) => t.id === selectedTableId);
      if (!activeTable) throw new Error('Table not found.');

      // DB is already in sync via targeted ops on every cart change.
      // Use ref directly — no full re-sync needed.
      const orderId = activeOrderIdRef.current;
      if (!orderId) throw new Error('No active order. Add items to the cart first.');

      // Step 2: Compute incremental items by comparing cart qty
      // against what was PREVIOUSLY sent to the kitchen (kotPrintedQtys).
      // This is independent of DB qty, so adding item A and immediately
      // clicking Print KOT always produces delta = 1 for item A.
      const newItemsToPrint: CartItem[] = [];
      for (const item of cart) {
        const previouslyPrinted = kotPrintedQtys[item.menu_item_id] ?? 0;
        const diff = item.quantity - previouslyPrinted;
        if (diff > 0) {
          newItemsToPrint.push({ ...item, quantity: diff });
        }
      }

      if (newItemsToPrint.length === 0) {
        toast({ title: 'Already Printed', description: 'All current items have already been sent to the kitchen.' });
        return;
      }

      // Step 3: Get KOT sequence number
      const { data: kotSeq } = await supabase.rpc('get_next_receipt_number', {
        p_restaurant_id: user!.restaurant_id,
        p_rule_type: 'kot'
      });

      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      // Step 4: Send KOT to kitchen printer
      await unifiedPrintReceipt({
        type: 'kot',
        restaurant,
        table: activeTable,
        floorName: activeTable.floor_id,
        cashierName: user?.full_name || 'Cashier',
        orderNumber: kotSeq || orderId.substring(0, 8).toUpperCase(),
        orderId,
        items: newItemsToPrint,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: 'KOT - KITCHEN ONLY',
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
      });

      // Step 5: Update kotPrintedQtys to record what was just sent to kitchen.
      // Merge new quantities on top of existing ones.
      const updatedKotQtys = { ...kotPrintedQtys };
      for (const item of newItemsToPrint) {
        updatedKotQtys[item.menu_item_id] = (kotPrintedQtys[item.menu_item_id] ?? 0) + item.quantity;
      }
      setKotPrintedQtys(updatedKotQtys);
      // Persist so it survives refresh
      localStorage.setItem(`nexvelt_pos_kot_${orderId}`, JSON.stringify(updatedKotQtys));

      // Step 6: Log KOT activity
      await supabase.from('activity_logs').insert({
        restaurant_id: user!.restaurant_id,
        user_id: user!.id,
        action: 'kot_printed',
        entity_type: 'order',
        entity_id: orderId,
        metadata: {
          items_count: newItemsToPrint.length,
          items: newItemsToPrint.map(i => ({ name: i.item_name, qty: i.quantity })),
          kot_number: kotSeq || orderId.substring(0, 8).toUpperCase(),
          cashier: user!.full_name || 'Cashier',
          timestamp: new Date().toISOString(),
        }
      });

      toast({ title: '✅ KOT Sent', description: `${newItemsToPrint.length} item(s) sent to kitchen.` });
    } catch (err: any) {
      toast({ title: 'KOT Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // 2. Customer Receipt Action → opens CheckoutDialog (DB already in sync via targeted ops)
  const handleCustomerReceiptClick = async () => {
    if (!selectedTableId || cart.length === 0) return;
    setIsPlacingOrder(true);
    try {
      // DB is kept in sync on every cart mutation via targeted single-row operations.
      // No re-sync required here — just ensure an order exists.
      const orderId = activeOrderIdRef.current;
      if (!orderId) throw new Error('No active order. Add items first.');

      setIsCheckoutOpen(true);
    } catch (err: any) {
      toast({ title: 'Invoice Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // 3. Owner Copy Action
  const handleOwnerCopyClick = async () => {
    if (!activeOrderId) {
      toast({ title: 'Unpaid Order', description: 'Proceed with checkout first.' });
      return;
    }
    try {
      const activeTable = tables.find((t) => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'owner',
        restaurant,
        table: activeTable,
        floorName: activeTable?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: activeOrderId.substring(0, 8).toUpperCase(),
        orderId: activeOrderId,
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: completedPaymentMethod,
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
        isReprint: true,
        reprintReason: 'Manual Reprint',
      });

      toast({ title: 'Owner Copy Sent', description: 'Reprint job sent to billing printer.' });
    } catch (err: any) {
      toast({ title: 'Reprint Error', description: err.message, variant: 'destructive' });
    }
  };

  // Hold Receipt Workflow
  const handleHoldClick = async () => {
    if (!selectedTableId || cart.length === 0) return;
    setIsPlacingOrder(true);
    try {
      // DB is already in sync. Just flip the order status to held.
      const orderId = activeOrderIdRef.current;
      if (!orderId) throw new Error('No active order to hold.');

      await supabase
        .from('orders')
        .update({ status: 'hold', updated_by: user!.id })
        .eq('id', orderId);

      setHasUnsavedChanges(false);
      toast({ title: 'Bill on Hold', description: 'Order saved on hold. Table remains occupied.' });
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Hold Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCancelOrderClick = async () => {
    if (!selectedTableId) return;
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel and delete this entire bill? This will release the table.'
    );
    if (!confirmCancel) return;

    setIsPlacingOrder(true);
    try {
      if (activeOrderId) {
        // Soft delete all order items
        await supabase
          .from('order_items')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user!.id
          })
          .eq('order_id', activeOrderId);

        // Soft delete order status cancelled in Supabase
        const { error: cancelErr } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            deleted_at: new Date().toISOString(),
            deleted_by: user!.id,
            updated_by: user!.id
          })
          .eq('id', activeOrderId);
        if (cancelErr) throw cancelErr;
      }

      // Reset current bill on the table in Supabase
      const { error: resetErr } = await supabase
        .from('tables')
        .update({ current_bill: 0 })
        .eq('id', selectedTableId);
      if (resetErr) throw resetErr;

      // Mark table status available
      const res = await tableService.updateTableStatusValidated(selectedTableId, 'available', user!);
      if (!res.success) throw new Error(res.message);
      if (res.data) {
        updateTable(res.data);
      }

      // Clear local storage cache (cart + KOT tracking)
      localStorage.removeItem(`nexvelt_pos_cart_${selectedTableId}`);
      localStorage.removeItem(`nexvelt_pos_notes_${selectedTableId}`);
      if (activeOrderId) localStorage.removeItem(`nexvelt_pos_kot_${activeOrderId}`);

      // Reset state
      setCart([]);
      setSpecialInstructions('');
      setActiveOrderId(null);
      activeOrderIdRef.current = null;
      setKotPrintedQtys({});
      setHasUnsavedChanges(false);

      toast({
        title: 'Bill Cancelled',
        description: 'Bill deleted and table is now available.',
      });
      navigate('/');
    } catch (err: any) {
      toast({
        title: 'Cancel Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePaymentComplete = async (
    paymentMethod: string,
    _paidAmount: number,
    _isPartial: boolean,
    _splitDetails?: any,
    printWindow?: Window | null,
  ) => {
    if (!activeOrderId || !selectedTableId) {
      printWindow?.close();
      return;
    }

    try {
      // 1. Generate receipt sequence numbers
      const { data: invoiceNum } = await supabase.rpc('get_next_receipt_number', {
        p_restaurant_id: user!.restaurant_id,
        p_rule_type: 'invoice'
      });
      const { data: billNum } = await supabase.rpc('get_next_receipt_number', {
        p_restaurant_id: user!.restaurant_id,
        p_rule_type: 'bill'
      });

      // 2. Mark order completed & update receipt numbers
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          invoice_number: invoiceNum || null,
          bill_number: billNum || null,
          updated_by: user!.id,
        })
        .eq('id', activeOrderId);

      if (updateError) throw updateError;

      // 3. Mark table cleaning or available status
      const autoAvailable = settings?.auto_available_after_payment === true;
      const targetStatus = autoAvailable ? 'available' : 'cleaning';
      if (targetStatus === 'available') {
        const { data: updatedTable } = await supabase
          .from('tables')
          .update({ current_bill: 0, status: 'available' })
          .eq('id', selectedTableId)
          .select()
          .single();
        if (updatedTable) {
          updateTable(updatedTable);
        }
        await supabase.from('activity_logs').insert({
          restaurant_id: user!.restaurant_id,
          user_id: user!.id,
          action: 'table_status_changed',
          entity_type: 'table',
          entity_id: selectedTableId,
          metadata: {
            previous_status: 'occupied',
            new_status: 'available',
            user_name: user!.full_name || 'Cashier'
          }
        });
      } else {
        const res = await tableService.updateTableStatusValidated(selectedTableId, 'cleaning', user!);
        if (res.data) {
          updateTable(res.data);
        }
      }

      // Clear local storage cache (cart + KOT tracking)
      localStorage.removeItem(`nexvelt_pos_cart_${selectedTableId}`);
      localStorage.removeItem(`nexvelt_pos_notes_${selectedTableId}`);
      localStorage.removeItem(`nexvelt_pos_kot_${activeOrderId}`);
      setKotPrintedQtys({});
      activeOrderIdRef.current = null;


      setCompletedPaymentMethod(paymentMethod);

      // 4. Trigger print of Customer Receipt
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'customer',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: invoiceNum || activeOrderId.substring(0, 8).toUpperCase(),
        orderId: activeOrderId,
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod,
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
        printWindow,
      });

      toast({ title: 'Payment Completed', description: 'Order completed and Customer copy printed.' });
      setIsCheckoutOpen(false);
      setIsSuccessDialogOpen(true);
    } catch (err: any) {
      printWindow?.close();
      toast({ title: 'Failed to complete checkout', description: err.message, variant: 'destructive' });
    }
  };

  const handleReprintCustomerFromSuccess = async () => {
    if (!activeOrderId) return;
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'customer',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: activeOrderId.substring(0, 8).toUpperCase(),
        orderId: activeOrderId,
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: completedPaymentMethod,
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
        isReprint: true,
        reprintReason: 'Checkout Success Reprint',
      });
      toast({ title: 'Reprinting Customer Copy' });
    } catch (err: any) {
      toast({ title: 'Print Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleReprintOwnerFromSuccess = async () => {
    if (!activeOrderId) return;
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'owner',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: activeOrderId.substring(0, 8).toUpperCase(),
        orderId: activeOrderId,
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: completedPaymentMethod,
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
        isReprint: true,
        reprintReason: 'Checkout Success Owner Copy',
      });
      toast({ title: 'Reprinting Owner Copy' });
    } catch (err: any) {
      toast({ title: 'Print Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleKotAgainFromSuccess = async () => {
    if (!activeOrderId) return;
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'kot',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: activeOrderId.substring(0, 8).toUpperCase(),
        orderId: activeOrderId,
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: 'KOT - KITCHEN ONLY',
        specialInstructions,
        userId: user!.id,
        printers: printers || [],
        isReprint: true,
        reprintReason: 'Checkout Success KOT Again',
      });
      toast({ title: 'KOT Sent again to Kitchen.' });
    } catch (err: any) {
      toast({ title: 'KOT Print Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkCleaningComplete = async () => {
    if (!selectedTableId) return;
    try {
      const res = await tableService.updateTableStatusValidated(selectedTableId, 'available', user!);
      if (!res.success) throw new Error(res.message);
      if (res.data) {
        updateTable(res.data);
        toast({ title: 'Table Available', description: 'Status set to Available.' });
      }
      setIsSuccessDialogOpen(false);
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Failed to update table', description: err.message, variant: 'destructive' });
    }
  };

  // Void Receipt workflow
  const triggerVoidRequest = (orderId: string) => {
    setVoidOrderId(orderId);
    setVoidReason('Duplicate Print');
    setOtherVoidReason('');
    setIsVoidAuthOpen(true);
  };

  const handleVoidAuthorize = async () => {
    if (!voidOrderId) return;
    setIsVerifyingVoid(true);
    try {
      // 1. Verify manager isolated override
      const authRes = await managerAuthService.authorize(managerEmail, managerPassword);
      if (!authRes.success) {
        throw new Error(authRes.error || 'Authentication Override Failed.');
      }

      const finalReason = voidReason === 'Other' ? otherVoidReason : voidReason;

      // 2. Void order in database
      const { error: voidErr } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          void_reason: finalReason,
          voided_at: new Date().toISOString(),
          void_approved_by: authRes.user.id
        })
        .eq('id', voidOrderId);

      if (voidErr) throw voidErr;

      // 3. Log event
      await supabase.from('activity_logs').insert({
        restaurant_id: user!.restaurant_id,
        user_id: user!.id,
        action: 'receipt_voided',
        entity_type: 'order',
        entity_id: voidOrderId,
        metadata: {
          void_reason: finalReason,
          void_approved_by_name: authRes.user.full_name,
          timestamp: new Date().toISOString()
        }
      });

      toast({ title: 'Receipt Voided', description: 'Order void status logged successfully.' });
      setIsVoidAuthOpen(false);
      setManagerPassword('');
      fetchPrintHistory();
    } catch (err: any) {
      toast({ title: 'Void Authorization Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsVerifyingVoid(false);
    }
  };

  // Filter Categories
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  // Filter Menu Items
  const filteredMenuItems = items.filter((item: MenuItemWithTags) => {
    const matchesCategory = selectedCategoryId ? item.category_id === selectedCategoryId : true;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)] flex flex-col space-y-4 pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 flex-1 overflow-visible lg:overflow-hidden">
        
        {/* LEFT COLUMN: Categories */}
        <div className="col-span-12 lg:col-span-2 bg-card border border-border rounded-2xl flex flex-col overflow-hidden p-4 space-y-3.5 shrink-0">
          <div className="space-y-1.5 shrink-0">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Categories</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search cats..."
                className="pl-8 text-xs h-8 animate-all"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pr-1 pb-2 lg:pb-0 scrollbar-hide">
            {filteredCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id)}
                className={`px-4 py-2.5 lg:px-3 lg:py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full lg:text-left ${
                  selectedCategoryId === c.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER COLUMN: Menu Items */}
        <div className="col-span-12 lg:col-span-6 flex flex-col overflow-visible lg:overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] bg-muted/30 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-2xl border border-border">
                <p className="text-muted-foreground text-sm font-semibold">No items in this category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-4">
                {filteredMenuItems.map((item: MenuItemWithTags) => {
                  const isAvailable = item.availability_status === 'available';
                  const isPopular = item.selling_price < 200;
                  const isChef = item.selling_price > 400;

                  return (
                    <VirtualCard key={item.id}>
                      <div
                        onClick={() => isAvailable && handleAddToCart(item)}
                        className={`bg-card rounded-2xl border border-border overflow-hidden p-3 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between relative group h-full ${
                          !isAvailable ? 'opacity-40 cursor-not-allowed pointer-events-none bg-slate-100' : ''
                        }`}
                      >
                        <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden mb-2.5">
                          <MenuItemImage 
                            src={item.image_url} 
                            alt={item.name} 
                            availabilityStatus={item.availability_status} 
                          />
                          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur p-1 rounded-md border border-border flex items-center justify-center z-10">
                            <span className={`w-2.5 h-2.5 rounded-full border border-white ${
                              item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                          </div>

                          <div className="absolute top-2 right-2 flex flex-col gap-1">
                            {isChef && (
                              <span className="bg-amber-500 text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                <Sparkles className="w-2.5 h-2.5" /> Chef
                              </span>
                            )}
                            {isPopular && (
                              <span className="bg-[#0AB190] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                <TrendingUp className="w-2.5 h-2.5" /> Popular
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <h4 className="font-extrabold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {item.name}
                          </h4>
                          <div className="flex justify-between items-center mt-2.5">
                            <span className="font-black text-sm text-foreground">{formatCurrency(item.selling_price)}</span>
                            {item.is_veg !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                {item.is_veg ? 'Veg' : 'Non-Veg'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </VirtualCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Bill Cart */}
        <div className="col-span-12 lg:col-span-4 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <span className="font-extrabold text-sm text-foreground">Current Cart</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleHoldClick} disabled={cart.length === 0 || isPlacingOrder} className="font-bold text-xs h-8">
                Hold Bill
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancelOrderClick} disabled={cart.length === 0 || isPlacingOrder} className="w-8 h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                  <ShoppingCart className="w-6 h-6 text-slate-400 opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-600">Your billing cart is empty</p>
                  <p className="text-[11px] text-muted-foreground">Select dishes from the menu to populate invoice</p>
                </div>
              </div>
            ) : (
              cart.map((item: CartItem) => (
                <div key={item.menu_item_id} className="flex justify-between items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs text-slate-800 truncate leading-snug">{item.item_name}</h5>
                    <span className="text-[10px] text-muted-foreground font-semibold">₹{item.unit_price} each</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-7 h-7 rounded-lg border-slate-200"
                      onClick={() => handleUpdateQuantity(item.menu_item_id, -1)}
                    >
                      <Minus className="w-3 h-3 text-slate-600" />
                    </Button>
                    <span className="text-xs font-extrabold w-4 text-center text-slate-800">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-7 h-7 rounded-lg border-slate-200"
                      onClick={() => handleUpdateQuantity(item.menu_item_id, 1)}
                    >
                      <Plus className="w-3 h-3 text-slate-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      onClick={() => handleRemoveFromCart(item.menu_item_id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border space-y-4 shrink-0 bg-slate-50/50">
            <div className="space-y-1.5">
              <Label htmlFor="specialInstructions" className="text-[11px] font-bold text-muted-foreground uppercase">Kitchen Instructions / Notes</Label>
              <Input
                id="specialInstructions"
                placeholder="e.g. Medium spicy, no onions"
                value={specialInstructions}
                onChange={(e) => {
                  setSpecialInstructions(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="text-xs rounded-xl h-9"
              />
            </div>

            <div className="space-y-2 text-xs border-t border-slate-200/60 pt-3">
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>GST Tax ({taxRate}%)</span>
                <span className="font-bold text-slate-800">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm text-foreground font-bold">
                <span>Total Due</span>
                <span className="text-primary text-base font-extrabold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Pay / Receipt Actions Panel */}
            <div className="flex gap-2 w-full pt-1">
              <Button
                variant="outline"
                className="flex-1 font-extrabold text-[10px] tracking-wider uppercase h-10 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1"
                disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
                onClick={handleCustomerReceiptClick}
              >
                <Printer className="w-3.5 h-3.5" /> Customer Receipt
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-extrabold text-[10px] tracking-wider uppercase h-10 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1"
                disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
                onClick={handlePrintKotClick}
              >
                <Printer className="w-3.5 h-3.5" /> Print KOT
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-extrabold text-[10px] tracking-wider uppercase h-10 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1"
                disabled={isPlacingOrder || cart.length === 0 || !activeOrderId}
                onClick={handleOwnerCopyClick}
              >
                <Printer className="w-3.5 h-3.5" /> Owner Copy
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* Checkout Payment Dialog */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        total={grandTotal}
        onComplete={handlePaymentComplete}
      />

      {/* Payment Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-800">Checkout Successful</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Invoice created and payments verified successfully.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2.5 py-4">
            <Button variant="outline" size="sm" onClick={handleReprintCustomerFromSuccess} className="font-bold text-xs h-9 justify-start px-3">
              <Printer className="w-4 h-4 mr-2" /> Customer Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleReprintOwnerFromSuccess} className="font-bold text-xs h-9 justify-start px-3">
              <Printer className="w-4 h-4 mr-2" /> Owner Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleKotAgainFromSuccess} className="font-bold text-xs h-9 justify-start px-3 col-span-2">
              <Printer className="w-4 h-4 mr-2" /> Print KOT Again
            </Button>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:space-x-0 w-full">
            <Button variant="default" onClick={handleMarkCleaningComplete} className="w-full bg-[#0AB190] hover:bg-[#057B62] font-black h-10 rounded-xl text-xs uppercase tracking-wider">
              Mark Cleaning Complete
            </Button>
            <Button variant="ghost" onClick={() => { setIsSuccessDialogOpen(false); navigate('/'); }} className="w-full font-bold text-xs text-muted-foreground h-9">
              Return to Tables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Print History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Receipt Print History
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {printHistory.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-10">No recent prints logged.</p>
            ) : (
              printHistory.map((h: any) => (
                <div key={h.id} className="p-3 border rounded-xl bg-slate-50 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-800">#{h.receipt_number}</span>
                      <Badge className="text-[9px] uppercase tracking-wider font-extrabold border-none" variant={h.receipt_type === 'kot' ? 'secondary' : 'default'}>
                        {h.receipt_type}
                      </Badge>
                      {h.is_reprint && <Badge className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-500 text-white border-none">Reprint</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Printed at: {new Date(h.printed_at).toLocaleTimeString()} ({h.print_status})
                    </p>
                    {h.reprint_reason && <p className="text-[10px] text-amber-600 italic">Reason: {h.reprint_reason}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const activeTableObj = tables.find(t => t.id === selectedTableId);
                          const { data: printers } = await printerService.getAll(user!.restaurant_id);

                          await unifiedPrintReceipt({
                            type: h.receipt_type === 'kot' ? 'kot' : h.receipt_type === 'restaurant' ? 'owner' : 'customer',
                            restaurant,
                            table: activeTableObj,
                            floorName: activeTableObj?.floor_id || 'Main Area',
                            cashierName: user?.full_name || 'Cashier',
                            orderNumber: h.receipt_number,
                            orderId: h.order_id || '',
                            items: cart,
                            subtotal,
                            taxRate,
                            taxAmount,
                            serviceChargeRate,
                            serviceChargeAmount,
                            discountAmount: 0,
                            grandTotal,
                            paymentMethod: completedPaymentMethod,
                            specialInstructions,
                            userId: user!.id,
                            printers: printers || [],
                            isReprint: true,
                            reprintReason: 'Reprint from History',
                          });
                          toast({ title: 'Reprint Request Dispatched' });
                          fetchPrintHistory();
                        } catch (err: any) {
                          toast({ title: 'Reprint Failed', description: err.message, variant: 'destructive' });
                        }
                      }}
                      className="font-bold text-[10px] uppercase h-7"
                    >
                      Reprint
                    </Button>
                    {h.receipt_type !== 'kot' && h.print_status !== 'voided' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { triggerVoidRequest(h.order_id); }}
                        className="font-bold text-[10px] uppercase h-7 bg-red-600 hover:bg-red-700"
                      >
                        Void
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)} className="font-bold text-xs rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Password Overrides Modal */}
      <Dialog open={isVoidAuthOpen} onOpenChange={setIsVoidAuthOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Manager Approval Required
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cashiers cannot void receipt logs. Manager authorization is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Void Reason</Label>
              <Select value={voidReason} onValueChange={setVoidReason}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Duplicate Print">Duplicate Print</SelectItem>
                  <SelectItem value="Wrong Table">Wrong Table</SelectItem>
                  <SelectItem value="Wrong Customer">Wrong Customer</SelectItem>
                  <SelectItem value="Wrong Payment">Wrong Payment</SelectItem>
                  <SelectItem value="Refund">Refund</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {voidReason === 'Other' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Please specify</Label>
                <Input
                  placeholder="Reason details..."
                  value={otherVoidReason}
                  onChange={(e) => setOtherVoidReason(e.target.value)}
                  className="text-xs rounded-xl h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Select Manager</Label>
              <Select value={managerEmail} onValueChange={setManagerEmail}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="Select Manager Account" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.email}>{m.full_name} ({m.role?.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Manager Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                className="text-xs rounded-xl h-9"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setIsVoidAuthOpen(false)} disabled={isVerifyingVoid} className="font-bold text-xs h-9 rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidAuthorize}
              disabled={isVerifyingVoid || !managerPassword || (voidReason === 'Other' && !otherVoidReason)}
              className="bg-red-600 hover:bg-red-700 font-extrabold text-xs h-9 rounded-xl uppercase tracking-wider flex items-center gap-1.5"
            >
              {isVerifyingVoid && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Approve Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Status Validation dialog */}
      <TableStatusValidationDialog
        isOpen={isValidationOpen}
        onOpenChange={setIsValidationOpen}
        reason={validationParams.reason}
        errorMessage={validationParams.errorMessage}
        suggestedAction={validationParams.suggestedAction}
        onActionTriggered={() => {
          const { suggestedAction } = validationParams;
          if (suggestedAction === 'checkout') {
            setIsCheckoutOpen(true);
          }
        }}
      />
    </div>
  );
}
