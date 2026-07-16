import { useEffect, useCallback } from 'react';
import { useKdsStore } from '@/stores/kds.store';
import { kdsService } from '@/services/kds.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { KdsStatus } from '@/types/kds.types';

export function useKds() {
  const { orders, isLoading, setOrders, updateOrderStatus, setLoading } = useKdsStore();
  const { restaurant } = useRestaurantStore();

  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    const res = await kdsService.getActiveOrders(restaurant.id);
    if (res.success && res.data) setOrders(res.data as any);
    setLoading(false);
  }, [restaurant, setOrders, setLoading]);

  const moveOrder = useCallback(async (orderId: string, status: KdsStatus, version: number) => {
    const res = await kdsService.updateStatus(orderId, status, version);
    if (res.success) updateOrderStatus(orderId, status);
    return res;
  }, [updateOrderStatus]);

  useEffect(() => { load(); }, [load]);

  const pending = orders.filter((o) => o.status === 'pending');
  const preparing = orders.filter((o) => o.status === 'preparing');
  const ready = orders.filter((o) => o.status === 'ready');
  const served = orders.filter((o) => o.status === 'served');

  return { pending, preparing, ready, served, isLoading, moveOrder, reload: load };
}
