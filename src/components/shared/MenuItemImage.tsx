import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/utils/cn';

interface MenuItemImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
  availabilityStatus?: string;
}

const RETRY_INTERVALS = [500, 1000, 2000];

const FallbackPlaceholder = memo(() => {
  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 select-none p-4 relative overflow-hidden rounded-xl aspect-square"
      role="presentation"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-[#0AB190]/5 to-transparent pointer-events-none" />
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <UtensilsCrossed className="w-5 h-5 text-[#0AB190]" />
      </div>
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0AB190] leading-none mb-1">NexVelt POS</span>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Image Coming Soon</span>
    </div>
  );
});

FallbackPlaceholder.displayName = 'FallbackPlaceholder';

export const MenuItemImage = memo(function MenuItemImage({
  src,
  alt = 'Menu Item',
  className,
  priority = false,
  availabilityStatus = 'available',
}: MenuItemImageProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error' | 'fallback_error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const retryTimerRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  // Initialize and validate source
  useEffect(() => {
    isMounted.current = true;
    setRetryCount(0);
    setLoadState(src ? 'loading' : 'error');
    setCurrentSrc(src || null);

    return () => {
      isMounted.current = false;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, [src]);

  const handleLoad = useCallback(() => {
    if (!isMounted.current) return;
    setLoadState('loaded');
  }, []);

  const handleError = useCallback(() => {
    if (!isMounted.current) return;

    if (loadState === 'fallback_error') return;

    // If placeholder itself fails
    if (currentSrc === '/images/menu-placeholder.png') {
      setLoadState('fallback_error');
      return;
    }

    // Auto-retry up to 3 times for newly uploaded images
    if (retryCount < 3 && src) {
      const delay = RETRY_INTERVALS[retryCount];
      setRetryCount(prev => prev + 1);
      
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }

      retryTimerRef.current = window.setTimeout(() => {
        if (!isMounted.current) return;
        // Append cache-buster query parameter to force refresh
        const separator = src.includes('?') ? '&' : '?';
        setCurrentSrc(`${src}${separator}retry=${retryCount}&t=${Date.now()}`);
      }, delay);
    } else {
      // Fallback to placeholder
      setLoadState('error');
      setCurrentSrc('/images/menu-placeholder.png');
    }
  }, [retryCount, src, currentSrc, loadState]);

  const isAvailable = availabilityStatus === 'available';

  if (loadState === 'fallback_error' || !currentSrc) {
    return <FallbackPlaceholder />;
  }

  return (
    <div 
      className={cn(
        'relative aspect-square w-full h-full overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group select-none shadow-sm',
        className
      )}
      role="img"
      aria-label={alt}
    >
      {/* Skeleton loader overlay */}
      {loadState === 'loading' && (
        <div 
          className="absolute inset-0 bg-[#0AB190]/5 dark:bg-[#0AB190]/10 animate-pulse flex items-center justify-center"
          aria-hidden="true"
        >
          <UtensilsCrossed className="w-6 h-6 text-[#0AB190]/30 animate-spin duration-1000" />
        </div>
      )}

      {/* Image element */}
      <img
        src={currentSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'low'}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'w-full h-full object-cover transform-gpu transition-all duration-500 ease-out select-none',
          loadState === 'loading' ? 'scale-95 blur-sm opacity-0' : 'scale-100 blur-0 opacity-100',
          // Desktop hover scale effect
          isAvailable && 'hover:scale-[1.04]'
        )}
      />

      {/* Out of Stock Overlay */}
      {!isAvailable && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-2 transition-all duration-300">
          <span className="bg-rose-500 dark:bg-rose-600 text-white text-[9px] font-extrabold uppercase px-2 py-1 rounded-md shadow-md tracking-wider border border-white/20 scale-100 animate-fade-in">
            Out Of Stock
          </span>
        </div>
      )}
    </div>
  );
});
