import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { Printer, PrinterJob, PrintJobType, PaperSize, PrinterStatus } from '@/types/printer.types';
import { KotReceiptData, BillReceiptData } from '@/types/receipt.types';

export interface IPrinterProvider {
  print(data: any, options: { paperSize?: PaperSize; template?: string; orderId?: string; userId?: string }): Promise<void>;
  checkStatus(): Promise<PrinterStatus>;
}

export class BrowserPrinterProvider implements IPrinterProvider {
  constructor(private service: PrinterService) {}
  async print(data: any, options: { paperSize?: PaperSize; template?: string }): Promise<void> {
    const html = options.template === 'kot'
      ? this.service.buildKotHtml(data as any, options.paperSize || '80mm')
      : this.service.buildBillHtml(data as any, options.paperSize || '80mm', options.template || 'customer');
    this.service.triggerBrowserPrint(html);
  }
  async checkStatus(): Promise<PrinterStatus> {
    return 'online';
  }
}

export class NetworkPrinterProvider implements IPrinterProvider {
  constructor(private service: PrinterService, private printerId: string, private restaurantId: string) {}
  async print(data: any, options: { orderId?: string; userId?: string; template?: string }): Promise<void> {
    const jobType = options.template === 'kot'
      ? 'kot'
      : options.template === 'restaurant'
        ? 'restaurant_receipt'
        : 'customer_receipt';

    const res = await this.service.createPrinterJob(
      this.printerId,
      this.restaurantId,
      jobType,
      data,
      options.orderId,
      options.userId
    );
    if (!res.success) throw new Error(res.message);
  }
  async checkStatus(): Promise<PrinterStatus> {
    try {
      const { data, error } = await supabase
        .from('printers')
        .select('printer_status')
        .eq('id', this.printerId)
        .single();
      if (error || !data) return 'offline';
      return (data.printer_status as PrinterStatus) || 'online';
    } catch (_) {
      return 'unknown';
    }
  }
}

export interface PersistentPrintJob {
  id: string;
  type: 'kot' | 'customer' | 'owner';
  data: any;
  options: any;
  retryCount: number;
  createdTime: number;
  lastRetry?: number;
  error?: string;
  status: 'pending' | 'retrying' | 'printed' | 'failed' | 'archived';
  printerId?: string;
}

export class PrintQueueService {
  private queueKey = 'nexvelt_pos_print_queue';
  private processing = false;

  constructor() {
    // Periodically run print queue retry logic every 15 seconds
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.processQueue();
      }, 15000);
    }
  }

  getQueue(): PersistentPrintJob[] {
    try {
      const stored = localStorage.getItem(this.queueKey);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  }

  saveQueue(queue: PersistentPrintJob[]) {
    try {
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    } catch (_) {}
  }

  addJob(job: { type: 'kot' | 'customer' | 'owner'; data: any; options: any; printerId?: string }) {
    const queue = this.getQueue();
    const newJob: PersistentPrintJob = {
      ...job,
      id: crypto.randomUUID(),
      status: 'pending',
      retryCount: 0,
      createdTime: Date.now(),
    };
    queue.push(newJob);
    this.saveQueue(queue);
    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const queue = this.getQueue();
      const activeJobs = queue.filter(j => j.status === 'pending' || j.status === 'retrying');
      if (activeJobs.length === 0) return;

      for (const job of activeJobs) {
        job.lastRetry = Date.now();
        try {
          await printerService.executePrintJobDirect(job.type, job.data, job.options, job.printerId);
          job.status = 'printed';
        } catch (err: any) {
          job.retryCount++;
          job.error = err.message || 'Print error';
          if (job.retryCount >= 5) {
            job.status = 'failed';
            try {
              // Trigger backup failover
              await printerService.triggerFailover(job.type, job.data, job.options, job.printerId);
              job.status = 'printed';
            } catch (failoverErr: any) {
              console.error('Print failover execution failed:', failoverErr);
            }
          } else {
            job.status = 'retrying';
          }
        }
      }
      this.saveQueue(queue);
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      this.processing = false;
    }
  }
}

export const printQueueService = new PrintQueueService();

export class PrinterService extends BaseService {
  async getAll(restaurantId: string): Promise<ApiResponse<Printer[]>> {
    return this.handleCall(
      supabase
        .from('printers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('name')
    );
  }

  async create(
    restaurantId: string,
    data: Omit<Printer, 'id' | 'restaurant_id' | 'version' | 'deleted_at' | 'deleted_by' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<Printer>> {
    return this.handleCall(
      supabase.from('printers').insert({ ...data, restaurant_id: restaurantId }).select().single()
    );
  }

  async update(id: string, data: Partial<Printer>, currentVersion: number): Promise<ApiResponse<Printer>> {
    return this.handleCall(
      supabase
        .from('printers')
        .update({ ...data, version: currentVersion + 1 })
        .eq('id', id)
        .eq('version', currentVersion)
        .select()
        .single()
    );
  }

  async delete(id: string, userId: string): Promise<ApiResponse<null>> {
    const { error } = await supabase
      .from('printers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id);
    if (error) return this.createClientError(error.message);
    return { success: true, message: 'Printer deleted', data: null, error: null };
  }

  async getPrinterJobs(restaurantId: string, status?: string): Promise<ApiResponse<PrinterJob[]>> {
    let query = supabase
      .from('printer_jobs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) query = query.eq('status', status);

    return this.handleCall(query);
  }

  async createPrinterJob(
    printerId: string,
    restaurantId: string,
    jobType: PrintJobType,
    payload: Record<string, unknown>,
    orderId?: string,
    userId?: string
  ): Promise<ApiResponse<PrinterJob>> {
    return this.handleCall(
      supabase
        .from('printer_jobs')
        .insert({
          printer_id: printerId,
          restaurant_id: restaurantId,
          order_id: orderId ?? null,
          job_type: jobType,
          payload,
          created_by: userId ?? null,
        })
        .select()
        .single()
    );
  }

  async retryJob(jobId: string): Promise<ApiResponse<PrinterJob>> {
    const { data: job, error } = await supabase
      .from('printer_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) return this.createClientError('Job not found', 'NOT_FOUND');

    return this.handleCall(
      supabase
        .from('printer_jobs')
        .update({ status: 'pending', retry_count: job.retry_count + 1, error: null })
        .eq('id', jobId)
        .select()
        .single()
    );
  }

  // Get active provider based on printer type
  getProvider(printer: Printer): IPrinterProvider {
    if (printer.connection_type === 'browser') {
      return new BrowserPrinterProvider(this);
    }
    return new NetworkPrinterProvider(this, printer.id, printer.restaurant_id);
  }

  // Trigger print directly
  async executePrintJobDirect(type: 'kot' | 'customer' | 'owner', data: any, options: any, printerId?: string) {
    if (printerId) {
      const { data: printer } = await supabase
        .from('printers')
        .select('*')
        .eq('id', printerId)
        .single();

      if (printer) {
        const provider = this.getProvider(printer);
        const status = await provider.checkStatus();
        if (status === 'offline' || status === 'error') {
          throw new Error(`Printer ${printer.name} is ${status}.`);
        }
        await provider.print(data, {
          paperSize: printer.paper_size,
          template: type === 'kot' ? 'kot' : type === 'owner' ? 'restaurant' : 'customer',
          orderId: options.orderId,
          userId: options.userId,
        });
        return;
      }
    }

    // Default Browser Fallback
    const browserProvider = new BrowserPrinterProvider(this);
    await browserProvider.print(data, {
      paperSize: '80mm',
      template: type === 'kot' ? 'kot' : type === 'owner' ? 'restaurant' : 'customer',
    });
  }

  // Failover to backup printer
  async triggerFailover(type: 'kot' | 'customer' | 'owner', data: any, options: any, originalPrinterId?: string) {
    console.warn(`Printing failed on printer ${originalPrinterId}. Activating failover...`);

    // Fetch backup printers
    const { data: printers } = await supabase
      .from('printers')
      .select('*')
      .is('deleted_at', null);

    const backups = (printers || []).filter(p => p.id !== originalPrinterId && p.printer_status === 'online');

    if (backups.length > 0) {
      const backupPrinter = backups[0];
      console.log(`Switched to backup printer: ${backupPrinter.name}`);

      // Log printer failover event in activity log
      await supabase.from('activity_logs').insert({
        restaurant_id: backupPrinter.restaurant_id,
        action: 'printer_switched',
        entity_type: 'printer',
        entity_id: backupPrinter.id,
        metadata: {
          original_printer_id: originalPrinterId,
          backup_printer_name: backupPrinter.name,
          timestamp: new Date().toISOString()
        }
      });

      const provider = this.getProvider(backupPrinter);
      await provider.print(data, {
        paperSize: backupPrinter.paper_size,
        template: type === 'kot' ? 'kot' : type === 'owner' ? 'restaurant' : 'customer',
        orderId: options.orderId,
        userId: options.userId,
      });
    } else {
      // Direct browser default fallback
      const browserProvider = new BrowserPrinterProvider(this);
      await browserProvider.print(data, {
        paperSize: '80mm',
        template: type === 'kot' ? 'kot' : type === 'owner' ? 'restaurant' : 'customer',
      });
    }
  }

  // Browser print using iframe strategy
  printKot(data: KotReceiptData, paperSize: '58mm' | '80mm' = '80mm'): void {
    const html = this.buildKotHtml(data, paperSize);
    this.triggerBrowserPrint(html);
  }

  printBill(data: BillReceiptData, paperSize: '58mm' | '80mm' = '80mm', template: 'customer' | 'restaurant' = 'customer'): void {
    const html = this.buildBillHtml(data, paperSize, template);
    this.triggerBrowserPrint(html);
  }

  triggerBrowserPrint(html: string): void {
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

  buildKotHtml(data: KotReceiptData, paperSize: '58mm' | '80mm'): string {
    const width = paperSize === '58mm' ? '52mm' : '72mm';
    return `<!DOCTYPE html><html><head><style>
      @media print { @page { margin: 2mm; size: ${paperSize}; } }
      body { font-family: monospace; font-size: 10px; width: ${width}; margin: 0; padding: 4px; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .separator { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
      h2 { margin: 0; font-size: 13px; }
    </style></head><body>
      <div class="center bold"><h2>KITCHEN ORDER</h2></div>
      ${data.is_reprint ? '<div class="center bold">** DUPLICATE COPY **</div>' : ''}
      <div class="separator"></div>
      <div class="row"><span>Order#: ${data.order_number}</span><span>Token: ${data.token_number}</span></div>
      <div class="row"><span>Table: ${data.table_number}</span><span>Floor: ${data.floor_name}</span></div>
      <div class="row"><span>Date: ${data.date}</span><span>Time: ${data.time}</span></div>
      <div class="row"><span>Cashier: ${data.cashier_name}</span></div>
      <div class="separator"></div>
      ${data.items.map(i => `
        <div class="bold">${i.quantity}x ${i.name}</div>
        ${i.special_notes ? `<div style="font-style:italic;margin-left:8px;"> * ${i.special_notes}</div>` : ''}
      `).join('')}
      <div class="separator"></div>
      ${data.kitchen_notes ? `<div>Notes: ${data.kitchen_notes}</div>` : ''}
      <div class="center" style="margin-top:8px;">-- KOT END --</div>
    </body></html>`;
  }

  buildBillHtml(data: BillReceiptData, paperSize: '58mm' | '80mm', template: string): string {
    const width = paperSize === '58mm' ? '52mm' : '72mm';
    const sym = data.currency_symbol;
    const logoUrl = data.restaurant_logo_url;
    const name = data.restaurant_name || 'NexVelt POS';
    const initials = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'POS';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="Logo" style="max-height: 44px; max-width: 100%; object-fit: contain; margin: 0 auto 4px auto; display: block;" onError="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" /><div style="display:none; font-size:12px; font-weight:bold; padding:2px 6px; border:1px solid #000; margin:0 auto 4px auto;">${initials}</div>`
      : `<div style="display:inline-block; font-size:12px; font-weight:bold; padding:2px 6px; border:1px solid #000; margin:0 auto 4px auto;">${initials}</div>`;

    return `<!DOCTYPE html><html><head><style>
      @media print { @page { margin: 2mm; size: ${paperSize}; } }
      body { font-family: monospace; font-size: 10px; width: ${width}; margin: 0; padding: 4px; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .separator { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
      h2 { margin: 0; font-size: 13px; }
      .double { border-top: 2px double #000; margin: 4px 0; }
    </style></head><body>
      <div class="center">
        ${logoHtml}
        <h2 class="bold" style="margin-top: 2px;">${name}</h2>
        ${data.restaurant_address ? `<div>${data.restaurant_address}</div>` : ''}
        ${data.restaurant_phone ? `<div>Ph: ${data.restaurant_phone}</div>` : ''}
        ${data.restaurant_email ? `<div>Email: ${data.restaurant_email}</div>` : ''}
        ${data.gst_number ? `<div>GSTIN: ${data.gst_number}</div>` : ''}
      </div>
      <div class="separator"></div>
      ${template === 'restaurant' ? '<div class="center bold">RESTAURANT COPY</div>' : '<div class="center bold">CUSTOMER COPY</div>'}
      <div class="separator"></div>
      <div class="row"><span>Bill#: ${data.bill_number}</span><span>Date: ${data.date}</span></div>
      <div class="row"><span>Table: ${data.table_number}/${data.floor_name}</span><span>Time: ${data.time}</span></div>
      <div class="row"><span>Cashier: ${data.cashier_name}</span></div>
      ${data.customer_name ? `<div class="row"><span>Customer: ${data.customer_name}</span></div>` : ''}
      <div class="separator"></div>
      <div class="row bold"><span>Item</span><span>Qty</span><span>Price</span><span>Total</span></div>
      <div class="separator"></div>
      ${data.items.map(i => `<div class="row"><span>${i.name}</span><span>${i.quantity}</span><span>${sym}${i.unit_price.toFixed(2)}</span><span>${sym}${i.item_total.toFixed(2)}</span></div>`).join('')}
      <div class="separator"></div>
      <div class="row"><span>Subtotal</span><span>${sym}${data.subtotal.toFixed(2)}</span></div>
      ${data.discount_amount > 0 ? `<div class="row"><span>Discount</span><span>-${sym}${data.discount_amount.toFixed(2)}</span></div>` : ''}
      ${data.cgst_amount > 0 ? `<div class="row"><span>CGST</span><span>${sym}${data.cgst_amount.toFixed(2)}</span></div>` : ''}
      ${data.sgst_amount > 0 ? `<div class="row"><span>SGST</span><span>${sym}${data.sgst_amount.toFixed(2)}</span></div>` : ''}
      ${data.igst_amount > 0 ? `<div class="row"><span>IGST</span><span>${sym}${data.igst_amount.toFixed(2)}</span></div>` : ''}
      <div class="double"></div>
      <div class="row bold"><span>GRAND TOTAL</span><span>${sym}${data.grand_total.toFixed(2)}</span></div>
      <div class="separator"></div>
      ${data.payments.map(p => `<div class="row"><span>${p.method}</span><span>${sym}${p.amount.toFixed(2)}</span></div>`).join('')}
      <div class="separator"></div>
      ${template === 'restaurant' && data.internal_notes ? `<div><strong>Internal Notes:</strong> ${data.internal_notes}</div><div class="separator"></div>` : ''}
      <div class="center">${data.footer_message}</div>
    </body></html>`;
  }
}

export const printerService = new PrinterService();
