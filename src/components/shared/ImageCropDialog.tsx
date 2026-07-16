import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCw, ZoomIn, RefreshCw } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCropComplete: (blob: Blob) => void;
}

export const ImageCropDialog = memo(function ImageCropDialog({
  open,
  onOpenChange,
  file,
  onCropComplete,
}: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Generate local preview URL
  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Reset transforms
    setZoom(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDragging.current = true;
    dragStart.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    setOffset({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    });
  }, []);

  // Attach global mouseup/move handlers to window for smooth drag tracking
  useEffect(() => {
    if (open) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [open, handleMouseMove, handleMouseUp, handleTouchMove]);

  const handleReset = () => {
    setZoom(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirm = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const cropOptions = {
        x: offset.x,
        y: offset.y,
        zoom,
        rotate,
      };

      const { imageService } = await import('@/services/image.service');
      const blob = await imageService.cropAndCompress(file, cropOptions);
      
      onCropComplete(blob);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to crop image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-card border border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-foreground">Crop Menu Item Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 my-4">
          {/* Crop Container */}
          <div 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="relative w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden cursor-move border border-slate-200/50 dark:border-slate-800 touch-none flex items-center justify-center select-none"
          >
            {/* Aspect Square Cutout Viewport Overlay */}
            <div className="absolute inset-0 border-[24px] border-black/50 pointer-events-none z-10 flex items-center justify-center">
              <div className="w-full h-full border-2 border-dashed border-[#0AB190] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]" />
            </div>

            {/* Target Image to Crop */}
            <img
              src={imageUrl}
              alt="Crop Source"
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${zoom})`,
                transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-full object-contain pointer-events-none transform-gpu"
            />
          </div>

          {/* Adjustments */}
          <div className="space-y-4">
            {/* Zoom Range Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><ZoomIn className="w-3.5 h-3.5 text-primary" /> Zoom</span>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-[#0AB190]"
              />
            </div>

            {/* Rotation Range Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5 text-primary" /> Rotate</span>
                <span>{rotate}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="90"
                value={rotate}
                onChange={(e) => setRotate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-[#0AB190]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t mt-4">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleReset} 
            className="text-xs h-9 border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)} 
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              size="sm" 
              onClick={handleConfirm} 
              disabled={isProcessing} 
              className="text-xs h-9 bg-primary text-white font-bold"
            >
              {isProcessing ? 'Processing...' : 'Crop & Confirm'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
