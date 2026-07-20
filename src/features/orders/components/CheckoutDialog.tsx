import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Banknote, QrCode, CreditCard, Wallet, Gift } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onComplete: (paymentMethod: string, paidAmount: number, isPartial: boolean, splitDetails?: any) => void;
  onPrintPreview?: () => void;
}

export function CheckoutDialog({ open, onOpenChange, total, onComplete, onPrintPreview }: CheckoutDialogProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'split'>('single');
  const [singleMethod, setSingleMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Wallet' | 'Gift Card'>('Cash');
  
  // Single payment details
  const [singleAmountPaid, setSingleAmountPaid] = useState(total);
  const [isPartialPayment, setIsPartialPayment] = useState(false);

  // Split payment details
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);
  const [splitWallet, setSplitWallet] = useState<number>(0);
  const [splitGift, setSplitGift] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setSingleAmountPaid(total);
      setIsPartialPayment(false);
      setSplitCash(0);
      setSplitUpi(0);
      setSplitCard(0);
      setSplitWallet(0);
      setSplitGift(0);
    }
  }, [open, total]);

  const splitTotal = Number(splitCash) + Number(splitUpi) + Number(splitCard) + Number(splitWallet) + Number(splitGift);
  const splitRemaining = total - splitTotal;

  const handleSinglePayment = () => {
    const isPartial = isPartialPayment && singleAmountPaid < total;
    onComplete(singleMethod, singleAmountPaid, isPartial, null);
  };

  const handleSplitPayment = () => {
    const splitDetails = {
      Cash: Number(splitCash),
      UPI: Number(splitUpi),
      Card: Number(splitCard),
      Wallet: Number(splitWallet),
      'Gift Card': Number(splitGift),
    };
    
    const methodsPaid = Object.entries(splitDetails)
      .filter(([_, amt]) => amt > 0)
      .map(([m]) => m);

    const methodLabel = methodsPaid.join(' + ') || 'Split';
    const isPartial = splitRemaining > 0.01;

    onComplete(methodLabel, splitTotal, isPartial, splitDetails);
  };

  const setSplitMax = (method: 'Cash' | 'UPI' | 'Card' | 'Wallet' | 'Gift Card') => {
    const remaining = total - (
      (method === 'Cash' ? 0 : Number(splitCash)) +
      (method === 'UPI' ? 0 : Number(splitUpi)) +
      (method === 'Card' ? 0 : Number(splitCard)) +
      (method === 'Wallet' ? 0 : Number(splitWallet)) +
      (method === 'Gift Card' ? 0 : Number(splitGift))
    );
    
    const cleanRemaining = Math.max(0, Number(remaining.toFixed(2)));

    if (method === 'Cash') setSplitCash(cleanRemaining);
    if (method === 'UPI') setSplitUpi(cleanRemaining);
    if (method === 'Card') setSplitCard(cleanRemaining);
    if (method === 'Wallet') setSplitWallet(cleanRemaining);
    if (method === 'Gift Card') setSplitGift(cleanRemaining);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Generate Invoice & Payment</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Invoice Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Amount Due</p>
              <h3 className="text-3xl font-extrabold text-primary mt-1">{formatCurrency(total)}</h3>
            </div>
            {activeTab === 'split' && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Remaining Balance</p>
                <h4 className={`text-xl font-bold mt-1 ${splitRemaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(splitRemaining)}
                </h4>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="single" className="font-semibold">Single Payment</TabsTrigger>
              <TabsTrigger value="split" className="font-semibold">Split Payment</TabsTrigger>
            </TabsList>

            {/* Single Payment Method */}
            <TabsContent value="single" className="space-y-6 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSingleMethod('Cash')}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-xl font-semibold transition-all duration-200 ${
                    singleMethod === 'Cash'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Banknote className="w-6 h-6" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('UPI')}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-xl font-semibold transition-all duration-200 ${
                    singleMethod === 'UPI'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <QrCode className="w-6 h-6" />
                  <span>UPI Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('Card')}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-xl font-semibold transition-all duration-200 ${
                    singleMethod === 'Card'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span>Card / Debit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('Wallet')}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-xl font-semibold transition-all duration-200 ${
                    singleMethod === 'Wallet'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Wallet className="w-6 h-6" />
                  <span>Digital Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('Gift Card')}
                  className={`flex flex-col items-center gap-2 p-3 border rounded-xl font-semibold transition-all duration-200 col-span-2 ${
                    singleMethod === 'Gift Card'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Gift className="w-6 h-6" />
                  <span>Gift Card</span>
                </button>
              </div>

              {/* Partial Payment Toggle & Input */}
              <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="partial" className="font-bold text-sm text-foreground">Partial Payment</Label>
                    <p className="text-xs text-muted-foreground">Accept payment amount less than total</p>
                  </div>
                  <input
                    type="checkbox"
                    id="partial"
                    checked={isPartialPayment}
                    onChange={(e) => {
                      setIsPartialPayment(e.target.checked);
                      if (!e.target.checked) setSingleAmountPaid(total);
                    }}
                    className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                  />
                </div>

                {isPartialPayment && (
                  <div className="pt-2 space-y-2">
                    <Label htmlFor="amountPaid" className="text-xs font-bold text-muted-foreground uppercase">Amount Tendered</Label>
                    <Input
                      id="amountPaid"
                      type="number"
                      max={total}
                      min={1}
                      step="any"
                      value={singleAmountPaid}
                      onChange={(e) => setSingleAmountPaid(Math.min(total, Number(e.target.value)))}
                      className="text-lg font-bold"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Split Payment Method */}
            <TabsContent value="split" className="space-y-4 mt-0">
              <div className="space-y-3">
                {/* Cash Split Row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-slate-500" /> Cash Amount
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={splitCash || ''}
                        onChange={(e) => setSplitCash(Number(e.target.value))}
                        className="font-bold pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setSplitMax('Cash')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>

                {/* UPI Split Row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-slate-500" /> UPI Amount
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={splitUpi || ''}
                        onChange={(e) => setSplitUpi(Number(e.target.value))}
                        className="font-bold pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setSplitMax('UPI')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Split Row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Card Amount
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={splitCard || ''}
                        onChange={(e) => setSplitCard(Number(e.target.value))}
                        className="font-bold pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setSplitMax('Card')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>

                {/* Wallet Split Row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-500" /> Wallet Amount
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={splitWallet || ''}
                        onChange={(e) => setSplitWallet(Number(e.target.value))}
                        className="font-bold pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setSplitMax('Wallet')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gift Card Split Row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-slate-500" /> Gift Card Amount
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={splitGift || ''}
                        onChange={(e) => setSplitGift(Number(e.target.value))}
                        className="font-bold pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setSplitMax('Gift Card')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full border-t pt-4 sm:space-x-0">
          <div className="flex gap-2 w-full sm:w-auto justify-start">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto font-bold"
            >
              Cancel
            </Button>
            {onPrintPreview && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onPrintPreview}
                className="w-full sm:w-auto font-bold"
              >
                Print Preview
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto font-bold"
            >
              Back
            </Button>
            
            {activeTab === 'single' ? (
              <Button
                type="button"
                className="w-full sm:w-auto bg-[#0AB190] hover:bg-[#057B62] text-white font-extrabold"
                disabled={isPartialPayment && (singleAmountPaid <= 0 || singleAmountPaid > total)}
                onClick={handleSinglePayment}
              >
                Confirm Payment
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full sm:w-auto bg-[#0AB190] hover:bg-[#057B62] text-white font-extrabold"
                disabled={splitTotal <= 0 || splitTotal > total + 0.01}
                onClick={handleSplitPayment}
              >
                Confirm Split Payment
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
