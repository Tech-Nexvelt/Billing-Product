import { create } from 'zustand';
import type { Table } from '@/types/table.types';

interface TableState {
  tables: Table[];
  isLoading: boolean;
  error: string | null;
  setTables: (tables: Table[]) => void;
  addTable: (table: Table) => void;
  updateTable: (table: Table) => void;
  removeTable: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTableStore = create<TableState>((set) => ({
  tables: [],
  isLoading: false,
  error: null,
  setTables: (tables) => set({ tables }),
  addTable: (table) => set((state) => ({ tables: [...state.tables, table] })),
  updateTable: (table) =>
    set((state) => ({
      tables: state.tables.map((t) => (t.id === table.id ? table : t)),
    })),
  removeTable: (id) =>
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
