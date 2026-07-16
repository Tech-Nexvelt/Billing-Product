import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { restaurantService } from '@/services/restaurant.service';

export function useRestaurant() {
  const { user } = useAuthStore();
  const { restaurant, settings, isLoading, setRestaurant, setSettings, setLoading, setError } = useRestaurantStore();

  useEffect(() => {
    if (!user?.restaurant_id) return;
    if (restaurant && settings) return; // Already loaded

    async function loadRestaurantData() {
      setLoading(true);
      try {
        const [restRes, settingsRes] = await Promise.all([
          restaurantService.getRestaurant(user!.restaurant_id),
          restaurantService.getSettings(user!.restaurant_id),
        ]);

        if (restRes.error) throw new Error(restRes.error.message);
        if (settingsRes.error) throw new Error(settingsRes.error.message);

        setRestaurant(restRes.data);
        setSettings(settingsRes.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load restaurant settings');
      } finally {
        setLoading(false);
      }
    }

    loadRestaurantData();
  }, [user?.restaurant_id, restaurant, settings]);

  return {
    restaurant,
    settings,
    isLoading,
  };
}
