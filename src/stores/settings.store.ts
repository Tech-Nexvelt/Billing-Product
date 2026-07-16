import { create } from 'zustand';
import { FeatureFlag, ReceiptCustomization, ReceiptNumberRule, DiscountRoleLimit } from '@/types/settings.types';

interface SettingsStore {
  featureFlags: FeatureFlag[];
  receiptCustomization: ReceiptCustomization | null;
  receiptNumberRules: ReceiptNumberRule[];
  discountLimits: DiscountRoleLimit[];
  isLoading: boolean;
  setFeatureFlags: (flags: FeatureFlag[]) => void;
  setReceiptCustomization: (customization: ReceiptCustomization | null) => void;
  setReceiptNumberRules: (rules: ReceiptNumberRule[]) => void;
  setDiscountLimits: (limits: DiscountRoleLimit[]) => void;
  isFeatureEnabled: (key: string) => boolean;
  setLoading: (loading: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  featureFlags: [],
  receiptCustomization: null,
  receiptNumberRules: [],
  discountLimits: [],
  isLoading: false,
  setFeatureFlags: (featureFlags) => set({ featureFlags }),
  setReceiptCustomization: (receiptCustomization) => set({ receiptCustomization }),
  setReceiptNumberRules: (receiptNumberRules) => set({ receiptNumberRules }),
  setDiscountLimits: (discountLimits) => set({ discountLimits }),
  isFeatureEnabled: (key) => {
    const flag = get().featureFlags.find((f) => f.feature_key === key);
    return flag?.enabled ?? false;
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
