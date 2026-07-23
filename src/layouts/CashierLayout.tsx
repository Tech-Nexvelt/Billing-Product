import { ReactNode } from 'react';
import { BrandThemeApplier } from '@/components/shared/BrandThemeApplier';

interface CashierLayoutProps {
  children: ReactNode;
}

/**
 * CashierLayout
 * Enterprise full-width POS billing workspace.
 * Completely excludes Sidebar, sidebar toggles, drawers, and left margins.
 */
export function CashierLayout({ children }: CashierLayoutProps) {
  return (
    <BrandThemeApplier>
      <div className="w-full h-screen max-h-screen bg-background text-foreground flex flex-col overflow-hidden select-none">
        <main className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </BrandThemeApplier>
  );
}
