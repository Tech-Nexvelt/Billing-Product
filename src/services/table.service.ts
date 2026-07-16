import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Table, TableStatus } from '@/types/table.types';
import { TableInput } from '@/schemas/table.schema';

export class TableService extends BaseService {
  async getTables(restaurantId: string): Promise<ApiResponse<Table[]>> {
    return this.handleCall(
      supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
    );
  }

  async createTable(restaurantId: string, input: TableInput): Promise<ApiResponse<Table>> {
    return this.handleCall(
      supabase
        .from('tables')
        .insert({
          restaurant_id: restaurantId,
          floor_id: input.floorId,
          table_number: input.tableNumber,
          capacity: input.capacity,
          table_type: input.tableType,
          table_shape: input.tableShape,
          status: input.status,
          position_x: input.positionX,
          position_y: input.positionY,
          display_order: input.displayOrder,
        })
        .select()
        .single()
    );
  }

  async updateTable(id: string, version: number, input: TableInput): Promise<ApiResponse<Table>> {
    return this.handleCall(
      supabase
        .from('tables')
        .update({
          floor_id: input.floorId,
          table_number: input.tableNumber,
          capacity: input.capacity,
          table_type: input.tableType,
          table_shape: input.tableShape,
          status: input.status,
          position_x: input.positionX,
          position_y: input.positionY,
          display_order: input.displayOrder,
        })
        .eq('id', id)
        .eq('version', version) // Optimistic locking
        .select()
        .single()
    );
  }

  async updateTableStatus(id: string, status: TableStatus, previous: TableStatus, user: { id: string; restaurant_id: string; full_name?: string | null; role?: { name?: string } }, reason?: string): Promise<ApiResponse<Table>> {
    const transitions: Partial<Record<TableStatus, TableStatus[]>> = { available: ['occupied','reserved','out_of_service','closed'], reserved: ['occupied'], occupied: ['cleaning'], cleaning: ['available'], out_of_service: ['available'], closed: ['available'] };
    const role = user.role?.name;
    const cashierAllowed: TableStatus[] = ['available','occupied','reserved','cleaning'];
    if (role === 'Kitchen' || (role === 'Cashier' && !cashierAllowed.includes(status)) || (status === 'closed' && role !== 'Owner') || (status === 'out_of_service' && !['Owner','Manager'].includes(role || ''))) return this.createClientError('You do not have permission to set this status.') as ApiResponse<Table>;
    if (!transitions[previous]?.includes(status)) return this.createClientError(`Cannot change a ${previous} table to ${status}.`) as ApiResponse<Table>;
    if (['cleaning','reserved','out_of_service'].includes(status) && !reason?.trim()) return this.createClientError('A reason is required for this status change.') as ApiResponse<Table>;
    const result = await this.handleCall<Table>(
      supabase.from('tables').update({ status })
        .eq('id', id)
        .select()
        .single()
    );
    if (result.data) await supabase.from('activity_logs').insert({ restaurant_id: user.restaurant_id, user_id: user.id, action: 'table_status_changed', entity_type: 'table', entity_id: id, metadata: { previous_status: previous, new_status: status, reason: reason || null, user_name: user.full_name || null } });
    return result;
  }

  async deleteTable(id: string, userId: string): Promise<ApiResponse<void>> {
    return this.handleCall(
      supabase
        .from('tables')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', id)
    );
  }
}

export const tableService = new TableService();
