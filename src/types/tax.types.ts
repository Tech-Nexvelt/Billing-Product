export type TaxType = 'cgst_sgst' | 'igst' | 'custom' | 'none';

export interface TaxProfile {
  id: string;
  restaurant_id: string;
  name: string;
  tax_type: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  custom_rate: number;
  is_inclusive: boolean;
  is_default: boolean;
  version: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxCalculation {
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  custom_tax_amount: number;
  total_tax: number;
  grand_total: number;
  tax_profile: TaxProfile | null;
  breakdown: TaxBreakdownLine[];
}

export interface TaxBreakdownLine {
  label: string;
  rate: number;
  amount: number;
}
