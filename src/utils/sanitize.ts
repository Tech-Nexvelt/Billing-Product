import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS.
 * Use on ANY user-provided content rendered as HTML.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function sanitizeText(input: string): string {
  return sanitizeHtml(input).trim();
}
