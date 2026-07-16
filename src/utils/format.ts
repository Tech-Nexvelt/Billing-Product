import { format } from 'date-fns';

export function formatCurrency(amount: number, symbol: string = '₹', decimals: number = 2): string {
  return `${symbol}${amount.toFixed(decimals)}`;
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  return format(new Date(date), formatStr);
}

export function formatTime(date: string | Date, formatStr: string = 'HH:mm'): string {
  return format(new Date(date), formatStr);
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
