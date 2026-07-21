import { CartItem } from '@/types/order.types';
import { printQueueService } from '@/services/printer.service';
import { supabase } from '@/lib/supabase';

interface ReceiptData {
  restaurantName: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  currencySymbol: string;
  tableNumber: string;
  orderNumber: string;
  cashierName: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  internalNotes?: string | null;
  isReprint?: boolean;
}

export function printReceipts(
  data: ReceiptData,
  options: { kot?: boolean; bill?: boolean; customer?: boolean; restaurant?: boolean } = { kot: true, bill: true },
  printWindow?: Window | null,
) {
  // Create a temporary print frame or styling
  const style = `
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
      }
      .receipt-container {
        width: 80mm;
        padding: 4mm;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
        border-bottom: 2px dashed #000;
        margin-bottom: 10px;
        padding-bottom: 10px;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .right { text-align: right; }
      .separator {
        border-bottom: 1px dashed #000;
        margin: 5px 0;
      }
      .double-separator {
        border-bottom: 2px double #000;
        margin: 5px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        margin: 3px 0;
      }
      .item-qty { width: 10%; }
      .item-name { width: 60%; }
      .item-price { width: 30%; text-align: right; }
    }
  `;

  // HTML content for print
  const kotHtml = `
    <div class="receipt-container page-break">
      <div class="center bold" style="font-size: 16px;">KITCHEN ORDER TICKET (KOT)</div>
      ${data.isReprint ? '<div class="center bold">** DUPLICATE/REPRINT COPY **</div>' : ''}
      <div class="separator"></div>
      <div><strong>Order Ref:</strong> ${data.orderNumber}</div>
      <div><strong>Table:</strong> ${data.tableNumber}</div>
      <div><strong>Date/Time:</strong> ${data.timestamp}</div>
      <div class="separator"></div>
      <div class="bold" style="display: flex; justify-content: space-between;">
        <span style="width: 20%;">QTY</span>
        <span style="width: 80%;">ITEM</span>
      </div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0;">
          <span style="width: 20%; font-weight: bold;">${item.quantity} x</span>
          <span style="width: 80%;">${item.item_name} ${item.special_notes ? `<br/><small style="font-weight: normal; font-style: italic;">* Note: ${item.special_notes}</small>` : ''}</span>
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="center italic">For Kitchen Station Use Only</div>
    </div>
  `;

  const customerHtml = `
    <div class="receipt-container page-break">
      <div class="center">
        ${data.logoUrl ? `<img src="${data.logoUrl}" style="max-height: 40px; margin-bottom: 5px;" />` : ''}
        <div class="bold" style="font-size: 16px;">${data.restaurantName}</div>
        ${data.address ? `<div>${data.address}</div>` : ''}
        ${data.phone ? `<div>Ph: ${data.phone}</div>` : ''}
        ${data.gstNumber ? `<div>GSTIN: ${data.gstNumber}</div>` : ''}
        ${data.isReprint ? '<div class="bold" style="margin-top: 4px; border: 1px solid #000; padding: 2px;">REPRINT COPY</div>' : ''}
      </div>
      <div class="separator"></div>
      <div><strong>Invoice:</strong> ${data.orderNumber}</div>
      <div><strong>Table:</strong> ${data.tableNumber}</div>
      <div><strong>Cashier:</strong> ${data.cashierName}</div>
      <div><strong>Date:</strong> ${data.timestamp}</div>
      <div class="separator"></div>
      <div class="bold" style="display: flex;">
        <span style="width: 10%;">QTY</span>
        <span style="width: 60%;">ITEM</span>
        <span style="width: 30%; text-align: right;">PRICE</span>
      </div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div style="display: flex;">
          <span style="width: 10%;">${item.quantity}</span>
          <span style="width: 60%;">${item.item_name}</span>
          <span style="width: 30%; text-align: right;">${data.currencySymbol}${item.item_total.toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="item-row">
        <span>Subtotal:</span>
        <span>${data.currencySymbol}${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.discountAmount > 0 ? `
        <div class="item-row">
          <span>Discount:</span>
          <span>-${data.currencySymbol}${data.discountAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="item-row">
        <span>GST (${data.taxRate}%):</span>
        <span>${data.currencySymbol}${data.taxAmount.toFixed(2)}</span>
      </div>
      ${data.serviceChargeAmount > 0 ? `
        <div class="item-row">
          <span>Service Charge (${data.serviceChargeRate}%):</span>
          <span>${data.currencySymbol}${data.serviceChargeAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="double-separator"></div>
      <div class="item-row bold" style="font-size: 14px;">
        <span>GRAND TOTAL:</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="double-separator"></div>
      <div class="center">
        <strong>Paid via ${data.paymentMethod}</strong>
      </div>
      <div class="separator"></div>
      <div class="center bold" style="margin-top: 5px;">Thank You! Visit Again</div>
    </div>
  `;

  const restaurantHtml = `
    <div class="receipt-container">
      <div class="center">
        <div class="bold" style="font-size: 14px; border: 1px solid #000; padding: 2px; display: inline-block; margin-bottom: 5px;">INTERNAL COPY (RESTAURANT)</div>
        <div class="bold" style="font-size: 16px;">${data.restaurantName}</div>
        ${data.isReprint ? '<div class="bold" style="margin-top: 4px; border: 1px solid #000; padding: 2px;">REPRINT COPY</div>' : ''}
      </div>
      <div class="separator"></div>
      <div><strong>Invoice:</strong> ${data.orderNumber}</div>
      <div><strong>Table:</strong> ${data.tableNumber}</div>
      <div><strong>Cashier:</strong> ${data.cashierName}</div>
      <div><strong>Date:</strong> ${data.timestamp}</div>
      <div class="separator"></div>
      <div class="bold" style="display: flex;">
        <span style="width: 10%;">QTY</span>
        <span style="width: 60%;">ITEM</span>
        <span style="width: 30%; text-align: right;">PRICE</span>
      </div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div style="display: flex;">
          <span style="width: 10%;">${item.quantity}</span>
          <span style="width: 60%;">${item.item_name}</span>
          <span style="width: 30%; text-align: right;">${data.currencySymbol}${item.item_total.toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="item-row">
        <span>Subtotal:</span>
        <span>${data.currencySymbol}${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.discountAmount > 0 ? `
        <div class="item-row">
          <span>Discount:</span>
          <span>-${data.currencySymbol}${data.discountAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="item-row">
        <span>GST (${data.taxRate}%):</span>
        <span>${data.currencySymbol}${data.taxAmount.toFixed(2)}</span>
      </div>
      <div class="double-separator"></div>
      <div class="item-row bold">
        <span>GRAND TOTAL:</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="separator"></div>
      <div class="center">
        <strong>Paid via ${data.paymentMethod}</strong>
      </div>
      <div class="separator"></div>
      ${data.internalNotes ? `<div><strong>Internal Notes:</strong> ${data.internalNotes}</div><div class="separator"></div>` : ''}
      <div class="center italic">Internal Audit Copy</div>
    </div>
  `;

  const htmlParts = [];
  const hasSpecificBillTemplate = options.customer !== undefined || options.restaurant !== undefined;
  
  if (options.kot ?? (!hasSpecificBillTemplate)) {
    htmlParts.push(kotHtml);
  }
  
  if (hasSpecificBillTemplate) {
    if (options.customer) htmlParts.push(customerHtml);
    if (options.restaurant) htmlParts.push(restaurantHtml);
  } else if (options.bill ?? true) {
    htmlParts.push(customerHtml);
    htmlParts.push(restaurantHtml);
  }

  // Write content to print window
  const targetWindow = printWindow || window.open('', '_blank');
  if (targetWindow) {
    targetWindow.document.write(`
      <html>
        <head>
          <title>Print Receipt - ${data.orderNumber}</title>
          <style>${style}</style>
        </head>
        <body>
          ${htmlParts.join('')}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    targetWindow.document.close();
  }
}

export interface UnifiedPrintParams {
  type: 'customer' | 'owner' | 'kot';
  restaurant: any;
  table: any;
  floorName: string;
  cashierName: string;
  orderNumber: string;
  orderId: string;
  items: any[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  specialInstructions?: string | null;
  isReprint?: boolean;
  kotVersion?: number;
  printWindow?: Window | null;
  printers?: any[];
  userId?: string;
  reprintReason?: string;
}

export async function unifiedPrintReceipt(params: UnifiedPrintParams) {
  const startTime = Date.now();
  let printStatus: 'success' | 'failed' = 'success';
  let errorMsg: string | null = null;

  try {
    const {
      type,
      restaurant,
      table,
      floorName,
      cashierName,
      orderNumber,
      orderId,
      items,
      subtotal,
      taxRate: _taxRate,
      taxAmount,
      serviceChargeRate: _serviceChargeRate,
      serviceChargeAmount: _serviceChargeAmount,
      discountAmount,
      grandTotal,
      paymentMethod,
      specialInstructions,
      isReprint = false,
      kotVersion = 1,
      printWindow = null,
      printers = [],
      userId,
    } = params;

    // Route to local print queue which checks health, failover, etc.
    printQueueService.addJob({
      type,
      data: {
        restaurant_name: restaurant?.name || 'NexVelt POS',
        restaurant_address: restaurant?.address || null,
        restaurant_phone: restaurant?.phone || null,
        restaurant_email: restaurant?.email || null,
        gst_number: restaurant?.gst_number || null,
        bill_number: orderNumber,
        invoice_number: orderNumber,
        order_number: orderNumber,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashier_name: cashierName,
        table_number: table?.table_number || '',
        floor_name: floorName,
        items: items.map(i => ({
          name: i.item_name || i.name,
          quantity: i.quantity,
          unit_price: i.unit_price || 0,
          item_total: i.item_total || 0,
          special_notes: i.special_notes || i.specialInstructions || null
        })),
        subtotal,
        discount_amount: discountAmount,
        cgst_amount: taxAmount / 2,
        sgst_amount: taxAmount / 2,
        grand_total: grandTotal,
        payments: [{ method: paymentMethod, amount: grandTotal }],
        footer_message: isReprint ? 'DUPLICATE COPY' : 'Thank You!',
        currency_symbol: '₹',
        internal_notes: specialInstructions || null,
        is_reprint: isReprint,
        token_number: kotVersion,
        kitchen_notes: specialInstructions || null,
      },
      options: {
        orderId,
        userId,
        printWindow,
      },
      printerId: type === 'kot'
        ? printers?.find(p => p.is_default_kitchen)?.id
        : printers?.find(p => p.is_default_billing)?.id
    });

  } catch (err: any) {
    printStatus = 'failed';
    errorMsg = err.message || 'Printing failed';
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    // Audit log
    await logReceiptPrint({
      restaurantId: params.restaurant?.id,
      orderId: params.orderId,
      receiptType: params.type,
      receiptNumber: params.orderNumber,
      printerName: params.type === 'kot' ? 'Kitchen Printer' : 'Billing Printer',
      printedBy: params.userId,
      printDurationMs: duration,
      printStatus,
      isReprint: params.isReprint || false,
      reprintReason: params.reprintReason || null,
      copies: 1,
      metadata: errorMsg ? { error: errorMsg } : {},
    });
  }
}

async function logReceiptPrint(audit: {
  restaurantId: string;
  orderId: string;
  receiptType: string;
  receiptNumber: string;
  printerName: string;
  printedBy?: string;
  printDurationMs: number;
  printStatus: string;
  isReprint: boolean;
  reprintReason?: string | null;
  copies: number;
  metadata: any;
}) {
  try {
    // 1. Try writing to receipt_print_history table
    const { error } = await supabase
      .from('receipt_print_history')
      .insert({
        restaurant_id: audit.restaurantId,
        order_id: audit.orderId,
        receipt_type: audit.receiptType,
        receipt_number: audit.receiptNumber,
        printer_name: audit.printerName,
        printer_type: 'browser',
        printed_by: audit.printedBy || null,
        print_duration_ms: audit.printDurationMs,
        print_status: audit.printStatus,
        is_reprint: audit.isReprint,
        reprint_reason: audit.reprintReason,
        copies: audit.copies,
        metadata: audit.metadata
      });

    if (error) throw error;
  } catch (err: any) {
    console.warn('Could not write print audit to receipt_print_history table, logging to activity_logs fallback instead.', err);
    // 2. Fallback: Write print event to activity_logs
    try {
      await supabase.from('activity_logs').insert({
        restaurant_id: audit.restaurantId,
        user_id: audit.printedBy || null,
        action: audit.isReprint ? 'receipt_reprinted' : 'receipt_printed',
        entity_type: 'order',
        entity_id: audit.orderId,
        metadata: {
          receipt_type: audit.receiptType,
          receipt_number: audit.receiptNumber,
          printer: audit.printerName,
          duration_ms: audit.printDurationMs,
          status: audit.printStatus,
          is_reprint: audit.isReprint,
          reprint_reason: audit.reprintReason,
          timestamp: new Date().toISOString()
        }
      });
    } catch (fallbackErr) {
      console.error('Failed to log print audit log:', fallbackErr);
    }
  }
}
