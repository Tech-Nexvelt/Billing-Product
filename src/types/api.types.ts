export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'CONFLICT_VERSION'
  | 'UPLOAD_ERROR'
  | 'REALTIME_ERROR'
  | 'INTERNAL_ERROR'
  | 'DUPLICATE_RECORD'
  | 'NETWORK_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
  field?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: ApiError | null;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}
