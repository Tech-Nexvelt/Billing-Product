/**
 * Calculate profit margin percentage.
 * NEVER store this in the database — always compute at runtime.
 * @param sellingPrice - The public selling price
 * @param costPrice - The internal cost price
 * @returns Profit margin as percentage (0-100), or null if costPrice is not provided
 */
export function calculateProfitMargin(
  sellingPrice: number,
  costPrice: number | null | undefined
): number | null {
  if (costPrice === null || costPrice === undefined) return null;
  if (sellingPrice <= 0) return null;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

export function formatProfitMargin(margin: number | null): string {
  if (margin === null) return 'N/A';
  return `${margin.toFixed(1)}%`;
}
