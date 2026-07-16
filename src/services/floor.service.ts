import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Floor } from '@/types/floor.types';
import { FloorInput } from '@/schemas/floor.schema';

export class FloorService extends BaseService {
  async getFloors(restaurantId: string): Promise<ApiResponse<Floor[]>> {
    return this.handleCall(
      supabase
        .from('floors')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
    );
  }

  async createFloor(restaurantId: string, input: FloorInput): Promise<ApiResponse<Floor>> {
    return this.handleCall(
      supabase
        .from('floors')
        .insert({
          restaurant_id: restaurantId,
          name: input.name,
          display_order: input.displayOrder,
          is_active: input.isActive,
        })
        .select()
        .single()
    );
  }

  async updateFloor(id: string, version: number, input: FloorInput): Promise<ApiResponse<Floor>> {
    return this.handleCall(
      supabase
        .from('floors')
        .update({
          name: input.name,
          display_order: input.displayOrder,
          is_active: input.isActive,
        })
        .eq('id', id)
        .eq('version', version) // Optimistic locking
        .select()
        .single()
    );
  }

  async deleteFloor(id: string, userId: string): Promise<ApiResponse<void>> {
    return this.handleCall(
      supabase
        .from('floors')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', id)
    );
  }
}

export const floorService = new FloorService();
