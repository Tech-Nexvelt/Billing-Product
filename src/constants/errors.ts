export const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  CONFLICT: 'This record is linked to other data and cannot be modified.',
  CONFLICT_VERSION: 'This record was modified by another user. Please refresh and try again.',
  UPLOAD_ERROR: 'Failed to upload image. Please try again.',
  REALTIME_ERROR: 'Real-time connection error. Attempting to reconnect...',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  DUPLICATE_RECORD: 'A record with this information already exists.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
} as const;
