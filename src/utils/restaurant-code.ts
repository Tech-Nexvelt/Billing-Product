/**
 * Format and validate restaurant codes.
 * Format: NXV-XXXX (e.g. NXV-0001)
 * NEVER expose raw UUIDs in the UI — always use restaurant_code.
 */
export function formatRestaurantCode(code: string): string {
  return code.toUpperCase();
}

export function isValidRestaurantCode(code: string): boolean {
  return /^NXV-[0-9]{4}$/.test(code);
}
