import { create } from 'zustand';
import { Customer } from '@/types/customer.types';

interface CustomerStore {
  customers: Customer[];
  selectedCustomer: Customer | null;
  isLoading: boolean;
  setCustomers: (customers: Customer[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  removeCustomer: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: [],
  selectedCustomer: null,
  isLoading: false,
  setCustomers: (customers) => set({ customers }),
  setSelectedCustomer: (selectedCustomer) => set({ selectedCustomer }),
  addCustomer: (customer) => set((state) => ({ customers: [customer, ...state.customers] })),
  updateCustomer: (customer) =>
    set((state) => ({
      customers: state.customers.map((c) => (c.id === customer.id ? customer : c)),
    })),
  removeCustomer: (id) =>
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
}));
