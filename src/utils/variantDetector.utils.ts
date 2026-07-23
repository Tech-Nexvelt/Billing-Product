import { MenuItemWithVariantsAndModifiers, ProductVariant } from '@/types/menu.types';

export interface ExtractedVariantInfo {
  isVariant: boolean;
  baseName: string;
  variantTitle: string;
  variantType: 'size' | 'weight' | 'volume' | 'cup' | 'portion' | 'unknown';
}

const VARIANT_PATTERNS: { type: ExtractedVariantInfo['variantType']; regex: RegExp }[] = [
  // 1. Size in inches: e.g. 6", 8", 10", (6"), (8 Inch)
  { type: 'size', regex: /\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches))\s*[\)\]\}]?$/i },
  // 2. Weight: e.g. ½ Kg, 1 Kg, 500 g, 250g, (1.5 Kg)
  { type: 'weight', regex: /\s*[\(\[\{-]?\s*(½|1\/2|\d+(?:\.\d+)?)\s*(?:kg|g|gm|grams|kilo|kilos)\s*[\)\]\}]?$/i },
  // 3. Volume: e.g. 250ml, 500 ml, 1L, 2 L, (750 ml)
  { type: 'volume', regex: /\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?)\s*(?:ml|l|liter|liters|litre|litres)\s*[\)\]\}]?$/i },
  // 4. Cup & Beverage Sizes: Small, Medium, Large, Regular, Large, XL
  { type: 'cup', regex: /\s*[\(\[\{-]?\s*(small|medium|large|regular|xl|xxl|mini|jumbo)\s*[\)\]\}]?$/i },
  // 5. Serving Portions: Single, Double, Family, Half, Full
  { type: 'portion', regex: /\s*[\(\[\{-]?\s*(single|double|family|half|full|quarter)\s*[\)\]\}]?$/i },
];

/**
 * Extracts generic variant information from a product name.
 * e.g. "Chocolate Cake (1 Kg)" -> baseName: "Chocolate Cake", variantTitle: "1 Kg", isVariant: true
 */
export function extractVariantInfo(itemName: string): ExtractedVariantInfo {
  const trimmed = itemName.trim();

  for (const pattern of VARIANT_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const rawVariant = match[1] || match[0];
      const baseName = trimmed.replace(pattern.regex, '').trim();

      if (baseName.length >= 2) {
        return {
          isVariant: true,
          baseName,
          variantTitle: capitalizeVariant(rawVariant),
          variantType: pattern.type
        };
      }
    }
  }

  return {
    isVariant: false,
    baseName: trimmed,
    variantTitle: '',
    variantType: 'unknown'
  };
}

function capitalizeVariant(str: string): string {
  const s = str.trim().replace(/^[\(\[\{-]+|[\)\]\}]+$/g, '').trim();
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Consolidates legacy menu items with size/weight/volume suffixes into unified parent items with product variants.
 */
export function consolidateLegacyVariantItems(
  items: MenuItemWithVariantsAndModifiers[],
  restaurantId: string
): MenuItemWithVariantsAndModifiers[] {
  const parentMap = new Map<string, MenuItemWithVariantsAndModifiers>();
  const variantClusters = new Map<string, MenuItemWithVariantsAndModifiers[]>();

  // Group items by baseName if they match variant patterns
  for (const item of items) {
    const info = extractVariantInfo(item.name);

    if (info.isVariant && (!item.variants || item.variants.length === 0)) {
      const key = `${item.category_id}_${info.baseName.toLowerCase()}`;
      if (!variantClusters.has(key)) {
        variantClusters.set(key, []);
      }
      variantClusters.get(key)!.push(item);
    } else {
      parentMap.set(item.id, { ...item });
    }
  }

  // Convert clusters into consolidated parent items
  for (const [_key, cluster] of variantClusters.entries()) {
    if (cluster.length >= 1) {
      const first = cluster[0];
      const info = extractVariantInfo(first.name);
      const parentId = `parent-${first.id}`;

      const generatedVariants: ProductVariant[] = cluster.map((child, idx) => {
        const childInfo = extractVariantInfo(child.name);
        return {
          id: `var-${child.id}`,
          restaurant_id: restaurantId,
          menu_item_id: parentId,
          name: childInfo.variantTitle || `Option ${idx + 1}`,
          sku: child.sku,
          barcode: child.barcode,
          price_override: child.selling_price,
          cost_price: child.cost_price,
          is_active: child.availability_status === 'available',
          display_order: idx + 1
        };
      });

      const consolidatedParent: MenuItemWithVariantsAndModifiers = {
        ...first,
        id: parentId,
        name: info.baseName,
        variants: generatedVariants,
        modifier_groups: first.modifier_groups || [],
      };

      parentMap.set(parentId, consolidatedParent);
    } else {
      for (const item of cluster) {
        parentMap.set(item.id, { ...item });
      }
    }
  }

  return Array.from(parentMap.values());
}
