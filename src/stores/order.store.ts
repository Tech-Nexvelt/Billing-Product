import { create } from 'zustand';
import type { OrderWithItems } from '@/types/order.types';

interface OrderState {
  orders: OrderWithItems[];
  isLoading: boolean;
  error: string | null;
  setOrders: (orders: OrderWithItems[]) => void;
  addOrder: (order: OrderWithItems) => void;
  updateOrder: (order: OrderWithItems) => void;
  removeOrder: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  isLoading: false,
  error: null,
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
  updateOrder: (order) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === order.id ? order : o)),
    })),
  removeOrder: (id) =>
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
