import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight, Play, ShoppingCart, HelpCircle } from 'lucide-react';

interface TableStatusValidationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  errorMessage?: string;
  suggestedAction?: 'checkout' | 'kitchen' | 'resume' | 'cancel' | 'none';
  onActionTriggered?: () => void;
}

export function TableStatusValidationDialog({
  isOpen,
  onOpenChange,
  reason,
  errorMessage,
  suggestedAction = 'none',
  onActionTriggered
}: TableStatusValidationDialogProps) {
  const getActionIcon = () => {
    switch (suggestedAction) {
      case 'checkout':
        return <ShoppingCart className="w-4 h-4 mr-2" />;
      case 'resume':
        return <Play className="w-4 h-4 mr-2" />;
      case 'kitchen':
        return <ArrowRight className="w-4 h-4 mr-2" />;
      default:
        return <HelpCircle className="w-4 h-4 mr-2" />;
    }
  };

  const getActionLabel = () => {
    switch (suggestedAction) {
      case 'checkout':
        return 'Go To Checkout';
      case 'resume':
        return 'Resume Bill';
      case 'kitchen':
        return 'View Kitchen';
      default:
        return 'Proceed';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-800">
            {reason || 'Cannot Update Status'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {errorMessage || 'This action is currently blocked by active orders or status constraints.'}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 sm:space-x-0 w-full pt-4 border-t mt-3">
          {suggestedAction !== 'none' && onActionTriggered && (
            <Button
              variant="default"
              onClick={() => {
                onOpenChange(false);
                onActionTriggered();
              }}
              className="w-full bg-[#0AB190] hover:bg-[#057B62] font-black h-10 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center"
            >
              {getActionIcon()}
              {getActionLabel()}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full font-bold text-xs h-10 rounded-xl border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
