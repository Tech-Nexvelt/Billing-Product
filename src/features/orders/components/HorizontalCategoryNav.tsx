import { useRef } from 'react';
import { MenuCategory } from '@/types/menu.types';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useBrandingStore } from '@/stores/useBrandingStore';

interface Props {
  categories: MenuCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  itemCountsByCategory: Record<string, number>;
  totalItemCount: number;
}

export function HorizontalCategoryNav({
  categories,
  selectedCategoryId,
  onSelectCategory,
  itemCountsByCategory,
  totalItemCount,
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const branding = useBrandingStore((state) => state.branding);
  const defaultColor = branding?.primary_color || '#0AB190';

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const distance = direction === 'left' ? -260 : 260;
      scrollContainerRef.current.scrollBy({ left: distance, behavior: 'smooth' });
    }
  };

  const isAllSelected = selectedCategoryId === null;

  return (
    <div className="w-full bg-card/80 backdrop-blur-md border-b border-border/80 sticky top-0 z-20 py-2.5 px-4 shadow-sm">
      <div className="flex items-center gap-2 max-w-full relative">
        {/* Scroll Left Button */}
        <button
          onClick={() => scroll('left')}
          className="p-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition-all shrink-0 hidden sm:flex"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Pill Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 px-1 scroll-smooth w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All Items Pill */}
          <button
            onClick={() => onSelectCategory(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border border-border shadow-sm"
            style={{
              backgroundColor: isAllSelected ? defaultColor : 'var(--background)',
              color: isAllSelected ? '#ffffff' : 'var(--foreground)',
              borderColor: isAllSelected ? defaultColor : 'var(--border)',
              boxShadow: isAllSelected ? `0 4px 12px ${defaultColor}30` : 'none',
            }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Items</span>
            <span
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"
              style={{
                backgroundColor: isAllSelected ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                color: isAllSelected ? '#ffffff' : 'var(--muted-foreground)',
              }}
            >
              {totalItemCount}
            </span>
          </button>

          {/* Individual Category Pills */}
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            const count = itemCountsByCategory[category.id] || 0;
            const pillColor = category.color || defaultColor;

            return (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border border-border shadow-sm"
                style={{
                  backgroundColor: isSelected ? pillColor : 'var(--background)',
                  color: isSelected ? '#ffffff' : 'var(--foreground)',
                  borderColor: isSelected ? pillColor : 'var(--border)',
                  boxShadow: isSelected ? `0 4px 12px ${pillColor}30` : 'none',
                }}
              >
                <span>{category.name}</span>
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                      color: isSelected ? '#ffffff' : 'var(--muted-foreground)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scroll('right')}
          className="p-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition-all shrink-0 hidden sm:flex"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
