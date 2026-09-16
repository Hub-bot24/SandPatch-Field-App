import { loadDrawableImage } from "./compressImage";

// Boosts a weak red/grey difference to full black-white contrast before
// inverting - tuned against a real ruler photo whose red printed numbers
// were otherwise only a few grey levels darker than its silver background.
const REDNESS_GAIN = 2.2;

/**
 * Produces a version of the photo where "how red" each pixel is becomes
 * its (inverted) brightness - dark ink on a light background, the
 * polarity OCR is tuned for. Standard RGB-to-grayscale conversion (see
 * lib/images/grayscale.ts) keeps each channel's usual luminance weight,
 * which is exactly why it fails on red ink: red's high R and low G/B
 * average out to a mid-grey barely different from a silver ruler's own
 * background, even though the two are obviously different colours to the
 * eye. Confirmed against a real photo whose ruler prints its major
 * numbers in red: standard grayscale OCR found none of them anywhere in
 * the photo, at any confidence; OCR on this transform's output found them
 * cleanly. Isolating redness directly - r minus the average of g and b -
 * keeps that colour difference instead of discarding it.
 *
 * Runs at the photo's full resolution (unlike the downsampled analysis
 * image in grayscale.ts, which only needs to find edges): OCR needs the
 * real pixel detail small print was captured at.
 */
export async function blobToRedIsolatedBlob(blob: Blob): Promise<Blob> {
  const source = await loadDrawableImage(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }
    ctx.drawImage(source.image, 0, 0, source.width, source.height);

    const imageData = ctx.getImageData(0, 0, source.width, source.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const redness = Math.max(0, Math.min(255, r - (g + b) / 2));
      const value = Math.max(0, Math.min(255, 255 - redness * REDNESS_GAIN));
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);

    const outBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!outBlob) {
      throw new Error("Failed to encode the red-isolated photo.");
    }
    return outBlob;
  } finally {
    if (typeof ImageBitmap !== "undefined" && source.image instanceof ImageBitmap) {
      source.image.close();
    }
  }
}
