import { useEffect, useState, useRef, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useMenuStore } from '@/stores/menu.store';
import { useTableStore } from '@/stores/table.store';
import { useOrderStore } from '@/stores/order.store';
import { menuService } from '@/services/menu.service';
import { tableService } from '@/services/table.service';
import { orderService } from '@/services/order.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Loader2, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MenuItemWithTags } from '@/types/menu.types';
import { CartItem } from '@/types/order.types';
import { formatCurrency } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { CheckoutDialog } from '../components/CheckoutDialog';
import { printReceipts } from '@/services/print.service';
import { printerService } from '@/services/printer.service';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useTopbarContent } from '@/components/shared/TopbarContext';
import { ROUTES } from '@/constants/routes';
import { useRestaurant } from '@/hooks/useRestaurant';
import { MenuItemImage } from '@/components/shared/MenuItemImage';

// Native viewport intersection observer-based card virtualizer
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

    const target = ref.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, []);

  return (
    <div ref={ref} className="w-full h-full min-h-[180px]">
      {isVisible ? children : <div className="w-full h-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse" />}
    </div>
  );
});
VirtualCard.displayName = 'VirtualCard';

export function OrderPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setTopbarContent } = useTopbarContent();
  const { restaurant } = useRestaurant();
  const [searchParams] = useSearchParams();

  // Selected table ID from URL query params
  const queryTableId = searchParams.get('table');
  const shouldResumeBill = searchParams.get('resumeBill') === 'true';

  const { items: menuItems, categories, setCategories, setItems: setMenuItems } = useMenuStore();
  const { tables, setTables } = useTableStore();
  const { addOrder } = useOrderStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Active Order tracking (for occupied tables)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  // Taxes and charges defaults (will load from settings)
  const [taxRate, setTaxRate] = useState(5.0); // 5% default
  const [serviceChargeRate, setServiceChargeRate] = useState(0.0);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadOrderScreenData();
  }, [user?.restaurant_id]);

  // Smart category image preloading and adjacent preloading
  useEffect(() => {
    if (!selectedCategoryId || menuItems.length === 0) return;

    // 1. Preload active category
    const activeItems = menuItems.filter(item => item.category_id === selectedCategoryId);
    activeItems.forEach(item => {
      if (item.image_url) {
        const img = new Image();
        img.src = item.image_url;
      }
    });

    // 2. Preload adjacent categories during idle times (next/prev)
    const currentIdx = categories.findIndex(c => c.id === selectedCategoryId);
    if (currentIdx !== -1) {
      const adjacentIdxs = [currentIdx - 1, currentIdx + 1].filter(idx => idx >= 0 && idx < categories.length);
      
      const preloadAdjacent = () => {
        adjacentIdxs.forEach(idx => {
          const catId = categories[idx]?.id;
          if (!catId) return;
          const adjacentItems = menuItems.filter(item => item.category_id === catId);
          adjacentItems.forEach(item => {
            if (item.image_url) {
              const img = new Image();
              img.src = item.image_url;
            }
          });
        });
      };

      const timeoutId = setTimeout(() => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(preloadAdjacent);
        } else {
          preloadAdjacent();
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedCategoryId, menuItems, categories]);

  useEffect(() => {
    if (queryTableId && tables.length > 0) {
      setSelectedTableId(queryTableId);
    }
  }, [queryTableId, tables]);

  // Query and resume active order when selected table changes
  useEffect(() => {
    if (!selectedTableId || !user?.restaurant_id) return;

    async function checkActiveOrder() {
      try {
        const orderStatuses = shouldResumeBill
          ? ['draft', 'pending', 'preparing', 'completed']
          : ['draft', 'pending', 'preparing'];

        const { data: activeOrders, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('restaurant_id', user!.restaurant_id)
          .eq('table_id', selectedTableId)
          .in('status', orderStatuses)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (activeOrders && activeOrders.length > 0) {
          const activeOrder = activeOrders[0];
          setActiveOrderId(activeOrder.id);
          setSpecialInstructions(activeOrder.special_instructions || '');
          
          // Populate cart items
          const loadedCart: CartItem[] = activeOrder.order_items.map((oi: any) => ({
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
          
          toast({
            title: shouldResumeBill ? 'Resumed Bill' : 'Resumed Order',
            description: `Loaded saved cart details for Table ${tables.find(t => t.id === selectedTableId)?.table_number || ''}`,
          });
        } else {
          // If no active order, clear cart and activeOrderId
          setCart([]);
          setSpecialInstructions('');
          setActiveOrderId(null);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error('Error checking active order:', err);
      }
    }

    checkActiveOrder();
  }, [selectedTableId, shouldResumeBill, tables, user?.restaurant_id]);

  const loadOrderScreenData = async () => {
    setIsLoading(true);
    try {
      const [catsRes, itemsRes, tablesRes, settingsRes] = await Promise.all([
        menuService.getCategories(user!.restaurant_id),
        menuService.getMenuItems(user!.restaurant_id),
        tableService.getTables(user!.restaurant_id),
        supabase.from('restaurant_settings').select('tax_rate, service_charge').eq('restaurant_id', user!.restaurant_id).single(),
      ]);

      if (catsRes.data) {
        setCategories(catsRes.data);
        if (catsRes.data.length > 0) {
          setSelectedCategoryId(catsRes.data[0].id);
        }
      }
      if (itemsRes.data) setMenuItems(itemsRes.data);
      if (tablesRes.data) setTables(tablesRes.data);
      
      if (settingsRes.data) {
        setTaxRate(Number(settingsRes.data.tax_rate));
        setServiceChargeRate(Number(settingsRes.data.service_charge));
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (item: MenuItemWithTags) => {
    // If not available, cannot add
    if (item.availability_status !== 'available') return;

    setHasUnsavedChanges(true);
    setCart((prev) => {
      const existing = prev.find((i) => i.menu_item_id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === item.id
            ? { ...i, quantity: i.quantity + 1, item_total: (i.quantity + 1) * i.unit_price }
            : i
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          item_name: item.name,
          category_name: categories.find((c) => c.id === item.category_id)?.name || '',
          unit_price: item.selling_price,
          quantity: 1,
          item_total: item.selling_price,
          image_url: item.image_url || undefined,
          is_veg: item.is_veg,
        },
      ];
    });
    toast({
      title: 'Added to cart',
      description: `${item.name} has been added to this order.`,
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setHasUnsavedChanges(true);
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.menu_item_id !== itemId) return i;
          const nextQty = i.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...i, quantity: nextQty, item_total: nextQty * i.unit_price };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (itemId: string) => {
    setHasUnsavedChanges(true);
    setCart((prev) => prev.filter((i) => i.menu_item_id !== itemId));
  };

  // Helper function to print Kitchen Order Ticket (KOT)
  const handlePrintKot = async (orderId: string) => {
    try {
      const activeTable = tables.find((t) => t.id === selectedTableId);
      if (!activeTable) return;

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user!.restaurant_id)
        .single();

      const { data: floor } = await supabase
        .from('floors')
        .select('name')
        .eq('id', activeTable.floor_id)
        .single();
      const floorName = floor?.name || 'Main Area';

      const { data: printers } = await printerService.getAll(user!.restaurant_id);
      const kitchenPrinter = printers?.find(p => p.is_default_kitchen);

      const kotData = {
        restaurant_name: restaurant?.name || 'NexVelt Restaurant',
        order_number: orderId.substring(0, 8).toUpperCase(),
        token_number: 1,
        table_number: activeTable?.table_number || '',
        floor_name: floorName,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashier_name: user?.full_name || 'Cashier',
        items: cart.map(i => ({ name: i.item_name, quantity: i.quantity, special_notes: i.special_notes || null })),
        is_reprint: false,
        kitchen_notes: specialInstructions || null,
      };

      if (kitchenPrinter) {
        if (kitchenPrinter.connection_type === 'browser') {
          printerService.printKot(kotData, kitchenPrinter.paper_size);
        } else {
          await printerService.createPrinterJob(
            kitchenPrinter.id,
            user!.restaurant_id,
            'kot',
            kotData as any,
            orderId,
            user!.id
          );
          toast({ title: 'KOT Dispatched', description: `Order sent directly to ${kitchenPrinter.name}.` });
        }
      } else {
        printReceipts({
          restaurantName: restaurant?.name || 'NexVelt Restaurant',
          address: restaurant?.address || '',
          phone: restaurant?.phone || '',
          email: restaurant?.email || '',
          gstNumber: restaurant?.gst_number || '',
          logoUrl: '/logo.png',
          currencySymbol: '₹',
          tableNumber: activeTable?.table_number || '',
          orderNumber: orderId.substring(0, 8).toUpperCase(),
          cashierName: user?.full_name || 'Cashier',
          timestamp: new Date().toLocaleString(),
          items: cart,
          subtotal,
          taxRate,
          taxAmount,
          serviceChargeRate,
          serviceChargeAmount,
          discountAmount: 0,
          grandTotal,
          paymentMethod: 'KOT - KITCHEN ONLY',
        }, { kot: true, bill: false });
      }
    } catch (err: any) {
      console.error('KOT printing failed:', err);
    }
  };

  // Helper function to print Bills (Customer + Restaurant copies)
  const handlePrintBill = async (orderId: string, paymentMethod: string, printWindow?: Window | null) => {
    try {
      const activeTable = tables.find((t) => t.id === selectedTableId);
      if (!activeTable) return;

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user!.restaurant_id)
        .single();

      const { data: floor } = await supabase
        .from('floors')
        .select('name')
        .eq('id', activeTable.floor_id)
        .single();
      const floorName = floor?.name || 'Main Area';

      const { data: printers } = await printerService.getAll(user!.restaurant_id);
      const billingPrinter = printers?.find(p => p.is_default_billing);

      const gstAmount = taxAmount;
      const cgstAmount = gstAmount / 2;
      const sgstAmount = gstAmount / 2;

      const billData = {
        restaurant_name: restaurant?.name || 'NexVelt Restaurant',
        restaurant_logo_url: '/logo.png',
        restaurant_address: restaurant?.address || null,
        restaurant_phone: restaurant?.phone || null,
        restaurant_email: restaurant?.email || null,
        gst_number: restaurant?.gst_number || null,
        bill_number: orderId.substring(0, 8).toUpperCase(),
        invoice_number: orderId.substring(0, 8).toUpperCase(),
        order_number: orderId.substring(0, 8).toUpperCase(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashier_name: user?.full_name || 'Cashier',
        customer_name: null,
        customer_phone: null,
        customer_gst: null,
        table_number: activeTable?.table_number || '',
        floor_name: floorName,
        items: cart.map(i => ({
          name: i.item_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          item_total: i.item_total,
          special_notes: i.special_notes || null
        })),
        subtotal,
        discount_type: null,
        discount_rate: null,
        discount_amount: 0,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: 0,
        total_tax: gstAmount,
        grand_total: grandTotal,
        payments: [{ method: paymentMethod, amount: grandTotal }],
        footer_message: 'Thank You! Visit Again',
        currency_symbol: '₹',
      };

      if (billingPrinter) {
        printWindow?.close();
        if (billingPrinter.connection_type === 'browser') {
          printerService.printBill(billData, billingPrinter.paper_size, 'customer');
          printerService.printBill(billData, billingPrinter.paper_size, 'restaurant');
        } else {
          await printerService.createPrinterJob(
            billingPrinter.id,
            user!.restaurant_id,
            'customer_receipt',
            billData as any,
            orderId,
            user!.id
          );
          await printerService.createPrinterJob(
            billingPrinter.id,
            user!.restaurant_id,
            'restaurant_receipt',
            { ...billData, template: 'restaurant' } as any,
            orderId,
            user!.id
          );
          toast({ title: 'Bill Dispatched', description: `Receipts sent directly to ${billingPrinter.name}.` });
        }
      } else {
        printReceipts({
          restaurantName: restaurant?.name || 'NexVelt Restaurant',
          address: restaurant?.address || '',
          phone: restaurant?.phone || '',
          email: restaurant?.email || '',
          gstNumber: restaurant?.gst_number || '',
          logoUrl: '/logo.png',
          currencySymbol: '₹',
          tableNumber: activeTable?.table_number || '',
          orderNumber: orderId.substring(0, 8).toUpperCase(),
          cashierName: user?.full_name || 'Cashier',
          timestamp: new Date().toLocaleString(),
          items: cart,
          subtotal,
          taxRate,
          taxAmount,
          serviceChargeRate,
          serviceChargeAmount,
          discountAmount: 0,
          grandTotal,
          paymentMethod,
        }, { kot: false, bill: true }, printWindow);
      }
    } catch (err: any) {
      console.error('Bill printing failed:', err);
    }
  };

  // Generate Invoice: saves current cart draft/pending to DB, then launches payment modal
  const handleGenerateInvoice = async () => {
    if (!selectedTableId) {
      toast({ title: 'Select Table', description: 'Please assign a table.', variant: 'destructive' });
      return;
    }
    if (cart.length === 0) {
      toast({ title: 'Cart Empty', description: 'Please add dishes to generate an invoice.', variant: 'destructive' });
      return;
    }

    setIsPlacingOrder(true);
    try {
      const activeTable = tables.find((t) => t.id === selectedTableId);
      if (!activeTable) throw new Error('Selected table not found.');

      if (activeOrderId) {
        // Sync updated items for existing order
        await supabase.from('order_items').delete().eq('order_id', activeOrderId);
        
        const orderItems = cart.map((item) => ({
          order_id: activeOrderId,
          menu_item_id: item.menu_item_id,
          restaurant_id: user!.restaurant_id,
          item_name: item.item_name,
          category_name: item.category_name || null,
          unit_price: item.unit_price,
          quantity: item.quantity,
          item_total: item.item_total,
          special_notes: item.special_notes || null,
        }));
        
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        const { error: orderError } = await supabase
          .from('orders')
          .update({
            subtotal,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            special_instructions: specialInstructions || null,
            updated_by: user!.id,
          })
          .eq('id', activeOrderId);
        if (orderError) throw orderError;

        // Print KOT directly to kitchen printer on update
        await handlePrintKot(activeOrderId);
      } else {
        // Create new pending order
        const res = await orderService.createOrder(
          user!.restaurant_id,
          user!.id,
          selectedTableId,
          activeTable.floor_id,
          cart,
          specialInstructions
        );
        if (res.error) throw new Error(res.error.message);
        if (res.data) {
          addOrder(res.data);
          setActiveOrderId(res.data.id);
          // Print KOT directly to kitchen printer on creation
          await handlePrintKot(res.data.id);
        }
      }

      setHasUnsavedChanges(false);
      setIsCheckoutOpen(true);
    } catch (err: any) {
      toast({ title: 'Invoice Error', description: err.message, variant: 'destructive' });
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
      // 1. Mark order completed
      const nextStatus = 'completed';
      const res = await orderService.updateOrderStatus(activeOrderId, nextStatus, user!.id);
      if (res.error) throw new Error(res.error.message);

      // 2. Trigger Print Receipt Copies (Customer + Restaurant copies only)
      await handlePrintBill(activeOrderId, paymentMethod, printWindow);

      toast({ title: 'Payment Completed', description: 'Bill printed successfully.' });
      setIsCheckoutOpen(false);
      
      // 4. Return immediately to tables home screen
      navigate('/');
    } catch (err: any) {
      printWindow?.close();
      toast({ title: 'Failed to complete order', description: err.message, variant: 'destructive' });
    }
  };

  const handlePrintPreview = async () => {
    if (!selectedTableId || !activeOrderId) return;
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user!.restaurant_id)
        .single();

      const activeTable = tables.find((t) => t.id === selectedTableId);

      printReceipts({
        restaurantName: restaurant?.name || 'NexVelt POS',
        gstNumber: restaurant?.gst_number || 'N/A',
        address: restaurant?.address || 'N/A',
        phone: restaurant?.phone || 'N/A',
        email: restaurant?.email || '',
        logoUrl: '/logo.png',
        currencySymbol: '₹',
        tableNumber: activeTable?.table_number || '00',
        orderNumber: activeOrderId.substring(0, 8).toUpperCase(),
        cashierName: user?.full_name || 'Cashier',
        timestamp: new Date().toLocaleString(),
        items: cart,
        subtotal,
        taxRate,
        taxAmount,
        serviceChargeRate,
        serviceChargeAmount,
        discountAmount: 0,
        grandTotal,
        paymentMethod: 'DRAFT - PREVIEW ONLY',
      });
      toast({ title: 'Preview Sent', description: 'Receipt copy opened in print preview.' });
    } catch (err: any) {
      toast({ title: 'Preview Failed', description: err.message, variant: 'destructive' });
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, i) => sum + i.item_total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const serviceChargeAmount = (subtotal * serviceChargeRate) / 100;
  const grandTotal = subtotal + taxAmount + serviceChargeAmount;

  // Filters
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategoryId ? item.category_id === selectedCategoryId : true;
    
    if (!searchQuery.trim()) {
      return matchesCategory;
    }

    const query = searchQuery.toLowerCase();
    const matchesName = item.name.toLowerCase().includes(query);
    const matchesSku = item.sku?.toLowerCase().includes(query);
    const matchesBarcode = item.barcode?.toLowerCase().includes(query);
    
    const itemCategoryName = categories.find((c) => c.id === item.category_id)?.name.toLowerCase() || '';
    const matchesCategoryName = itemCategoryName.includes(query);

    const matchesTags = item.tags?.some(
      (t) => t.label.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query)
    ) || false;

    return matchesName || matchesSku || matchesBarcode || matchesCategoryName || matchesTags;
  });

  const activeTable = tables.find((t) => t.id === selectedTableId);

  const returnToTables = () => navigate(ROUTES.TABLES);

  const handleBackToTables = () => {
    if (hasUnsavedChanges) {
      setIsDiscardConfirmOpen(true);
      return;
    }
    returnToTables();
  };

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
          <div className="min-w-0 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1.5 sm:px-3">
            <p className="whitespace-nowrap text-xs font-extrabold text-primary">Table {activeTable?.table_number || '—'}</p>
            <p className="hidden whitespace-nowrap text-[10px] font-semibold capitalize text-[#057B62] sm:block">
              {activeTable ? `${activeTable.status} · ${activeTable.customer_count || activeTable.capacity} guests` : 'Loading table'}
            </p>
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
          <span className="hidden whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-[10px] font-extrabold uppercase text-primary lg:inline">{shiftName}</span>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={loadOrderScreenData} aria-label="Refresh order screen">
            <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      ),
    });

    return () => setTopbarContent(null);
  }, [activeTable?.capacity, activeTable?.customer_count, activeTable?.status, activeTable?.table_number, hasUnsavedChanges, isLoading, restaurant?.logo_url, restaurant?.name, searchQuery, setTopbarContent]);

  return (
    <div className="min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)] flex flex-col space-y-4 pb-20 lg:pb-0">
      {/* 3-Column Grid Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 flex-1 overflow-visible lg:overflow-hidden">
        
        {/* LEFT COLUMN: Categories */}
        <div className="col-span-12 lg:col-span-2 bg-card border border-border rounded-2xl flex flex-col overflow-hidden p-4 space-y-3.5 shrink-0">
          <div className="space-y-1.5 shrink-0">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Categories</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search cats..."
                className="pl-8 text-xs h-8"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Categories list (horizontal scroll on mobile/tablet, vertical scroll on desktop) */}
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
          {/* Items Grid */}
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
                {filteredMenuItems.map((item) => {
                  const isAvailable = item.availability_status === 'available';

                  // Determine system tags
                  const isPopular = item.image_url?.includes('popular') || item.selling_price < 200; // placeholder test
                  const isChef = item.image_url?.includes('special') || item.selling_price > 400; // placeholder test

                  return (
                    <VirtualCard key={item.id}>
                      <div
                        onClick={() => isAvailable && handleAddToCart(item)}
                        className={`bg-card rounded-2xl border border-border overflow-hidden p-3 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between relative group h-full ${
                          !isAvailable ? 'opacity-40 cursor-not-allowed pointer-events-none bg-slate-100' : ''
                        }`}
                      >
                        {/* Image container */}
                        <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden mb-2.5">
                          <MenuItemImage 
                            src={item.image_url} 
                            alt={item.name} 
                            availabilityStatus={item.availability_status} 
                          />
                          {/* Veg / Non-Veg Indicator */}
                          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur p-1 rounded-md border border-border flex items-center justify-center z-10">
                            <span className={`w-2.5 h-2.5 rounded-full border border-white ${
                              item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                          </div>

                          {/* Chef Special or Popular badges */}
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

                        {/* Details */}
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight min-h-[2rem]">
                            {item.name}
                          </h4>
                          
                          <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                            <span className="font-extrabold text-xs text-primary">₹{item.selling_price}</span>
                            {item.prep_time && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3" /> {item.prep_time}m
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

        {/* RIGHT COLUMN: Cart & Billing Checkout */}
        <div className={`${isMobileCartOpen ? 'fixed inset-x-3 top-20 bottom-3 z-40 flex' : 'hidden'} lg:static lg:inset-auto lg:col-span-4 lg:flex lg:h-full bg-card border border-border rounded-2xl flex-col overflow-hidden shadow-sm`}>
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <span className="font-extrabold text-sm text-foreground">Current Order Ticket</span>
            </div>
            <div className="flex items-center gap-2">
              {activeTable && (
                <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-extrabold">
                  Table {activeTable.table_number}
                </span>
              )}
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setIsMobileCartOpen(false)}>
                Close
              </Button>
            </div>
          </div>

          {/* Cart items */}
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
              cart.map((item) => (
                <div key={item.menu_item_id} className="flex justify-between items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs text-slate-800 truncate leading-snug">{item.item_name}</h5>
                    <span className="text-[10px] text-muted-foreground font-semibold">₹{item.unit_price} each</span>
                  </div>

                  {/* Quantity adjustment */}
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

          {/* Checkout & summary footer */}
          <div className="p-4 border-t border-border space-y-4 shrink-0 bg-slate-50/50">
            {/* Instructions */}
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

            {/* Price layout */}
            <div className="space-y-2 text-xs border-t border-slate-200/60 pt-3">
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>Subtotal</span>
                <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>GST Tax ({taxRate}%)</span>
                <span className="font-bold text-slate-800">{formatCurrency(taxAmount)}</span>
              </div>
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Service Charge ({serviceChargeRate}%)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(serviceChargeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-sm text-foreground font-bold">
                <span>Total Due</span>
                <span className="text-primary text-base font-extrabold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Pay / Generate Button */}
            <Button
              className="w-full bg-primary hover:bg-primary/95 text-white font-extrabold h-12 rounded-xl text-xs uppercase tracking-wider"
              disabled={isPlacingOrder || cart.length === 0 || !selectedTableId}
              onClick={handleGenerateInvoice}
            >
              {isPlacingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing Checkout...
                </>
              ) : (
                <>
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

      </div>

      {!isMobileCartOpen && (
        <Button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="fixed bottom-4 right-4 z-30 rounded-full shadow-lg lg:hidden"
          aria-label={`Open cart with ${cart.length} items`}
        >
          <ShoppingCart className="w-4 h-4" />
          Cart {cart.length > 0 ? `(${cart.length})` : ''}
        </Button>
      )}

      <ConfirmDialog
        open={isDiscardConfirmOpen}
        onOpenChange={setIsDiscardConfirmOpen}
        title="Unsaved Changes"
        description="You have unsaved changes for this order."
        cancelLabel="Continue Editing"
        confirmLabel="Discard & Return"
        variant="destructive"
        onConfirm={returnToTables}
      />

      {/* Checkout Payment Dialog */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        total={grandTotal}
        onComplete={handlePaymentComplete}
        onPrintPreview={handlePrintPreview}
      />
    </div>
  );
}
