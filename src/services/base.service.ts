import { ApiResponse, ApiError } from '@/types/api.types';
import { mapSupabaseError, createSuccessResponse, createErrorResponse } from '@/utils/error-handler';

export class BaseService {
  protected async handleCall<T>(
    promise: PromiseLike<{ data: T | null; error: any }>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await promise;
      if (error) {
        const mappedError = mapSupabaseError(error);
        return createErrorResponse(mappedError);
      }
      return createSuccessResponse(data as T, 'Success');
    } catch (err: unknown) {
      const mappedError = mapSupabaseError(err);
      return createErrorResponse(mappedError);
    }
  }

  protected createClientError(message: string, code: ApiError['code'] = 'VALIDATION_ERROR'): ApiResponse<never> {
    return createErrorResponse({
      code,
      message,
    });
  }
}
