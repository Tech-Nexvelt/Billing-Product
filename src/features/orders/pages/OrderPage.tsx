import { useEffect, useState, useRef, memo, useMemo } from 'react';
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
  ArrowRight,
  Sparkles,
  Printer,
  History,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { MenuItemWithTags, MenuItemWithVariantsAndModifiers } from '@/types/menu.types';
import { CartItem } from '@/types/order.types';
import { formatCurrency } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { ProductConfiguratorModal } from '@/components/shared/ProductConfiguratorModal';
import { computeCartItemHash } from '@/engines/cartHash.engine';
import { CheckoutDialog } from '../components/CheckoutDialog';
import { unifiedPrintReceipt } from '@/services/print.service';
import { managerAuthService } from '@/services/managerAuthorization.service';
import { printerService } from '@/services/printer.service';
import { useTopbarContent } from '@/components/shared/TopbarContext';
import { useRestaurant } from '@/hooks/useRestaurant';
import { RestaurantLogo } from '@/components/shared/RestaurantLogo';
import { MenuItemImage } from '@/components/shared/MenuItemImage';
import { TableStatus } from '@/types/table.types';
import { tableStatusValidationService } from '@/services/tableStatusValidation.service';
import { TableStatusValidationDialog } from '@/components/shared/TableStatusValidationDialog';
import { CashierLayout } from '@/layouts/CashierLayout';
import { mergeCartItems } from '@/hooks/useCartLifecycle';

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
  const { user, logout } = useAuthStore();
  const { restaurant, settings } = useRestaurant();
  const { items, categories, setItems, setCategories } = useMenuStore();
  const { tables, updateTable, setTables } = useTableStore();
  const { addOrder } = useOrderStore();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setTopbarContent } = useTopbarContent();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      logout();
      navigate(ROUTES.LOGIN);
      toast({ title: 'Logged out successfully' });
    } catch (err: any) {
      toast({
        title: 'Logout failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const safeLogActivity = async (action: string, resourceType: string, resourceId?: string | null, metadata?: any) => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validResId = resourceId && uuidRegex.test(resourceId) ? resourceId : null;
      const validUserId = user?.id && uuidRegex.test(user.id) ? user.id : null;
      const validRestId = user?.restaurant_id && uuidRegex.test(user.restaurant_id) ? user.restaurant_id : null;

      if (!validRestId) return;

      await supabase.from('activity_logs').insert({
        restaurant_id: validRestId,
        user_id: validUserId,
        action,
        resource_type: resourceType,
        resource_id: validResId,
        metadata: metadata || {}
      });
    } catch {
      // Ignore activity log failures
    }
  };

  const selectedTableId = searchParams.get('table');
  const shouldResumeBill = searchParams.get('resumeBill') === 'true';

  // Local Page State
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Automatically reset pagination to Page 1 when category or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, searchQuery]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState<MenuItemWithVariantsAndModifiers | null>(null);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CartItem | null>(null);

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
  const [lastCompletedOrder, setLastCompletedOrder] = useState<{
    id: string;
    number: string;
    items: CartItem[];
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    specialInstructions: string | null;
    paymentMethod: string;
  } | null>(null);

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

  const hasResumedSessionRef = useRef<Record<string, boolean>>({});
  const [isOrderLoading, setIsOrderLoading] = useState<boolean>(false);

  // Silent, single-execution, race-condition-free active order resume
  useEffect(() => {
    async function checkActiveOrder() {
      if (!selectedTableId || !user?.restaurant_id) return;

      const sessionKey = `${selectedTableId}_${shouldResumeBill ? 'resume' : 'normal'}`;
      if (hasResumedSessionRef.current[sessionKey]) {
        return;
      }

      setIsOrderLoading(true);

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
          activeOrderIdRef.current = activeOrder.id;
          setSpecialInstructions(activeOrder.special_instructions || '');

          // Load cart — consolidate non-deleted items
          const rawItems = (activeOrder.order_items || []).filter((oi: any) => !oi.deleted_at);
          const itemMap = new Map<string, CartItem>();

          for (const oi of rawItems) {
            const hash = oi.configuration_hash || computeCartItemHash(
              oi.menu_item_id || oi.id,
              oi.variant_id,
              oi.selected_modifiers || [],
              oi.special_notes || ''
            );
            const key = hash || oi.id;
            const existingItem = itemMap.get(key);
            if (existingItem) {
              existingItem.quantity += oi.quantity;
              existingItem.item_total += Number(oi.item_total);
            } else {
              itemMap.set(key, {
                db_id: oi.id,
                menu_item_id: oi.menu_item_id,
                variant_id: oi.variant_id || null,
                item_name: oi.item_name,
                category_name: oi.category_name || '',
                unit_price: Number(oi.unit_price),
                quantity: oi.quantity,
                item_total: Number(oi.item_total),
                selected_modifiers: oi.selected_modifiers || [],
                selected_variant_text: oi.selected_variant_text || '',
                special_notes: oi.special_notes || '',
                configuration_hash: key,
              });
            }
          }
          const loadedCart: CartItem[] = Array.from(itemMap.values());
          
          // Smart Merge with local cart additions to eliminate race conditions
          setCart(currentCart => mergeCartItems(loadedCart, currentCart));
          setHasUnsavedChanges(false);

          // Restore KOT-printed quantities
          try {
            const savedKot = localStorage.getItem(`nexvelt_pos_kot_${activeOrder.id}`);
            if (savedKot) setKotPrintedQtys(JSON.parse(savedKot));
            else setKotPrintedQtys({});
          } catch (_) {
            setKotPrintedQtys({});
          }
        } else {
          // Check local draft fallback
          const cachedCart = localStorage.getItem(`nexvelt_pos_cart_${selectedTableId}`);
          const cachedNotes = localStorage.getItem(`nexvelt_pos_notes_${selectedTableId}`);
          if (cachedCart) {
            const parsed = JSON.parse(cachedCart);
            setCart(currentCart => mergeCartItems(parsed, currentCart));
            setSpecialInstructions(cachedNotes || '');
            setActiveOrderId(null);
            activeOrderIdRef.current = null;
            setKotPrintedQtys({});
            setHasUnsavedChanges(true);
          } else {
            setCart(currentCart => currentCart.length > 0 ? currentCart : []);
            setSpecialInstructions('');
            setActiveOrderId(null);
            activeOrderIdRef.current = null;
            setKotPrintedQtys({});
            setHasUnsavedChanges(false);
          }
        }

        hasResumedSessionRef.current[sessionKey] = true;
      } catch (err) {
        console.error('Error checking active order silently:', err);
      } finally {
        setIsOrderLoading(false);
      }
    }

    checkActiveOrder();
  }, [selectedTableId, shouldResumeBill, user?.restaurant_id]);

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
            <RestaurantLogo size="xs" showName nameClassName="max-w-36 truncate text-sm font-extrabold text-foreground" />
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-10 rounded-xl font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Logout
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
      let rawData: any[] | null = null;
      const res1 = await supabase
        .from('users')
        .select('id, full_name, role_id, roles(name)')
        .is('deleted_at', null);

      if (res1.error || !res1.data) {
        const res2 = await supabase
          .from('users')
          .select('id, full_name, role_id')
          .is('deleted_at', null);
        rawData = res2.data as any[];
      } else {
        rawData = res1.data as any[];
      }

      const mList = (rawData || []).map((u: any) => ({
        ...u,
        email: `${u.full_name?.toLowerCase().replace(/\s+/g, '') || 'manager'}@store.com`,
        role: u.roles || u.role
      })).filter((u: any) => u.role?.name === 'Owner' || u.role?.name === 'Manager' || !u.role);

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

  /** Validates that a valid authenticated session exists before DB writes. */
  const ensureValidSession = async (): Promise<boolean> => {
    if (!user?.id || !user?.restaurant_id) {
      toast({ title: 'Auth Error', description: 'User profile or restaurant session not loaded. Please log in again.', variant: 'destructive' });
      return false;
    }
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session) {
        toast({ title: 'Session Expired', description: 'Your session has expired. Please log in again.', variant: 'destructive' });
        navigate('/login');
        return false;
      }
    }
    return true;
  };

  /** Creates a new draft order if one doesn't exist. Returns the orderId. */
  const ensureOrder = async (): Promise<string | null> => {
    if (!selectedTableId) return null;

    // Verify session validity before writing to database
    const isValidSession = await ensureValidSession();
    if (!isValidSession) return null;

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

    if (error) {
      console.error('Failed to insert order:', error);
      toast({ title: 'Order Creation Error', description: error.message, variant: 'destructive' });
      return null;
    }

    if (!newOrder) return null;

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

  const CONFIGURABLE_CATEGORY_NAMES = useMemo(() => [
    'cakes',
    'veg pizza',
    'non veg pizza',
    'bread pizza',
    'momos'
  ], []);

  const isConfigurableCategory = (item: MenuItemWithVariantsAndModifiers): boolean => {
    const catName = categories.find((c) => c.id === item.category_id)?.name || (item as any).category_name || '';
    const lowerCat = catName.toLowerCase().trim();
    return CONFIGURABLE_CATEGORY_NAMES.includes(lowerCat) || Boolean((item as any).is_variant_parent) || Boolean(item.variants && item.variants.length > 0);
  };

  const handleAddToCart = async (item: MenuItemWithVariantsAndModifiers) => {
    if (!selectedTableId) {
      toast({ title: 'Select Table', description: 'Assign a table first.', variant: 'destructive' });
      return;
    }

    if (isConfigurableCategory(item)) {
      setConfiguringProduct(item);
      setIsConfiguratorOpen(true);
      return;
    }

    // Direct Add to Cart for all non-configurable categories (Burgers, Coffee, Tea, Bakery, Pastries, Sandwiches, Rice, Starters, etc.)
    const defaultCartItem: CartItem = {
      menu_item_id: item.id,
      item_name: item.name,
      category_name: categories.find((c) => c.id === item.category_id)?.name || '',
      base_unit_price: item.selling_price,
      unit_price: item.selling_price,
      quantity: 1,
      item_total: item.selling_price,
      selected_modifiers: [],
      configuration_hash: computeCartItemHash(item.id, null, [], ''),
      image_url: item.image_url || undefined,
      is_veg: item.is_veg
    };

    await handleAddConfiguredCartItem(defaultCartItem);
  };

  const handleAddConfiguredCartItem = async (configuredItem: CartItem) => {
    if (!selectedTableId) {
      toast({ title: 'Select Table', description: 'Assign a table first.', variant: 'destructive' });
      return;
    }

    const hash = configuredItem.configuration_hash || computeCartItemHash(
      configuredItem.menu_item_id,
      configuredItem.variant_id,
      configuredItem.selected_modifiers || [],
      configuredItem.special_notes || ''
    );

    const existingIndex = cart.findIndex((i) => 
      i.configuration_hash === hash || 
      (i.menu_item_id === configuredItem.menu_item_id && !i.selected_modifiers?.length && !configuredItem.selected_modifiers?.length && !i.variant_id && !configuredItem.variant_id)
    );

    let nextCart: CartItem[];
    let targetCartItem: CartItem;

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + configuredItem.quantity;
      targetCartItem = {
        ...existing,
        quantity: newQty,
        item_total: newQty * existing.unit_price,
      };
      nextCart = [...cart];
      nextCart[existingIndex] = targetCartItem;
    } else {
      targetCartItem = {
        ...configuredItem,
        configuration_hash: hash,
      };
      nextCart = [...cart, targetCartItem];
    }

    setCart(nextCart);
    setHasUnsavedChanges(true);

    try {
      const orderId = await ensureOrder();
      if (!orderId) return;

      if (targetCartItem.db_id) {
        await supabase
          .from('order_items')
          .update({
            quantity: targetCartItem.quantity,
            item_total: targetCartItem.item_total,
            selected_modifiers: targetCartItem.selected_modifiers || [],
            special_notes: targetCartItem.special_notes || null,
          })
          .eq('id', targetCartItem.db_id);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            menu_item_id: targetCartItem.menu_item_id,
            variant_id: targetCartItem.variant_id || null,
            restaurant_id: user!.restaurant_id,
            item_name: targetCartItem.item_name,
            category_name: categories.find((c) => c.id === targetCartItem.menu_item_id)?.name || null,
            unit_price: targetCartItem.unit_price,
            quantity: targetCartItem.quantity,
            item_total: targetCartItem.item_total,
            selected_modifiers: targetCartItem.selected_modifiers || [],
            special_notes: targetCartItem.special_notes || null,
            configuration_hash: hash,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        if (inserted) {
          setCart((prev) =>
            prev.map((ci) =>
              (ci.configuration_hash === hash && !ci.db_id)
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

  const handleUpdateQuantity = async (targetKey: string, delta: number) => {
    const originalCart = [...cart];
    const targetItem = cart.find((i) => i.configuration_hash === targetKey || i.menu_item_id === targetKey || i.db_id === targetKey);
    if (!targetItem) return;

    const targetHash = targetItem.configuration_hash || targetItem.menu_item_id;
    const nextQty = targetItem.quantity + delta;
    const nextCart =
      nextQty <= 0
        ? cart.filter((i) => (i.configuration_hash || i.menu_item_id) !== targetHash)
        : cart.map((i) =>
            (i.configuration_hash || i.menu_item_id) === targetHash
              ? { ...i, quantity: nextQty, item_total: nextQty * i.unit_price }
              : i
          );

    setCart(nextCart);

    try {
      const orderId = activeOrderIdRef.current;
      const dbId = targetItem.db_id;

      if (orderId) {
        if (nextQty <= 0) {
          if (dbId) {
            await supabase
              .from('order_items')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', dbId);
          } else {
            await supabase
              .from('order_items')
              .update({ deleted_at: new Date().toISOString() })
              .eq('order_id', orderId)
              .eq('menu_item_id', targetItem.menu_item_id)
              .is('deleted_at', null);
          }

          await safeLogActivity(
            'cart_item_deleted',
            'order_item',
            dbId || targetItem.menu_item_id,
            { order_id: orderId, item_name: targetItem.item_name, quantity: targetItem.quantity, cashier: user?.full_name || 'Cashier' }
          );
        } else {
          if (dbId) {
            await supabase
              .from('order_items')
              .update({ quantity: nextQty, item_total: nextQty * targetItem.unit_price })
              .eq('id', dbId);
          } else {
            await supabase
              .from('order_items')
              .update({ quantity: nextQty, item_total: nextQty * targetItem.unit_price })
              .eq('order_id', orderId)
              .eq('menu_item_id', targetItem.menu_item_id)
              .is('deleted_at', null);
          }
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

  const handleRemoveFromCart = async (targetKey: string) => {
    const originalCart = [...cart];
    const targetItem = cart.find(
      (i) =>
        i.configuration_hash === targetKey ||
        i.db_id === targetKey ||
        i.menu_item_id === targetKey
    );
    if (!targetItem) return;

    const targetHash = targetItem.configuration_hash || targetItem.db_id || targetItem.menu_item_id;
    const nextCart = cart.filter(
      (i) => (i.configuration_hash || i.db_id || i.menu_item_id) !== targetHash
    );
    setCart(nextCart);

    try {
      const orderId = activeOrderIdRef.current;
      const dbId = targetItem.db_id;
      const itemId = targetItem.menu_item_id;

      if (orderId) {
        if (dbId) {
          await supabase
            .from('order_items')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', dbId);
        } else {
          await supabase
            .from('order_items')
            .update({ deleted_at: new Date().toISOString() })
            .eq('order_id', orderId)
            .eq('menu_item_id', itemId)
            .is('deleted_at', null);
        }

        await safeLogActivity(
          'cart_item_deleted',
          'order_item',
          dbId || itemId,
          { order_id: orderId, item_name: targetItem.item_name, quantity: targetItem.quantity, cashier: user?.full_name || 'Cashier' }
        );

        if (nextCart.length === 0) {
          await supabase
            .from('orders')
            .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
            .eq('id', orderId);
          setActiveOrderId(null);
          activeOrderIdRef.current = null;
          await supabase.from('tables').update({ current_bill: 0 }).eq('id', selectedTableId!);
          const res = await tableService.updateTableStatusValidated(selectedTableId!, 'available', user!);
          if (res.data) updateTable(res.data);
          await safeLogActivity(
            'order_emptied',
            'order',
            orderId,
            { table_id: selectedTableId, cashier: user?.full_name || 'Cashier' }
          );
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
      await safeLogActivity(
        'kot_printed',
        'order',
        orderId,
        {
          items_count: newItemsToPrint.length,
          items: newItemsToPrint.map(i => ({ name: i.item_name, qty: i.quantity })),
          kot_number: kotSeq || orderId.substring(0, 8).toUpperCase(),
          cashier: user?.full_name || 'Cashier',
          timestamp: new Date().toISOString(),
        }
      );

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
            deleted_at: new Date().toISOString()
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
  ) => {
    if (!activeOrderId || !selectedTableId) {
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
        await safeLogActivity(
          'table_status_changed',
          'table',
          selectedTableId,
          {
            previous_status: 'occupied',
            new_status: 'available',
            user_name: user?.full_name || 'Cashier'
          }
        );
      } else {
        const res = await tableService.updateTableStatusValidated(selectedTableId, 'cleaning', user!);
        if (res.data) {
          updateTable(res.data);
        }
      }

      // Save snapshot of completed order for reprint actions in Checkout Successful modal
      const completedData = {
        id: activeOrderId,
        number: invoiceNum || activeOrderId.substring(0, 8).toUpperCase(),
        items: [...cart],
        subtotal,
        taxAmount,
        grandTotal,
        specialInstructions: specialInstructions || null,
        paymentMethod,
      };
      setLastCompletedOrder(completedData);

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
      });

      toast({ title: 'Payment Completed', description: 'Order completed and Customer copy printed.' });
      setIsCheckoutOpen(false);
      setIsSuccessDialogOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to complete checkout', description: err.message, variant: 'destructive' });
    }
  };

  const handleReprintCustomerFromSuccess = async () => {
    const targetOrder = lastCompletedOrder;
    const orderId = targetOrder?.id || activeOrderId;
    if (!orderId) {
      toast({ title: 'No Order Data', description: 'Order details not found for reprint.', variant: 'destructive' });
      return;
    }
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'customer',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: targetOrder?.number || orderId.substring(0, 8).toUpperCase(),
        orderId: orderId,
        items: targetOrder?.items || cart,
        subtotal: targetOrder?.subtotal ?? subtotal,
        taxRate,
        taxAmount: targetOrder?.taxAmount ?? taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal: targetOrder?.grandTotal ?? grandTotal,
        paymentMethod: targetOrder?.paymentMethod || completedPaymentMethod,
        specialInstructions: targetOrder?.specialInstructions || specialInstructions,
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
    const targetOrder = lastCompletedOrder;
    const orderId = targetOrder?.id || activeOrderId;
    if (!orderId) {
      toast({ title: 'No Order Data', description: 'Order details not found for reprint.', variant: 'destructive' });
      return;
    }
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'owner',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: targetOrder?.number || orderId.substring(0, 8).toUpperCase(),
        orderId: orderId,
        items: targetOrder?.items || cart,
        subtotal: targetOrder?.subtotal ?? subtotal,
        taxRate,
        taxAmount: targetOrder?.taxAmount ?? taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal: targetOrder?.grandTotal ?? grandTotal,
        paymentMethod: targetOrder?.paymentMethod || completedPaymentMethod,
        specialInstructions: targetOrder?.specialInstructions || specialInstructions,
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
    const targetOrder = lastCompletedOrder;
    const orderId = targetOrder?.id || activeOrderId;
    if (!orderId) {
      toast({ title: 'No Order Data', description: 'Order details not found for reprint.', variant: 'destructive' });
      return;
    }
    try {
      const activeTableObj = tables.find(t => t.id === selectedTableId);
      const { data: printers } = await printerService.getAll(user!.restaurant_id);

      await unifiedPrintReceipt({
        type: 'kot',
        restaurant,
        table: activeTableObj,
        floorName: activeTableObj?.floor_id || 'Main Area',
        cashierName: user?.full_name || 'Cashier',
        orderNumber: targetOrder?.number || orderId.substring(0, 8).toUpperCase(),
        orderId: orderId,
        items: targetOrder?.items || cart,
        subtotal: targetOrder?.subtotal ?? subtotal,
        taxRate,
        taxAmount: targetOrder?.taxAmount ?? taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal: targetOrder?.grandTotal ?? grandTotal,
        paymentMethod: 'KOT - KITCHEN ONLY',
        specialInstructions: targetOrder?.specialInstructions || specialInstructions,
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
      if (res.data) updateTable(res.data);
      setLastCompletedOrder(null);
      setCart([]);
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
      await safeLogActivity(
        'receipt_voided',
        'order',
        voidOrderId,
        {
          void_reason: finalReason,
          void_approved_by_name: authRes.user.full_name,
          timestamp: new Date().toISOString()
        }
      );

      toast({ title: 'Receipt Voided', description: 'Order void status logged successfully.' });
      setIsVoidAuthOpen(false);
      setManagerPassword('');
    } catch (err: any) {
      toast({ title: 'Void Authorization Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsVerifyingVoid(false);
    }
  };

  // Filter Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [categories, categorySearchQuery]);

  // Memoized Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    const selectedCat = categories.find((c) => c.id === selectedCategoryId);
    return items.filter((item: MenuItemWithTags) => {
      if ((item as any).parent_menu_item_id != null) return false;
      const matchesCategory = selectedCategoryId
        ? item.category_id === selectedCategoryId ||
          (selectedCat && (item as any).category_name?.toLowerCase() === selectedCat.name.toLowerCase())
        : true;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategoryId, searchQuery, categories]);

  const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / ITEMS_PER_PAGE));

  // Memoized Paginated Slices for current page (Max 10 products per page)
  const paginatedMenuItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMenuItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMenuItems, currentPage, ITEMS_PER_PAGE]);

  return (
    <CashierLayout>
        <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0 overflow-hidden w-full">
          <div className="flex flex-row items-stretch gap-3.5 flex-1 w-full overflow-hidden h-full min-h-0">
            
            {/* LEFT COLUMN: Product Category Panel (Dedicated 220-260px Billing Category Menu) */}
            <div className="w-56 lg:w-60 xl:w-64 bg-card border border-border rounded-2xl flex flex-col overflow-hidden p-3.5 space-y-3 shrink-0 shadow-sm h-full min-h-0">
              <div className="space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categories</Label>
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">{categories.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search category..."
                    className="pl-8 text-xs h-8.5 rounded-xl"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {/* All Items Button */}
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left border ${
                    selectedCategoryId === null
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-background hover:bg-muted text-foreground border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Items</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    selectedCategoryId === null ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {items.length}
                  </span>
                </button>

                {/* Individual Category Buttons */}
                {filteredCategories.map((category) => {
                  const isSelected = selectedCategoryId === category.id;
                  const itemCount = items.filter(i => {
                    if ((i as any).parent_menu_item_id != null) return false;
                    return i.category_id === category.id || ((i as any).category_name && (i as any).category_name.toLowerCase() === category.name.toLowerCase());
                  }).length;

                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left border ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-background hover:bg-muted text-foreground border-border'
                      }`}
                      style={isSelected && category.color ? {
                        backgroundColor: category.color,
                        borderColor: category.color,
                        boxShadow: `0 4px 12px ${category.color}35`
                      } : undefined}
                    >
                      <span className="truncate">{category.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ml-1 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {itemCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CENTER COLUMN: Product Grid with Enterprise Pagination */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="aspect-[4/3] bg-muted/30 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredMenuItems.length === 0 ? (
                  <div className="text-center py-20 bg-card rounded-2xl border border-border">
                    <p className="text-muted-foreground text-sm font-semibold">
                      {searchQuery
                        ? `No matching products found for "${searchQuery}"`
                        : 'No products available in this category.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-4">
                    {paginatedMenuItems.map((item: MenuItemWithTags) => {
                      const isAvailable = item.availability_status === 'available';

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
                            </div>

                            <div className="flex flex-col justify-between flex-1">
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                    {item.name}
                                  </h4>
                                  {isConfigurableCategory(item) && item.variants && item.variants.length > 0 && (
                                    <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0 font-extrabold">
                                      {item.variants.length} Variants
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {item.description || 'Fresh & delicious choice'}
                                </p>
                              </div>
                              <div className="flex justify-between items-center mt-2.5">
                                <div>
                                  {isConfigurableCategory(item) && item.variants && item.variants.length > 0 ? (
                                    <span className="font-black text-xs text-primary">
                                      From {formatCurrency(Math.min(...item.variants.map(v => v.price_override ?? item.selling_price)))}
                                    </span>
                                  ) : (
                                    <span className="font-black text-sm text-foreground">{formatCurrency(item.selling_price)}</span>
                                  )}
                                </div>
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

              {/* PAGINATION CONTROLS BAR */}
              {!isLoading && filteredMenuItems.length > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-border mt-auto shrink-0 bg-card px-3 py-2.5 rounded-2xl shadow-sm">
                  <div className="text-xs text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{Math.min(filteredMenuItems.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}–{Math.min(filteredMenuItems.length, currentPage * ITEMS_PER_PAGE)}</span> of <span className="font-bold text-foreground">{filteredMenuItems.length}</span> products
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="h-8 px-2.5 text-xs font-bold rounded-xl"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-xl text-xs font-extrabold transition-all border ${
                            currentPage === page
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-background hover:bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="h-8 px-2.5 text-xs font-bold rounded-xl"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Bill Cart Panel (Full-Height Fixed Footer Architecture) */}
            <div className="w-80 lg:w-88 xl:w-96 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm h-full max-h-full min-h-0 shrink-0">
              {/* Cart Header */}
              <div className="p-3.5 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
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

              {/* Scrollable Cart Items Container */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 scrollbar-thin">
                {isOrderLoading ? (
                  <div className="space-y-2.5">
                    <div className="h-14 bg-muted/40 rounded-xl animate-pulse" />
                    <div className="h-14 bg-muted/40 rounded-xl animate-pulse" />
                    <div className="h-14 bg-muted/40 rounded-xl animate-pulse" />
                  </div>
                ) : cart.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                      <ShoppingCart className="w-6 h-6 text-slate-400 opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-600">Your billing cart is empty</p>
                      <p className="text-[11px] text-muted-foreground">Select dishes from the menu to populate invoice</p>
                    </div>
                  </div>
                ) : (
                  cart.map((item: CartItem) => {
                    const itemKey = item.configuration_hash || item.db_id || item.menu_item_id;

                    return (
                      <div 
                        key={itemKey} 
                        className="p-3 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2.5 transition-all hover:border-primary/40 group"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-extrabold text-xs text-foreground leading-snug">{item.item_name}</h5>
                            {item.selected_variant_text && (
                              <p className="text-[10px] text-primary font-bold mt-0.5 leading-tight">
                                {item.selected_variant_text}
                              </p>
                            )}
                            {item.special_notes && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                                * Note: {item.special_notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-extrabold text-foreground block">
                              {formatCurrency(item.item_total)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              {formatCurrency(item.unit_price)} ea
                            </span>
                          </div>
                        </div>

                        {/* ENTERPRISE TOUCH-FRIENDLY POS ACTION CONTROLS */}
                        <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                          {/* Stepper Quantity Controls */}
                          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-background text-foreground active:scale-95 transition-all shrink-0"
                              onClick={() => {
                                if (item.quantity === 1) {
                                  setItemToDelete(item);
                                } else {
                                  handleUpdateQuantity(itemKey, -1);
                                }
                              }}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="font-mono text-sm font-black w-7 text-center text-foreground">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-background text-foreground active:scale-95 transition-all shrink-0"
                              onClick={() => handleUpdateQuantity(itemKey, 1)}
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* 40x40px Touch Target Delete Button with Tooltip & Confirmation */}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remove Item"
                            className="h-10 w-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all shadow-xs flex items-center justify-center shrink-0"
                            onClick={() => setItemToDelete(item)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4.5 h-4.5 stroke-[2.2]" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Permanently Fixed Footer Container */}
              <div className="p-3.5 border-t border-border space-y-3 shrink-0 bg-card shadow-inner mt-auto">
                {/* Kitchen Instructions */}
                <div className="space-y-1">
                  <Label htmlFor="specialInstructions" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Kitchen Instructions / Notes</Label>
                  <Input
                    id="specialInstructions"
                    placeholder="e.g. Medium spicy, no onions"
                    value={specialInstructions}
                    onChange={(e) => {
                      setSpecialInstructions(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="text-xs rounded-xl h-8 bg-slate-50/50"
                  />
                </div>

                {/* Totals Section */}
                <div className="space-y-1.5 text-xs border-t border-border/60 pt-2.5">
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>GST Tax ({taxRate}%)</span>
                    <span className="font-bold text-slate-800">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/80 pt-2 text-sm text-foreground font-extrabold">
                    <span>Total Due</span>
                    <span className="text-[#0AB190] text-base font-black">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* 3 Receipt Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  <Button
                    variant="outline"
                    className="font-extrabold text-[9.5px] sm:text-[10px] tracking-wider uppercase h-9 px-1 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 truncate"
                    disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
                    onClick={handleCustomerReceiptClick}
                  >
                    <Printer className="w-3 h-3 shrink-0" /> <span className="truncate">Customer Receipt</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="font-extrabold text-[9.5px] sm:text-[10px] tracking-wider uppercase h-9 px-1 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 truncate"
                    disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
                    onClick={handlePrintKotClick}
                  >
                    <Printer className="w-3 h-3 shrink-0" /> <span className="truncate">Print KOT</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="font-extrabold text-[9.5px] sm:text-[10px] tracking-wider uppercase h-9 px-1 border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-1 truncate"
                    disabled={isPlacingOrder || cart.length === 0 || !activeOrderId}
                    onClick={handleOwnerCopyClick}
                  >
                    <Printer className="w-3 h-3 shrink-0" /> <span className="truncate">Owner Copy</span>
                  </Button>
                </div>

                {/* Proceed to Payment Action Button */}
                <Button
                  className="w-full h-11 bg-[#0AB190] hover:bg-[#057B62] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-[0.99]"
                  disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
                  onClick={() => setIsCheckoutOpen(true)}
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
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

      {/* Product Configurator Modal */}
      <ProductConfiguratorModal
        isOpen={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
        product={configuringProduct}
        onAddToCart={handleAddConfiguredCartItem}
      />

      {/* REMOVE ITEM CONFIRMATION DIALOG */}
      <Dialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Remove Item from Cart?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Are you sure you want to remove <strong className="text-foreground">{itemToDelete?.item_name}</strong> {itemToDelete?.selected_variant_text ? `(${itemToDelete.selected_variant_text})` : ''} from the order cart?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setItemToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md"
              onClick={() => {
                if (itemToDelete) {
                  const itemKey = itemToDelete.configuration_hash || itemToDelete.db_id || itemToDelete.menu_item_id;
                  handleRemoveFromCart(itemKey);
                  setItemToDelete(null);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
    </CashierLayout>
  );
}
