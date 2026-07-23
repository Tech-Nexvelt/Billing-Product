import { describe, it, expect } from 'vitest';
import { ReceiptValidationEngine } from '../services/printing/ReceiptValidationEngine';
import { CharacterLayoutEngine } from '../services/printing/CharacterLayoutEngine';
import { getProfileForWidth } from '../services/printing/PrinterProfile';
import { BillReceiptData } from '../types/receipt.types';

describe('Enterprise Thermal Receipt Engine Test Suite', () => {
  it('PrinterProfile: returns correct column width for 80mm and 58mm', () => {
    const prof80 = getProfileForWidth('80mm');
    expect(prof80.charPerLine).toBe(42);
    expect(prof80.printableWidthMm).toBe(74);

    const prof58 = getProfileForWidth('58mm');
    expect(prof58.charPerLine).toBe(32);
    expect(prof58.printableWidthMm).toBe(52);
  });

  it('CharacterLayoutEngine: formats line alignment within column limits', () => {
    const line80 = CharacterLayoutEngine.formatLine('Margarita Pizza', 'RS 380.00', 42);
    expect(line80.length).toBe(42);
    expect(line80.startsWith('Margarita Pizza')).toBe(true);
    expect(line80.endsWith('RS 380.00')).toBe(true);

    const line58 = CharacterLayoutEngine.formatLine('Burger', 'RS 120.00', 32);
    expect(line58.length).toBe(32);
    expect(line58.startsWith('Burger')).toBe(true);
    expect(line58.endsWith('RS 120.00')).toBe(true);
  });

  it('CharacterLayoutEngine: formats centered text correctly', () => {
    const centered = CharacterLayoutEngine.formatCenter('CUSTOMER COPY', 42);
    expect(centered.length).toBe(42);
    expect(centered.trim()).toBe('CUSTOMER COPY');
  });

  it('ReceiptValidationEngine: blocks empty items and subtotal mismatches', () => {
    const invalidReceipt: BillReceiptData = {
      restaurant_name: 'Test POS',
      restaurant_logo_url: null,
      restaurant_address: null,
      restaurant_phone: null,
      restaurant_email: null,
      gst_number: null,
      bill_number: 'BILL-001',
      invoice_number: 'BILL-001',
      order_number: 'ORD-001',
      date: '2026-07-23',
      time: '16:50',
      cashier_name: 'Admin',
      customer_name: null,
      customer_phone: null,
      customer_gst: null,
      table_number: 'T1',
      floor_name: 'Main',
      items: [],
      subtotal: 500,
      discount_type: null,
      discount_rate: null,
      discount_amount: 0,
      cgst_amount: 12.5,
      sgst_amount: 12.5,
      igst_amount: 0,
      total_tax: 25,
      grand_total: 525,
      payments: [{ method: 'Cash', amount: 525 }],
      footer_message: 'Thanks',
      currency_symbol: '₹'
    };

    const val = ReceiptValidationEngine.validateBillReceipt(invalidReceipt);
    expect(val.isValid).toBe(false);
    expect(val.errors[0].code).toBe('EMPTY_ITEMS');
  });

  it('ReceiptValidationEngine: approves valid receipt payload', () => {
    const validReceipt: BillReceiptData = {
      restaurant_name: 'Test POS',
      restaurant_logo_url: null,
      restaurant_address: null,
      restaurant_phone: null,
      restaurant_email: null,
      gst_number: null,
      bill_number: 'BILL-002',
      invoice_number: 'BILL-002',
      order_number: 'ORD-002',
      date: '2026-07-23',
      time: '16:50',
      cashier_name: 'Admin',
      customer_name: null,
      customer_phone: null,
      customer_gst: null,
      table_number: 'T1',
      floor_name: 'Main',
      items: [
        { name: 'Pizza', quantity: 1, unit_price: 380, item_total: 380, special_notes: null }
      ],
      subtotal: 380,
      discount_type: null,
      discount_rate: null,
      discount_amount: 0,
      cgst_amount: 9.5,
      sgst_amount: 9.5,
      igst_amount: 0,
      total_tax: 19,
      grand_total: 399,
      payments: [{ method: 'Cash', amount: 399 }],
      footer_message: 'Thanks',
      currency_symbol: '₹'
    };

    const val = ReceiptValidationEngine.validateBillReceipt(validReceipt);
    expect(val.isValid).toBe(true);
    expect(val.errors.length).toBe(0);
  });
});
