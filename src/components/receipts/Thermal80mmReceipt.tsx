import { memo } from 'react';
import { BillReceiptData, KotReceiptData } from '@/types/receipt.types';

interface CustomerReceiptProps {
  data: BillReceiptData;
  templateType?: 'customer' | 'restaurant' | 'merchant';
}

export const Thermal80mmReceipt = memo(({ data, templateType = 'customer' }: CustomerReceiptProps) => {
  const sym = data.currency_symbol || '₹';
  const logoUrl = data.restaurant_logo_url;
  const name = data.restaurant_name || 'NexVelt POS';
  const initials = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'POS';

  return (
    <div className="thermal-receipt-wrapper">
      <style>{thermalReceiptCss}</style>
      <div className="thermal-receipt">
        {/* Header Section */}
        <div className="center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="logo-img"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="initials-badge">{initials}</div>
          )}
          <div className="restaurant-title">{name}</div>
          {data.restaurant_address && <div className="contact-text">{data.restaurant_address}</div>}
          {data.restaurant_phone && <div className="contact-text">Ph: {data.restaurant_phone}</div>}
          {data.restaurant_email && <div className="contact-text">Email: {data.restaurant_email}</div>}
          {data.gst_number && <div className="contact-text bold">GSTIN: {data.gst_number}</div>}
        </div>

        <div className="divider-dashed" />

        {/* Copy Tag */}
        <div className="center bold copy-tag">
          {templateType === 'restaurant' ? 'MERCHANT COPY' : 'CUSTOMER COPY'}
          {data.is_reprint ? ' - REPRINT' : ''}
        </div>

        <div className="divider-dashed" />

        {/* Invoice Info */}
        <div className="info-grid">
          <div className="flex-row"><span>Bill No: <strong>{data.bill_number}</strong></span><span>Table: <strong>{data.table_number || 'N/A'}</strong></span></div>
          <div className="flex-row"><span>Date: {data.date}</span><span>Time: {data.time}</span></div>
          <div className="flex-row"><span>Cashier: {data.cashier_name}</span><span>Floor: {data.floor_name || 'Main'}</span></div>
          {data.customer_name && <div className="flex-row"><span>Customer: {data.customer_name}</span></div>}
        </div>

        <div className="divider-dashed" />

        {/* Item Headers */}
        <div className="flex-row bold item-header-row">
          <span className="col-item">ITEM DESCRIPTION</span>
          <span className="col-amount text-right">AMOUNT</span>
        </div>

        <div className="divider-dashed" />

        {/* Items List */}
        <div className="items-container">
          {data.items.map((item, idx) => (
            <div key={idx} className="item-entry">
              <div className="item-name bold">{item.name}</div>
              <div className="flex-row item-rate-row">
                <span className="rate-text">{item.quantity} × {sym}{item.unit_price.toFixed(2)}</span>
                <span className="bold amount-text">{sym}{item.item_total.toFixed(2)}</span>
              </div>
              {item.selected_variant_text && (
                <div className="variant-detail">
                  • {item.selected_variant_text.split(' | ').join('\n• ')}
                </div>
              )}
              {item.special_notes && (
                <div className="note-detail">
                  * Note: {item.special_notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="divider-dashed" />

        {/* Totals Breakdown */}
        <div className="totals-container">
          <div className="flex-row"><span>Subtotal</span><span>{sym}{data.subtotal.toFixed(2)}</span></div>
          {data.discount_amount > 0 && (
            <div className="flex-row text-discount"><span>Discount</span><span>-{sym}{data.discount_amount.toFixed(2)}</span></div>
          )}
          {data.cgst_amount > 0 && (
            <div className="flex-row"><span>CGST (2.5%)</span><span>{sym}{data.cgst_amount.toFixed(2)}</span></div>
          )}
          {data.sgst_amount > 0 && (
            <div className="flex-row"><span>SGST (2.5%)</span><span>{sym}{data.sgst_amount.toFixed(2)}</span></div>
          )}
          {data.igst_amount > 0 && (
            <div className="flex-row"><span>IGST</span><span>{sym}{data.igst_amount.toFixed(2)}</span></div>
          )}
        </div>

        <div className="divider-double" />

        {/* Grand Total */}
        <div className="flex-row grand-total-row">
          <span>GRAND TOTAL</span>
          <span>{sym}{data.grand_total.toFixed(2)}</span>
        </div>

        <div className="divider-double" />

        {/* Payment Summary */}
        <div className="payment-container">
          {data.payments.map((p, idx) => (
            <div key={idx} className="flex-row bold">
              <span>Paid via {p.method}</span>
              <span>{sym}{p.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="divider-dashed" />

        {/* Footer */}
        <div className="center footer-container">
          <div className="bold">{data.footer_message || 'Thank You! Please Visit Again.'}</div>
          <div className="sub-footer">NexVelt POS • Enterprise Billing Systems</div>
        </div>
      </div>
    </div>
  );
});

export const Thermal80mmKotReceipt = memo(({ data }: { data: KotReceiptData }) => {
  return (
    <div className="thermal-receipt-wrapper">
      <style>{thermalReceiptCss}</style>
      <div className="thermal-receipt">
        <div className="center bold kot-title">KITCHEN ORDER TICKET</div>
        {data.is_reprint && <div className="center bold text-reprint">** DUPLICATE / REPRINT **</div>}
        
        <div className="divider-dashed" />

        <div className="info-grid">
          <div className="flex-row"><span>Order Ref: <strong>{data.order_number}</strong></span><span>Token: <strong>#{data.token_number}</strong></span></div>
          <div className="flex-row"><span>Table: <strong>{data.table_number || 'N/A'}</strong></span><span>Floor: <strong>{data.floor_name || 'Main'}</strong></span></div>
          <div className="flex-row"><span>Date: {data.date}</span><span>Time: {data.time}</span></div>
          <div className="flex-row"><span>Cashier: {data.cashier_name}</span></div>
        </div>

        <div className="divider-dashed" />

        <div className="flex-row bold item-header-row">
          <span style={{ width: '20%' }}>QTY</span>
          <span style={{ width: '80%' }}>ITEM SPECIFICATION</span>
        </div>

        <div className="divider-dashed" />

        <div className="items-container">
          {data.items.map((item, idx) => (
            <div key={idx} className="kot-item-entry">
              <div className="flex-row" style={{ alignItems: 'flex-start' }}>
                <span className="kot-qty">{item.quantity} ×</span>
                <span className="kot-name bold">{item.name}</span>
              </div>
              {item.selected_variant_text && (
                <div className="variant-detail" style={{ marginLeft: '18%' }}>
                  • {item.selected_variant_text.split(' | ').join('\n• ')}
                </div>
              )}
              {item.special_notes && (
                <div className="note-detail" style={{ marginLeft: '18%' }}>
                  * Note: {item.special_notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="divider-dashed" />

        {data.kitchen_notes && (
          <div className="kot-kitchen-notes">
            <strong>Kitchen Note:</strong> {data.kitchen_notes}
            <div className="divider-dashed" />
          </div>
        )}

        <div className="center italic sub-footer">-- Kitchen Station Record --</div>
      </div>
    </div>
  );
});

export const thermalReceiptCss = `
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
    /* Hide browser headers/footers (date, URL, page numbers) */
    header, footer {
      display: none !important;
    }
  }

  .thermal-receipt-wrapper {
    background: #ffffff;
    color: #000000;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.3;
  }

  .thermal-receipt {
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
  .text-right { text-align: right; }
  .bold { font-weight: bold; }
  .italic { font-style: italic; }

  .logo-img {
    max-height: 48px;
    max-width: 100%;
    object-fit: contain;
    margin: 0 auto 3px auto;
    display: block;
  }

  .initials-badge {
    display: inline-block;
    font-size: 14px;
    font-weight: bold;
    padding: 2px 6px;
    border: 1.5px solid #000;
    margin: 0 auto 3px auto;
  }

  .restaurant-title {
    font-size: 17px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .contact-text {
    font-size: 10px;
    color: #111;
  }

  .copy-tag {
    font-size: 12px;
    letter-spacing: 1px;
    padding: 1px 0;
  }

  .kot-title {
    font-size: 16px;
    letter-spacing: 0.5px;
  }

  .info-grid {
    font-size: 10.5px;
  }

  .flex-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1.5px 0;
  }

  .divider-dashed {
    border-top: 1px dashed #000;
    margin: 4px 0;
  }

  .divider-double {
    border-top: 2.5px double #000;
    margin: 4px 0;
  }

  .item-header-row {
    font-size: 11px;
  }

  .col-item { width: 65%; }
  .col-amount { width: 35%; }

  .items-container {
    margin: 2px 0;
  }

  .item-entry {
    margin-bottom: 5px;
  }

  .item-name {
    font-size: 11.5px;
    word-break: break-word;
  }

  .item-rate-row {
    font-size: 10.5px;
    padding-left: 2px;
  }

  .variant-detail {
    font-size: 9.5px;
    color: #222;
    padding-left: 8px;
    white-space: pre-line;
  }

  .note-detail {
    font-size: 9.5px;
    font-style: italic;
    color: #333;
    padding-left: 8px;
  }

  .kot-item-entry {
    margin-bottom: 6px;
    border-bottom: 1px dotted #ccc;
    padding-bottom: 3px;
  }

  .kot-qty {
    width: 18%;
    font-size: 13px;
    font-weight: bold;
  }

  .kot-name {
    width: 82%;
    font-size: 13px;
    word-break: break-word;
  }

  .totals-container {
    font-size: 11px;
  }

  .grand-total-row {
    font-size: 15px;
    font-weight: bold;
    padding: 2px 0;
  }

  .payment-container {
    font-size: 11px;
  }

  .footer-container {
    margin-top: 6px;
    font-size: 11px;
  }

  .sub-footer {
    font-size: 9px;
    color: #444;
    margin-top: 2px;
  }

  .text-discount {
    font-weight: bold;
  }

  .text-reprint {
    font-size: 11px;
    margin-top: 2px;
  }
`;
