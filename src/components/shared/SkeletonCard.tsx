import { cn } from '@/utils/cn';

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse', className)}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-muted rounded"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 p-4 animate-pulse', className)}>
      <div className="w-8 h-8 rounded bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
      <div className="h-6 bg-muted rounded w-20" />
    </div>
  );
}
