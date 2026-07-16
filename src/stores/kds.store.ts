import { create } from 'zustand';
import { KdsOrder, KdsStatus } from '@/types/kds.types';

interface KdsStore {
  orders: KdsOrder[];
  isLoading: boolean;
  setOrders: (orders: KdsOrder[]) => void;
  updateOrderStatus: (orderId: string, status: KdsStatus) => void;
  removeOrder: (orderId: string) => void;
  addOrUpdateOrder: (order: KdsOrder) => void;
  setLoading: (loading: boolean) => void;
}

export const useKdsStore = create<KdsStore>((set) => ({
  orders: [],
  isLoading: false,
  setOrders: (orders) => set({ orders }),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, status } : o
      ),
    })),
  removeOrder: (orderId) =>
    set((state) => ({ orders: state.orders.filter((o) => o.id !== orderId) })),
  addOrUpdateOrder: (order) =>
    set((state) => {
      const existing = state.orders.findIndex((o) => o.id === order.id);
      if (existing >= 0) {
        const updated = [...state.orders];
        updated[existing] = order;
        return { orders: updated };
      }
      return { orders: [...state.orders, order] };
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
