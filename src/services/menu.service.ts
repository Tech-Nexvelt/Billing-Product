import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { MenuCategory, MenuItemWithTags, Tag } from '@/types/menu.types';
import { CategoryInput, MenuItemInput } from '@/schemas/menu.schema';

export class MenuService extends BaseService {
  // Categories
  async getCategories(restaurantId: string): Promise<ApiResponse<MenuCategory[]>> {
    return this.handleCall(
      supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
    );
  }

  async createCategory(restaurantId: string, input: CategoryInput): Promise<ApiResponse<MenuCategory>> {
    return this.handleCall(
      supabase
        .from('categories')
        .insert({
          restaurant_id: restaurantId,
          name: input.name,
          description: input.description || null,
          image_url: input.imageUrl || null,
          icon: input.icon || null,
          color: input.color || null,
          display_order: input.displayOrder,
          is_active: input.isActive,
        })
        .select()
        .single()
    );
  }

  async updateCategory(id: string, _version: number, input: CategoryInput): Promise<ApiResponse<MenuCategory>> {
    return this.handleCall(
      supabase
        .from('categories')
        .update({
          name: input.name,
          description: input.description || null,
          image_url: input.imageUrl || null,
          icon: input.icon || null,
          color: input.color || null,
          display_order: input.displayOrder,
          is_active: input.isActive,
        })
        .eq('id', id)
        .select()
        .single()
    );
  }

  async deleteCategory(id: string, userId: string): Promise<ApiResponse<void>> {
    return this.handleCall(
      supabase
        .from('categories')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', id)
    );
  }

  // Menu Items
  async getMenuItems(restaurantId: string): Promise<ApiResponse<MenuItemWithTags[]>> {
    try {
      const itemsRes = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_tags (
            tags (*)
          )
        `)
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (itemsRes.error) throw itemsRes.error;

      const formatted = (itemsRes.data || []).map((item: any) => ({
        ...item,
        tags: (item.menu_item_tags || [])
          .map((mit: any) => mit.tags)
          .filter(Boolean) as Tag[],
      }));

      return {
        success: true,
        message: 'Success',
        data: formatted,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to fetch menu items');
    }
  }

  async createMenuItem(restaurantId: string, input: MenuItemInput): Promise<ApiResponse<MenuItemWithTags>> {
    try {
      // 1. Insert Menu Item
      const { data: item, error: itemError } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          category_id: input.categoryId,
          name: input.name,
          description: input.description || null,
          cost_price: input.costPrice || null,
          selling_price: input.sellingPrice,
          image_url: input.imageUrl,
          is_veg: input.isVeg,
          prep_time: input.prepTime || null,
          availability_status: input.availabilityStatus,
          sku: input.sku || null,
          barcode: input.barcode || null,
          display_order: input.displayOrder,
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // 2. Insert Tags
      if (input.tags && input.tags.length > 0) {
        const tagRelations = input.tags.map((tagId) => ({
          menu_item_id: item.id,
          tag_id: tagId,
          restaurant_id: restaurantId,
        }));
        const { error: tagError } = await supabase.from('menu_item_tags').insert(tagRelations);
        if (tagError) throw tagError;
      }

      // Re-fetch menu item with tags
      const updatedItem = await this.getMenuItemById(item.id);
      return updatedItem;
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to create menu item');
    }
  }

  async updateMenuItem(id: string, _version: number, restaurantId: string, input: MenuItemInput): Promise<ApiResponse<MenuItemWithTags>> {
    try {
      // 1. Update Menu Item
      const { error: itemError } = await supabase
        .from('menu_items')
        .update({
          category_id: input.categoryId,
          name: input.name,
          description: input.description || null,
          cost_price: input.costPrice || null,
          selling_price: input.sellingPrice,
          image_url: input.imageUrl,
          is_veg: input.isVeg,
          prep_time: input.prepTime || null,
          availability_status: input.availabilityStatus,
          sku: input.sku || null,
          barcode: input.barcode || null,
          display_order: input.displayOrder,
        })
        .eq('id', id)
        .select()
        .single();

      if (itemError) throw itemError;

      // 2. Clear old tags and insert new ones
      const { error: clearError } = await supabase
        .from('menu_item_tags')
        .delete()
        .eq('menu_item_id', id);

      if (clearError) throw clearError;

      if (input.tags && input.tags.length > 0) {
        const tagRelations = input.tags.map((tagId) => ({
          menu_item_id: id,
          tag_id: tagId,
          restaurant_id: restaurantId,
        }));
        const { error: tagError } = await supabase.from('menu_item_tags').insert(tagRelations);
        if (tagError) throw tagError;
      }

      return this.getMenuItemById(id);
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to update menu item');
    }
  }

  async deleteMenuItem(id: string, userId: string): Promise<ApiResponse<void>> {
    return this.handleCall(
      supabase
        .from('menu_items')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq('id', id)
    );
  }

  // Tags
  async getTags(restaurantId: string): Promise<ApiResponse<Tag[]>> {
    return this.handleCall(
      supabase
        .from('tags')
        .select('*')
        .or(`restaurant_id.is.null,restaurant_id.eq.${restaurantId}`)
    );
  }

  private async getMenuItemById(id: string): Promise<ApiResponse<MenuItemWithTags>> {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_tags (
            tags (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const formatted: MenuItemWithTags = {
        ...data,
        tags: (data.menu_item_tags || [])
          .map((mit: any) => mit.tags)
          .filter(Boolean) as Tag[],
      };

      return {
        success: true,
        message: 'Success',
        data: formatted,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to fetch updated item');
    }
  }
}

export const menuService = new MenuService();
