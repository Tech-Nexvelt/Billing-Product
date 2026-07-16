import { cn } from '@/utils/cn';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Table statuses
  available:  { label: 'Available',  className: 'bg-green-100 text-green-700 border-green-200' },
  occupied:   { label: 'Occupied',   className: 'bg-red-100 text-red-700 border-red-200' },
  reserved:   { label: 'Reserved',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  cleaning:   { label: 'Cleaning',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  out_of_service: { label: 'Out of Service', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  // Order statuses
  draft:      { label: 'Draft',      className: 'bg-gray-100 text-gray-600 border-gray-200' },
  pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  preparing:  { label: 'Preparing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:  { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
  cancelled:  { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
  // Menu statuses
  out_of_stock: { label: 'Out of Stock', className: 'bg-red-100 text-red-700 border-red-200' },
  hidden:      { label: 'Hidden',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
  seasonal:    { label: 'Seasonal',  className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
      config.className,
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {config.label}
    </span>
  );
}
