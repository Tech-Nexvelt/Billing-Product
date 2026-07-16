import { CartItem } from '@/types/order.types';

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
}

export function printReceipts(
  data: ReceiptData,
  options: { kot?: boolean; bill?: boolean } = { kot: true, bill: true },
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
      <div class="center italic">Internal Audit Copy</div>
    </div>
  `;

  const htmlParts = [];
  if (options.kot ?? true) {
    htmlParts.push(kotHtml);
  }
  if (options.bill ?? true) {
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
