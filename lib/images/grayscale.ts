import { loadDrawableImage, scaleDimensions } from "./compressImage";
import type { GrayscaleImage } from "@/lib/measurement/autoDetect";

// The line-based scan in lib/measurement/autoDetect.ts only ever reads a
// thin horizontal band, not the whole frame, so it's already cheap at high
// resolution - this cap exists purely to bound the one-off canvas
// draw/getImageData cost on a large camera photo, not because the
// measurement itself needs fewer pixels.
const DEFAULT_ANALYSIS_DIMENSION = 400;

export interface GrayscaleImageResult {
  image: GrayscaleImage;
  /**
   * How much smaller `image` is than the original photo (analysis width /
   * original width, <= 1). Edge positions detectPatchEdges finds are in
   * this downsampled image's pixel space, but the ruler numbers OCR reads
   * (lib/measurement/ocrRuler.ts) come from the original, full-resolution
   * photo - callers must divide an edge's pixel position by this scale
   * before matching it against those numbers' positions (see
   * lib/measurement/measurePatch.ts), or every match will land on the
   * wrong part of the photo by roughly (original size / analysis size).
   */
  scale: number;
}

/**
 * Decodes a photo Blob into a small grayscale pixel buffer for
 * lib/measurement/autoDetect.ts. Standard luminance weights (ITU-R BT.601)
 * convert RGB to a single intensity per pixel.
 */
export async function blobToGrayscaleImage(
  blob: Blob,
  maxDimension: number = DEFAULT_ANALYSIS_DIMENSION,
): Promise<GrayscaleImageResult> {
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

    return { image: { width, height, data: gray }, scale: width / source.width };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
      source.image.close();
    }
  }
}
