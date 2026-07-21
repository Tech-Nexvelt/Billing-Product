/**
 * Validates and sanitizes dynamic image URLs to prevent XSS / javascript: URI injections.
 */
export function sanitizeImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Allow standard web URLs and relative paths
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  // Reject suspicious or invalid protocols (e.g. javascript:, vbscript:)
  return null;
}

/**
 * Calculates deterministic initials from a restaurant name.
 * e.g. "Bake Home" -> "BH", "Domino's Pizza" -> "DP", "Starbucks" -> "S"
 */
export function getRestaurantInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'POS';

  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return 'POS';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}
