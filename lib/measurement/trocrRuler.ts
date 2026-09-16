/**
 * A second, more capable text reader for one thing specifically: re-reading
 * small regions the primary reader (lib/measurement/ocrRuler.ts, Tesseract)
 * already located but couldn't confidently transcribe. Tesseract's classic
 * engine was built for scanned documents; TrOCR is a transformer model
 * trained on real, messy photographed text, and is expected to read a much
 * larger share of a ruler's printed numbers correctly - but that has not
 * been verified against a real device in this codebase yet (this
 * environment's own network policy blocks downloading the model to test
 * with), unlike everything else in lib/measurement/, which was checked
 * against real photos before shipping. Treat results from this module with
 * that in mind until it's been run for real.
 *
 * Unlike Tesseract's ~11MB trained-data file (small enough to vendor into
 * public/vendor/ and commit to the repo), this model is too large for that.
 * It is fetched from the Hugging Face Hub the first time it's needed and
 * cached by the browser's own Cache API from then on (transformers.js's
 * default behaviour - see `env.useBrowserCache` in the vendored package) -
 * a larger one-time download in exchange for not needing a server or a
 * per-use cost, mirroring how the app already treats Tesseract's assets,
 * just at a bigger size. It needs a network connection the first time only;
 * every use after that is fully offline, same as the rest of this app.
 */

import { pipeline, RawImage } from "@huggingface/transformers";

// Microsoft's TrOCR checkpoint fine-tuned on *printed* text (as opposed to
// the handwritten variant) - the better match for numbers printed on a
// ruler. Ported to the ONNX format transformers.js runs, following the
// same naming convention as the handwritten variant transformers.js's own
// documentation uses as its OCR example.
const MODEL_ID = "Xenova/trocr-small-printed";

type ImageToTextPipeline = (
  image: RawImage,
) => Promise<{ generated_text: string }[] | { generated_text: string }>;

let readerPromise: Promise<ImageToTextPipeline> | null = null;

/**
 * Loads (or returns the already-loading/loaded) TrOCR pipeline. Kept as a
 * single lazily-created singleton for the app's lifetime, mirroring
 * ocrRuler.ts's one-worker-per-run approach - unlike Tesseract's worker,
 * this one is cheap to keep alive for the whole session rather than
 * recreating per guided-capture run, since there's no per-photo state to
 * reset and reusing it avoids repeating the (potentially large, one-time)
 * model load.
 */
export function getTrocrReader(): Promise<ImageToTextPipeline> {
  if (!readerPromise) {
    readerPromise = pipeline("image-to-text", MODEL_ID) as Promise<ImageToTextPipeline>;
  }
  return readerPromise;
}

/** How many digits a ruler's printed numbers realistically span (see MIN_RULER_VALUE in readRulerAtEdge.ts) - guards against treating a stray generated character as a number. */
const MAX_DIGITS = 4;

/**
 * Extracts a single whole number from the reader's free-form output, if
 * there is one. TrOCR generates text for whatever it thinks a crop shows -
 * this takes the longest digit run in that text (a ruler crop's only
 * expected content) and ignores anything else the model produced, rather
 * than requiring the entire output to be a clean number the way
 * Tesseract's word boxes are. Kept separate from readNumberFromCrop() so
 * this parsing logic can be unit-tested without a real canvas or model.
 */
export function extractNumberFromGeneratedText(generatedText: string | undefined): number | null {
  if (!generatedText) return null;

  const digitRuns = generatedText.match(/\d+/g);
  if (!digitRuns) return null;

  const longest = digitRuns.reduce((best, run) => (run.length > best.length ? run : best));
  if (longest.length > MAX_DIGITS) return null;

  const value = Number(longest);
  return Number.isFinite(value) ? value : null;
}

/** Runs the reader over one already-cropped region and extracts a single whole number from its output, if there is one - see extractNumberFromGeneratedText() for how. */
export async function readNumberFromCrop(
  reader: ImageToTextPipeline,
  canvas: HTMLCanvasElement,
): Promise<number | null> {
  const image = RawImage.fromCanvas(canvas);
  const result = await reader(image);
  const generatedText = Array.isArray(result) ? result[0]?.generated_text : result.generated_text;
  return extractNumberFromGeneratedText(generatedText);
}
