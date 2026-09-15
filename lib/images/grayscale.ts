import { loadDrawableImage, scaleDimensions } from "./compressImage";
import type { GrayscaleImage } from "@/lib/measurement/autoDetect";

// Auto-detection measures a region's pixel *area*, not fine edge detail, so
// analysing at full photo resolution (1600-2000px) buys no real accuracy
// and costs real time - downsampling first keeps every capture fast.
const DEFAULT_ANALYSIS_DIMENSION = 400;

/**
 * Decodes a photo Blob into a small grayscale pixel buffer for
 * lib/measurement/autoDetect.ts. Standard luminance weights (ITU-R BT.601)
 * convert RGB to a single intensity per pixel.
 */
export async function blobToGrayscaleImage(
  blob: Blob,
  maxDimension: number = DEFAULT_ANALYSIS_DIMENSION,
): Promise<GrayscaleImage> {
  const source = await loadDrawableImage(blob);
  try {
    const { width, height } = scaleDimensions(source.width, source.height, maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }
    ctx.drawImage(source.image, 0, 0, width, height);

    const { data: rgba } = ctx.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < gray.length; i++) {
      const offset = i * 4;
      gray[i] = 0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2];
    }

    return { width, height, data: gray };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
      source.image.close();
    }
  }
}
