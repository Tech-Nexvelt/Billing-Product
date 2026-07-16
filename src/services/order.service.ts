import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { OrderWithItems, Order, CartItem } from '@/types/order.types';

export class OrderService extends BaseService {
  async getOrders(restaurantId: string): Promise<ApiResponse<OrderWithItems[]>> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((o: any) => ({
        ...o,
        items: o.order_items || [],
      }));

      return {
        success: true,
        message: 'Success',
        data: formatted,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to fetch orders');
    }
  }

  async getOrderById(id: string): Promise<ApiResponse<OrderWithItems>> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const formatted: OrderWithItems = {
        ...data,
        items: data.order_items || [],
      };

      return {
        success: true,
        message: 'Success',
        data: formatted,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to fetch order');
    }
  }

  async createOrder(
    restaurantId: string,
    userId: string,
    tableId: string,
    floorId: string,
    items: CartItem[],
    specialInstructions?: string
  ): Promise<ApiResponse<OrderWithItems>> {
    try {
      // 1. Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.item_total, 0);
      
      // Fetch restaurant settings for taxes
      const { data: settings } = await supabase
        .from('restaurant_settings')
        .select('tax_rate, service_charge')
        .eq('restaurant_id', restaurantId)
        .single();

      const taxRate = settings?.tax_rate || 5.0;
      const serviceChargeRate = settings?.service_charge || 0.0;

      const taxAmount = (subtotal * taxRate) / 100;
      const serviceChargeAmount = (subtotal * serviceChargeRate) / 100;
      const grandTotal = subtotal + taxAmount + serviceChargeAmount;

      // 2. Create order row (Starts as pending or draft)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          table_id: tableId,
          floor_id: floorId,
          status: 'pending',
          subtotal,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          special_instructions: specialInstructions || null,
          created_by: userId,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Create order item snapshots
      const orderItems = items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        restaurant_id: restaurantId,
        item_name: item.item_name,
        category_name: item.category_name || null,
        unit_price: item.unit_price,
        quantity: item.quantity,
        item_total: item.item_total,
        special_notes: item.special_notes || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // 4. Set table status to occupied
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tableId);

      return this.getOrderById(order.id);
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to create order');
    }
  }

  async updateOrderStatus(id: string, status: Order['status'], userId: string): Promise<ApiResponse<OrderWithItems>> {
    try {
      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({
          status,
          updated_by: userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // If order is completed or cancelled, change the table status back to available or cleaning
      if (status === 'completed' || status === 'cancelled') {
        const nextTableStatus = status === 'completed' ? 'cleaning' : 'available';
        await supabase
          .from('tables')
          .update({ status: nextTableStatus })
          .eq('id', order.table_id);
      }

      return this.getOrderById(id);
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to update order status');
    }
  }
}

export const orderService = new OrderService();
