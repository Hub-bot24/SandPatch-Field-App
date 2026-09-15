import { withBasePath } from "@/lib/config";
import { estimatePixelsPerMmFromRulerNumbers, type RulerNumberToken, type RulerReadResult } from "./readRuler";

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

/** Runs OCR over the photo and returns every cleanly-recognized whole number, with its position and confidence - the raw material estimatePixelsPerMmFromRulerNumbers() weighs against itself. */
export async function recognizeRulerNumbers(photo: Blob): Promise<RulerNumberToken[]> {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker(LANG, OEM.LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    gzip: true,
  });

  try {
    const buffer = await photo.arrayBuffer();
    const { data } = await worker.recognize(new Blob([buffer]), {}, { blocks: true });
    const words = collectWords(data.blocks as Parameters<typeof collectWords>[0]);

    const tokens: RulerNumberToken[] = [];
    for (const word of words) {
      const trimmed = word.text.trim();
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
    return tokens;
  } finally {
    await worker.terminate();
  }
}

/** Reads a ruler photo end to end: OCR, then the pairwise-consensus scale estimate. Null means no confident, self-consistent reading was found - the caller should fall back to manual calibration rather than accept a guess. */
export async function readRulerScale(photo: Blob): Promise<RulerReadResult | null> {
  const tokens = await recognizeRulerNumbers(photo);
  return estimatePixelsPerMmFromRulerNumbers(tokens);
}
