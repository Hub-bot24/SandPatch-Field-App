import { withBasePath } from "@/lib/config";

// Tesseract.js defaults to fetching its worker script, WASM core, and
// trained data from a CDN at runtime - which would both fail offline (the
// one thing this app cannot compromise on) and fail entirely in a network-
// restricted environment. All three are vendored into public/vendor/
// tesseract/ instead, and never fetched from anywhere else.
const WORKER_PATH = withBasePath("/vendor/tesseract/worker.min.js");
const CORE_PATH = withBasePath("/vendor/tesseract/tesseract-core-lstm.wasm.js");
const LANG_PATH = withBasePath("/vendor/tesseract");

// The full (non-quantized) English trained data reads real ruler markings
// far more reliably than the smaller int8-quantized variant - confirmed by
// testing both against a real ruler photo before choosing which to vendor;
// the quantized model missed most of the actual numbers.
const LANG = "eng";

export interface RulerNumberToken {
  /** The recognized number's real value, e.g. 150 for a "150" mark. */
  value: number;
  /** Bounding-box center, in the source image's pixel coordinates. */
  x: number;
  y: number;
  /** OCR-reported confidence, 0-100. */
  confidence: number;
}

/** A region Tesseract found *something* in - not necessarily text it read correctly, or even correctly as text at all. See recognizeCandidateRegions(). */
export interface CandidateRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type CreateWorkerFn = typeof import("tesseract.js").createWorker;
/** A ready-to-use Tesseract worker, as returned by createRulerOcrWorker(). */
export type RulerOcrWorker = Awaited<ReturnType<CreateWorkerFn>>;

/**
 * Creates one Tesseract worker for reading ruler numbers. Every reading
 * (see lib/measurement/measurePatch.ts) runs on its own photo, but a
 * single guided-capture run reads four photos back to back - the caller
 * creates one worker for that whole run and reuses it via
 * recognizeRulerText() rather than paying worker start-up (loading the
 * ~11MB trained-data file) four times over, then terminates it once the
 * run finishes.
 */
export async function createRulerOcrWorker(): Promise<RulerOcrWorker> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker(LANG, OEM.LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    gzip: true,
  });
  // Tesseract defaults to assuming a page of structured text (paragraphs,
  // columns) - a poor match for a few large, isolated numbers scattered
  // across a photo of sand and asphalt. "Sparse text" mode, built for
  // exactly that shape of input, was confirmed against a real ruler photo
  // to be both dramatically faster (roughly 3x, since it skips trying to
  // find page/column structure that was never there) and more accurate
  // (it found numbers the default mode missed completely).
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function collectWords(blocks: { paragraphs?: { lines?: { words?: OcrWord[] }[] }[] }[] | undefined): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

export interface OcrPass {
  /** Every cleanly-recognized whole number, with its position and confidence - the raw material lib/measurement/readRulerAtEdge.ts reads directly off. */
  tokens: RulerNumberToken[];
  /**
   * Every word-shaped region found, regardless of what Tesseract thought
   * the text was or how confident it was. Feeds
   * lib/measurement/trocrRuler.ts's better (but slower) reader candidate
   * crops to re-read: Tesseract is often right about *where* a ruler
   * number sits even when it misreads what's actually printed there (a
   * "1O0" misread for "100" still lands a bounding box roughly on the
   * real "100"), so its segmentation is worth keeping even when its
   * recognition isn't.
   */
  candidateRegions: CandidateRegion[];
}

/** Runs OCR over the photo once and returns both the cleanly-recognized numbers and every word-shaped region found - one `recognize()` call serves both, since the second is strictly more permissive than the first and can be derived from the same raw word list. */
export async function recognizeRulerText(worker: RulerOcrWorker, photo: Blob): Promise<OcrPass> {
  const buffer = await photo.arrayBuffer();
  const { data } = await worker.recognize(new Blob([buffer]), {}, { blocks: true });
  const words = collectWords(data.blocks as Parameters<typeof collectWords>[0]);

  const tokens: RulerNumberToken[] = [];
  const candidateRegions: CandidateRegion[] = [];
  for (const word of words) {
    const trimmed = word.text.trim();
    if (trimmed.length > 0) {
      candidateRegions.push({ x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 });
    }
    if (!/^\d+$/.test(trimmed)) continue;
    const value = Number(trimmed);
    if (!Number.isFinite(value)) continue;
    tokens.push({
      value,
      x: (word.bbox.x0 + word.bbox.x1) / 2,
      y: (word.bbox.y0 + word.bbox.y1) / 2,
      confidence: word.confidence,
    });
  }
  return { tokens, candidateRegions };
}
