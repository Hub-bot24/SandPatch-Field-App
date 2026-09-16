import { loadDrawableImage } from "./compressImage";

export interface PixelRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Crops one rectangular region out of a photo at full resolution, padded
 * by `paddingFraction` of the region's own size on every side. A tight
 * word-sized bounding box (see lib/measurement/ocrRuler.ts's
 * CandidateRegion) rarely has enough surrounding context for a reader that
 * expects a modest margin around the text, and rulers print digits close
 * enough together that a couple of neighbouring digits inside the padding
 * are still fine - the caller re-parses whatever number ends up in the
 * result rather than assuming it holds exactly one original candidate.
 */
export async function cropRegionToCanvas(
  photo: Blob,
  region: PixelRegion,
  paddingFraction: number,
): Promise<HTMLCanvasElement> {
  const source = await loadDrawableImage(photo);
  try {
    const width = region.x1 - region.x0;
    const height = region.y1 - region.y0;
    const padX = width * paddingFraction;
    const padY = height * paddingFraction;

    const left = Math.max(0, Math.floor(region.x0 - padX));
    const top = Math.max(0, Math.floor(region.y0 - padY));
    const right = Math.min(source.width, Math.ceil(region.x1 + padX));
    const bottom = Math.min(source.height, Math.ceil(region.y1 + padY));
    const cropWidth = Math.max(1, right - left);
    const cropHeight = Math.max(1, bottom - top);

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }
    ctx.drawImage(source.image, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return canvas;
  } finally {
    if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
      source.image.close();
    }
  }
}
