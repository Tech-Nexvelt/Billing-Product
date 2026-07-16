import { create } from 'zustand';
import type { Restaurant, RestaurantSettings } from '@/types/restaurant.types';

interface RestaurantState {
  restaurant: Restaurant | null;
  settings: RestaurantSettings | null;
  isLoading: boolean;
  error: string | null;
  setRestaurant: (restaurant: Restaurant | null) => void;
  setSettings: (settings: RestaurantSettings | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRestaurantStore = create<RestaurantState>((set) => ({
  restaurant: null,
  settings: null,
  isLoading: false,
  error: null,
  setRestaurant: (restaurant) => set({ restaurant }),
  setSettings: (settings) => set({ settings }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
