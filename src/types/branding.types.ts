export interface RestaurantBranding {
  id: string;
  restaurant_id: string;
  name: string;
  logo_url: string | null;
  receipt_logo_url: string | null;
  invoice_logo_url: string | null;
  email_logo_url: string | null;
  favicon_url: string | null;
  
  // Theme & Design Tokens
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  surface_color: string;
  background_color: string;
  sidebar_color: string;
  header_color: string;
  font_family: string;
  border_radius: string;
  
  // Custom Footers & Info
  receipt_footer: string | null;
  invoice_footer: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  
  version?: number;
}

export interface BrandingState {
  branding: RestaurantBranding | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  
  setBranding: (branding: RestaurantBranding | null) => void;
  updateLocalBranding: (updates: Partial<RestaurantBranding>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearBranding: () => void;
}
