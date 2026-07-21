import { RestaurantBranding } from '@/types/branding.types';

export const DEFAULT_BRANDING: RestaurantBranding = {
  id: 'default',
  restaurant_id: '',
  name: 'NexVelt POS',
  logo_url: null,
  receipt_logo_url: null,
  invoice_logo_url: null,
  email_logo_url: null,
  favicon_url: null,
  primary_color: '#0AB190',
  secondary_color: '#057B62',
  accent_color: '#F59E0B',
  surface_color: '#FFFFFF',
  background_color: '#F8FAFC',
  sidebar_color: '#0F172A',
  header_color: '#FFFFFF',
  font_family: 'Inter, sans-serif',
  border_radius: '0.75rem',
  receipt_footer: 'Thank You! Visit Again',
  invoice_footer: 'Terms & Conditions Apply',
  address: null,
  phone: null,
  email: null,
  gst_number: null,
};

/**
 * Injects dynamic CSS variables into document.documentElement for tenant theme customization.
 */
export function applyBrandTheme(branding?: RestaurantBranding | null): void {
  if (typeof document === 'undefined') return;

  const b = branding || DEFAULT_BRANDING;
  const root = document.documentElement;

  root.style.setProperty('--brand-primary', b.primary_color || DEFAULT_BRANDING.primary_color);
  root.style.setProperty('--brand-secondary', b.secondary_color || DEFAULT_BRANDING.secondary_color);
  root.style.setProperty('--brand-accent', b.accent_color || DEFAULT_BRANDING.accent_color);
  root.style.setProperty('--brand-surface', b.surface_color || DEFAULT_BRANDING.surface_color);
  root.style.setProperty('--brand-background', b.background_color || DEFAULT_BRANDING.background_color);
  root.style.setProperty('--brand-sidebar', b.sidebar_color || DEFAULT_BRANDING.sidebar_color);
  root.style.setProperty('--brand-header', b.header_color || DEFAULT_BRANDING.header_color);
  root.style.setProperty('--brand-radius', b.border_radius || DEFAULT_BRANDING.border_radius);

  // Update dynamic document title if logged in
  if (b.name && b.name !== 'NexVelt POS') {
    if (!document.title.includes(b.name)) {
      document.title = `${b.name} | POS`;
    }
  }

  // Update dynamic favicon if available
  if (b.favicon_url) {
    const faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (faviconLink) {
      faviconLink.href = b.favicon_url;
    }
  }
}
