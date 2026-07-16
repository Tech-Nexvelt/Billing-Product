import { create } from 'zustand';
import type { MenuItemWithTags, MenuCategory, Tag } from '@/types/menu.types';

interface MenuState {
  items: MenuItemWithTags[];
  categories: MenuCategory[];
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  setItems: (items: MenuItemWithTags[]) => void;
  setCategories: (categories: MenuCategory[]) => void;
  setTags: (tags: Tag[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateMenuItem: (item: MenuItemWithTags) => void;
  addMenuItem: (item: MenuItemWithTags) => void;
  removeMenuItem: (id: string) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  items: [],
  categories: [],
  tags: [],
  isLoading: false,
  error: null,
  setItems: (items) => set({ items }),
  setCategories: (categories) => set({ categories }),
  setTags: (tags) => set({ tags }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  updateMenuItem: (item) => set((state) => ({
    items: state.items.map((i) => (i.id === item.id ? item : i))
  })),
  addMenuItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  removeMenuItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id)
  })),
}));
