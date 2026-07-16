import { useState, useRef, useCallback, memo } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { imageService } from '@/services/image.service';
import { ImageCropDialog } from './ImageCropDialog';
import { MenuItemImage } from './MenuItemImage';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  restaurantId?: string;
  categoryName?: string;
  sku?: string;
  itemId?: string;
  itemName?: string;
  className?: string;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
}

export const ImageUpload = memo(function ImageUpload({
  value,
  onChange,
  restaurantId,
  categoryName = 'uncategorized',
  sku,
  itemId,
  itemName = 'Menu Item',
  className,
  accept = 'image/jpeg,image/png,image/webp',
  maxSizeMB = 10,
  label = 'Upload image',
}: ImageUploadProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  
  // Crop Dialog states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const isOwner = user?.role?.name === 'Owner';

  const getCategorySlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!restaurantId) {
      toast({ title: 'Upload error', description: 'Restaurant ID is required.', variant: 'destructive' });
      return;
    }

    // 1. Validation via Service
    const sizeVal = imageService.validateImage(file, maxSizeMB);
    if (!sizeVal.isValid) {
      toast({ title: 'Invalid file', description: sizeVal.error, variant: 'destructive' });
      return;
    }

    setUploadStage('Preparing Image...');
    try {
      // 2. Resolution Validation via Service
      const resVal = await imageService.validateResolution(file, 500);
      if (!resVal.isValid) {
        toast({ title: 'Invalid resolution', description: resVal.error, variant: 'destructive' });
        return;
      }

      // 3. Open Crop Dialog
      setSelectedFile(file);
      setIsCropOpen(true);
    } catch (err: any) {
      toast({ title: 'Error processing file', description: err.message, variant: 'destructive' });
    } finally {
      setUploadStage(null);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!restaurantId || !user) return;
    setUploadStage('Uploading...');
    
    try {
      const categorySlug = getCategorySlug(categoryName);
      
      // Perform upload sequence (Safe sequence: upload new -> db update -> delete old)
      const newUrl = await imageService.uploadMenuItemImage({
        restaurantId,
        categorySlug,
        sku: sku || '',
        itemId: itemId || '',
        itemName,
        blob: croppedBlob,
        oldUrl: value || null,
        userId: user.id,
        userName: user.full_name,
        reason: 'Replacement Upload',
      });

      onChange(newUrl);
      toast({ title: 'Success', description: 'Menu image updated successfully.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Upload failed', description: err.message || 'Error occurred.', variant: 'destructive' });
    } finally {
      setUploadStage(null);
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isOwner) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemove = async () => {
    if (!isOwner || !user) return;
    const confirmDelete = window.confirm(`Are you sure you want to remove the image for "${itemName}"?`);
    if (!confirmDelete) return;

    setUploadStage('Updating Database...');
    try {
      if (value && itemId) {
        await imageService.deleteMenuItemImage({
          restaurantId: restaurantId || user.restaurant_id,
          itemId,
          itemName,
          oldUrl: value,
          userId: user.id,
          userName: user.full_name,
        });
      }

      onChange(null);
      toast({ title: 'Image removed', description: 'Menu item image has been removed.' });
    } catch (err: any) {
      toast({ title: 'Error removing image', description: err.message, variant: 'destructive' });
    } finally {
      setUploadStage(null);
    }
  };

  // If NOT owner, render read-only image preview with no action buttons
  if (!isOwner) {
    return (
      <div className={cn('relative w-full aspect-square max-w-[200px] mx-auto', className)}>
        <MenuItemImage src={value} alt={itemName} className="rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {value ? (
        <div className="relative w-full max-w-[240px] mx-auto aspect-square rounded-xl overflow-hidden border border-border shadow-sm group">
          <MenuItemImage src={value} alt="Upload preview" className="w-full h-full" />
          
          {uploadStage ? (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#0AB190]" />
              <span>{uploadStage}</span>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                className="text-xs h-8 bg-white/90 text-slate-800 hover:bg-white"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                className="text-xs h-8"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative w-full max-w-[240px] mx-auto aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3',
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border bg-slate-50 dark:bg-slate-900 hover:border-primary/50 hover:bg-slate-100/50'
          )}
        >
          {uploadStage ? (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-bold">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span>{uploadStage}</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center px-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Drag & drop or click • max {maxSizeMB}MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Image Crop Dialog Modal */}
      <ImageCropDialog
        open={isCropOpen}
        onOpenChange={setIsCropOpen}
        file={selectedFile}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
});
