import { useState, useRef, useCallback } from 'react';
import { CartItem } from '@/types/order.types';
import { supabase } from '@/lib/supabase';

export type CartLifecycleState = 
  | 'Idle' 
  | 'Initializing' 
  | 'Loading_Order' 
  | 'Cart_Ready' 
  | 'Cashier_Editing' 
  | 'Checkout' 
  | 'Completed';

/**
 * Smart merge function combining remote order items with locally added cart items.
 */
export function mergeCartItems(remoteItems: CartItem[], localItems: CartItem[]): CartItem[] {
  if (!localItems || localItems.length === 0) return remoteItems;
  if (!remoteItems || remoteItems.length === 0) return localItems;

  const mergedMap = new Map<string, CartItem>();

  // 1. Add all remote items
  remoteItems.forEach(item => {
    const key = item.configuration_hash || `${item.menu_item_id}_${item.variant_id || 'no_var'}`;
    mergedMap.set(key, { ...item });
  });

  // 2. Merge or append local items
  localItems.forEach(item => {
    const key = item.configuration_hash || `${item.menu_item_id}_${item.variant_id || 'no_var'}`;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      const newQty = existing.quantity + item.quantity;
      mergedMap.set(key, {
        ...existing,
        quantity: newQty,
        item_total: existing.unit_price * newQty
      });
    } else {
      mergedMap.set(key, { ...item });
    }
  });

  return Array.from(mergedMap.values());
}

export function useCartLifecycle() {
  const [cartState, setCartState] = useState<CartLifecycleState>('Idle');
  const [cart, setCart] = useState<CartItem[]>([]);
  const hasResumedSessionRef = useRef<Record<string, boolean>>({});

  /**
   * Initializes or silently resumes a table order session ONCE per session key.
   */
  const initializeTableSession = useCallback(async (
    tableId: string,
    _restaurantId: string,
    existingOrderId?: string
  ): Promise<CartItem[]> => {
    const sessionKey = `${tableId}_${existingOrderId || 'new'}`;

    // Session Guard: Return current cart if already resumed to prevent duplicate API executions
    if (hasResumedSessionRef.current[sessionKey]) {
      return cart;
    }

    setCartState('Loading_Order');

    try {
      if (existingOrderId) {
        // Fetch active order items silently
        const { data: orderItems, error } = await supabase
          .from('order_items')
          .select(`
            *,
            menu_items (
              name,
              is_veg,
              image_url,
              selling_price
            ),
            product_variants (
              name,
              price_override
            )
          `)
          .eq('order_id', existingOrderId)
          .is('deleted_at', null);

        if (!error && orderItems && orderItems.length > 0) {
          const remoteCartItems: CartItem[] = orderItems.map((item: any) => ({
            db_id: item.id,
            menu_item_id: item.menu_item_id,
            variant_id: item.variant_id || null,
            variant_name: item.product_variants?.name || null,
            item_name: item.item_name || item.menu_items?.name || 'Item',
            category_name: null,
            base_unit_price: item.product_variants?.price_override ?? item.menu_items?.selling_price ?? item.unit_price,
            unit_price: item.unit_price,
            quantity: item.quantity,
            item_total: item.item_total,
            selected_modifiers: item.selected_modifiers || [],
            selected_variant_text: item.selected_variant_text || null,
            special_notes: item.special_notes || '',
            configuration_hash: item.configuration_hash || undefined,
            image_url: item.menu_items?.image_url || undefined,
            is_veg: item.menu_items?.is_veg ?? true
          }));

          // Smart Merge with any local cart additions made by cashier while loading
          setCart(prev => {
            const merged = mergeCartItems(remoteCartItems, prev);
            return merged;
          });
        }
      }

      hasResumedSessionRef.current[sessionKey] = true;
      setCartState('Cart_Ready');
      return cart;
    } catch (err) {
      console.error('Silent order resume error:', err);
      setCartState('Cart_Ready');
      return cart;
    }
  }, [cart]);

  const clearSessionGuard = useCallback((tableId?: string) => {
    if (tableId) {
      Object.keys(hasResumedSessionRef.current).forEach(k => {
        if (k.startsWith(tableId)) {
          delete hasResumedSessionRef.current[k];
        }
      });
    } else {
      hasResumedSessionRef.current = {};
    }
  }, []);

  return {
    cartState,
    setCartState,
    cart,
    setCart,
    initializeTableSession,
    clearSessionGuard
  };
}
