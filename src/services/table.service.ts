import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Table } from '@/types/table.types';
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

  async updateTableStatus(id: string, status: Table['status']): Promise<ApiResponse<Table>> {
    return this.handleCall(
      supabase
        .from('tables')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
    );
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
