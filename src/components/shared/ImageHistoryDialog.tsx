import { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { imageService, ImageVersionLog } from '@/services/image.service';
import { useAuthStore } from '@/stores/auth.store';
import { History, Calendar, User, Trash2, ArrowLeftRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MenuItemImage } from './MenuItemImage';
import { cn } from '@/utils/cn';

interface ImageHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  itemName: string;
  currentUrl: string | null;
  onRestoreSuccess: (newUrl: string | null) => void;
}

export const ImageHistoryDialog = memo(function ImageHistoryDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  currentUrl,
  onRestoreSuccess,
}: ImageHistoryDialogProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [history, setHistory] = useState<ImageVersionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  const isOwner = user?.role?.name === 'Owner';

  const loadHistory = async () => {
    if (!itemId) return;
    setIsLoading(true);
    try {
      const logs = await imageService.getImageHistory(itemId);
      setHistory(logs);
    } catch (err: any) {
      console.error('Failed to load version history:', err);
      toast({ title: 'Error', description: 'Failed to load image history logs.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && itemId) {
      loadHistory();
    }
  }, [open, itemId]);

  const handleRestore = async (log: ImageVersionLog) => {
    if (!itemId || !user) return;
    const confirmRestore = window.confirm('Are you sure you want to restore this image version?');
    if (!confirmRestore) return;

    setIsRestoring(log.id);
    try {
      await imageService.restoreImageVersion({
        itemId,
        restaurantId: user.restaurant_id,
        targetUrl: log.image_url,
        userId: user.id,
        userName: user.full_name,
        itemName,
        oldUrl: currentUrl,
      });

      toast({ title: 'Version restored', description: 'Successfully reverted to the selected image version.' });
      onRestoreSuccess(log.image_url);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Restore failed', description: err.message || 'Could not restore image version.', variant: 'destructive' });
    } finally {
      setIsRestoring(null);
    }
  };

  const handleClearHistory = async () => {
    if (!itemId || !user) return;
    const confirmClear = window.confirm('Are you sure you want to delete all image history logs for this item? This action is permanent.');
    if (!confirmClear) return;

    setIsDeletingHistory(true);
    try {
      await imageService.deleteImageHistory(itemId, user.restaurant_id);
      toast({ title: 'History cleared', description: 'All past version logs for this item have been removed.' });
      setHistory([]);
    } catch (err: any) {
      toast({ title: 'Error clearing history', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeletingHistory(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border shadow-xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <History className="w-5 h-5 text-primary" />
            Image Version History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 pr-1 divide-y divide-border space-y-4">
          <div className="pb-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{itemName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage and restore the last 5 version states.</p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-semibold">Loading history logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 opacity-60" />
              </div>
              <p className="text-xs font-bold">No image history logs found</p>
              <p className="text-[10px] text-muted-foreground max-w-[200px]">Previous edits will appear here once saved.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {history.map((log) => {
                const isActive = currentUrl?.split('?')[0] === log.image_url?.split('?')[0];

                return (
                  <div 
                    key={log.id} 
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-xl border transition-all',
                      isActive 
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-border bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50'
                    )}
                  >
                    {/* Version Preview */}
                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-slate-200/50 bg-slate-100">
                      <MenuItemImage src={log.image_url} alt={itemName} />
                    </div>

                    {/* Meta details */}
                    <div className="flex-1 min-w-0 text-xs space-y-1">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                          {log.reason}
                        </span>
                        {isActive && (
                          <span className="text-[8px] bg-primary text-white font-extrabold uppercase px-1 py-0.5 rounded leading-none">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-semibold">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-semibold">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Restore button */}
                    {!isActive && isOwner && (
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={isRestoring !== null}
                        onClick={() => handleRestore(log)}
                        title="Restore this version"
                        className="w-8 h-8 rounded-lg shrink-0 border-slate-200 hover:border-primary/50 text-slate-600 hover:text-primary"
                      >
                        {isRestoring === log.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t mt-auto">
          {isOwner && history.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeletingHistory}
              onClick={handleClearHistory}
              className="text-xs h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              {isDeletingHistory ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-rose-500" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1" />
              )}
              Delete History
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 bg-slate-800 text-white font-bold ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
