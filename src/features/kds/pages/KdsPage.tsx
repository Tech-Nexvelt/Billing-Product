import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Clock, ChefHat, Utensils, CheckCircle2, LogOut } from 'lucide-react';
import { cn } from '@/utils/cn';
import { kdsService } from '@/services/kds.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase';
import { ROUTES } from '@/constants/routes';
import { KdsOrder, KdsStatus } from '@/types/kds.types';
import { useToast } from '@/hooks/use-toast';

const COLUMNS: { status: KdsStatus; label: string; color: string; headerColor: string }[] = [
  { status: 'pending', label: 'Pending', color: 'bg-yellow-50/50 border-yellow-100', headerColor: 'bg-yellow-400 text-yellow-900' },
  { status: 'preparing', label: 'Preparing', color: 'bg-blue-50/50 border-blue-100', headerColor: 'bg-blue-500 text-white' },
  { status: 'ready', label: 'Ready', color: 'bg-green-50/50 border-green-100', headerColor: 'bg-[#0AB190] text-white' },
  { status: 'served', label: 'Served', color: 'bg-gray-50/50 border-gray-100', headerColor: 'bg-gray-500 text-white' },
];

const STATUS_TRANSITIONS: Record<KdsStatus, KdsStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: null,
  cancelled: null,
};

function ElapsedTime({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  return (
    <span className={cn('text-xs font-mono flex items-center gap-1', mins >= 15 ? 'text-red-500 font-bold animate-pulse' : mins >= 8 ? 'text-orange-500' : 'text-muted-foreground')}>
      <Clock className="w-3 h-3" /> {elapsed}
    </span>
  );
}

interface KdsOrderCardProps {
  order: KdsOrder;
  onMove: (id: string, status: KdsStatus, version: number) => Promise<void>;
}

function KdsOrderCard({ order, onMove }: KdsOrderCardProps) {
  const nextStatus = STATUS_TRANSITIONS[order.status];
  const [loading, setLoading] = useState(false);

  const handleMove = async () => {
    if (!nextStatus) return;
    setLoading(true);
    await onMove(order.id, nextStatus, order.version ?? 1);
    setLoading(false);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground">#{order.bill_number || order.id.slice(0, 8)}</span>
            {order.priority === 'rush' && <Badge variant="destructive" className="text-[10px] px-1 py-0.5">RUSH</Badge>}
            {order.priority === 'vip' && <Badge className="text-[10px] px-1 py-0.5 bg-[#00FEFD] text-black hover:bg-[#00FEFD]/90">VIP</Badge>}
          </div>
          <ElapsedTime createdAt={order.created_at} />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Utensils className="w-3 h-3 text-[#0AB190]" />
          <span className="font-medium">{order.table_number || order.table_id.slice(0, 6)}</span>
          <span>•</span>
          <span>{order.floor_name || 'Main Area'}</span>
        </div>

        <div className="space-y-1 py-1 border-t border-b border-border/50">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start justify-between text-xs">
              <span className="font-medium text-foreground">{item.quantity}x {item.item_name}</span>
              {item.special_notes && (
                <span className="text-orange-500 italic text-right max-w-[50%] text-[10px]">{item.special_notes}</span>
              )}
            </div>
          ))}
        </div>

        {order.kitchen_notes && (
          <div className="text-[10px] bg-amber-50 border border-amber-100 rounded p-1.5 flex items-start gap-1">
            <ChefHat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-amber-700 leading-tight">{order.kitchen_notes}</span>
          </div>
        )}

        {order.special_instructions && (
          <div className="text-[10px] text-muted-foreground italic leading-tight">
            * {order.special_instructions}
          </div>
        )}

        {nextStatus && (
          <Button
            size="sm"
            className="w-full h-8 text-xs bg-[#0AB190] hover:bg-[#057B62] text-white"
            onClick={handleMove}
            disabled={loading}
          >
            {loading ? 'Moving...' : `Mark ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`}
          </Button>
        )}

        {order.status === 'served' && (
          <div className="flex items-center justify-center gap-1 text-xs text-green-600 font-medium py-1">
            <CheckCircle2 className="w-4 h-4" /> Served
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KdsPage() {
  const { restaurant } = useRestaurantStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate(ROUTES.LOGIN);
  };

  const load = useCallback(async () => {
    if (!restaurant) return;
    setIsLoading(true);
    const res = await kdsService.getActiveOrders(restaurant.id);
    if (res.success && res.data) {
      setOrders(res.data);
    }
    setLastRefresh(new Date());
    setIsLoading(false);
  }, [restaurant]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const moveOrder = useCallback(async (orderId: string, status: KdsStatus, version: number) => {
    const res = await kdsService.updateStatus(orderId, status, version);
    if (res.success) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (status === 'ready') {
        toast({ title: 'Order Ready', description: 'Order has been marked as ready for serving.' });
      }
    } else {
      toast({ title: 'Error', description: res.error?.message, variant: 'destructive' });
    }
  }, [toast]);

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen Display"
        description="Real-time kitchen order management"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        }
      />

      <div className="text-xs text-muted-foreground">
        Last updated: {lastRefresh.toLocaleTimeString()} • {activeOrders.length} active orders
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colOrders = activeOrders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className={cn('rounded-lg border p-3 min-h-[450px] flex flex-col', col.color)}>
              <div className={cn('rounded-md px-3 py-2 mb-3 flex items-center justify-between shadow-sm', col.headerColor)}>
                <span className="font-semibold text-sm">{col.label}</span>
                <Badge variant="secondary" className="font-bold text-xs bg-white/20 text-current border-none">{colOrders.length}</Badge>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {colOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-30 text-current" />
                    <span className="text-xs">No orders</span>
                  </div>
                )}
                {colOrders.map((order) => (
                  <KdsOrderCard key={order.id} order={order} onMove={moveOrder} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
