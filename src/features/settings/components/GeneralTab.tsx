import { DiscountLimitsTab } from './DiscountLimitsTab';
import { ReceiptNumberingTab } from './ReceiptNumberingTab';

export function GeneralTab() {
  return (
    <div className="space-y-8 divide-y divide-border">
      <div>
        <ReceiptNumberingTab />
      </div>
      <div className="pt-8">
        <DiscountLimitsTab />
      </div>
    </div>
  );
}
