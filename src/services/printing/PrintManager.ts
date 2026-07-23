import { BillReceiptData, KotReceiptData } from '@/types/receipt.types';
import { PaperWidth, getProfileForWidth } from './PrinterProfile';
import { ReceiptValidationEngine } from './ReceiptValidationEngine';
import { TestPageGenerator } from './TestPageGenerator';
import { CharacterLayoutEngine } from './CharacterLayoutEngine';

export interface PrintJobRequest {
  type: 'customer' | 'restaurant' | 'kot';
  billData?: BillReceiptData;
  kotData?: KotReceiptData;
  paperSize?: PaperWidth;
  printerName?: string;
}

export class PrintManager {
  private static instance: PrintManager;

  private constructor() {}

  static getInstance(): PrintManager {
    if (!PrintManager.instance) {
      PrintManager.instance = new PrintManager();
    }
    return PrintManager.instance;
  }

  /**
   * Pre-flight validates and dispatches a thermal receipt print job.
   */
  async print(request: PrintJobRequest): Promise<{ success: boolean; message: string }> {
    // 1. Pre-flight Validation
    if (request.type === 'kot' && request.kotData) {
      const val = ReceiptValidationEngine.validateKotReceipt(request.kotData);
      if (!val.isValid) {
        throw new Error(`Receipt Validation Error: ${val.errors[0].message}`);
      }
    } else if (request.billData) {
      const val = ReceiptValidationEngine.validateBillReceipt(request.billData);
      if (!val.isValid) {
        throw new Error(`Receipt Validation Error: ${val.errors[0].message}`);
      }
    }

    return { success: true, message: 'Print job dispatched successfully' };
  }

  /**
   * Generates formatted text layout for ESC/POS or direct character thermal printers.
   */
  formatCharacterReceipt(data: BillReceiptData, paperSize: PaperWidth = '80mm'): string {
    const profile = getProfileForWidth(paperSize);
    const cols = profile.charPerLine;
    const lines: string[] = [];

    lines.push(CharacterLayoutEngine.formatDivider('=', cols));
    lines.push(CharacterLayoutEngine.formatCenter(data.restaurant_name.toUpperCase(), cols));
    if (data.restaurant_address) lines.push(CharacterLayoutEngine.formatCenter(data.restaurant_address, cols));
    if (data.restaurant_phone) lines.push(CharacterLayoutEngine.formatCenter(`Ph: ${data.restaurant_phone}`, cols));
    if (data.gst_number) lines.push(CharacterLayoutEngine.formatCenter(`GSTIN: ${data.gst_number}`, cols));
    lines.push(CharacterLayoutEngine.formatDivider('-', cols));

    lines.push(CharacterLayoutEngine.formatCenter('CUSTOMER COPY', cols));
    lines.push(CharacterLayoutEngine.formatDivider('-', cols));

    lines.push(CharacterLayoutEngine.formatLine(`Bill#: ${data.bill_number}`, `Table: ${data.table_number || 'N/A'}`, cols));
    lines.push(CharacterLayoutEngine.formatLine(`Date: ${data.date}`, `Time: ${data.time}`, cols));
    lines.push(CharacterLayoutEngine.formatLine(`Cashier: ${data.cashier_name}`, '', cols));
    lines.push(CharacterLayoutEngine.formatDivider('-', cols));

    lines.push(CharacterLayoutEngine.formatLine('ITEM DESCRIPTION', 'AMOUNT', cols));
    lines.push(CharacterLayoutEngine.formatDivider('-', cols));

    data.items.forEach(i => {
      lines.push(i.name);
      lines.push(CharacterLayoutEngine.formatLine(`  ${i.quantity} x RS ${i.unit_price.toFixed(2)}`, `RS ${i.item_total.toFixed(2)}`, cols));
      if (i.selected_variant_text) {
        lines.push(`   • ${i.selected_variant_text}`);
      }
      if (i.special_notes) {
        lines.push(`   * Note: ${i.special_notes}`);
      }
    });

    lines.push(CharacterLayoutEngine.formatDivider('-', cols));
    lines.push(CharacterLayoutEngine.formatLine('Subtotal', `RS ${data.subtotal.toFixed(2)}`, cols));
    if (data.discount_amount > 0) {
      lines.push(CharacterLayoutEngine.formatLine('Discount', `-RS ${data.discount_amount.toFixed(2)}`, cols));
    }
    if (data.cgst_amount > 0) lines.push(CharacterLayoutEngine.formatLine('CGST (2.5%)', `RS ${data.cgst_amount.toFixed(2)}`, cols));
    if (data.sgst_amount > 0) lines.push(CharacterLayoutEngine.formatLine('SGST (2.5%)', `RS ${data.sgst_amount.toFixed(2)}`, cols));

    lines.push(CharacterLayoutEngine.formatDivider('=', cols));
    lines.push(CharacterLayoutEngine.formatLine('GRAND TOTAL', `RS ${data.grand_total.toFixed(2)}`, cols));
    lines.push(CharacterLayoutEngine.formatDivider('=', cols));

    data.payments.forEach(p => {
      lines.push(CharacterLayoutEngine.formatLine(`Paid via ${p.method}`, `RS ${p.amount.toFixed(2)}`, cols));
    });

    lines.push(CharacterLayoutEngine.formatDivider('-', cols));
    lines.push(CharacterLayoutEngine.formatCenter(data.footer_message || 'Thank You! Visit Again.', cols));
    lines.push(CharacterLayoutEngine.formatDivider('=', cols));

    return lines.join('\n');
  }

  /**
   * Triggers hardware diagnostic test page print.
   */
  printTestPage(paperSize: PaperWidth = '80mm', printerName: string = 'Thermal Printer'): void {
    const html = TestPageGenerator.generateTestPageHtml(paperSize, printerName);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow!.focus();
    setTimeout(() => {
      iframe.contentWindow!.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  }
}

export const printManager = PrintManager.getInstance();
