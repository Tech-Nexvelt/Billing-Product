import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, AlertCircle, Sparkles, ReceiptText, Tag } from 'lucide-react';
import { MenuItemWithVariantsAndModifiers, ProductVariant, ModifierGroup, ModifierOption } from '@/types/menu.types';
import { SelectedModifier, CartItem } from '@/types/order.types';
import { DependencyEngine } from '@/engines/dependency.engine';
import { computeCartItemHash } from '@/engines/cartHash.engine';
import { formatCurrency } from '@/utils/format';
import { useMenuStore } from '@/stores/menu.store';
import { useBrandingStore } from '@/stores/useBrandingStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: MenuItemWithVariantsAndModifiers | null;
  initialCartItem?: CartItem | null;
  onAddToCart: (cartItem: CartItem) => void;
}

export function ProductConfiguratorModal({ isOpen, onClose, product, initialCartItem, onAddToCart }: Props) {
  if (!product) return null;

  const categories = useMenuStore((state) => state.categories);
  const branding = useBrandingStore((state) => state.branding);

  const category = categories.find((c) => c.id === product.category_id);
  const themeColor = category?.color || branding?.primary_color || '#0AB190';

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [specialNotes, setSpecialNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Lowest starting base price among variants or product base price
  const startingPrice = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
      const prices = product.variants.map(v => v.price_override ?? product.selling_price);
      return Math.min(...prices);
    }
    return product.selling_price;
  }, [product]);

  // Dynamic helper: Calculates option price delta based on selected variant (e.g. Eggless: ₹50 for ½ Kg, ₹100 for 1 Kg / 2 Kg)
  const getEffectiveOptionPriceDelta = (_group: ModifierGroup, option: ModifierOption): number => {
    const isEggless = option.name.toLowerCase() === 'eggless';
    if (isEggless) {
      const isKgVariant = selectedVariant && (
        selectedVariant.name.includes('1') || 
        selectedVariant.name.includes('2') ||
        selectedVariant.name.toLowerCase().includes('1kg') ||
        selectedVariant.name.toLowerCase().includes('2kg')
      );
      return isKgVariant ? 100 : 50;
    }
    return option.price_delta;
  };

  useEffect(() => {
    if (isOpen) {
      if (initialCartItem) {
        setSelectedVariant(product.variants?.find(v => v.id === initialCartItem.variant_id) || null);
        setSelectedModifiers(initialCartItem.selected_modifiers || []);
        setSpecialNotes(initialCartItem.special_notes || '');
        setQuantity(initialCartItem.quantity || 1);
      } else {
        if (product.variants && product.variants.length === 1) {
          setSelectedVariant(product.variants[0]);
        } else {
          setSelectedVariant(null);
        }
        setSpecialNotes('');
        setQuantity(1);

        const defaults: SelectedModifier[] = [];
        product.modifier_groups?.forEach(group => {
          group.options?.filter(o => o.is_default).forEach(opt => {
            defaults.push({
              group_id: group.id,
              group_name: group.name,
              option_id: opt.id,
              option_name: opt.name,
              price_delta: opt.price_delta,
              quantity: 1
            });
          });
        });
        setSelectedModifiers(defaults);
      }
    }
  }, [isOpen, product, initialCartItem]);

  // Automatically update selectedModifiers price_delta when selectedVariant changes (e.g., Eggless updates 50 <-> 100)
  useEffect(() => {
    setSelectedModifiers(prev =>
      prev.map(mod => {
        if (mod.option_name?.toLowerCase() === 'eggless') {
          const isKgVariant = selectedVariant && (
            selectedVariant.name.includes('1') || 
            selectedVariant.name.includes('2') ||
            selectedVariant.name.toLowerCase().includes('1kg') ||
            selectedVariant.name.toLowerCase().includes('2kg')
          );
          return {
            ...mod,
            price_delta: isKgVariant ? 100 : 50
          };
        }
        return mod;
      })
    );
  }, [selectedVariant]);

  // Effective Base Price based on selection
  const effectiveBasePrice = useMemo(() => {
    if (selectedVariant && selectedVariant.price_override != null) {
      return selectedVariant.price_override;
    }
    return startingPrice;
  }, [selectedVariant, product.selling_price, startingPrice]);

  // Variant price upgrade delta over starting price
  const variantUpgradeDelta = useMemo(() => {
    if (!selectedVariant || selectedVariant.price_override == null) return 0;
    return Math.max(0, selectedVariant.price_override - startingPrice);
  }, [selectedVariant, startingPrice]);

  // Modifiers total
  const modifiersTotal = useMemo(() => {
    return selectedModifiers.reduce((sum, mod) => {
      const delta = mod.price_delta || 0;
      const qty = mod.quantity || 1;
      return sum + (delta * qty);
    }, 0);
  }, [selectedModifiers]);

  // Final single unit price
  const unitPrice = useMemo(() => {
    return effectiveBasePrice + modifiersTotal;
  }, [effectiveBasePrice, modifiersTotal]);

  const grandTotal = unitPrice * quantity;

  // Validation rules
  const validationResult = useMemo(() => {
    const errors: string[] = [];

    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      errors.push('Please select a variant option (e.g. Size / Weight)');
    }

    if (product.modifier_groups) {
      product.modifier_groups.forEach(group => {
        if (!DependencyEngine.isGroupVisible(group, selectedModifiers)) return;

        const groupSelections = selectedModifiers.filter(s => s.group_id === group.id);
        const val = DependencyEngine.validateGroupSelection(group, groupSelections);
        if (!val.isValid && val.error) {
          errors.push(val.error);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }, [product.variants, product.modifier_groups, selectedVariant, selectedModifiers]);

  const handleOptionToggle = (group: ModifierGroup, option: ModifierOption) => {
    const effectiveDelta = getEffectiveOptionPriceDelta(group, option);

    if (group.selection_type === 'single' || group.selection_type === 'dropdown') {
      setSelectedModifiers(prev => [
        ...prev.filter(s => s.group_id !== group.id),
        {
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price_delta: effectiveDelta,
          quantity: 1
        }
      ]);
    } else if (group.selection_type === 'multi') {
      const exists = selectedModifiers.some(s => s.option_id === option.id);
      if (exists) {
        setSelectedModifiers(prev => prev.filter(s => s.option_id !== option.id));
      } else {
        setSelectedModifiers(prev => [
          ...prev,
          {
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price_delta: effectiveDelta,
            quantity: 1
          }
        ]);
      }
    }
  };

  const handleTextChange = (group: ModifierGroup, text: string) => {
    if (!text.trim()) {
      setSelectedModifiers(prev => prev.filter(s => s.group_id !== group.id));
    } else {
      setSelectedModifiers(prev => [
        ...prev.filter(s => s.group_id !== group.id),
        {
          group_id: group.id,
          group_name: group.name,
          price_delta: 0,
          quantity: 1,
          text_value: text,
          option_name: text
        }
      ]);
    }
  };

  const handleConfirm = () => {
    if (!validationResult.isValid) return;

    const summaryParts: string[] = [];
    if (selectedVariant) summaryParts.push(`Variant: ${selectedVariant.name}`);
    selectedModifiers.forEach(m => {
      if (m.text_value) summaryParts.push(`${m.group_name}: ${m.text_value}`);
      else if (m.option_name) summaryParts.push(`${m.group_name}: ${m.option_name}`);
    });
    const selectedVariantText = summaryParts.join(' | ');

    const hash = computeCartItemHash(product.id, selectedVariant?.id, selectedModifiers, specialNotes);

    const cartItem: CartItem = {
      db_id: initialCartItem?.db_id,
      menu_item_id: product.id,
      variant_id: selectedVariant?.id || null,
      variant_name: selectedVariant?.name || null,
      item_name: product.name,
      category_name: category?.name || null,
      base_unit_price: selectedVariant?.price_override ?? product.selling_price,
      unit_price: unitPrice,
      quantity,
      item_total: grandTotal,
      selected_modifiers: selectedModifiers,
      selected_variant_text: selectedVariantText,
      special_notes: specialNotes,
      configuration_hash: hash,
      image_url: product.image_url || undefined,
      is_veg: product.is_veg
    };

    onAddToCart(cartItem);
    onClose();
  };

  // Ensure the header title ALWAYS displays the selected parent menu item's clean name
  const menuItemTitle = useMemo(() => {
    if (!product?.name) return 'Product Customization';
    return product.name.replace(/\s*[\(\[\{-]?\s*\d+(?:\.\d+)?\s*(?:"|inch|inches|''|cm)\s*[\)\]\}]?$/i, '').trim();
  }, [product?.name]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border shadow-2xl rounded-2xl p-6"
        style={{
          boxShadow: `0 20px 40px -15px ${themeColor}20`
        }}
      >
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 relative">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-2xl font-extrabold text-foreground flex items-center gap-2">
                {menuItemTitle}
                {product.is_veg ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block border-2 border-emerald-200" title="Vegetarian" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 inline-block border-2 border-rose-200" title="Non-Vegetarian" />
                )}
              </DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">{product.description || 'Customize your order choices below.'}</p>
            </div>
            
            {/* Header Price Badge */}
            <div className="text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-0.5">
                {!selectedVariant && product.variants?.length ? 'Starting From' : 'Price Per Unit'}
              </span>
              <Badge 
                className="text-lg px-3.5 py-1 font-mono font-black rounded-xl shadow-sm border"
                style={{
                  backgroundColor: `${themeColor}15`,
                  color: themeColor,
                  borderColor: `${themeColor}40`
                }}
              >
                {formatCurrency(!selectedVariant && product.variants?.length ? startingPrice : unitPrice)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Variants Selector */}
        {product.variants && product.variants.length > 0 && (
          <div className="py-4 border-b border-border">
            <div className="flex items-center justify-between mb-2.5">
              <h4 
                className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: themeColor }}
              >
                <Tag className="w-3.5 h-3.5" />
                Select Variant / Size / Weight
              </h4>
              {!selectedVariant && (
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Required Selection
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {product.variants.map(variant => {
                const isSelected = selectedVariant?.id === variant.id;
                const vPrice = variant.price_override ?? product.selling_price;
                const diffFromStart = vPrice - startingPrice;

                return (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className="p-3.5 rounded-xl border text-left transition-all duration-200 relative overflow-hidden group"
                    style={{
                      borderColor: isSelected ? themeColor : 'var(--border)',
                      backgroundColor: isSelected ? `${themeColor}12` : 'var(--card)',
                      boxShadow: isSelected ? `0 4px 12px ${themeColor}18` : 'none'
                    }}
                  >
                    <div className="font-bold text-sm text-foreground">{variant.name}</div>
                    <div className="flex flex-wrap items-center justify-between gap-1 mt-1">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatCurrency(vPrice)}
                      </span>
                      {diffFromStart > 0 && (
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground whitespace-nowrap">
                          (+{formatCurrency(diffFromStart)})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <div 
                        className="absolute top-0 right-0 w-6 h-6 rounded-bl-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modifier Groups */}
        <div className="space-y-5 py-4">
          {product.modifier_groups?.map(group => {
            if (!DependencyEngine.isGroupVisible(group, selectedModifiers)) return null;

            const groupSelections = selectedModifiers.filter(s => s.group_id === group.id);
            const textVal = groupSelections[0]?.text_value || '';

            return (
              <div 
                key={group.id} 
                className="bg-muted/40 p-4 rounded-2xl border border-border/80"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-foreground text-base flex items-center gap-2">
                      {group.name}
                      {group.is_required && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold">Required</Badge>
                      )}
                    </h4>
                    {group.description && <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider bg-background px-2.5 py-1 rounded-md border border-border">
                    {group.selection_type === 'single' ? 'Pick 1' : group.selection_type === 'text' ? 'Optional Text' : 'Multi-select'}
                  </span>
                </div>

                {group.selection_type === 'text' || group.selection_type === 'textarea' ? (
                  <Input
                    placeholder={`Enter ${group.name.toLowerCase()}...`}
                    value={textVal}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-2 rounded-xl h-10 text-sm"
                    onChange={e => handleTextChange(group, e.target.value)}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {group.options?.map(option => {
                      const isSelected = selectedModifiers.some(s => s.option_id === option.id);
                      const effOptionDelta = getEffectiveOptionPriceDelta(group, option);

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleOptionToggle(group, option)}
                          className="p-3.5 rounded-xl border text-left flex items-center justify-between transition-all duration-200 bg-background"
                          style={{
                            borderColor: isSelected ? themeColor : 'var(--border)',
                            backgroundColor: isSelected ? `${themeColor}10` : 'var(--background)',
                            boxShadow: isSelected ? `0 2px 8px ${themeColor}12` : 'none'
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors"
                              style={{
                                borderColor: isSelected ? themeColor : 'var(--border)',
                                backgroundColor: isSelected ? themeColor : 'transparent'
                              }}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                            </div>
                            <span className="text-sm font-semibold text-foreground">{option.name}</span>
                          </div>
                          {effOptionDelta > 0 && (
                            <span 
                              className="text-xs font-mono font-bold"
                              style={{ color: themeColor }}
                            >
                              +{formatCurrency(effOptionDelta)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Special Instructions */}
        <div className="py-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Special Instructions</label>
          <Textarea
            placeholder="e.g. Less spicy, extra napkins, serve warm..."
            value={specialNotes}
            onChange={e => setSpecialNotes(e.target.value)}
            className="bg-background border-border text-foreground text-sm placeholder:text-muted-foreground rounded-xl focus:ring-2"
            rows={2}
          />
        </div>

        {/* LIVE PRICE BREAKDOWN CARD (Fully Synced with Theme System) */}
        <div 
          className="my-4 p-4 rounded-2xl border bg-muted/40 text-foreground transition-all space-y-2.5 shadow-sm"
          style={{
            borderColor: `${themeColor}30`,
            boxShadow: `0 4px 16px ${themeColor}08`
          }}
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
              <ReceiptText className="w-4 h-4" style={{ color: themeColor }} />
              Live Pricing Breakdown
            </div>
            <span 
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: `${themeColor}12`,
                color: themeColor,
                borderColor: `${themeColor}30`
              }}
            >
              Real-time Summary
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            {/* Starting Price Row */}
            <div className="flex justify-between text-muted-foreground">
              <span>Starting Base Price</span>
              <span className="font-semibold text-foreground">{formatCurrency(startingPrice)}</span>
            </div>

            {/* Variant Upgrade Row */}
            {selectedVariant ? (
              <div className="flex justify-between font-semibold" style={{ color: themeColor }}>
                <span>Variant ({selectedVariant.name})</span>
                <span>{variantUpgradeDelta > 0 ? `+${formatCurrency(variantUpgradeDelta)}` : 'Included'}</span>
              </div>
            ) : product.variants && product.variants.length > 0 ? (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 italic">
                <span>Variant Selection</span>
                <span>Not Selected</span>
              </div>
            ) : null}

            {/* Modifiers List Breakdown */}
            {selectedModifiers.map((mod, idx) => (
              <div key={idx} className="flex justify-between text-foreground font-medium">
                <span>{mod.group_name}: {mod.option_name || mod.text_value}</span>
                <span style={{ color: themeColor }}>
                  {mod.price_delta > 0 ? `+${formatCurrency(mod.price_delta * mod.quantity)}` : 'Free'}
                </span>
              </div>
            ))}

            {/* Price Per Unit Subtotal */}
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-extrabold text-sm text-foreground">
              <span>Price Per Unit</span>
              <span style={{ color: themeColor }}>{formatCurrency(unitPrice)}</span>
            </div>

            {/* Quantity Multiplier */}
            {quantity > 1 && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Quantity Multiplier</span>
                <span className="font-bold text-foreground">× {quantity}</span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div 
            className="border-t border-border pt-2.5 flex items-center justify-between font-black text-lg"
          >
            <span className="uppercase text-xs tracking-widest text-muted-foreground font-extrabold">Grand Total</span>
            <span className="font-mono text-xl font-black" style={{ color: themeColor }}>
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>

        {/* Validation Errors */}
        {!validationResult.isValid && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>{validationResult.errors[0]}</div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="border-t border-border pt-4 flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-3 bg-muted p-1.5 rounded-xl border border-border">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-foreground hover:bg-background rounded-lg"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="font-mono font-bold text-foreground px-2">{quantity}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-foreground hover:bg-background rounded-lg"
              onClick={() => setQuantity(q => q + 1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!validationResult.isValid}
            className="text-white font-extrabold px-7 py-5 rounded-xl shadow-lg transition-all disabled:opacity-50"
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 8px 20px -4px ${themeColor}40`
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Add to Cart • {formatCurrency(grandTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
