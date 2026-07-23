import { CartItem } from '@/types/order.types';
import { printQueueService } from '@/services/printer.service';
import { supabase } from '@/lib/supabase';
import { useBrandingStore } from '@/stores/useBrandingStore';
import { getRestaurantInitials } from '@/utils/imageSanitizer.utils';

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
  const branding = useBrandingStore.getState().branding;
  const effectiveName = branding?.name || data.restaurantName || 'NexVelt POS';
  const effectiveLogo = branding?.receipt_logo_url || branding?.logo_url || data.logoUrl || null;
  const effectiveAddress = branding?.address || data.address || '';
  const effectivePhone = branding?.phone || data.phone || '';
  const effectiveEmail = branding?.email || data.email || '';
  const effectiveGst = branding?.gst_number || data.gstNumber || '';
  const initials = getRestaurantInitials(effectiveName);

  const customerLogoHtml = effectiveLogo
    ? `<img src="${effectiveLogo}" style="max-height: 48px; max-width: 120px; object-fit: contain; margin: 0 auto 5px auto; display: block;" onError="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" /><div style="display:none; font-size:14px; font-weight:bold; padding:4px 8px; border:1px solid #000; margin:0 auto 5px auto;">${initials}</div>`
    : `<div style="display:inline-block; font-size:14px; font-weight:bold; padding:4px 8px; border:1px solid #000; margin:0 auto 5px auto;">${initials}</div>`;

  // Create a temporary print frame or styling for continuous 80mm thermal receipts
  const style = `
    @media print {
      @page {
        size: 80mm auto;
        margin: 0mm !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 80mm !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace, sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      header, footer {
        display: none !important;
      }
    }

    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
    }

    .receipt-container {
      width: 76mm;
      max-width: 76mm;
      margin: 0 auto;
      padding: 3mm 2mm;
      box-sizing: border-box;
      page-break-before: avoid !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      break-before: avoid !important;
      break-after: avoid !important;
      break-inside: avoid !important;
    }

    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #000; margin: 4px 0; }
    .double-separator { border-top: 2.5px double #000; margin: 4px 0; }
    .item-row { display: flex; justify-content: space-between; align-items: center; margin: 1.5px 0; }
    .item-entry { margin-bottom: 5px; }
    .item-name { font-size: 11.5px; font-weight: bold; word-break: break-word; }
    .variant-detail { font-size: 9.5px; color: #222; padding-left: 8px; }
    .note-detail { font-size: 9.5px; font-style: italic; color: #333; padding-left: 8px; }
  `;

  // HTML content for KOT print
  const kotHtml = `
    <div class="receipt-container">
      <div class="center bold" style="font-size: 16px;">KITCHEN ORDER TICKET</div>
      ${data.isReprint ? '<div class="center bold">** DUPLICATE COPY **</div>' : ''}
      <div class="separator"></div>
      <div class="item-row"><span>Order Ref: <strong>${data.orderNumber}</strong></span><span>Table: <strong>${data.tableNumber}</strong></span></div>
      <div class="item-row"><span>Date: ${data.timestamp}</span><span>Cashier: ${data.cashierName}</span></div>
      <div class="separator"></div>
      <div class="item-row bold"><span>QTY</span><span>ITEM SPECIFICATION</span></div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div style="margin-bottom: 6px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
          <div class="item-row" style="align-items: flex-start;">
            <span style="width: 18%; font-size: 13px; font-weight: bold;">${item.quantity} ×</span>
            <span style="width: 82%; font-size: 13px; font-weight: bold; word-break: break-word;">${item.item_name}</span>
          </div>
          ${item.selected_variant_text ? `
            <div class="variant-detail" style="margin-left: 18%;">
              • ${item.selected_variant_text.split(' | ').join('<br/>• ')}
            </div>
          ` : ''}
          ${item.special_notes ? `
            <div class="note-detail" style="margin-left: 18%;">
              * Note: ${item.special_notes}
            </div>
          ` : ''}
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="center" style="font-size: 9px; color: #444;">-- Kitchen Station Record --</div>
    </div>
  `;

  const customerHtml = `
    <div class="receipt-container">
      <div class="center">
        ${customerLogoHtml}
        <div class="bold" style="font-size: 17px; text-transform: uppercase;">${effectiveName}</div>
        ${effectiveAddress ? `<div style="font-size: 10px;">${effectiveAddress}</div>` : ''}
        ${effectivePhone ? `<div style="font-size: 10px;">Ph: ${effectivePhone}</div>` : ''}
        ${effectiveEmail ? `<div style="font-size: 10px;">Email: ${effectiveEmail}</div>` : ''}
        ${effectiveGst ? `<div style="font-size: 10px; font-weight: bold;">GSTIN: ${effectiveGst}</div>` : ''}
      </div>
      <div class="separator"></div>
      <div class="center bold" style="font-size: 12px; letter-spacing: 1px;">
        CUSTOMER COPY
        ${data.isReprint ? ' - REPRINT' : ''}
      </div>
      <div class="separator"></div>
      <div class="item-row"><span>Bill No: <strong>${data.orderNumber}</strong></span><span>Table: <strong>${data.tableNumber || 'N/A'}</strong></span></div>
      <div class="item-row"><span>Date: ${data.timestamp}</span><span>Cashier: ${data.cashierName}</span></div>
      <div class="separator"></div>
      <div class="item-row bold"><span>ITEM DESCRIPTION</span><span>AMOUNT</span></div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div class="item-entry">
          <div class="item-name">${item.item_name}</div>
          <div class="item-row" style="font-size: 10.5px;">
            <span>${item.quantity} × ${data.currencySymbol}${item.unit_price.toFixed(2)}</span>
            <span class="bold">${data.currencySymbol}${item.item_total.toFixed(2)}</span>
          </div>
          ${item.selected_variant_text ? `
            <div class="variant-detail">
              • ${item.selected_variant_text.split(' | ').join('<br/>• ')}
            </div>
          ` : ''}
          ${item.special_notes ? `
            <div class="note-detail">
              * Note: ${item.special_notes}
            </div>
          ` : ''}
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="item-row">
        <span>Subtotal</span>
        <span>${data.currencySymbol}${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.discountAmount > 0 ? `
        <div class="item-row bold">
          <span>Discount</span>
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
      <div class="item-row bold" style="font-size: 15px;">
        <span>GRAND TOTAL</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="double-separator"></div>
      <div class="item-row bold">
        <span>Paid via ${data.paymentMethod}</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="separator"></div>
      <div class="center bold" style="margin-top: 4px;">Thank You! Please Visit Again.</div>
      <div class="center" style="font-size: 9px; color: #444; margin-top: 2px;">NexVelt POS • Enterprise Billing Systems</div>
    </div>
  `;

  const restaurantHtml = `
    <div class="receipt-container">
      <div class="center">
        <div class="bold" style="font-size: 17px; text-transform: uppercase;">${effectiveName}</div>
      </div>
      <div class="separator"></div>
      <div class="center bold" style="font-size: 12px; letter-spacing: 1px;">
        MERCHANT COPY
        ${data.isReprint ? ' - REPRINT' : ''}
      </div>
      <div class="separator"></div>
      <div class="item-row"><span>Bill No: <strong>${data.orderNumber}</strong></span><span>Table: <strong>${data.tableNumber || 'N/A'}</strong></span></div>
      <div class="item-row"><span>Date: ${data.timestamp}</span><span>Cashier: ${data.cashierName}</span></div>
      <div class="separator"></div>
      <div class="item-row bold"><span>ITEM DESCRIPTION</span><span>AMOUNT</span></div>
      <div class="separator"></div>
      ${data.items.map(item => `
        <div class="item-entry">
          <div class="item-name">${item.item_name}</div>
          <div class="item-row" style="font-size: 10.5px;">
            <span>${item.quantity} × ${data.currencySymbol}${item.unit_price.toFixed(2)}</span>
            <span class="bold">${data.currencySymbol}${item.item_total.toFixed(2)}</span>
          </div>
          ${item.selected_variant_text ? `
            <div class="variant-detail">
              • ${item.selected_variant_text.split(' | ').join('<br/>• ')}
            </div>
          ` : ''}
          ${item.special_notes ? `
            <div class="note-detail">
              * Note: ${item.special_notes}
            </div>
          ` : ''}
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="item-row">
        <span>Subtotal</span>
        <span>${data.currencySymbol}${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.discountAmount > 0 ? `
        <div class="item-row bold">
          <span>Discount</span>
          <span>-${data.currencySymbol}${data.discountAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="item-row">
        <span>GST (${data.taxRate}%):</span>
        <span>${data.currencySymbol}${data.taxAmount.toFixed(2)}</span>
      </div>
      <div class="double-separator"></div>
      <div class="item-row bold" style="font-size: 15px;">
        <span>GRAND TOTAL</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="double-separator"></div>
      <div class="item-row bold">
        <span>Paid via ${data.paymentMethod}</span>
        <span>${data.currencySymbol}${data.grandTotal.toFixed(2)}</span>
      </div>
      <div class="separator"></div>
      ${data.internalNotes ? `<div><strong>Internal Notes:</strong> ${data.internalNotes}</div><div class="separator"></div>` : ''}
      <div class="center" style="font-size: 9px; color: #444; margin-top: 2px;">Merchant Copy • Internal Record</div>
    </div>
  `;

  const htmlParts = [];
  const hasSpecificBillTemplate = options.customer !== undefined || options.restaurant !== undefined;
  
  if (options.kot) {
    htmlParts.push(kotHtml);
  }
  
  if (hasSpecificBillTemplate) {
    if (options.customer) htmlParts.push(customerHtml);
    if (options.restaurant) htmlParts.push(restaurantHtml);
  } else if (options.bill ?? true) {
    htmlParts.push(customerHtml);
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

    const branding = useBrandingStore.getState().branding;
    const effectiveLogo = branding?.receipt_logo_url || branding?.logo_url || restaurant?.logo_url || null;
    const effectiveName = branding?.name || restaurant?.name || 'NexVelt POS';
    const effectiveAddress = branding?.address || restaurant?.address || null;
    const effectivePhone = branding?.phone || restaurant?.phone || null;
    const effectiveEmail = branding?.email || restaurant?.email || null;
    const effectiveGst = branding?.gst_number || restaurant?.gst_number || null;

    // Route to local print queue which checks health, failover, etc.
    printQueueService.addJob({
      type,
      data: {
        restaurant_name: effectiveName,
        restaurant_logo_url: effectiveLogo,
        restaurant_address: effectiveAddress,
        restaurant_phone: effectivePhone,
        restaurant_email: effectiveEmail,
        gst_number: effectiveGst,
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
