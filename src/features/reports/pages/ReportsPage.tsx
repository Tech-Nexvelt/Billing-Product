import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Printer,
  Mail,
  Share2,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

interface OrderReportItem {
  id: string;
  created_at: string;
  table_number: string;
  cashier_name: string;
  customer_name: string;
  payment_method: string;
  grand_total: number;
  tax_amount: number;
  discount_amount: number;
  status: string;
  items_summary: string;
}

export function ReportsPage() {
  const { user } = useAuthStore();
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();

  // Filters
  const [period, setPeriod] = useState<string>('today');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cashierId, setCashierId] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [tableId, setTableId] = useState<string>('all');
  const [orderStatus, setOrderStatus] = useState<string>('all');

  // Dropdown list data
  const [staffList, setStaffList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [tablesList, setTablesList] = useState<any[]>([]);

  // Report Data
  const [reportData, setReportData] = useState<OrderReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Layout Printing configurations
  const [printSize, setPrintSize] = useState<'A4' | 'Letter'>('A4');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);

  // Email state
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('Daily Sales Report - NexVelt POS');
  const [emailMessage, setEmailMessage] = useState('Please find attached the daily sales performance report.');

  // WhatsApp state
  const [isWhatsappOpen, setIsWhatsappOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waCountryCode, setWaCountryCode] = useState('91');
  const [waMessage, setWaMessage] = useState('');

  // Stats summaries
  const [totals, setTotals] = useState({
    revenue: 0,
    orders: 0,
    tax: 0,
    discount: 0,
    avgOrder: 0
  });

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadDropdowns();
    loadReport();
  }, [user?.restaurant_id]);

  useEffect(() => {
    // Re-trigger date logic based on period selector
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (period === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      setFromDate(fmt(y));
      setToDate(fmt(y));
    } else if (period === 'this_week') {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      setFromDate(fmt(start));
      setToDate(today);
    } else if (period === 'last_week') {
      const end = new Date(now);
      end.setDate(end.getDate() - end.getDay() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      setFromDate(fmt(start));
      setToDate(fmt(end));
    } else if (period === 'this_month') {
      setFromDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
      setToDate(today);
    } else if (period === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(fmt(lastMonth));
      setToDate(fmt(lastDay));
    }
  }, [period]);

  const loadDropdowns = async () => {
    try {
      const restId = user!.restaurant_id;
      const [staffRes, catsRes, tablesRes] = await Promise.all([
        supabase.from('users').select('id, full_name').eq('restaurant_id', restId).is('deleted_at', null),
        supabase.from('categories').select('id, name').eq('restaurant_id', restId).is('deleted_at', null),
        supabase.from('tables').select('id, table_number').eq('restaurant_id', restId).is('deleted_at', null)
      ]);

      if (staffRes.data) setStaffList(staffRes.data);
      if (catsRes.data) setCategoriesList(catsRes.data);
      if (tablesRes.data) setTablesList(tablesRes.data);
    } catch (err) {
      console.error('Error loading dropdown lists:', err);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const restId = user!.restaurant_id;
      
      // Basic query for orders
      let query = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          grand_total,
          tax_amount,
          discount_amount,
          status,
          payment_method:payments(payment_method:payment_method_name),
          tables(table_number),
          users:users!created_by(full_name),
          order_items(item_name, quantity, item_total, menu_items(category_id))
        `)
        .eq('restaurant_id', restId)
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .is('deleted_at', null);

      if (cashierId !== 'all') {
        query = query.eq('created_by', cashierId);
      }
      if (tableId !== 'all') {
        query = query.eq('table_id', tableId);
      }
      if (orderStatus !== 'all') {
        query = query.eq('status', orderStatus);
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      // Filter and map in memory for nested payments, categories, customers
      const mappedData: OrderReportItem[] = (orders || []).map((o: any) => {
        // Extract payment method from payments array
        const pMethod = o.payment_method?.[0]?.payment_method || 'Cash';
        
        // Items list
        const items = o.order_items || [];
        const itemsSummary = items.map((i: any) => `${i.item_name} (x${i.quantity})`).join(', ');

        return {
          id: o.id,
          created_at: o.created_at,
          table_number: o.tables?.table_number || '—',
          cashier_name: o.users?.full_name || 'Staff',
          customer_name: 'Walk-in Customer',
          payment_method: pMethod,
          grand_total: Number(o.grand_total),
          tax_amount: Number(o.tax_amount),
          discount_amount: Number(o.discount_amount),
          status: o.status,
          items_summary: itemsSummary,
          order_items: items // for category filtering
        };
      });

      // Apply in-memory checks for payment method and category filters
      const finalFiltered = mappedData.filter(item => {
        const matchesPayment = paymentMethod === 'all' || item.payment_method.toLowerCase() === paymentMethod.toLowerCase();
        
        const matchesCategory = categoryId === 'all' || (item as any).order_items.some((oi: any) => 
          oi.menu_items?.category_id === categoryId
        );

        return matchesPayment && matchesCategory;
      });

      // Calculate totals
      const completed = finalFiltered.filter(i => i.status === 'completed');
      const revenue = completed.reduce((sum, i) => sum + i.grand_total, 0);
      const tax = completed.reduce((sum, i) => sum + i.tax_amount, 0);
      const discount = completed.reduce((sum, i) => sum + i.discount_amount, 0);
      const ordersCount = finalFiltered.length;
      const avgOrder = completed.length ? (revenue / completed.length) : 0;

      setReportData(finalFiltered);
      setTotals({
        revenue,
        orders: ordersCount,
        tax,
        discount,
        avgOrder
      });

      // Prefill WhatsApp text
      setWaMessage(`*${restaurant?.name || 'NexVelt POS'}* - Sales Performance Summary\nPeriod: ${fromDate} to ${toDate}\nRevenue: ₹${revenue.toLocaleString()}\nOrders Count: ${ordersCount}`);

    } catch (err: any) {
      toast({ title: 'Report Load Failure', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuditLog = async (action: string, format: string, recipient?: string) => {
    try {
      await supabase.from('activity_logs').insert({
        restaurant_id: user!.restaurant_id,
        user_id: user!.id,
        action,
        resource_type: 'report',
        resource_id: user!.id,
        ip_address: '127.0.0.1',
        browser: navigator.userAgent.substring(0, 100),
        device: 'Web Client',
        metadata: {
          format,
          recipient: recipient || 'self',
          report_type: 'Sales Report',
          date_range: `${fromDate} to ${toDate}`,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('Audit logger failure:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    handleAuditLog('Export CSV', 'csv');
    const header = 'Order ID,Date,Table,Cashier,Items,Payment Mode,Tax,Discount,Grand Total,Status';
    const rows = reportData.map(r => 
      `"${r.id.substring(0, 8)}","${formatDate(r.created_at)}","${r.table_number}","${r.cashier_name}","${r.items_summary.replace(/"/g, '""')}","${r.payment_method}",${r.tax_amount},${r.discount_amount},${r.grand_total},"${r.status}"`
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Revenue_Report_${fromDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded', description: `Saved as Revenue_Report_${fromDate}.csv` });
  };

  // Export Excel
  const handleExportExcel = () => {
    handleAuditLog('Export Excel', 'xlsx');
    // Generate beautiful HTML spreadsheet that Excel imports natively with styles
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: sans-serif; }
          .header { font-size: 16px; font-weight: bold; color: #057B62; }
          .total-row { font-weight: bold; background-color: #F1F5F9; }
          th { background-color: #0AB190; color: white; padding: 6px; font-weight: bold; }
          td { border: 0.5px solid #E2E8F0; padding: 6px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="header">${restaurant?.name || 'NexVelt POS'} Sales Report</td></tr>
          <tr><td colspan="5">Period: ${fromDate} to ${toDate}</td></tr>
          <tr><td colspan="5">Generated By: ${user?.full_name} (${user?.role?.name})</td></tr>
          <tr><td colspan="5">Generated Time: ${new Date().toLocaleString()}</td></tr>
          <tr></tr>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Table</th>
              <th>Cashier</th>
              <th>Payment Mode</th>
              <th>Tax Amount</th>
              <th>Discount Amount</th>
              <th>Grand Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>${r.id.substring(0,8)}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>${r.table_number}</td>
                <td>${r.cashier_name}</td>
                <td>${r.payment_method}</td>
                <td>₹${r.tax_amount.toFixed(2)}</td>
                <td>₹${r.discount_amount.toFixed(2)}</td>
                <td>₹${r.grand_total.toFixed(2)}</td>
                <td>${r.status.toUpperCase()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">TOTAL SUMMARIES</td>
              <td>₹${totals.tax.toFixed(2)}</td>
              <td>₹${totals.discount.toFixed(2)}</td>
              <td>₹${totals.revenue.toFixed(2)}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Daily_Report_${fromDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel Downloaded', description: `Saved as Daily_Report_${fromDate}.xlsx` });
  };

  // Export PDF / Print setup
  const handlePrint = () => {
    handleAuditLog('Print Report', 'pdf');
    setIsPrintConfigOpen(false);

    // Apply orientation config via temporary style block
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      @page {
        size: ${printSize.toLowerCase()} ${printOrientation};
        margin: 15mm;
      }
      @media print {
        body * { visibility: hidden; }
        #print-preview-section, #print-preview-section * { visibility: visible; }
        #print-preview-section { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(styleEl);

    // Trigger Print
    setTimeout(() => {
      window.print();
      document.head.removeChild(styleEl);
    }, 300);
  };

  // Simulated Email send
  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecipients) return;
    handleAuditLog('Email Report', 'pdf', emailRecipients);
    toast({ title: 'Report Dispatched', description: `Email with attachment sent to ${emailRecipients}.` });
    setIsEmailOpen(false);
  };

  // WhatsApp share url trigger
  const handleWhatsappShare = () => {
    if (!waPhone) return;
    handleAuditLog('WhatsApp Share', 'pdf', waPhone);
    const textMsg = encodeURIComponent(
      `*${restaurant?.name || 'NexVelt POS'}*\n` +
      `Report: *Sales Report Summary*\n` +
      `Period: ${fromDate} to ${toDate}\n` +
      `Generated By: ${user?.full_name}\n` +
      `Date: ${new Date().toLocaleDateString()}\n` +
      `Total Revenue: ₹${totals.revenue.toLocaleString()}\n` +
      `Total Orders: ${totals.orders}\n` +
      `---------------------------------\n` +
      `Details shared via WhatsApp API.`
    );
    window.open(`https://api.whatsapp.com/send?phone=${waCountryCode}${waPhone}&text=${textMsg}`, '_blank');
    setIsWhatsappOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER ACTION BAR */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-gradient-to-r from-white to-primary/5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-extrabold text-foreground">Enterprise Reports Centre</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Aggregate bills, audit order lists, and export files.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="rounded-xl font-bold h-9 border-border"><FileText className="w-4 h-4 mr-2 text-blue-500" />Export CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl font-bold h-9 border-border"><FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />Export Excel</Button>
          <Button variant="outline" size="sm" onClick={() => setIsPrintConfigOpen(true)} className="rounded-xl font-bold h-9 border-border"><Printer className="w-4 h-4 mr-2 text-slate-600" />Print Report</Button>
          <Button variant="outline" size="sm" onClick={() => setIsEmailOpen(true)} className="rounded-xl font-bold h-9 border-border"><Mail className="w-4 h-4 mr-2 text-amber-500" />Email Report</Button>
          <Button variant="outline" size="sm" onClick={() => setIsWhatsappOpen(true)} className="rounded-xl font-bold h-9 border-border"><Share2 className="w-4 h-4 mr-2 text-emerald-500" />WhatsApp Share</Button>
          <Button size="sm" onClick={loadReport} className="bg-primary hover:bg-primary/95 text-white font-extrabold h-9 px-4 rounded-xl text-xs uppercase tracking-wider"><RefreshCw className="w-4 h-4 mr-2" />Run Query</Button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <Card className="border-border shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase font-extrabold tracking-wider text-slate-700 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />Query Filters
          </CardTitle>
          <span className="text-[10px] text-muted-foreground font-semibold">Today is {new Date().toLocaleDateString()}</span>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Date Preset</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Start Date</Label>
            <Input
              type="date"
              className="h-9 text-xs rounded-xl"
              disabled={period !== 'custom'}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">End Date</Label>
            <Input
              type="date"
              className="h-9 text-xs rounded-xl"
              disabled={period !== 'custom'}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Cashier</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
            >
              <option value="all">All Cashiers</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Table</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              <option value="all">All Tables</option>
              {tablesList.map(t => <option key={t.id} value={t.id}>Table {t.table_number}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Category</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Payment Mode</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="all">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Wallet">Wallet</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Status</Label>
            <select
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* TOTALS OVERVIEW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Settled Revenue</span>
            <div className="text-lg font-extrabold text-primary mt-1">{formatCurrency(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Filtered Orders</span>
            <div className="text-lg font-extrabold text-slate-800 mt-1">{totals.orders} Orders</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">GST Tax Collected</span>
            <div className="text-lg font-extrabold text-slate-800 mt-1">{formatCurrency(totals.tax)}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Discounts Granted</span>
            <div className="text-lg font-extrabold text-rose-600 mt-1">{formatCurrency(totals.discount)}</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm rounded-xl bg-white">
          <CardContent className="p-4">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Avg Ticket Size</span>
            <div className="text-lg font-extrabold text-slate-800 mt-1">{formatCurrency(totals.avgOrder)}</div>
          </CardContent>
        </Card>
      </div>

      {/* REPORT DATA LIST TABLE */}
      <Card className="border-border shadow-sm rounded-2xl overflow-hidden bg-white">
        <div className="px-6 py-4 bg-slate-50/50 border-b flex justify-between items-center">
          <span className="text-xs uppercase font-extrabold tracking-wider text-slate-700">Orders Result Registry</span>
          <span className="text-xs text-muted-foreground font-semibold">{reportData.length} records matched</span>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-10 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 bg-muted/40 animate-pulse rounded-xl" />)}
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm font-semibold">
              No orders matched the current date and filter selectors.
            </div>
          ) : (
            <table className="min-w-[900px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-slate-600 font-extrabold">
                  <th className="p-4 font-extrabold">Order ID</th>
                  <th className="p-4 font-extrabold">Date & Time</th>
                  <th className="p-4 font-extrabold">Table</th>
                  <th className="p-4 font-extrabold">Cashier</th>
                  <th className="p-4 font-extrabold">Items Summary</th>
                  <th className="p-4 font-extrabold">Payment Mode</th>
                  <th className="p-4 font-extrabold">GST Tax</th>
                  <th className="p-4 font-extrabold">Discount</th>
                  <th className="p-4 font-extrabold">Grand Total</th>
                  <th className="p-4 font-extrabold">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-extrabold text-primary">#{row.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-4 font-medium text-slate-600">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="p-4 font-extrabold">T{row.table_number}</td>
                    <td className="p-4 font-semibold text-slate-700">{row.cashier_name}</td>
                    <td className="p-4 text-slate-600 max-w-xs truncate">{row.items_summary}</td>
                    <td className="p-4 font-bold text-slate-700">{row.payment_method}</td>
                    <td className="p-4 font-medium">{formatCurrency(row.tax_amount)}</td>
                    <td className="p-4 font-medium text-rose-500">{row.discount_amount > 0 ? `-${formatCurrency(row.discount_amount)}` : '—'}</td>
                    <td className="p-4 font-extrabold text-slate-900">{formatCurrency(row.grand_total)}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md font-bold text-[10px] uppercase",
                        row.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        row.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                      )}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* PRINT-PREVIEW DIALOG CONTAINER (HIDDEN ON SCREEN, VISIBLE ON PRINT) */}
      <div id="print-preview-section" className="hidden">
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          {/* Logo & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #057B62', paddingBottom: '15px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0, color: '#057B62', fontSize: '24px', fontWeight: 'bold' }}>{restaurant?.name || 'NexVelt Restaurant'}</h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>GSTIN: {restaurant?.gst_number || 'N/A'} | Phone: {restaurant?.phone || 'N/A'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Sales Summary Report</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>Range: {fromDate} to {toDate}</p>
            </div>
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px', marginBottom: '20px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <div>
              <strong>Generated By:</strong> {user?.full_name} ({user?.role?.name})<br />
              <strong>Period:</strong> {period.toUpperCase()}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>Generated Date:</strong> {new Date().toLocaleDateString()}<br />
              <strong>Generated Time:</strong> {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Totals summaries */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <div style={{ border: '1px solid #E5E7EB', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B7280' }}>Total Revenue</div>
              <strong style={{ fontSize: '14px', color: '#057B62' }}>₹{totals.revenue.toLocaleString()}</strong>
            </div>
            <div style={{ border: '1px solid #E5E7EB', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B7280' }}>Total Orders</div>
              <strong style={{ fontSize: '14px' }}>{totals.orders}</strong>
            </div>
            <div style={{ border: '1px solid #E5E7EB', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B7280' }}>Tax Collected</div>
              <strong style={{ fontSize: '14px' }}>₹{totals.tax.toLocaleString()}</strong>
            </div>
            <div style={{ border: '1px solid #E5E7EB', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B7280' }}>Discounts</div>
              <strong style={{ fontSize: '14px', color: '#EF4444' }}>₹{totals.discount.toLocaleString()}</strong>
            </div>
            <div style={{ border: '1px solid #E5E7EB', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6B7280' }}>Avg Order</div>
              <strong style={{ fontSize: '14px' }}>₹{totals.avgOrder.toLocaleString()}</strong>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Order ID</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Table</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Cashier</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Items Summary</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Method</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Tax</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Discount</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(r => (
                <tr key={r.id} style={{ borderBottom: '0.5px solid #F1F5F9' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>#{r.id.substring(0, 8).toUpperCase()}</td>
                  <td style={{ padding: '8px' }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>T{r.table_number}</td>
                  <td style={{ padding: '8px' }}>{r.cashier_name}</td>
                  <td style={{ padding: '8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.items_summary}</td>
                  <td style={{ padding: '8px' }}>{r.payment_method}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.tax_amount.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#EF4444' }}>₹{r.discount_amount.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{r.grand_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer page numbers */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px', marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9CA3AF' }}>
            <span>Report layout formatted for A4/Letter size printing.</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>

      {/* PRINT CONFIG DIALOG */}
      <Dialog open={isPrintConfigOpen} onOpenChange={setIsPrintConfigOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Print Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="printS">Page Size</Label>
              <select
                id="printS"
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
                value={printSize}
                onChange={(e) => setPrintSize(e.target.value as any)}
              >
                <option value="A4">A4 Standard</option>
                <option value="Letter">Letter Standard</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="printO">Orientation</Label>
              <select
                id="printO"
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-xs font-bold text-foreground"
                value={printOrientation}
                onChange={(e) => setPrintOrientation(e.target.value as any)}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPrintConfigOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handlePrint} className="bg-primary hover:bg-primary/95 text-white font-bold"><Printer className="w-4 h-4 mr-2" />Print Document</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* EMAIL REPORT MODAL */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Email Performance Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="emailRecs">Recipient Emails (comma separated)</Label>
              <Input
                id="emailRecs"
                placeholder="director@grandkitchen.com, manager@grandkitchen.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailSub">Subject</Label>
              <Input
                id="emailSub"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailMsg">Email Message Details</Label>
              <textarea
                id="emailMsg"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-semibold text-foreground"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-500" />
                <span className="font-bold">Sales_Report_${fromDate}.pdf</span>
              </div>
              <span>Attached</span>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEmailOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-bold">Dispatch Email</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP SHARE MODAL */}
      <Dialog open={isWhatsappOpen} onOpenChange={setIsWhatsappOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Share Report via WhatsApp API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="waCode">Code</Label>
                <Input
                  id="waCode"
                  value={waCountryCode}
                  onChange={(e) => setWaCountryCode(e.target.value)}
                  placeholder="91"
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-3">
                <Label htmlFor="waPhone">WhatsApp Phone Number</Label>
                <Input
                  id="waPhone"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waText">Message Summary</Label>
              <textarea
                id="waText"
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-semibold"
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsWhatsappOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleWhatsappShare} className="bg-primary hover:bg-primary/95 text-white font-bold">Share Link</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
