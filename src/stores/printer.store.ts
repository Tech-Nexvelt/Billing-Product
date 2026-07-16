import { create } from 'zustand';
import { Printer, PrinterJob } from '@/types/printer.types';

interface PrinterStore {
  printers: Printer[];
  jobs: PrinterJob[];
  isLoading: boolean;
  setPrinters: (printers: Printer[]) => void;
  addPrinter: (printer: Printer) => void;
  updatePrinter: (printer: Printer) => void;
  removePrinter: (id: string) => void;
  setJobs: (jobs: PrinterJob[]) => void;
  updateJob: (job: PrinterJob) => void;
  getDefaultBillingPrinter: () => Printer | null;
  getDefaultKitchenPrinter: () => Printer | null;
  setLoading: (loading: boolean) => void;
}

export const usePrinterStore = create<PrinterStore>((set, get) => ({
  printers: [],
  jobs: [],
  isLoading: false,
  setPrinters: (printers) => set({ printers }),
  addPrinter: (printer) => set((state) => ({ printers: [printer, ...state.printers] })),
  updatePrinter: (printer) =>
    set((state) => ({
      printers: state.printers.map((p) => (p.id === printer.id ? printer : p)),
    })),
  removePrinter: (id) =>
    set((state) => ({ printers: state.printers.filter((p) => p.id !== id) })),
  setJobs: (jobs) => set({ jobs }),
  updateJob: (job) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
    })),
  getDefaultBillingPrinter: () => get().printers.find((p) => p.is_default_billing && !p.deleted_at) ?? null,
  getDefaultKitchenPrinter: () => get().printers.find((p) => p.is_default_kitchen && !p.deleted_at) ?? null,
  setLoading: (isLoading) => set({ isLoading }),
}));
