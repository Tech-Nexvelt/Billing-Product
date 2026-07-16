import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Customer, CustomerWithHistory } from '@/types/customer.types';

export class CustomerService extends BaseService {
  async getAll(restaurantId: string, search?: string): Promise<ApiResponse<Customer[]>> {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    return this.handleCall(query);
  }

  async getById(id: string): Promise<ApiResponse<CustomerWithHistory>> {
    const [customerRes, ordersRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).is('deleted_at', null).single(),
      supabase
        .from('orders')
        .select('grand_total, created_at')
        .eq('customer_id', id)
        .eq('status', 'completed')
        .is('deleted_at', null),
    ]);

    if (customerRes.error) return this.createClientError(customerRes.error.message, 'NOT_FOUND');

    const orders = ordersRes.data ?? [];
    const total_orders = orders.length;
    const total_spent = orders.reduce((s, o) => s + o.grand_total, 0);
    const last_visit = orders.length ? orders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at : null;

    return {
      success: true,
      message: 'Success',
      data: {
        ...customerRes.data,
        total_orders,
        total_spent,
        average_order_value: total_orders ? total_spent / total_orders : 0,
        last_visit,
      },
      error: null,
    };
  }

  async create(
    restaurantId: string,
    data: Omit<Customer, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'deleted_by' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<Customer>> {
    return this.handleCall(
      supabase
        .from('customers')
        .insert({ ...data, restaurant_id: restaurantId })
        .select()
        .single()
    );
  }

  async update(
    id: string,
    data: Partial<Customer>,
    currentVersion: number
  ): Promise<ApiResponse<Customer>> {
    return this.handleCall(
      supabase
        .from('customers')
        .update({ ...data, version: currentVersion + 1 })
        .eq('id', id)
        .eq('version', currentVersion)
        .select()
        .single()
    );
  }

  async delete(id: string, userId: string, currentVersion: number): Promise<ApiResponse<null>> {
    const { error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .eq('version', currentVersion);
    if (error) return this.createClientError(error.message);
    return { success: true, message: 'Customer deleted', data: null, error: null };
  }
}

export const customerService = new CustomerService();
