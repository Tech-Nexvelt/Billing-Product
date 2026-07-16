import type { ApiError, ApiResponse } from '@/types/api.types';

export function mapSupabaseError(error: unknown): ApiError {
  const err = error as any;
  
  if (err?.code === '23505') {
    return { code: 'DUPLICATE_RECORD', message: 'A record with this information already exists.', details: err };
  }
  if (err?.code === '23503') {
    return { code: 'CONFLICT', message: 'This record is linked to other data and cannot be modified.', details: err };
  }
  if (err?.code === 'PGRST116') {
    return { code: 'NOT_FOUND', message: 'The requested resource was not found.', details: err };
  }
  if (err?.name === 'AuthApiError' || err?.status === 401 || err?.status === 403) {
    return { code: 'UNAUTHORIZED', message: 'You are not authorized to perform this action.', details: err };
  }
  
  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.', details: err };
}

export function createSuccessResponse<T>(data: T, message: string = 'Success'): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    error: null,
  };
}

export function createErrorResponse(error: ApiError): ApiResponse<never> {
  return {
    success: false,
    message: error.message,
    data: null,
    error,
  };
}
