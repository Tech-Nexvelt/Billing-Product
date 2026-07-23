import { PaperWidth } from '@/services/printing/PrinterProfile';

export const THERMAL_TYPOGRAPHY = {
  restaurantName: { fontSize: '17px', fontWeight: 'bold', textTransform: 'uppercase' as const },
  sectionHeader: { fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' as const },
  itemName: { fontSize: '11.5px', fontWeight: 'bold' },
  itemRate: { fontSize: '10.5px' },
  itemAmount: { fontSize: '11.5px', fontWeight: 'bold' },
  variant: { fontSize: '9.5px', color: '#222' },
  note: { fontSize: '9.5px', fontStyle: 'italic', color: '#333' },
  grandTotal: { fontSize: '15px', fontWeight: 'bold' },
  footer: { fontSize: '11px', fontWeight: 'bold' }
};

export function getThermalReceiptCss(paperSize: PaperWidth = '80mm'): string {
  const width = paperSize === '58mm' ? '54mm' : '74mm';

  return `
    @media print {
      @page {
        size: ${paperSize} auto;
        margin: 0mm !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${paperSize} !important;
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

    .thermal-receipt-container {
      width: ${width};
      max-width: ${width};
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
    .double { border-top: 2.5px double #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; align-items: center; margin: 1.5px 0; }
  `;
}
