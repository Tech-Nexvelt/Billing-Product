import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { KdsOrder, KdsStatus, KdsPriority } from '@/types/kds.types';

export class KdsService extends BaseService {
  async getActiveOrders(restaurantId: string): Promise<ApiResponse<KdsOrder[]>> {
    const result = await supabase
      .from('orders')
      .select(`
        id, restaurant_id, table_id, floor_id, status, kitchen_notes,
        special_instructions, bill_number, created_at, updated_at,
        tables!inner(table_number),
        floors!inner(name),
        order_items(*)
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served'])
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (result.error) {
      return { success: false, message: result.error.message, data: null, error: { code: 'INTERNAL_ERROR', message: result.error.message } };
    }

    // Map joined result to KdsOrder shape
    const orders: KdsOrder[] = (result.data ?? []).map((row: any) => ({
      id: row.id,
      restaurant_id: row.restaurant_id,
      table_id: row.table_id,
      floor_id: row.floor_id,
      status: row.status as KdsStatus,
      kitchen_notes: row.kitchen_notes,
      special_instructions: row.special_instructions,
      bill_number: row.bill_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      priority: (row.priority ?? 'normal') as KdsPriority,
      chef_name: row.chef_name ?? null,
      table_number: row.tables?.table_number,
      floor_name: row.floors?.name,
      items: row.order_items ?? [],
      version: row.version ?? 1,
    }));

    return { success: true, message: 'Success', data: orders, error: null };
  }

  async updateStatus(
    orderId: string,
    status: KdsStatus,
    currentVersion: number
  ): Promise<ApiResponse<KdsOrder>> {
    const updateBody: Record<string, any> = { status, version: currentVersion + 1 };
    
    if (status === 'accepted') updateBody.accepted_at = new Date().toISOString();
    else if (status === 'preparing') updateBody.preparing_at = new Date().toISOString();
    else if (status === 'ready') updateBody.ready_at = new Date().toISOString();
    else if (status === 'served') updateBody.served_at = new Date().toISOString();

    const result = await this.handleCall<any>(
      supabase
        .from('orders')
        .update(updateBody)
        .eq('id', orderId)
        .eq('version', currentVersion)
        .select()
        .single()
    );

    if (result.data) {
      await supabase.from('activity_logs').insert({
        restaurant_id: result.data.restaurant_id,
        action: `kds_${status}`,
        resource_type: 'order',
        resource_id: orderId,
        metadata: {
          status,
          timestamp: new Date().toISOString()
        }
      });
    }

    return result;
  }

  async assignChef(
    orderId: string,
    chefName: string,
    currentVersion: number
  ): Promise<ApiResponse<KdsOrder>> {
    return this.handleCall(
      supabase
        .from('orders')
        .update({ kitchen_notes: chefName, version: currentVersion + 1 })
        .eq('id', orderId)
        .eq('version', currentVersion)
        .select()
        .single()
    );
  }
}

export const kdsService = new KdsService();
