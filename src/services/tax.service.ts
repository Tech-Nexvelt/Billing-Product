import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { TaxProfile, TaxCalculation, TaxBreakdownLine } from '@/types/tax.types';

export class TaxService extends BaseService {
  async getAll(restaurantId: string): Promise<ApiResponse<TaxProfile[]>> {
    return this.handleCall(
      supabase
        .from('tax_profiles')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .order('name')
    );
  }

  async getDefault(restaurantId: string): Promise<ApiResponse<TaxProfile | null>> {
    return this.handleCall(
      supabase
        .from('tax_profiles')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_default', true)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
    );
  }

  async getById(id: string): Promise<ApiResponse<TaxProfile>> {
    return this.handleCall(
      supabase
        .from('tax_profiles')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
    );
  }

  async create(
    restaurantId: string,
    data: Omit<TaxProfile, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'deleted_by' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<TaxProfile>> {
    return this.handleCall(
      supabase
        .from('tax_profiles')
        .insert({ ...data, restaurant_id: restaurantId })
        .select()
        .single()
    );
  }

  async update(
    id: string,
    data: Partial<TaxProfile>,
    currentVersion: number
  ): Promise<ApiResponse<TaxProfile>> {
    return this.handleCall(
      supabase
        .from('tax_profiles')
        .update({ ...data, version: currentVersion + 1 })
        .eq('id', id)
        .eq('version', currentVersion)
        .select()
        .single()
    );
  }

  async setDefault(id: string, restaurantId: string): Promise<ApiResponse<TaxProfile>> {
    // Unset current default first
    await supabase
      .from('tax_profiles')
      .update({ is_default: false })
      .eq('restaurant_id', restaurantId)
      .eq('is_default', true)
      .is('deleted_at', null);

    return this.handleCall(
      supabase
        .from('tax_profiles')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single()
    );
  }

  async delete(id: string, userId: string, currentVersion: number): Promise<ApiResponse<null>> {
    const { error } = await supabase
      .from('tax_profiles')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .eq('version', currentVersion);
    if (error) return this.createClientError(error.message);
    return { success: true, message: 'Tax profile deleted', data: null, error: null };
  }

  calculateTax(subtotal: number, taxProfile: TaxProfile | null): TaxCalculation {
    if (!taxProfile || taxProfile.tax_type === 'none') {
      return {
        subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        custom_tax_amount: 0,
        total_tax: 0,
        grand_total: subtotal,
        tax_profile: taxProfile,
        breakdown: [],
      };
    }

    let base = subtotal;
    let cgst_amount = 0;
    let sgst_amount = 0;
    let igst_amount = 0;
    let custom_tax_amount = 0;
    const breakdown: TaxBreakdownLine[] = [];

    if (taxProfile.is_inclusive) {
      const totalRate = taxProfile.cgst + taxProfile.sgst + taxProfile.igst + taxProfile.custom_rate;
      base = subtotal / (1 + totalRate / 100);
    }

    if (taxProfile.tax_type === 'cgst_sgst') {
      cgst_amount = (base * taxProfile.cgst) / 100;
      sgst_amount = (base * taxProfile.sgst) / 100;
      if (taxProfile.cgst > 0) breakdown.push({ label: `CGST @ ${taxProfile.cgst}%`, rate: taxProfile.cgst, amount: cgst_amount });
      if (taxProfile.sgst > 0) breakdown.push({ label: `SGST @ ${taxProfile.sgst}%`, rate: taxProfile.sgst, amount: sgst_amount });
    } else if (taxProfile.tax_type === 'igst') {
      igst_amount = (base * taxProfile.igst) / 100;
      if (taxProfile.igst > 0) breakdown.push({ label: `IGST @ ${taxProfile.igst}%`, rate: taxProfile.igst, amount: igst_amount });
    } else if (taxProfile.tax_type === 'custom') {
      custom_tax_amount = (base * taxProfile.custom_rate) / 100;
      if (taxProfile.custom_rate > 0) breakdown.push({ label: `Tax @ ${taxProfile.custom_rate}%`, rate: taxProfile.custom_rate, amount: custom_tax_amount });
    }

    const total_tax = cgst_amount + sgst_amount + igst_amount + custom_tax_amount;
    return {
      subtotal,
      cgst_amount,
      sgst_amount,
      igst_amount,
      custom_tax_amount,
      total_tax,
      grand_total: taxProfile.is_inclusive ? subtotal : subtotal + total_tax,
      tax_profile: taxProfile,
      breakdown,
    };
  }
}

export const taxService = new TaxService();
