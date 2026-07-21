import { useBrandingStore } from '@/stores/useBrandingStore';
import { getRestaurantInitials, sanitizeImageUrl } from '@/utils/imageSanitizer.utils';

export function useBranding() {
  const { branding, isLoading, isHydrated, error, setBranding, updateLocalBranding, clearBranding } = useBrandingStore();

  const logoUrl = sanitizeImageUrl(branding?.logo_url);
  const receiptLogoUrl = sanitizeImageUrl(branding?.receipt_logo_url || branding?.logo_url);
  const restaurantName = branding?.name || 'NexVelt POS';
  const initials = getRestaurantInitials(restaurantName);

  return {
    branding,
    logoUrl,
    receiptLogoUrl,
    restaurantName,
    initials,
    primaryColor: branding?.primary_color || '#0AB190',
    secondaryColor: branding?.secondary_color || '#057B62',
    accentColor: branding?.accent_color || '#F59E0B',
    isLoading,
    isHydrated,
    error,
    setBranding,
    updateLocalBranding,
    clearBranding,
  };
}
