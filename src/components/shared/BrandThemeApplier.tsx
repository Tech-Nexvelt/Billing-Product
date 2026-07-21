import { useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';
import { applyBrandTheme } from '@/utils/brandTheme.utils';

export function BrandThemeApplier({ children }: { children: React.ReactNode }) {
  const { branding } = useBranding();

  useEffect(() => {
    applyBrandTheme(branding);
  }, [branding]);

  return <>{children}</>;
}
