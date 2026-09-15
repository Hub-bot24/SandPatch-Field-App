export interface CompressImageOptions {
  /** Target longest-edge size in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

// Keeps enough resolution for future image measurement (V2) without
// storing unnecessarily huge camera originals (which can be 10-40MP).
const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.82;

/**
 * Compresses a camera photo before it is stored: resizes so the longest
 * edge is ~1600-2000px and re-encodes as JPEG. The original file (often
 * several MB straight off a phone camera) is never persisted.
 */
export async function compressImageFile(
  file: Blob,
  options: CompressImageOptions = {},
): Promise<CompressedImage> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const source = await loadDrawableImage(file);
  try {
    const { width, height } = scaleDimensions(source.width, source.height, maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }
    ctx.drawImage(source.image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) {
      throw new Error("Failed to encode the photo.");
    }
    return { blob, width, height };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
      source.image.close();
    }
  }
}

function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

interface DrawableImage {
  image: CanvasImageSource & { width?: number; height?: number };
  width: number;
  height: number;
}

async function loadDrawableImage(file: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Some browsers fail to decode certain camera formats via
      // createImageBitmap - fall back to an <img> element below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode the photo."));
      el.src = objectUrl;
    });
    return { image: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
