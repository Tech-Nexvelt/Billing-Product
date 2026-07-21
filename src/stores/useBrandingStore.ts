import { create } from 'zustand';
import { BrandingState, RestaurantBranding } from '@/types/branding.types';
import { applyBrandTheme } from '@/utils/brandTheme.utils';

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  setBranding: (branding: RestaurantBranding | null) => {
    applyBrandTheme(branding);
    set({ branding, isHydrated: true, isLoading: false, error: null });
  },

  updateLocalBranding: (updates: Partial<RestaurantBranding>) => {
    set((state) => {
      if (!state.branding) return state;
      const updated = { ...state.branding, ...updates };
      applyBrandTheme(updated);
      return { branding: updated };
    });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error, isLoading: false }),

  clearBranding: () => {
    applyBrandTheme(null);
    set({ branding: null, isLoading: false, isHydrated: false, error: null });
  },
}));
