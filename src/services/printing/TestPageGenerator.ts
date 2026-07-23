import { CharacterLayoutEngine } from './CharacterLayoutEngine';
import { PaperWidth } from './PrinterProfile';

export class TestPageGenerator {
  /**
   * Generates a diagnostic test page HTML string for 80mm or 58mm thermal printers.
   */
  static generateTestPageHtml(paperSize: PaperWidth = '80mm', printerName: string = 'Thermal Printer'): string {
    const width = paperSize === '58mm' ? '54mm' : '74mm';
    const cols = paperSize === '58mm' ? 32 : 42;
    const nowStr = new Date().toLocaleString();

    const titleLine = CharacterLayoutEngine.formatCenter('NEXVELT POS PRINTER TEST', cols);
    const rulerNumbers = cols === 32 
      ? '12345678901234567890123456789012'
      : '123456789012345678901234567890123456789012';
    const rulerScale = cols === 32
      ? '1--------10--------20--------32'
      : '1--------10--------20--------30--------42';

    const itemSample1 = CharacterLayoutEngine.formatLine('Margarita Pizza (10")', 'RS 380.00', cols);
    const itemSample2 = CharacterLayoutEngine.formatLine('Extra Cheese & Jalapeños', 'RS 80.00', cols);
    const totalSample = CharacterLayoutEngine.formatLine('GRAND TOTAL', 'RS 460.00', cols);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      @media print {
        @page { size: ${paperSize} auto; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; width: ${paperSize} !important; background: #fff !important; color: #000 !important; }
        header, footer { display: none !important; }
      }
      body {
        font-family: 'Courier New', Courier, monospace, sans-serif;
        font-size: 11px;
        width: ${width};
        margin: 0 auto;
        padding: 4px 2px;
        box-sizing: border-box;
        line-height: 1.3;
        color: #000;
        background: #fff;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .separator { border-top: 1px dashed #000; margin: 4px 0; }
      .double { border-top: 2px double #000; margin: 4px 0; }
      pre { margin: 0; font-family: inherit; font-size: 10.5px; white-space: pre-wrap; word-break: break-all; }
    </style></head><body>
      <div class="center bold" style="font-size: 15px;">====================================</div>
      <div class="center bold" style="font-size: 14px; margin: 2px 0;">${titleLine}</div>
      <div class="center bold" style="font-size: 15px;">====================================</div>
      <div class="separator"></div>
      <div>Printer: <strong>${printerName}</strong></div>
      <div>Media Width: <strong>${paperSize} (${cols} Columns)</strong></div>
      <div>Date/Time: <strong>${nowStr}</strong></div>
      <div class="separator"></div>
      <div class="bold">COLUMN ALIGNMENT RULER:</div>
      <pre>${rulerScale}</pre>
      <pre>${rulerNumbers}</pre>
      <div class="separator"></div>
      <div class="bold">ITEM LAYOUT ALIGNMENT SAMPLE:</div>
      <pre>${itemSample1}</pre>
      <pre>  • Size: 10 Inch (Medium)</pre>
      <pre>${itemSample2}</pre>
      <div class="separator"></div>
      <pre class="bold">${totalSample}</pre>
      <div class="double"></div>
      <div class="bold">THERMAL HEAD & DENSITY TEST:</div>
      <div style="background:#000; color:#fff; padding:3px; text-align:center; font-weight:bold; margin:3px 0;">
        HIGH CONTRAST BLACK BAR TEST
      </div>
      <div class="separator"></div>
      <div class="center bold" style="margin-top: 6px;">*** ALIGNMENT TEST OK ***</div>
      <div class="center" style="font-size: 9px; color: #444; margin-top: 2px;">NexVelt POS • Hardware Diagnostics Engine</div>
    </body></html>`;
  }
}
