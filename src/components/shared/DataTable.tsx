import { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SkeletonRow } from './SkeletonCard';
import { EmptyState } from './EmptyState';
import { cn } from '@/utils/cn';
import { LucideIcon } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  cell?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  skeletonRows?: number;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  rowClassName?: (row: T) => string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading,
  skeletonRows = 5,
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyAction,
  onRowClick,
  className,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-xl border border-border overflow-x-auto bg-card', className)}>
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3', col.headerClassName)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length} className="p-0">
                  <SkeletonRow />
                </TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, idx) => (
              <TableRow
                key={row.id ?? idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/40',
                  rowClassName?.(row)
                )}
              >
                {columns.map((col) => (
                  <TableCell key={String(col.key)} className={cn('py-3', col.className)}>
                    {col.cell
                      ? col.cell(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
