import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';
import { settingsService } from '@/services/settings.service';
import { useRestaurantStore } from '@/stores/restaurant.store';

export function useFeatureFlags() {
  const { featureFlags, isFeatureEnabled, setFeatureFlags, setLoading, isLoading } = useSettingsStore();
  const { restaurant } = useRestaurantStore();

  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    const res = await settingsService.getFeatureFlags(restaurant.id);
    if (res.success && res.data) setFeatureFlags(res.data);
    setLoading(false);
  }, [restaurant, setFeatureFlags, setLoading]);

  const toggle = useCallback(async (featureKey: string, enabled: boolean) => {
    if (!restaurant) return;
    const res = await settingsService.setFeatureFlag(restaurant.id, featureKey, enabled);
    if (res.success) await load();
    return res;
  }, [restaurant, load]);

  useEffect(() => { load(); }, [load]);

  return { featureFlags, isFeatureEnabled, toggle, isLoading };
}
