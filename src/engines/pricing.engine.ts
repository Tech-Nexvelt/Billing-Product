import { ProductVariant } from '@/types/menu.types';
import { SelectedModifier } from '@/types/order.types';

export class PricingEngine {
  /**
   * Calculates the final single unit price of a product given its base price,
   * selected variant (if any), and selected modifiers.
   * Formula: UnitPrice = (VariantPriceOverride ?? BasePrice) + Sum(ModifierDelta * Qty)
   */
  static calculateUnitPrice(
    basePrice: number,
    selectedVariant?: ProductVariant | null,
    selectedModifiers: SelectedModifier[] = []
  ): number {
    const effectiveBase = (selectedVariant && selectedVariant.price_override != null) 
      ? selectedVariant.price_override 
      : basePrice;

    const modifiersTotal = selectedModifiers.reduce((sum, mod) => {
      const delta = mod.price_delta || 0;
      const qty = mod.quantity || 1;
      return sum + (delta * qty);
    }, 0);

    return Math.max(0, effectiveBase + modifiersTotal);
  }
}
