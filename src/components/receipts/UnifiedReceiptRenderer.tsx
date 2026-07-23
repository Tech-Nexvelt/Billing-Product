import { memo } from 'react';
import { BillReceiptData, KotReceiptData } from '@/types/receipt.types';
import { PaperWidth } from '@/services/printing/PrinterProfile';
import { getThermalReceiptCss } from './styles/receiptTheme';

interface UnifiedReceiptProps {
  data: BillReceiptData;
  templateType?: 'customer' | 'restaurant' | 'merchant';
  paperSize?: PaperWidth;
}

export const UnifiedReceiptRenderer = memo(({ data, templateType = 'customer', paperSize = '80mm' }: UnifiedReceiptProps) => {
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
      <style>{getThermalReceiptCss(paperSize)}</style>
      <div className="thermal-receipt-container">
        {/* Receipt Header */}
        <div className="center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxHeight: '48px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto 3px auto', display: 'block' }}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : (
            <div style={{ display: 'inline-block', fontSize: '14px', fontWeight: 'bold', padding: '2px 6px', border: '1.5px solid #000', margin: '0 auto 3px auto' }}>
              {initials}
            </div>
          )}
          <div style={{ fontSize: '17px', fontWeight: 'bold', textTransform: 'uppercase' }}>{name}</div>
          {data.restaurant_address && <div style={{ fontSize: '10px' }}>{data.restaurant_address}</div>}
          {data.restaurant_phone && <div style={{ fontSize: '10px' }}>Ph: {data.restaurant_phone}</div>}
          {data.restaurant_email && <div style={{ fontSize: '10px' }}>Email: {data.restaurant_email}</div>}
          {data.gst_number && <div style={{ fontSize: '10px', fontWeight: 'bold' }}>GSTIN: {data.gst_number}</div>}
        </div>

        <div className="separator" />

        {/* Copy Tag */}
        <div className="center bold" style={{ fontSize: '12px', letterSpacing: '1px' }}>
          {templateType === 'restaurant' ? 'MERCHANT COPY' : 'CUSTOMER COPY'}
          {data.is_reprint ? ' - REPRINT' : ''}
        </div>

        <div className="separator" />

        {/* Receipt Metadata */}
        <div style={{ fontSize: '10.5px' }}>
          <div className="row"><span>Bill No: <strong>{data.bill_number}</strong></span><span>Table: <strong>{data.table_number || 'N/A'}</strong></span></div>
          <div className="row"><span>Date: {data.date}</span><span>Time: {data.time}</span></div>
          <div className="row"><span>Cashier: {data.cashier_name}</span><span>Floor: {data.floor_name || 'Main'}</span></div>
          {data.customer_name && <div className="row"><span>Customer: {data.customer_name}</span></div>}
        </div>

        <div className="separator" />

        {/* Items Table */}
        <div className="row bold" style={{ fontSize: '11px' }}>
          <span>ITEM DESCRIPTION</span>
          <span>AMOUNT</span>
        </div>

        <div className="separator" />

        <div className="items-list">
          {data.items.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '5px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 'bold', wordBreak: 'break-word' }}>{item.name}</div>
              <div className="row" style={{ fontSize: '10.5px' }}>
                <span>{item.quantity} × {sym}{item.unit_price.toFixed(2)}</span>
                <span className="bold">{sym}{item.item_total.toFixed(2)}</span>
              </div>
              {item.selected_variant_text && (
                <div style={{ fontSize: '9.5px', color: '#222', paddingLeft: '8px', whiteSpace: 'pre-line' }}>
                  • {item.selected_variant_text.split(' | ').join('\n• ')}
                </div>
              )}
              {item.special_notes && (
                <div style={{ fontSize: '9.5px', fontStyle: 'italic', color: '#333', paddingLeft: '8px' }}>
                  * Note: {item.special_notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="separator" />

        {/* Totals Section */}
        <div style={{ fontSize: '11px' }}>
          <div className="row"><span>Subtotal</span><span>{sym}{data.subtotal.toFixed(2)}</span></div>
          {data.discount_amount > 0 && (
            <div className="row bold"><span>Discount</span><span>-{sym}{data.discount_amount.toFixed(2)}</span></div>
          )}
          {data.cgst_amount > 0 && (
            <div className="row"><span>CGST (2.5%)</span><span>{sym}{data.cgst_amount.toFixed(2)}</span></div>
          )}
          {data.sgst_amount > 0 && (
            <div className="row"><span>SGST (2.5%)</span><span>{sym}{data.sgst_amount.toFixed(2)}</span></div>
          )}
          {data.igst_amount > 0 && (
            <div className="row"><span>IGST</span><span>{sym}{data.igst_amount.toFixed(2)}</span></div>
          )}
        </div>

        <div className="double" />

        {/* Grand Total */}
        <div className="row bold" style={{ fontSize: '15px' }}>
          <span>GRAND TOTAL</span>
          <span>{sym}{data.grand_total.toFixed(2)}</span>
        </div>

        <div className="double" />

        {/* Payments */}
        {data.payments.map((p, idx) => (
          <div key={idx} className="row bold" style={{ fontSize: '11px' }}>
            <span>Paid via {p.method}</span>
            <span>{sym}{p.amount.toFixed(2)}</span>
          </div>
        ))}

        <div className="separator" />

        {/* Footer */}
        <div className="center bold" style={{ marginTop: '4px', fontSize: '11px' }}>
          {data.footer_message || 'Thank You! Please Visit Again.'}
        </div>
        <div className="center" style={{ fontSize: '9px', color: '#444', marginTop: '2px' }}>
          NexVelt POS • Enterprise Billing Systems
        </div>
      </div>
    </div>
  );
});

export const UnifiedKotRenderer = memo(({ data, paperSize = '80mm' }: { data: KotReceiptData; paperSize?: PaperWidth }) => {
  return (
    <div className="thermal-receipt-wrapper">
      <style>{getThermalReceiptCss(paperSize)}</style>
      <div className="thermal-receipt-container">
        <div className="center bold" style={{ fontSize: '16px' }}>KITCHEN ORDER TICKET</div>
        {data.is_reprint && <div className="center bold" style={{ fontSize: '11px' }}>** DUPLICATE COPY **</div>}
        
        <div className="separator" />

        <div style={{ fontSize: '10.5px' }}>
          <div className="row"><span>Order Ref: <strong>{data.order_number}</strong></span><span>Token: <strong>#{data.token_number}</strong></span></div>
          <div className="row"><span>Table: <strong>{data.table_number || 'N/A'}</strong></span><span>Floor: <strong>{data.floor_name || 'Main'}</strong></span></div>
          <div className="row"><span>Date: {data.date}</span><span>Time: {data.time}</span></div>
          <div className="row"><span>Cashier: {data.cashier_name}</span></div>
        </div>

        <div className="separator" />

        <div className="row bold" style={{ fontSize: '11px' }}>
          <span>QTY</span>
          <span>ITEM SPECIFICATION</span>
        </div>

        <div className="separator" />

        <div className="kot-items">
          {data.items.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px dotted #ccc', paddingBottom: '3px' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: '18%', fontSize: '13px', fontWeight: 'bold' }}>{item.quantity} ×</span>
                <span style={{ width: '82%', fontSize: '13px', fontWeight: 'bold', wordBreak: 'break-word' }}>{item.name}</span>
              </div>
              {item.selected_variant_text && (
                <div style={{ fontSize: '10px', color: '#222', marginLeft: '18%' }}>
                  • {item.selected_variant_text.split(' | ').join('\n• ')}
                </div>
              )}
              {item.special_notes && (
                <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#333', marginLeft: '18%' }}>
                  * Note: {item.special_notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="separator" />

        {data.kitchen_notes && (
          <div>
            <div><strong>Notes:</strong> {data.kitchen_notes}</div>
            <div className="separator" />
          </div>
        )}

        <div className="center" style={{ fontSize: '9px', color: '#444' }}>-- Kitchen Station Record --</div>
      </div>
    </div>
  );
});
