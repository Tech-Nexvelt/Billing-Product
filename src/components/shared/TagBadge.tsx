import { cn } from '@/utils/cn';

interface TagBadgeProps {
  label: string;
  color?: string | null;
  className?: string;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '107, 114, 128';
}

export function TagBadge({ label, color, className }: TagBadgeProps) {
  const rgb = color ? hexToRgb(color) : '107, 114, 128';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        className
      )}
      style={{
        backgroundColor: `rgba(${rgb}, 0.1)`,
        borderColor: `rgba(${rgb}, 0.3)`,
        color: color ?? '#6B7280',
      }}
    >
      {label}
    </span>
  );
}
