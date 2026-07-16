import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Restaurant, RestaurantSettings } from '@/types/restaurant.types';
import { RestaurantOnboardingInput, RestaurantSettingsInput } from '@/schemas/restaurant.schema';

export class RestaurantService extends BaseService {
  async getRestaurant(id: string): Promise<ApiResponse<Restaurant>> {
    return this.handleCall(
      supabase.from('restaurants').select('*').eq('id', id).single()
    );
  }

  async getSettings(restaurantId: string): Promise<ApiResponse<RestaurantSettings>> {
    return this.handleCall(
      supabase.from('restaurant_settings').select('*').eq('restaurant_id', restaurantId).single()
    );
  }

  async updateSettings(
    restaurantId: string,
    input: RestaurantSettingsInput
  ): Promise<ApiResponse<RestaurantSettings>> {
    const { data: currentSettings, error: getError } = await supabase
      .from('restaurant_settings')
      .select('id, version')
      .eq('restaurant_id', restaurantId)
      .single();

    if (getError) return this.createClientError(getError.message);

    return this.handleCall(
      supabase
        .from('restaurant_settings')
        .update({
          tax_rate: input.taxRate,
          service_charge: input.serviceCharge,
          currency_symbol: input.currencySymbol,
          decimal_places: input.decimalPlaces,
        })
        .eq('restaurant_id', restaurantId)
        .eq('version', currentSettings.version) // optimistic lock trigger verification
        .select()
        .single()
    );
  }

  async onboardRestaurant(_userId: string, input: RestaurantOnboardingInput): Promise<ApiResponse<{ restaurant: Restaurant }>> {
    try {
      // 1. Create or Get Organization
      const orgSlug = input.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let org;
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .maybeSingle();

      if (existingOrg) {
        org = existingOrg;
      } else {
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: input.organizationName, slug: orgSlug })
          .select()
          .single();

        if (orgError) throw orgError;
        org = newOrg;
      }

      // 2. Create or Get Restaurant
      let restaurant;
      const { data: existingRest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('organization_id', org.id)
        .eq('name', input.restaurantName)
        .maybeSingle();

      if (existingRest) {
        restaurant = existingRest;
      } else {
        const { data: newRest, error: restError } = await supabase
          .from('restaurants')
          .insert({
            organization_id: org.id,
            name: input.restaurantName,
            phone: input.phone || null,
            email: input.email || null,
            address: input.address || null,
            gst_number: input.gstNumber || null,
            currency: input.currency,
            timezone: input.timezone,
            business_type: input.businessType,
          })
          .select()
          .single();

        if (restError) throw restError;
        restaurant = newRest;
      }

      // 3. Create settings, roles, permissions, floors, tables via DB function
      const { error: workspaceError } = await supabase.rpc('create_restaurant_workspace', {
        p_restaurant_id: restaurant.id,
        p_num_floors: input.numFloors,
        p_num_tables: input.numTables,
      });

      if (workspaceError) throw workspaceError;

      // 4. Update the user with restaurant and role (Owner) metadata
      const ownerRoleQuery = await supabase
        .from('roles')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('name', 'Owner')
        .single();

      if (ownerRoleQuery.error) throw ownerRoleQuery.error;

      // We update the user profile trigger
      const { error: userUpdateError } = await supabase.auth.updateUser({
        data: {
          restaurant_id: restaurant.id,
          role_id: ownerRoleQuery.data.id,
        },
      });

      if (userUpdateError) throw userUpdateError;

      return {
        success: true,
        message: 'Onboarding complete',
        data: { restaurant },
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Onboarding failed');
    }
  }
}

export const restaurantService = new RestaurantService();
