import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { MenuCategory, MenuItemWithVariantsAndModifiers, Tag, ProductVariant, ModifierGroup } from '@/types/menu.types';
import { CategoryInput, MenuItemInput } from '@/schemas/menu.schema';
import { consolidateLegacyVariantItems } from '@/utils/variantDetector.utils';

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

  // Menu Items with Variants & Modifier Groups
  async getMenuItems(restaurantId: string): Promise<ApiResponse<MenuItemWithVariantsAndModifiers[]>> {
    try {
      // 1. Fetch categories for category name mapping
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', restaurantId);

      const categoryMap = new Map<string, string>();
      (categoriesData || []).forEach((c: any) => categoryMap.set(c.id, c.name));

      // 2. Fetch menu_items with tags, product_variants, and modifier groups
      let queryRes: any = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_tags (
            tags (*)
          ),
          product_variants (*),
          menu_item_modifier_groups (
            display_order,
            modifier_groups (
              *,
              modifier_options (*)
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .is('parent_menu_item_id', null)
        .or('is_migrated_legacy_variant.is.null,is_migrated_legacy_variant.eq.false')
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      // Fallback if relational joins fail on un-migrated tables
      if (queryRes.error) {
        queryRes = await supabase
          .from('menu_items')
          .select(`
            *,
            menu_item_tags (
              tags (*)
            )
          `)
          .eq('restaurant_id', restaurantId)
          .is('parent_menu_item_id', null)
          .or('is_migrated_legacy_variant.is.null,is_migrated_legacy_variant.eq.false')
          .is('deleted_at', null)
          .order('display_order', { ascending: true });
      }

      if (queryRes.error) throw queryRes.error;

      const formatted = (queryRes.data || []).map((item: any) => {
        const tags = (item.menu_item_tags || [])
          .map((mit: any) => mit.tags)
          .filter(Boolean) as Tag[];

        let variants: ProductVariant[] = item.product_variants || [];
        let modifierGroups: ModifierGroup[] = (item.menu_item_modifier_groups || [])
          .map((j: any) => j.modifier_groups)
          .filter(Boolean);

        const categoryName = categoryMap.get(item.category_id) || '';

        // Category-based Configurator Seed Enrichment (Cakes, Veg/NonVeg/Bread Pizza, Momos ONLY)
        const mockConfig = this.getMockConfigForProduct(item.name, item.id, restaurantId, categoryName, item.selling_price);
        if (mockConfig.variants.length > 0) {
          variants = mockConfig.variants;
        } else if (variants.length > 0 && !this.isConfigurableCategoryName(categoryName)) {
          variants = []; // Clear variants for non-configurable categories (Burgers, Coffee, Pastries, etc.)
        }

        if (mockConfig.modifierGroups.length > 0) {
          modifierGroups = mockConfig.modifierGroups;
        } else if (modifierGroups.length > 0 && !this.isConfigurableCategoryName(categoryName)) {
          modifierGroups = [];
        }

        return {
          ...item,
          category_name: categoryName,
          tags,
          variants,
          modifier_groups: modifierGroups,
        };
      });

      // Apply generic variant detection & consolidation for unmigrated legacy item rows
      const consolidated = consolidateLegacyVariantItems(formatted, restaurantId);

      return {
        success: true,
        message: 'Success',
        data: consolidated,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to fetch menu items');
    }
  }

  async createMenuItem(restaurantId: string, input: MenuItemInput): Promise<ApiResponse<MenuItemWithVariantsAndModifiers>> {
    try {
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

      if (input.tags && input.tags.length > 0) {
        const tagRelations = input.tags.map((tagId) => ({
          menu_item_id: item.id,
          tag_id: tagId,
          restaurant_id: restaurantId,
        }));
        await supabase.from('menu_item_tags').insert(tagRelations);
      }

      return this.getMenuItemById(item.id);
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to create menu item');
    }
  }

  async updateMenuItem(id: string, _version: number, restaurantId: string, input: MenuItemInput): Promise<ApiResponse<MenuItemWithVariantsAndModifiers>> {
    try {
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

      await supabase.from('menu_item_tags').delete().eq('menu_item_id', id);

      if (input.tags && input.tags.length > 0) {
        const tagRelations = input.tags.map((tagId) => ({
          menu_item_id: id,
          tag_id: tagId,
          restaurant_id: restaurantId,
        }));
        await supabase.from('menu_item_tags').insert(tagRelations);
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

  async getTags(restaurantId: string): Promise<ApiResponse<Tag[]>> {
    return this.handleCall(
      supabase
        .from('tags')
        .select('*')
        .or(`restaurant_id.is.null,restaurant_id.eq.${restaurantId}`)
    );
  }

  private async getMenuItemById(id: string): Promise<ApiResponse<MenuItemWithVariantsAndModifiers>> {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          menu_item_tags (
            tags (*)
          ),
          product_variants (*),
          menu_item_modifier_groups (
            display_order,
            modifier_groups (
              *,
              modifier_options (*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const formatted: MenuItemWithVariantsAndModifiers = {
        ...data,
        tags: (data.menu_item_tags || [])
          .map((mit: any) => mit.tags)
          .filter(Boolean) as Tag[],
        variants: data.product_variants || [],
        modifier_groups: (data.menu_item_modifier_groups || [])
          .map((j: any) => j.modifier_groups)
          .filter(Boolean),
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

  private isConfigurableCategoryName(categoryName: string): boolean {
    const lower = (categoryName || '').toLowerCase().trim();
    return ['cakes', 'veg pizza', 'non veg pizza', 'bread pizza', 'momos'].includes(lower);
  }

  /** Strict Category-Based Configurator Seed Enrichment */
  private getMockConfigForProduct(
    _name: string,
    itemId: string,
    restaurantId: string,
    categoryName: string = '',
    baseSellingPrice: number = 500
  ): {
    variants: ProductVariant[];
    modifierGroups: ModifierGroup[];
  } {
    const lowerCategory = (categoryName || '').toLowerCase().trim();

    // 1. CAKES CONFIGURATOR: Weight (½ Kg / 1 Kg), Egg/Eggless, Sparkles (+₹30), Quantity
    if (lowerCategory === 'cakes') {
      return {
        variants: [
          { id: `v-half-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: '½ Kg', price_override: baseSellingPrice, display_order: 1, is_active: true },
          { id: `v-1kg-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: '1 Kg', price_override: baseSellingPrice + 500, display_order: 2, is_active: true }
        ],
        modifierGroups: [
          {
            id: `mg-type-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Egg Type',
            description: 'Egg or Eggless preparation',
            selection_type: 'single',
            is_required: true,
            min_selections: 1,
            max_selections: 1,
            is_template: false,
            display_order: 1,
            options: [
              { id: `opt-egg-${itemId}`, group_id: `mg-type-${itemId}`, restaurant_id: restaurantId, name: 'Egg', price_type: 'delta', price_delta: 0, is_default: false, max_quantity: 1, display_order: 1 },
              { id: `opt-eggless-${itemId}`, group_id: `mg-type-${itemId}`, restaurant_id: restaurantId, name: 'Eggless', price_type: 'delta', price_delta: 50, is_default: false, max_quantity: 1, display_order: 2 }
            ]
          },
          {
            id: `mg-sparkles-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Sparkles',
            description: 'Optional celebratory sparkles',
            selection_type: 'multi',
            is_required: false,
            min_selections: 0,
            max_selections: 1,
            is_template: false,
            display_order: 2,
            options: [
              { id: `opt-sparkles-${itemId}`, group_id: `mg-sparkles-${itemId}`, restaurant_id: restaurantId, name: 'Sparkles', price_type: 'delta', price_delta: 30, is_default: false, max_quantity: 1, display_order: 1 }
            ]
          }
        ]
      };
    }

    // 2. PIZZA CONFIGURATOR (Veg Pizza, Non Veg Pizza, Bread Pizza): Size, Crust, Extra Cheese, Extra Toppings, Quantity
    if (lowerCategory === 'veg pizza' || lowerCategory === 'non veg pizza' || lowerCategory === 'bread pizza') {
      return {
        variants: [
          { id: `v-6-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: '6"', price_override: baseSellingPrice, display_order: 1, is_active: true },
          { id: `v-8-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: '8"', price_override: baseSellingPrice + 100, display_order: 2, is_active: true },
          { id: `v-10-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: '10"', price_override: baseSellingPrice + 200, display_order: 3, is_active: true }
        ],
        modifierGroups: [
          {
            id: `mg-crust-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Crust Selection',
            description: 'Select pizza crust style',
            selection_type: 'single',
            is_required: true,
            min_selections: 1,
            max_selections: 1,
            is_template: false,
            display_order: 1,
            options: [
              { id: `opt-hand-${itemId}`, group_id: `mg-crust-${itemId}`, restaurant_id: restaurantId, name: 'Hand Tossed', price_type: 'delta', price_delta: 0, is_default: true, max_quantity: 1, display_order: 1 },
              { id: `opt-cheese-${itemId}`, group_id: `mg-crust-${itemId}`, restaurant_id: restaurantId, name: 'Cheese Burst', price_type: 'delta', price_delta: 80, is_default: false, max_quantity: 1, display_order: 2 },
              { id: `opt-thin-${itemId}`, group_id: `mg-crust-${itemId}`, restaurant_id: restaurantId, name: 'Thin Crust', price_type: 'delta', price_delta: 40, is_default: false, max_quantity: 1, display_order: 3 }
            ]
          },
          {
            id: `mg-toppings-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Extra Cheese & Toppings',
            description: 'Optional extra cheese and toppings',
            selection_type: 'multi',
            is_required: false,
            min_selections: 0,
            max_selections: 4,
            is_template: false,
            display_order: 2,
            options: [
              { id: `opt-excheese-${itemId}`, group_id: `mg-toppings-${itemId}`, restaurant_id: restaurantId, name: 'Extra Cheese', price_type: 'delta', price_delta: 50, is_default: false, max_quantity: 1, display_order: 1 },
              { id: `opt-shroom-${itemId}`, group_id: `mg-toppings-${itemId}`, restaurant_id: restaurantId, name: 'Mushroom', price_type: 'delta', price_delta: 40, is_default: false, max_quantity: 1, display_order: 2 },
              { id: `opt-jalapeno-${itemId}`, group_id: `mg-toppings-${itemId}`, restaurant_id: restaurantId, name: 'Jalapeños', price_type: 'delta', price_delta: 30, is_default: false, max_quantity: 1, display_order: 3 },
              { id: `opt-topping-${itemId}`, group_id: `mg-toppings-${itemId}`, restaurant_id: restaurantId, name: lowerCategory.includes('non veg') ? 'Chicken Topping' : 'Paneer Topping', price_type: 'delta', price_delta: 60, is_default: false, max_quantity: 1, display_order: 4 }
            ]
          }
        ]
      };
    }

    // 3. MOMOS CONFIGURATOR (Momos): Plate Size / Quantity, Steam / Fried, Extra Mayo, Chutney
    if (lowerCategory === 'momos') {
      return {
        variants: [
          { id: `v-half-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: 'Half Plate (6 Pcs)', price_override: baseSellingPrice, display_order: 1, is_active: true },
          { id: `v-full-${itemId}`, restaurant_id: restaurantId, menu_item_id: itemId, name: 'Full Plate (12 Pcs)', price_override: baseSellingPrice + 80, display_order: 2, is_active: true }
        ],
        modifierGroups: [
          {
            id: `mg-prep-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Preparation Style',
            description: 'Steam or Fried preparation',
            selection_type: 'single',
            is_required: true,
            min_selections: 1,
            max_selections: 1,
            is_template: false,
            display_order: 1,
            options: [
              { id: `opt-steam-${itemId}`, group_id: `mg-prep-${itemId}`, restaurant_id: restaurantId, name: 'Steamed', price_type: 'delta', price_delta: 0, is_default: true, max_quantity: 1, display_order: 1 },
              { id: `opt-fried-${itemId}`, group_id: `mg-prep-${itemId}`, restaurant_id: restaurantId, name: 'Fried', price_type: 'delta', price_delta: 20, is_default: false, max_quantity: 1, display_order: 2 },
              { id: `opt-kurkure-${itemId}`, group_id: `mg-prep-${itemId}`, restaurant_id: restaurantId, name: 'Kurkure / Cheese', price_type: 'delta', price_delta: 40, is_default: false, max_quantity: 1, display_order: 3 }
            ]
          },
          {
            id: `mg-dips-${itemId}`,
            restaurant_id: restaurantId,
            name: 'Add-ons & Dips',
            description: 'Extra sauces and dips',
            selection_type: 'multi',
            is_required: false,
            min_selections: 0,
            max_selections: 2,
            is_template: false,
            display_order: 2,
            options: [
              { id: `opt-mayo-${itemId}`, group_id: `mg-dips-${itemId}`, restaurant_id: restaurantId, name: 'Extra Mayo', price_type: 'delta', price_delta: 15, is_default: false, max_quantity: 1, display_order: 1 },
              { id: `opt-chutney-${itemId}`, group_id: `mg-dips-${itemId}`, restaurant_id: restaurantId, name: 'Extra Spicy Chutney', price_type: 'delta', price_delta: 10, is_default: false, max_quantity: 1, display_order: 2 }
            ]
          }
        ]
      };
    }

    // 4. ALL OTHER CATEGORIES (Burgers, Coffee, Tea, Bakery, Pastries, Sandwiches, Rice, Starters, etc.) -> DIRECT ADD TO CART
    return { variants: [], modifierGroups: [] };
  }
}

export const menuService = new MenuService();
