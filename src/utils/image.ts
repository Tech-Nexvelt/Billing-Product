import imageCompression from 'browser-image-compression';

export const IMAGE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_DIMENSION: 2048,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'] as const,
  MEDIUM_WIDTH: 640,
  THUMBNAIL_WIDTH: 200,
} as const;

export type AllowedMimeType = typeof IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES[number];

export interface ProcessedImage {
  original: File;
  medium: Blob;
  thumbnail: Blob;
  hash: string;
  filename: string;
  size: number;
  mimeType: AllowedMimeType;
  width: number;
  height: number;
}

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_EXTENSION' | 'INVALID_MIME' | 'INVALID_HEADER' | 'FILE_TOO_LARGE' | 'INVALID_DIMENSIONS'
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

// Magic bytes for validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
};

async function readMagicBytes(file: File, count: number = 4): Promise<number[]> {
  const buffer = await file.slice(0, count).arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

function checkMagicBytes(bytes: number[], mimeType: string): boolean {
  const patterns = MAGIC_BYTES[mimeType] ?? [];
  return patterns.some(pattern => pattern.every((byte, i) => bytes[i] === byte));
}

function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

async function computeHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function resizeImage(file: File | Blob, maxWidth: number): Promise<Blob> {
  const options = {
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
    fileType: 'image/webp' as const,
    initialQuality: 0.85,
  };
  return imageCompression(file instanceof File ? file : new File([file], 'img.jpg'), options);
}

export async function validateAndProcessImage(
  file: File,
  restaurantId: string
): Promise<ProcessedImage> {
  // 1. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(IMAGE_CONSTRAINTS.ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ImageValidationError(
      `Invalid file extension. Allowed: ${IMAGE_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`,
      'INVALID_EXTENSION'
    );
  }

  // 2. MIME type check
  if (!(IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageValidationError(
      `Invalid file type. Allowed: JPEG, PNG, WebP`,
      'INVALID_MIME'
    );
  }

  // 3. Magic bytes check
  const magicBytes = await readMagicBytes(file);
  if (!checkMagicBytes(magicBytes, file.type)) {
    throw new ImageValidationError(
      'File header does not match declared type. Possibly a malicious file.',
      'INVALID_HEADER'
    );
  }

  // 4. Size check
  if (file.size > IMAGE_CONSTRAINTS.MAX_SIZE_BYTES) {
    throw new ImageValidationError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit.`,
      'FILE_TOO_LARGE'
    );
  }

  // 5. Dimension check
  const { width, height } = await getImageDimensions(file);

  // 6. Compress + downscale if needed
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: IMAGE_CONSTRAINTS.MAX_DIMENSION,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.9,
  });

  // 7. Generate medium and thumbnail
  const medium = await resizeImage(compressed, IMAGE_CONSTRAINTS.MEDIUM_WIDTH);
  const thumbnail = await resizeImage(compressed, IMAGE_CONSTRAINTS.THUMBNAIL_WIDTH);

  // 8. Hash
  const hash = await computeHash(compressed);

  // 9. Unique filename
  const filename = `${restaurantId}/${crypto.randomUUID()}.webp`;

  const compressedFile = new File([compressed], filename, { type: 'image/webp' });

  return {
    original: compressedFile,
    medium,
    thumbnail,
    hash,
    filename,
    size: compressedFile.size,
    mimeType: 'image/webp',
    width,
    height,
  };
}

export function getImageUrl(path: string | null | undefined, fallback = ''): string {
  return path || fallback;
}
