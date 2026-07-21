import { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';
import { cn } from '@/utils/cn';

interface RestaurantLogoProps {
  logoUrl?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  className?: string;
  showName?: boolean;
  nameClassName?: string;
}

const sizeMap = {
  xs: { box: 'w-8 h-8 text-[11px]', px: 32 },
  sm: { box: 'w-10 h-10 text-xs', px: 40 },
  md: { box: 'w-12 h-12 text-sm', px: 48 },
  lg: { box: 'w-16 h-16 text-base', px: 64 },
};

export function RestaurantLogo({
  logoUrl: propLogoUrl,
  name: propName,
  size = 'md',
  className,
  showName = false,
  nameClassName,
}: RestaurantLogoProps) {
  const { logoUrl: storeLogoUrl, restaurantName: storeName, initials: storeInitials } = useBranding();
  const [imageError, setImageError] = useState(false);

  const effectiveLogoUrl = propLogoUrl !== undefined ? propLogoUrl : storeLogoUrl;
  const effectiveName = propName || storeName;

  // Reset error state if logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [effectiveLogoUrl]);

  // Compute initials fallback
  const initials = propName
    ? propName.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'POS'
    : storeInitials;

  const sizeClasses = typeof size === 'string' ? sizeMap[size]?.box || sizeMap.md.box : '';
  const inlineSize = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        style={inlineSize}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 aspect-square select-none p-0.5',
          sizeClasses,
          className
        )}
      >
        {effectiveLogoUrl && !imageError ? (
          <img
            src={effectiveLogoUrl}
            alt={`${effectiveName} logo`}
            onError={() => setImageError(true)}
            className="h-full w-full object-contain object-center scale-105 transform-gpu"
            loading="eager"
            decoding="async"
          />
        ) : (
          /* Tier 2 & 3 Initials / Fallback Badge */
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-black tracking-wider uppercase">
            {initials}
          </div>
        )}
      </div>

      {showName && (
        <span
          className={cn(
            'truncate text-sm font-extrabold tracking-tight text-foreground transition-all duration-200',
            nameClassName
          )}
          title={effectiveName}
        >
          {effectiveName}
        </span>
      )}
    </div>
  );
}
