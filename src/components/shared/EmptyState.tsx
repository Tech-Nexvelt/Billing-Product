import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-4', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground/50" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
