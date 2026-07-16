import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { FeatureFlag, ReceiptCustomization, ReceiptNumberRule, DiscountRoleLimit } from '@/types/settings.types';

export class SettingsService extends BaseService {
  // Feature Flags
  async getFeatureFlags(restaurantId: string): Promise<ApiResponse<FeatureFlag[]>> {
    return this.handleCall(
      supabase.from('feature_flags').select('*').eq('restaurant_id', restaurantId)
    );
  }

  async setFeatureFlag(restaurantId: string, featureKey: string, enabled: boolean): Promise<ApiResponse<FeatureFlag>> {
    return this.handleCall(
      supabase
        .from('feature_flags')
        .upsert({ restaurant_id: restaurantId, feature_key: featureKey, enabled }, { onConflict: 'restaurant_id,feature_key' })
        .select()
        .single()
    );
  }

  // Receipt Customization
  async getReceiptCustomization(restaurantId: string): Promise<ApiResponse<ReceiptCustomization | null>> {
    return this.handleCall(
      supabase
        .from('receipt_customizations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
    );
  }

  async upsertReceiptCustomization(
    restaurantId: string,
    data: Partial<Omit<ReceiptCustomization, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>>
  ): Promise<ApiResponse<ReceiptCustomization>> {
    return this.handleCall(
      supabase
        .from('receipt_customizations')
        .upsert({ ...data, restaurant_id: restaurantId }, { onConflict: 'restaurant_id' })
        .select()
        .single()
    );
  }

  // Receipt Number Rules
  async getReceiptNumberRules(restaurantId: string): Promise<ApiResponse<ReceiptNumberRule[]>> {
    return this.handleCall(
      supabase.from('receipt_number_rules').select('*').eq('restaurant_id', restaurantId)
    );
  }

  async updateReceiptNumberRule(
    restaurantId: string,
    ruleType: string,
    data: Partial<ReceiptNumberRule>
  ): Promise<ApiResponse<ReceiptNumberRule>> {
    return this.handleCall(
      supabase
        .from('receipt_number_rules')
        .upsert({ ...data, restaurant_id: restaurantId, rule_type: ruleType }, { onConflict: 'restaurant_id,rule_type' })
        .select()
        .single()
    );
  }

  // Discount Role Limits
  async getDiscountLimits(restaurantId: string): Promise<ApiResponse<DiscountRoleLimit[]>> {
    return this.handleCall(
      supabase.from('discount_role_limits').select('*, roles(name)').eq('restaurant_id', restaurantId)
    );
  }

  async upsertDiscountLimit(
    restaurantId: string,
    roleId: string,
    maxPercentage: number,
    requiresApprovalAbove: number
  ): Promise<ApiResponse<DiscountRoleLimit>> {
    return this.handleCall(
      supabase
        .from('discount_role_limits')
        .upsert({
          restaurant_id: restaurantId,
          role_id: roleId,
          max_discount_percentage: maxPercentage,
          requires_approval_above: requiresApprovalAbove,
        }, { onConflict: 'restaurant_id,role_id' })
        .select()
        .single()
    );
  }
}

export const settingsService = new SettingsService();
