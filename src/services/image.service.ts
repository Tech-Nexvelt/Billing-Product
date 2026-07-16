import { supabase } from '@/lib/supabase';

export interface ImageCropOptions {
  x: number;      // offset X percentage (-100 to 100)
  y: number;      // offset Y percentage (-100 to 100)
  zoom: number;   // zoom scale (1 to 3)
  rotate: number; // rotation in degrees (0, 90, 180, 270)
}

export interface ImageVersionLog {
  id: string;
  created_at: string;
  user_name: string;
  image_url: string | null;
  reason: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

class ImageService {
  /**
   * Validate image format and maximum size
   */
  validateImage(file: File, maxSizeMB: number = 10): { isValid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { isValid: false, error: 'Only JPEG, PNG and WebP images are allowed.' };
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return { isValid: false, error: `Image size must be smaller than ${maxSizeMB}MB.` };
    }
    return { isValid: true };
  }

  /**
   * Validate image minimum resolution (>= 500x500 px)
   */
  async validateResolution(file: File, minDim: number = 500): Promise<{ isValid: boolean; error?: string }> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = objectUrl;
      });

      if (img.width < minDim || img.height < minDim) {
        return {
          isValid: false,
          error: `Image resolution must be at least ${minDim}x${minDim} pixels. Selected image is ${img.width}x${img.height}px.`
        };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Could not verify image resolution.' };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Center crop, rotate, zoom, resize to 1024x1024, and convert to WebP blob
   */
  async cropAndCompress(file: File, options: ImageCropOptions): Promise<Blob> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Center the origin for rotation
      ctx.translate(512, 512);
      ctx.rotate((options.rotate * Math.PI) / 180);

      // Determine dimensions for square crop
      const minDim = Math.min(img.width, img.height);
      const zoomWidth = minDim / options.zoom;
      const zoomHeight = minDim / options.zoom;

      // Apply crop X/Y panning offsets
      // offset is percentage-based: x/y offsets translate to source image offsets
      const maxOffset = (minDim - zoomWidth) / 2;
      const sx = (img.width - minDim) / 2 + (options.x / 100) * maxOffset;
      const sy = (img.height - minDim) / 2 + (options.y / 100) * maxOffset;

      // Draw onto center of transformed canvas
      ctx.drawImage(
        img,
        Math.max(0, Math.min(img.width - zoomWidth, sx)),
        Math.max(0, Math.min(img.height - zoomHeight, sy)),
        zoomWidth,
        zoomHeight,
        -512,
        -512,
        1024,
        1024
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.82);
      });
      if (!blob) throw new Error('Failed to export canvas to WebP.');
      return blob;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Helper to parse storage path from a Supabase public URL
   */
  getStoragePathFromUrl(url: string): string | null {
    try {
      const storageBase = '/storage/v1/object/public/menu-images/';
      if (url.includes(storageBase)) {
        return url.split(storageBase)[1]?.split('?')[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Safe Replace Sequence:
   * 1. Upload new WebP file.
   * 2. Verify upload succeeded.
   * 3. Update database `image_url` with version.
   * 4. Delete the old file from storage.
   */
  async uploadMenuItemImage(params: {
    restaurantId: string;
    categorySlug: string;
    sku: string;
    itemId: string;
    itemName: string;
    blob: Blob;
    oldUrl: string | null;
    userId: string;
    userName: string;
    reason?: string;
  }): Promise<string> {
    const { restaurantId, categorySlug, sku, itemId, itemName, blob, oldUrl, userId, userName, reason = 'Upload' } = params;

    // 1. Upload new image
    const fileIdentifier = sku || itemId || Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    const filePath = `${restaurantId}/${categorySlug}/${fileIdentifier}_${timestamp}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) throw uploadError;

    // 2. Get public URL and apply cache-buster timestamp
    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(filePath);
    const cacheBustedUrl = `${publicUrl}?v=${timestamp}`;

    // 3. Update database
    const { error: dbError } = await supabase
      .from('menu_items')
      .update({ image_url: cacheBustedUrl, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (dbError) {
      // If DB update fails, attempt to clean up the orphaned newly uploaded file
      await supabase.storage.from('menu-images').remove([filePath]);
      throw dbError;
    }

    // 4. Log the audit entry
    await supabase.from('activity_logs').insert({
      restaurant_id: restaurantId,
      user_id: userId,
      action: oldUrl ? 'REPLACE_IMAGE' : 'UPLOAD_IMAGE',
      resource_type: 'menu_items',
      resource_id: itemId,
      metadata: {
        item_name: itemName,
        prev_image_url: oldUrl || null,
        new_image_url: cacheBustedUrl,
        user_name: userName,
        reason,
      },
    });

    // 5. Only then delete the old file
    if (oldUrl) {
      const oldPath = this.getStoragePathFromUrl(oldUrl);
      if (oldPath) {
        await supabase.storage.from('menu-images').remove([oldPath]);
      }
    }

    return cacheBustedUrl;
  }

  /**
   * Delete Menu Item Image from database and storage
   */
  async deleteMenuItemImage(params: {
    restaurantId: string;
    itemId: string;
    itemName: string;
    oldUrl: string;
    userId: string;
    userName: string;
    reason?: string;
  }): Promise<void> {
    const { restaurantId, itemId, itemName, oldUrl, userId, userName, reason = 'Delete' } = params;

    // 1. Update database first
    const { error: dbError } = await supabase
      .from('menu_items')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (dbError) throw dbError;

    // 2. Log audit entry
    await supabase.from('activity_logs').insert({
      restaurant_id: restaurantId,
      user_id: userId,
      action: 'DELETE_IMAGE',
      resource_type: 'menu_items',
      resource_id: itemId,
      metadata: {
        item_name: itemName,
        prev_image_url: oldUrl,
        new_image_url: null,
        user_name: userName,
        reason,
      },
    });

    // 3. Delete from storage
    const oldPath = this.getStoragePathFromUrl(oldUrl);
    if (oldPath) {
      await supabase.storage.from('menu-images').remove([oldPath]);
    }
  }

  /**
   * Fetch image version history timeline (last 5 entries)
   */
  async getImageHistory(itemId: string): Promise<ImageVersionLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('id, created_at, metadata')
      .eq('resource_type', 'menu_items')
      .eq('resource_id', itemId)
      .in('action', ['UPLOAD_IMAGE', 'REPLACE_IMAGE', 'DELETE_IMAGE'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    if (!data) return [];

    return data.map((log) => ({
      id: log.id,
      created_at: log.created_at,
      user_name: log.metadata?.user_name || 'System',
      image_url: log.metadata?.new_image_url || null,
      reason: log.metadata?.reason || (log.metadata?.new_image_url ? 'Upload Image' : 'Removed Image'),
    }));
  }

  /**
   * Restore previous image version
   */
  async restoreImageVersion(params: {
    itemId: string;
    restaurantId: string;
    targetUrl: string | null;
    userId: string;
    userName: string;
    itemName: string;
    oldUrl: string | null;
  }): Promise<void> {
    const { itemId, restaurantId, targetUrl, userId, userName, itemName, oldUrl } = params;

    // 1. Update database
    const { error: dbError } = await supabase
      .from('menu_items')
      .update({ image_url: targetUrl, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (dbError) throw dbError;

    // 2. Log restoration
    await supabase.from('activity_logs').insert({
      restaurant_id: restaurantId,
      user_id: userId,
      action: 'REPLACE_IMAGE',
      resource_type: 'menu_items',
      resource_id: itemId,
      metadata: {
        item_name: itemName,
        prev_image_url: oldUrl,
        new_image_url: targetUrl,
        user_name: userName,
        reason: `Restored to version from ${new Date().toLocaleDateString()}`,
      },
    });
  }

  /**
   * Clear item version history logs
   */
  async deleteImageHistory(itemId: string, restaurantId: string): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('resource_type', 'menu_items')
      .eq('resource_id', itemId)
      .in('action', ['UPLOAD_IMAGE', 'REPLACE_IMAGE', 'DELETE_IMAGE']);

    if (error) throw error;
  }
}

export const imageService = new ImageService();
