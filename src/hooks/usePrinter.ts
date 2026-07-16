import { useCallback, useEffect } from 'react';
import { usePrinterStore } from '@/stores/printer.store';
import { printerService } from '@/services/printer.service';
import { useRestaurantStore } from '@/stores/restaurant.store';

export function usePrinter() {
  const store = usePrinterStore();
  const { restaurant } = useRestaurantStore();

  const load = useCallback(async () => {
    if (!restaurant) return;
    store.setLoading(true);
    const res = await printerService.getAll(restaurant.id);
    if (res.success && res.data) store.setPrinters(res.data);
    store.setLoading(false);
  }, [restaurant, store]);

  const loadJobs = useCallback(async (status?: string) => {
    if (!restaurant) return;
    const res = await printerService.getPrinterJobs(restaurant.id, status);
    if (res.success && res.data) store.setJobs(res.data);
  }, [restaurant, store]);

  const retryJob = useCallback(async (jobId: string) => {
    const res = await printerService.retryJob(jobId);
    if (res.success && res.data) store.updateJob(res.data);
    return res;
  }, [store]);

  useEffect(() => { load(); }, [load]);

  return {
    printers: store.printers,
    jobs: store.jobs,
    isLoading: store.isLoading,
    defaultBillingPrinter: store.getDefaultBillingPrinter(),
    defaultKitchenPrinter: store.getDefaultKitchenPrinter(),
    load,
    loadJobs,
    retryJob,
  };
}
