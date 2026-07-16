import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { settingsService } from '@/services/settings.service';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { FeatureFlag } from '@/types/settings.types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const FEATURE_META: Record<string, { label: string; description: string; phase?: number }> = {
  kds: { label: 'Kitchen Display System', description: 'Real-time kitchen order management board' },
  customers: { label: 'Customer CRM', description: 'Customer profiles and purchase history' },
  reports: { label: 'Reports & Analytics', description: 'Sales reports, charts and insights' },
  analytics: { label: 'Advanced Analytics', description: 'Revenue trends and performance analysis', phase: 3 },
  printer: { label: 'Thermal Printing', description: 'Physical receipt and KOT printing' },
  crm: { label: 'CRM Module', description: 'Advanced customer relationship management', phase: 3 },
  qr_ordering: { label: 'QR Ordering', description: 'Customer self-ordering via QR codes', phase: 3 },
  inventory: { label: 'Inventory', description: 'Stock management and tracking', phase: 3 },
  multi_branch: { label: 'Multi-Branch', description: 'Manage multiple restaurant locations', phase: 3 },
};

export function FeatureFlagsTab() {
  const { restaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const res = await settingsService.getFeatureFlags(restaurant.id);
    if (res.success && res.data) setFlags(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurant]);

  const toggle = async (key: string, currentEnabled: boolean) => {
    if (!restaurant) return;
    setToggling(key);
    const res = await settingsService.setFeatureFlag(restaurant.id, key, !currentEnabled);
    if (res.success) {
      setFlags((prev) => prev.map((f) => f.feature_key === key ? { ...f, enabled: !currentEnabled } : f));
      toast({ title: `${FEATURE_META[key]?.label || key} ${!currentEnabled ? 'enabled' : 'disabled'}` });
    }
    setToggling(null);
  };

  const getFlag = (key: string) => flags.find((f) => f.feature_key === key);

  if (loading) return <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading feature flags...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Feature Flags</h3>
        <p className="text-sm text-muted-foreground">Enable or disable modules for your restaurant</p>
      </div>

      <div className="grid gap-3">
        {Object.entries(FEATURE_META).map(([key, meta]) => {
          const flag = getFlag(key);
          const enabled = flag?.enabled ?? false;
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {meta.phase && <Badge variant="outline" className="text-xs">Phase {meta.phase}</Badge>}
                      {enabled && <Badge className="text-xs bg-[#0AB190]/10 text-[#0AB190] border-[#0AB190]/20">Active</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                  {toggling === key ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggle(key, enabled)}
                      disabled={!!meta.phase}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
