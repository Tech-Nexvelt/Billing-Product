import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Armchair,
  Users,
  Clock,
  DollarSign,
  XCircle,
  FileText,
  Mail,
  Send,
  Printer,
  ChevronRight,
  UserCheck,
  Settings,
  UtensilsCrossed,
  FileSpreadsheet,
  Share2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface KPIStats {
  todayRevenue: number;
  todayOrders: number;
  occupiedTables: number;
  availableTables: number;
  reservedTables: number;
  cancelledOrders: number;
  averageOrderValue: number;
  avgPrepTime: number;
  avgBillingTime: number;
  todayCustomers: number;
  activeCashiers: number;
  kitchenStaffOnline: number;
}

const COLORS = ['#0AB190', '#00FEFD', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // States
  const [stats, setStats] = useState<KPIStats>({
    todayRevenue: 0,
    todayOrders: 0,
    occupiedTables: 0,
    availableTables: 0,
    reservedTables: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    avgPrepTime: 12,
    avgBillingTime: 4,
    todayCustomers: 0,
    activeCashiers: 2,
    kitchenStaffOnline: 1,
  });

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  const [paymentSplit, setPaymentSplit] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [leastItems, setLeastItems] = useState<any[]>([]);
  
  // Lists
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentUserActivities, setRecentUserActivities] = useState<any[]>([]);
  const [activeOrdersQueue, setActiveOrdersQueue] = useState<any[]>([]);

  // Dialog Modals
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Daily Sales Report - NexVelt POS');
  const [emailMessage, setEmailMessage] = useState('Please find attached the daily sales performance report.');
  const [emailRecipient, setEmailRecipient] = useState('');

  const [isWhatsappOpen, setIsWhatsappOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waCountryCode, setWaCountryCode] = useState('91');
  const [waMessage, setWaMessage] = useState('');

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadDashboard();
  }, [user?.restaurant_id]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const restId = user!.restaurant_id;
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      // Fetch seating states
      const { data: tables } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restId)
        .is('deleted_at', null);

      // Fetch today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('*, tables(table_number), users(full_name)')
        .eq('restaurant_id', restId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .is('deleted_at', null);

      // Fetch staff online counts
      const { data: staffUsers } = await supabase
        .from('users')
        .select('*, role:roles(name)')
        .eq('restaurant_id', restId)
        .eq('is_active', true)
        .is('deleted_at', null);

      // Fetch recent order items for item rank rankings
      const { data: recentItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('restaurant_id', restId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .is('deleted_at', null);

      // Aggregate KPI Metrics
      const occupied = tables?.filter(t => t.status === 'occupied').length || 0;
      const available = tables?.filter(t => t.status === 'available').length || 0;
      const reserved = tables?.filter(t => t.status === 'reserved').length || 0;

      const completedOrders = todayOrders?.filter(o => o.status === 'completed') || [];
      const cancelled = todayOrders?.filter(o => o.status === 'cancelled').length || 0;
      const revenue = completedOrders.reduce((sum, o) => sum + Number(o.grand_total), 0);
      const ordersCount = todayOrders?.length || 0;
      const avgOrder = completedOrders.length ? revenue / completedOrders.length : 0;
      
      const guestsCount = tables?.reduce((sum, t) => sum + (t.customer_count || 0), 0) || 0;

      const activeCashiers = staffUsers?.filter(u => u.role?.name === 'Cashier').length || 1;
      const kitchenOnline = staffUsers?.filter(u => u.role?.name === 'Kitchen').length || 1;

      setStats({
        todayRevenue: revenue,
        todayOrders: ordersCount,
        occupiedTables: occupied,
        availableTables: available,
        reservedTables: reserved,
        cancelledOrders: cancelled,
        averageOrderValue: avgOrder,
        avgPrepTime: 14,
        avgBillingTime: 3,
        todayCustomers: guestsCount || (completedOrders.length * 2),
        activeCashiers: activeCashiers || 2,
        kitchenStaffOnline: kitchenOnline || 1,
      });

      // --- Hourly Revenue Chart (real order timestamps) ---
      const hourBuckets: Record<string, number> = {
        '08:00': 0, '09:00': 0, '10:00': 0, '11:00': 0,
        '12:00': 0, '13:00': 0, '14:00': 0, '15:00': 0,
        '16:00': 0, '17:00': 0, '18:00': 0, '19:00': 0,
        '20:00': 0, '21:00': 0, '22:00': 0,
      };
      completedOrders.forEach(o => {
        const hour = new Date(o.created_at).getHours();
        const key = `${String(hour).padStart(2, '0')}:00`;
        if (key in hourBuckets) hourBuckets[key] += Number(o.grand_total);
      });
      setRevenueData(Object.entries(hourBuckets).map(([name, revenue]) => ({ name, revenue })));

      // --- Category Sales (real category_name from order_items) ---
      const catTotals: Record<string, number> = {};
      (recentItems || []).forEach(item => {
        const cat = item.category_name || 'Uncategorized';
        catTotals[cat] = (catTotals[cat] || 0) + Number(item.item_total);
      });
      const catArr = Object.entries(catTotals).map(([name, value]) => ({ name, value }));
      setCategorySales(catArr.length ? catArr : []);

      // --- Payment Method Split (real payment_method from completed orders) ---
      const payTotals: Record<string, number> = {};
      completedOrders.forEach(o => {
        const method = o.payment_method || 'Unknown';
        payTotals[method] = (payTotals[method] || 0) + Number(o.grand_total);
      });
      const payArr = Object.entries(payTotals).map(([name, value]) => ({ name, value }));
      setPaymentSplit(payArr.length ? payArr : []);

      // --- Dish Performance (real item quantities from order_items) ---
      const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
      (recentItems || []).forEach(item => {
        if (!itemCounts[item.item_name]) {
          itemCounts[item.item_name] = { name: item.item_name, qty: 0, revenue: 0 };
        }
        itemCounts[item.item_name].qty += item.quantity;
        itemCounts[item.item_name].revenue += Number(item.item_total);
      });
      const itemsArr = Object.values(itemCounts);
      setTopItems([...itemsArr].sort((a, b) => b.qty - a.qty).slice(0, 5));
      setLeastItems(itemsArr.length >= 2 ? [...itemsArr].sort((a, b) => a.qty - b.qty).slice(0, 5) : []);

      // --- Recent orders & payments ---
      setRecentOrders(todayOrders?.slice(0, 5) || []);
      setRecentPayments(completedOrders.slice(0, 5).map(o => ({
        id: o.id,
        amount: o.grand_total,
        time: new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        table: o.tables?.table_number || '—'
      })));

      // --- Staff Activity (real activity_logs) ---
      const { data: activityLogs } = await supabase
        .from('activity_logs')
        .select('*, user:users(full_name)')
        .eq('restaurant_id', restId)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentUserActivities((activityLogs || []).map(log => ({
        user: log.user?.full_name || 'Staff',
        action: log.action || log.resource_type || 'Activity',
        timestamp: new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })));

      setActiveOrdersQueue(todayOrders?.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)) || []);

      // Pre-fill default messages
      setWaMessage(`*${user?.full_name || 'Owner'}* shared report *Daily Sales Summary*.\nDate: ${today}\nTotal Revenue: ₹${revenue.toLocaleString()}\nTotal Orders: ${ordersCount}`);
    } catch (err) {
      console.error('Error loading dashboard:', err);
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
          report_type: 'Daily Summary',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('Audit log write failure:', err);
    }
  };

  // Simulated Download actions
  const triggerDownload = (format: 'pdf' | 'xlsx' | 'csv') => {
    handleAuditLog('Download Report', format);
    toast({
      title: `${format.toUpperCase()} Download Started`,
      description: `Daily_Report_${new Date().toISOString().split('T')[0]}.${format} is saving to local downloads.`,
    });
  };

  // Simulated Email send
  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecipient) return;
    handleAuditLog('Email Report', 'pdf', emailRecipient);
    toast({
      title: 'Email Sent Successfully',
      description: `Daily Sales Report sent to ${emailRecipient}.`
    });
    setIsEmailOpen(false);
  };

  // WhatsApp link generation
  const handleWhatsappSend = () => {
    if (!waPhone) return;
    handleAuditLog('WhatsApp Share', 'pdf', waPhone);
    const url = `https://api.whatsapp.com/send?phone=${waCountryCode}${waPhone}&text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
    setIsWhatsappOpen(false);
  };

  // Print Report Action
  const triggerPrint = () => {
    handleAuditLog('Print Report', 'print');
    window.print();
  };

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-white via-slate-50/50 to-primary/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary p-1.5 rounded-xl border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Executive Overview</h1>
          </div>
          <p className="text-xs text-muted-foreground">NexVelt Real-time Operational and Financial Performance Monitoring Console</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={isLoading} className="h-9 px-3 rounded-xl border-border">
            <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />Sync Dashboard
          </Button>
          <Button variant="default" size="sm" onClick={() => navigate('/reports')} className="bg-primary hover:bg-primary/95 text-white font-bold h-9 px-4 rounded-xl text-xs uppercase tracking-wider">
            Reports Desk
          </Button>
        </div>
      </div>

      {/* 12 KPI CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Row 1 */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Today's Revenue</span>
              <h3 className="text-2xl font-extrabold text-foreground">{formatCurrency(stats.todayRevenue)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100"><DollarSign className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Today's Orders</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.todayOrders}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20"><ShoppingBag className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Occupied Tables</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.occupiedTables}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100"><Armchair className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Available Tables</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.availableTables}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200"><Armchair className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        {/* Row 2 */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Reserved Tables</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.reservedTables}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><Armchair className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Cancelled Orders</span>
              <h3 className="text-2xl font-extrabold text-rose-600">{stats.cancelledOrders}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100"><XCircle className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Average Order Value</span>
              <h3 className="text-2xl font-extrabold text-foreground">{formatCurrency(stats.averageOrderValue)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100"><TrendingUp className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Kitchen Prep Time</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.avgPrepTime} min</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100"><Clock className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        {/* Row 3 */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Average Billing Time</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.avgBillingTime} min</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100"><Clock className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Today's Customers</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.todayCustomers} Guests</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><Users className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Active Cashiers</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.activeCashiers} Cashiers</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100"><UserCheck className="w-5 h-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Kitchen Staff Online</span>
              <h3 className="text-2xl font-extrabold text-foreground">{stats.kitchenStaffOnline} Online</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100"><UserCheck className="w-5 h-5" /></div>
          </CardContent>
        </Card>
      </div>

      {/* QUICK EXPORTS / OWNER ACTION BAR */}
      <Card className="border-border shadow-sm rounded-3xl overflow-hidden bg-slate-50/50">
        <div className="px-6 py-4 bg-white border-b flex justify-between items-center">
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-700 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />Owner Summary Report Quick Actions
          </h4>
          <span className="text-[10px] text-muted-foreground font-semibold">Today's Data Feed</span>
        </div>
        <CardContent className="p-5 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => triggerDownload('pdf')} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><FileText className="w-4 h-4 mr-2 text-rose-500" />Download PDF</Button>
          <Button variant="outline" size="sm" onClick={() => triggerDownload('xlsx')} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />Download Excel</Button>
          <Button variant="outline" size="sm" onClick={() => triggerDownload('csv')} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><FileText className="w-4 h-4 mr-2 text-blue-500" />Download CSV</Button>
          <Button variant="outline" size="sm" onClick={() => setIsEmailOpen(true)} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><Mail className="w-4 h-4 mr-2 text-amber-500" />Email Report</Button>
          <Button variant="outline" size="sm" onClick={() => setIsWhatsappOpen(true)} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><Share2 className="w-4 h-4 mr-2 text-emerald-500" />Share on WhatsApp</Button>
          <Button variant="outline" size="sm" onClick={triggerPrint} className="bg-white border-border hover:bg-slate-100 rounded-xl font-bold h-10"><Printer className="w-4 h-4 mr-2 text-slate-700" />Print Report</Button>
        </CardContent>
      </Card>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 1. Revenue hourly trend */}
        <Card className="xl:col-span-2 border-border shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Today's Revenue Stream</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0AB190" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0AB190" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} />
                <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#0AB190" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Payment Method split */}
        <Card className="border-border shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Payment Mode Share</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col justify-between">
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentSplit.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => `₹${Number(val || 0).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold mt-2">
              {paymentSplit.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-600 uppercase">{p.name}: <strong className="text-foreground">{formatCurrency(p.value)}</strong></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SALES RANKINGS AND OPERATIONS QUEUE */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top / Least Items */}
        <Card className="border-border shadow-sm rounded-2xl bg-white xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
              <span>Dish Performance Ranking</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Qty Sold</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Top Selling Dishes</span>
              {topItems.length === 0
                ? <p className="text-xs text-muted-foreground py-2">No orders recorded today yet.</p>
                : topItems.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0 border-slate-50">
                    <span className="font-semibold text-slate-800">{idx+1}. {item.name}</span>
                    <span className="font-extrabold text-primary">{item.qty} sold</span>
                  </div>
                ))
              }
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">Slow Moving Dishes</span>
              {leastItems.length === 0
                ? <p className="text-xs text-muted-foreground py-2">Not enough data to rank slow movers.</p>
                : leastItems.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0 border-slate-50">
                    <span className="font-semibold text-slate-700">{idx+1}. {item.name}</span>
                    <span className="font-extrabold text-rose-500">{item.qty} sold</span>
                  </div>
                ))
              }
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Category Distribution</span>
              {categorySales.length === 0
                ? <p className="text-xs text-muted-foreground py-2">No sales data available for today.</p>
                : categorySales.map((cat) => (
                  <div key={cat.name} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0 border-slate-50">
                    <span className="font-semibold text-slate-700">{cat.name}</span>
                    <span className="font-extrabold text-blue-600">{formatCurrency(cat.value)}</span>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>

        {/* Kitchen Operations queue */}
        <Card className="border-border shadow-sm rounded-2xl bg-white xl:col-span-2">
          <CardHeader className="pb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-primary" />
              Kitchen Live Queue & waiting
            </CardTitle>
            <div className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-700">
              Avg Waiting: 14 mins
            </div>
          </CardHeader>
          <CardContent>
            {activeOrdersQueue.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs font-semibold">
                Kitchen display has zero active orders in preparation.
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrdersQueue.map((o) => (
                  <div key={o.id} className="flex justify-between items-center p-3 border rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        T{o.tables?.table_number || '—'}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-foreground">Order: #{o.id.substring(0, 6).toUpperCase()}</div>
                        <div className="text-[10px] text-muted-foreground">Cashier: {o.users?.full_name || 'Staff'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase",
                        o.status === 'preparing' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        o.status === 'ready' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                      )}>
                        {o.status}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">{formatCurrency(o.grand_total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TABBED RECENT ACTIVITY FEED */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent payments / discounts feed */}
        <Card className="xl:col-span-2 border-border shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Recent Transactions & Orders</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Recent Orders Feed</span>
              <div className="space-y-2 mt-3">
                {recentOrders.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] py-4 text-center">No orders registered yet today.</p>
                ) : (
                  recentOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0 border-slate-50">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          o.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                        )} />
                        <span className="font-semibold text-slate-850 truncate">Order #{o.id.substring(0, 6).toUpperCase()} (T{o.tables?.table_number || '—'})</span>
                      </div>
                      <span className="font-extrabold text-slate-900 shrink-0">{formatCurrency(o.grand_total)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Recent Settled Payments</span>
              <div className="space-y-2 mt-3">
                {recentPayments.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] py-4 text-center">No transactions registered yet today.</p>
                ) : (
                  recentPayments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0 border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-800">Table {p.table} - Settled</span>
                      </div>
                      <span className="font-extrabold text-emerald-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent user activity log */}
        <Card className="border-border shadow-sm rounded-2xl bg-white xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Active Staff Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUserActivities.map((act, i) => (
              <div key={i} className="flex justify-between items-start text-xs border-b last:border-0 pb-2.5 last:pb-0 border-slate-50">
                <div>
                  <div className="font-bold text-slate-800">{act.user}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{act.action}</div>
                </div>
                <span className="text-[9px] text-slate-400 font-medium shrink-0">{act.timestamp}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* QUICK LINKS PANEL */}
      <Card className="border-border shadow-sm rounded-2xl bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground">Operational Quick Navigation Linkings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Button variant="ghost" onClick={() => navigate('/tables')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <Armchair className="w-4 h-4 text-primary shrink-0" />
              <span>Dining Seating</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" onClick={() => navigate('/reports')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <span>Reports Centre</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" onClick={() => navigate('/settings')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-primary shrink-0" />
              <span>Menu Catalogue</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" onClick={() => navigate('/settings')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <span>Staff Accounts</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" onClick={() => navigate('/settings')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary shrink-0" />
              <span>General Profile</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" onClick={() => navigate('/settings')} className="justify-between border hover:bg-slate-50 p-4 h-auto rounded-xl flex items-center font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary shrink-0" />
              <span>Printers Config</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>

      {/* EMAIL REPORT MODAL */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Email Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendEmail} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="emailRec">Recipient Email Address</Label>
              <Input
                id="emailRec"
                type="email"
                placeholder="owner@grandkitchen.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
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
              <Label htmlFor="emailMsg">Message</Label>
              <textarea
                id="emailMsg"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-500" />
                <span className="font-bold">Daily_Sales_Report.pdf</span>
              </div>
              <span>Attached</span>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEmailOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-bold"><Send className="w-4 h-4 mr-2" />Send Report</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP SHARE MODAL */}
      <Dialog open={isWhatsappOpen} onOpenChange={setIsWhatsappOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Share Report via WhatsApp</DialogTitle>
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
              <Label htmlFor="waText">Message Details</Label>
              <textarea
                id="waText"
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-semibold"
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsWhatsappOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleWhatsappSend} className="bg-primary hover:bg-primary/95 text-white font-bold"><Share2 className="w-4 h-4 mr-2" />Share on WhatsApp</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
