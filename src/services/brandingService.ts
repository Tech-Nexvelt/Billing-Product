import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types/api.types';
import { RestaurantBranding } from '@/types/branding.types';
import { DEFAULT_BRANDING } from '@/utils/brandTheme.utils';
import { sanitizeImageUrl } from '@/utils/imageSanitizer.utils';

export class BrandingService extends BaseService {
  /**
   * Fetches the branding configuration for the specified restaurant.
   * Uses the primary restaurants table and merges with defaults.
   */
  async getBranding(restaurantId: string): Promise<ApiResponse<RestaurantBranding>> {
    try {
      // Fetch primary restaurant info
      const { data: restaurant, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restErr) throw restErr;

      const mergedBranding: RestaurantBranding = {
        id: restaurantId,
        restaurant_id: restaurantId,
        name: restaurant?.name || DEFAULT_BRANDING.name,
        logo_url: sanitizeImageUrl(restaurant?.logo_url),
        receipt_logo_url: sanitizeImageUrl(restaurant?.logo_url),
        invoice_logo_url: sanitizeImageUrl(restaurant?.logo_url),
        email_logo_url: sanitizeImageUrl(restaurant?.logo_url),
        favicon_url: sanitizeImageUrl(restaurant?.logo_url),

        primary_color: DEFAULT_BRANDING.primary_color,
        secondary_color: DEFAULT_BRANDING.secondary_color,
        accent_color: DEFAULT_BRANDING.accent_color,
        surface_color: DEFAULT_BRANDING.surface_color,
        background_color: DEFAULT_BRANDING.background_color,
        sidebar_color: DEFAULT_BRANDING.sidebar_color,
        header_color: DEFAULT_BRANDING.header_color,
        font_family: DEFAULT_BRANDING.font_family,
        border_radius: DEFAULT_BRANDING.border_radius,

        receipt_footer: DEFAULT_BRANDING.receipt_footer,
        invoice_footer: DEFAULT_BRANDING.invoice_footer,
        address: restaurant?.address || null,
        phone: restaurant?.phone || null,
        email: restaurant?.email || null,
        gst_number: restaurant?.gst_number || null,
        version: restaurant?.version || 1,
      };

      // Memory pre-cache image assets if present
      if (mergedBranding.logo_url) {
        this.preloadImage(mergedBranding.logo_url);
      }

      return {
        success: true,
        message: 'Branding loaded successfully',
        data: mergedBranding,
        error: null,
      };
    } catch (err: any) {
      return this.createClientError(err.message || 'Failed to load restaurant branding');
    }
  }

  preloadImage(url: string): void {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.src = url;
  }
}

export const brandingService = new BrandingService();
