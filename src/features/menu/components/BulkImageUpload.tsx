import { useState, useRef, useCallback, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMenuStore } from '@/stores/menu.store';
import { useAuthStore } from '@/stores/auth.store';
import { imageService } from '@/services/image.service';
import { Upload, X, CheckCircle, AlertTriangle, Play, RefreshCw, FileImage, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/utils/cn';

interface BulkUploadItem {
  id: string; // File name or random uuid
  file: File;
  itemName: string;
  matchedItemId: string | null;
  matchType: 'sku' | 'barcode' | 'name' | 'name-case' | 'none';
  sku: string | null;
  categorySlug: string;
  status: 'pending' | 'processing' | 'uploaded' | 'failed' | 'no-match' | 'duplicate';
  error?: string;
}

interface BulkImageUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess: () => void;
}

export const BulkImageUpload = memo(function BulkImageUpload({
  open,
  onOpenChange,
  onUploadSuccess,
}: BulkImageUploadProps) {
  const { user } = useAuthStore();
  const { items: menuItems, categories } = useMenuStore();
  const { toast } = useToast();

  const [filesList, setFilesList] = useState<BulkUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCategorySlug = useCallback((categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return 'uncategorized';
    return cat.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, [categories]);

  const matchFileToItem = useCallback((filename: string) => {
    const cleanName = filename.split('.')[0]?.trim() || '';
    if (!cleanName) return null;

    // 1. Match SKU (case-sensitive)
    let matched = menuItems.find(item => item.sku === cleanName);
    if (matched) return { item: matched, type: 'sku' as const };

    // 2. Match Barcode
    matched = menuItems.find(item => item.barcode === cleanName);
    if (matched) return { item: matched, type: 'barcode' as const };

    // 3. Match Exact Name
    matched = menuItems.find(item => item.name === cleanName);
    if (matched) return { item: matched, type: 'name' as const };

    // 4. Match Case-insensitive Name
    matched = menuItems.find(item => item.name.toLowerCase() === cleanName.toLowerCase());
    if (matched) return { item: matched, type: 'name-case' as const };

    return null;
  }, [menuItems]);

  const handleFiles = useCallback((files: FileList) => {
    const newItems: BulkUploadItem[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) return;

      const filename = file.name;
      const match = matchFileToItem(filename);

      if (match) {
        newItems.push({
          id: Math.random().toString(36).substring(7),
          file,
          itemName: match.item.name,
          matchedItemId: match.item.id,
          matchType: match.type,
          sku: match.item.sku,
          categorySlug: getCategorySlug(match.item.category_id),
          status: 'pending',
        });
      } else {
        newItems.push({
          id: Math.random().toString(36).substring(7),
          file,
          itemName: filename.split('.')[0] || 'Unknown',
          matchedItemId: null,
          matchType: 'none',
          sku: null,
          categorySlug: 'uncategorized',
          status: 'no-match',
        });
      }
    });

    setFilesList((prev) => [...prev, ...newItems]);
  }, [matchFileToItem, getCategorySlug]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleStartUpload = async () => {
    if (!user?.restaurant_id) return;
    setIsUploading(true);

    // Process matching items sequentially to keep connection and memory stable
    const itemsToProcess = filesList.filter(item => item.status === 'pending' || item.status === 'failed');

    for (const uploadItem of itemsToProcess) {
      if (!uploadItem.matchedItemId) continue;

      setFilesList(prev =>
        prev.map(i => (i.id === uploadItem.id ? { ...i, status: 'processing' } : i))
      );

      try {
        // 1. Load image and auto-correct/center crop to square 1024x1024 WebP
        const cropOptions = { x: 0, y: 0, zoom: 1, rotate: 0 };
        const blob = await imageService.cropAndCompress(uploadItem.file, cropOptions);

        // 2. Safe Replace Sequence via Service
        // Fetch current item to see if it has an old url
        const currentItem = menuItems.find(i => i.id === uploadItem.matchedItemId);
        const oldUrl = currentItem?.image_url || null;

        await imageService.uploadMenuItemImage({
          restaurantId: user.restaurant_id,
          categorySlug: uploadItem.categorySlug,
          sku: uploadItem.sku || '',
          itemId: uploadItem.matchedItemId,
          itemName: uploadItem.itemName,
          blob,
          oldUrl,
          userId: user.id,
          userName: user.full_name,
          reason: 'Bulk Upload',
        });

        setFilesList(prev =>
          prev.map(i => (i.id === uploadItem.id ? { ...i, status: 'uploaded' } : i))
        );
      } catch (err: any) {
        setFilesList(prev =>
          prev.map(i => (i.id === uploadItem.id ? { ...i, status: 'failed', error: err.message || 'Failed to upload' } : i))
        );
      }
    }

    setIsUploading(false);
    onUploadSuccess();
    toast({ title: 'Bulk upload process finished' });
  };

  const handleRemoveItem = (id: string) => {
    setFilesList(prev => prev.filter(i => i.id !== id));
  };

  const handleRetryFailed = async () => {
    setFilesList(prev =>
      prev.map(i => (i.status === 'failed' ? { ...i, status: 'pending' } : i))
    );
    setTimeout(handleStartUpload, 100);
  };

  // Summarize stats
  const stats = filesList.reduce(
    (acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    },
    { pending: 0, processing: 0, uploaded: 0, failed: 0, 'no-match': 0, duplicate: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full rounded-2xl p-6 bg-card border border-border shadow-xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-slate-800 dark:text-slate-100">Bulk Upload Menu Images</DialogTitle>
        </DialogHeader>

        {/* Drop Zone */}
        {filesList.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 text-center cursor-pointer transition-all duration-200 aspect-video my-4',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border bg-slate-50 dark:bg-slate-900/30 hover:border-primary/50'
            )}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Drag and drop images or select folder</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm">
              Filenames should match item SKU, Barcode, or exact Name (e.g. STR-001.jpg, French Fries.png)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4 my-4">
            {/* Stats Summary Widget */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center text-xs font-bold">
              <div className="text-slate-600 dark:text-slate-400">
                <span className="block text-lg text-primary">{stats.uploaded}</span> Uploaded
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                <span className="block text-lg text-blue-500">{stats.pending + stats.processing}</span> Queued
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                <span className="block text-lg text-rose-500">{stats.failed}</span> Failed
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                <span className="block text-lg text-amber-500">{stats['no-match']}</span> No Match
              </div>
            </div>

            {/* Files List Table/List */}
            <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border pr-1">
              {filesList.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 text-xs gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileImage className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.file.name}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.matchedItemId ? `Matched: ${item.itemName} (${item.matchType.toUpperCase()})` : 'No matching item found'}
                      </p>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {item.status === 'uploaded' && <span className="text-emerald-600 flex items-center gap-1 font-bold"><CheckCircle className="w-3.5 h-3.5" /> Done</span>}
                    {item.status === 'failed' && <span className="text-rose-500 flex items-center gap-1 font-bold"><AlertTriangle className="w-3.5 h-3.5" /> Failed</span>}
                    {item.status === 'no-match' && <span className="text-amber-500 font-bold">Unmatched</span>}
                    {item.status === 'pending' && <span className="text-slate-400">Waiting</span>}

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isUploading}
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-7 h-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilesList([])}
            disabled={isUploading || filesList.length === 0}
            className="text-xs h-9 border-slate-200"
          >
            Clear All
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="text-xs h-9"
            >
              Close
            </Button>
            {stats.failed > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRetryFailed}
                disabled={isUploading}
                className="text-xs h-9"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Retry Failed
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleStartUpload}
              disabled={isUploading || filesList.length === 0 || !filesList.some(i => i.status === 'pending')}
              className="text-xs h-9 bg-primary text-white font-bold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Upload Matches
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
