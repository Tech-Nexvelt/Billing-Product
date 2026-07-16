import { create } from 'zustand';
import { PaymentMethod, Payment, SplitPaymentEntry } from '@/types/payment.types';

interface PaymentStore {
  methods: PaymentMethod[];
  activeOrderPayments: Payment[];
  splits: SplitPaymentEntry[];
  isProcessing: boolean;
  setMethods: (methods: PaymentMethod[]) => void;
  setActiveOrderPayments: (payments: Payment[]) => void;
  setSplits: (splits: SplitPaymentEntry[]) => void;
  addSplit: (split: SplitPaymentEntry) => void;
  removeSplit: (index: number) => void;
  clearSplits: () => void;
  setProcessing: (processing: boolean) => void;
}

export const usePaymentStore = create<PaymentStore>((set) => ({
  methods: [],
  activeOrderPayments: [],
  splits: [],
  isProcessing: false,
  setMethods: (methods) => set({ methods }),
  setActiveOrderPayments: (activeOrderPayments) => set({ activeOrderPayments }),
  setSplits: (splits) => set({ splits }),
  addSplit: (split) => set((state) => ({ splits: [...state.splits, split] })),
  removeSplit: (index) =>
    set((state) => ({ splits: state.splits.filter((_, i) => i !== index) })),
  clearSplits: () => set({ splits: [] }),
  setProcessing: (isProcessing) => set({ isProcessing }),
}));
