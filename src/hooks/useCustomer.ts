import { useCallback } from 'react';
import { useCustomerStore } from '@/stores/customer.store';
import { customerService } from '@/services/customer.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { Customer } from '@/types/customer.types';

export function useCustomers() {
  const { customers, isLoading, setCustomers, addCustomer, updateCustomer, removeCustomer, setLoading } = useCustomerStore();
  const { restaurant } = useRestaurantStore();

  const load = useCallback(async (search?: string) => {
    if (!restaurant) return;
    setLoading(true);
    const res = await customerService.getAll(restaurant.id, search);
    if (res.success && res.data) setCustomers(res.data);
    setLoading(false);
  }, [restaurant, setCustomers, setLoading]);

  const create = useCallback(async (data: Omit<Customer, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'deleted_by' | 'created_at' | 'updated_at'>) => {
    if (!restaurant) return null;
    const res = await customerService.create(restaurant.id, data);
    if (res.success && res.data) addCustomer(res.data);
    return res;
  }, [restaurant, addCustomer]);

  const update = useCallback(async (id: string, data: Partial<Customer>, version: number) => {
    const res = await customerService.update(id, data, version);
    if (res.success && res.data) updateCustomer(res.data);
    return res;
  }, [updateCustomer]);

  const remove = useCallback(async (id: string, userId: string, version: number) => {
    const res = await customerService.delete(id, userId, version);
    if (res.success) removeCustomer(id);
    return res;
  }, [removeCustomer]);

  return { customers, isLoading, load, create, update, remove };
}
