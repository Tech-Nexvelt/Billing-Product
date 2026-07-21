import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useBrandingStore } from '@/stores/useBrandingStore';
import { brandingService } from '@/services/brandingService';
import { BrandThemeApplier } from '@/components/shared/BrandThemeApplier';

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const { branding, setBranding, clearBranding, setError } = useBrandingStore();

  useEffect(() => {
    let isMounted = true;

    async function loadTenantBranding() {
      if (!isAuthenticated || !user?.restaurant_id) {
        clearBranding();
        return;
      }

      // Skip refetch if branding for current tenant is already cached in memory
      if (branding && branding.restaurant_id === user.restaurant_id) {
        return;
      }

      try {
        const res = await brandingService.getBranding(user.restaurant_id);
        if (isMounted) {
          if (res.data) {
            setBranding(res.data);
          } else if (res.error) {
            setError(res.error.message);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to initialize tenant branding');
        }
      }
    }

    loadTenantBranding();

    return () => {
      isMounted = false;
    };
  }, [user?.restaurant_id, isAuthenticated, branding, setBranding, clearBranding, setError]);

  return <BrandThemeApplier>{children}</BrandThemeApplier>;
}
