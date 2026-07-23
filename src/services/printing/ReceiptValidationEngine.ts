import { BillReceiptData, KotReceiptData } from '@/types/receipt.types';

export interface ReceiptValidationError {
  code: string;
  message: string;
}

export class ReceiptValidationEngine {
  /**
   * Validates a Customer or Merchant Bill Receipt payload before dispatching to hardware.
   */
  static validateBillReceipt(data: BillReceiptData): { isValid: boolean; errors: ReceiptValidationError[] } {
    const errors: ReceiptValidationError[] = [];

    if (!data.items || data.items.length === 0) {
      errors.push({ code: 'EMPTY_ITEMS', message: 'Receipt cannot be printed without line items.' });
    }

    if (data.grand_total < 0) {
      errors.push({ code: 'NEGATIVE_GRAND_TOTAL', message: 'Grand total cannot be negative.' });
    }

    if (data.items && data.items.length > 0) {
      const calculatedSubtotal = data.items.reduce((sum, item) => sum + (item.item_total || 0), 0);
      if (Math.abs(calculatedSubtotal - data.subtotal) > 1.0) {
        errors.push({
          code: 'SUBTOTAL_MISMATCH',
          message: `Calculated items total (${calculatedSubtotal.toFixed(2)}) differs from receipt subtotal (${data.subtotal.toFixed(2)}).`
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates a Kitchen Order Ticket payload before printing.
   */
  static validateKotReceipt(data: KotReceiptData): { isValid: boolean; errors: ReceiptValidationError[] } {
    const errors: ReceiptValidationError[] = [];

    if (!data.items || data.items.length === 0) {
      errors.push({ code: 'EMPTY_KOT_ITEMS', message: 'KOT cannot be generated without kitchen items.' });
    }

    return { isValid: errors.length === 0, errors };
  }
}
