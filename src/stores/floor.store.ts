import { create } from 'zustand';
import type { Floor } from '@/types/floor.types';

interface FloorState {
  floors: Floor[];
  isLoading: boolean;
  error: string | null;
  setFloors: (floors: Floor[]) => void;
  addFloor: (floor: Floor) => void;
  updateFloor: (floor: Floor) => void;
  removeFloor: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFloorStore = create<FloorState>((set) => ({
  floors: [],
  isLoading: false,
  error: null,
  setFloors: (floors) => set({ floors }),
  addFloor: (floor) => set((state) => ({ floors: [...state.floors, floor] })),
  updateFloor: (floor) =>
    set((state) => ({
      floors: state.floors.map((f) => (f.id === floor.id ? floor : f)),
    })),
  removeFloor: (id) =>
    set((state) => ({
      floors: state.floors.filter((f) => f.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
