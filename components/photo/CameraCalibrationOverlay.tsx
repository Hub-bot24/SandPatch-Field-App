"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { NumericField } from "@/components/ui/NumericField";
import type { TapPoint } from "@/lib/measurement/tapMeasure";
import { readRulerScale } from "@/lib/measurement/ocrRuler";
import type { RulerReadResult } from "@/lib/measurement/readRuler";

interface CameraCalibrationOverlayProps {
  photoUrl: string;
  /** Default real-world distance, in mm, between the two points the operator will tap if automatic reading doesn't find the ruler - editable on screen, since a photo often shows only part of the ruler rather than both physical ends. */
  rulerLengthMm: number;
  onConfirm: (pixelsPerMm: number) => void;
  onCancel: () => void;
}

const ZOOM_LEVELS = [100, 150, 200, 300];
const MIN_CALIBRATION_PIXELS = 4;

type Stage = "reading" | "auto-detected" | "manual";

/**
 * One-time camera calibration. First tries to read the ruler's own
 * printed numbers automatically (lib/measurement/ocrRuler.ts) - zero taps
 * at all if that finds a confident, self-consistent reading. If it
 * doesn't (poor lighting, an unusual ruler, blur), this falls back to the
 * operator tapping two points a known distance apart - anywhere on the
 * ruler, not necessarily its two physical ends, since a real photo often
 * only shows part of it. Either way, the resulting pixels-per-mm ratio is
 * reused for every future automatic reading
 * (lib/measurement/autoDetect.ts): a photo alone can never carry an
 * absolute scale on its own, so this one-time reference is unavoidable.
 */
export function CameraCalibrationOverlay({
  photoUrl,
  rulerLengthMm,
  onConfirm,
  onCancel,
}: CameraCalibrationOverlayProps) {
  const [stage, setStage] = useState<Stage>("reading");
  const [autoResult, setAutoResult] = useState<RulerReadResult | null>(null);

  const [taps, setTaps] = useState<TapPoint[]>([]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [spanRaw, setSpanRaw] = useState(String(rulerLengthMm));
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // photoUrl is set once per mount (the caller always renders a fresh
    // instance for a new photo rather than swapping this prop in place),
    // so the initial "reading"/null state already covers this effect's
    // first run - it only ever needs to report back an eventual result.
    let cancelled = false;

    (async () => {
      try {
        const photoBlob = await fetch(photoUrl).then((r) => r.blob());
        const result = await readRulerScale(photoBlob);
        if (cancelled) return;
        if (result) {
          setAutoResult(result);
          setStage("auto-detected");
        } else {
          setStage("manual");
        }
      } catch {
        if (!cancelled) setStage("manual");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  const zoomPercent = ZOOM_LEVELS[zoomIndex];
  const isComplete = taps.length === 2;
  const spanMm = Number(spanRaw) || 0;

  const calibrationPixelLength = isComplete ? Math.hypot(taps[1].x - taps[0].x, taps[1].y - taps[0].y) : 0;
  const isDegenerate = isComplete && calibrationPixelLength < MIN_CALIBRATION_PIXELS;
  const manualPixelsPerMm = isComplete && spanMm > 0 ? calibrationPixelLength / spanMm : null;

  function handleImageTap(event: MouseEvent<HTMLImageElement>) {
    if (stage !== "manual" || isComplete || !naturalSize) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point: TapPoint = {
      x: ((event.clientX - rect.left) / rect.width) * naturalSize.width,
      y: ((event.clientY - rect.top) / rect.height) * naturalSize.height,
    };
    setTaps((prev) => [...prev, point]);
  }

  function handleManualConfirm() {
    if (manualPixelsPerMm && !isDegenerate) {
      onConfirm(manualPixelsPerMm);
    }
  }

  const width = naturalSize?.width ?? 1;
  const height = naturalSize?.height ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 bg-black/80 px-4 py-3 text-white">
        <span className="text-sm font-semibold">Calibrate Camera</span>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-semibold text-white/80">
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-neutral-900" style={{ touchAction: "pan-x pan-y" }}>
        <div className="relative inline-block align-top" style={{ width: `${zoomPercent}%`, minWidth: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL for an in-progress capture, not a static asset */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Ruler - tap to calibrate"
            className="block w-full select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
            }}
            onClick={handleImageTap}
          />
          {stage === "manual" && !naturalSize && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Loading photo…
            </p>
          )}
          {stage === "manual" && naturalSize && taps.length >= 1 && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${width} ${height}`}
            >
              {taps.length === 2 && (
                <line x1={taps[0].x} y1={taps[0].y} x2={taps[1].x} y2={taps[1].y} stroke="#2563eb" strokeWidth={Math.max(2, width / 300)} />
              )}
            </svg>
          )}
          {stage === "manual" &&
            naturalSize &&
            taps.map((tap, i) => (
              <div
                key={i}
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand text-xs font-bold text-white shadow"
                style={{ left: `${(tap.x / width) * 100}%`, top: `${(tap.y / height) * 100}%` }}
              >
                {i === 0 ? "1" : "2"}
              </div>
            ))}
          {stage === "reading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="rounded-xl bg-black/70 px-4 py-3 text-center text-sm font-semibold text-white">
                Reading your ruler…
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 bg-black/90 px-4 py-4 text-white">
        {stage === "reading" && (
          <p className="text-center text-sm text-white/70">This takes a few seconds - no taps needed.</p>
        )}

        {stage === "auto-detected" && autoResult && (
          <>
            <p className="text-center text-2xl font-bold text-good">Ruler read automatically ✓</p>
            <p className="text-center text-sm text-white/70">
              {autoResult.pixelsPerMm.toFixed(2)} px/mm, from {autoResult.supportingPairs} matching numbers on the
              ruler.
            </p>
            <Button fullWidth onClick={() => onConfirm(autoResult.pixelsPerMm)}>
              Save Calibration
            </Button>
            <Button
              variant="ghost"
              fullWidth
              className="text-white"
              onClick={() => {
                setStage("manual");
                setTaps([]);
              }}
            >
              That&rsquo;s wrong - enter manually instead
            </Button>
          </>
        )}

        {stage === "manual" && (
          <>
            {autoResult === null && (
              <p className="text-center text-xs text-white/60">
                Couldn&rsquo;t read the ruler&rsquo;s numbers automatically - tap two points on it instead.
              </p>
            )}
            {!isComplete ? (
              <p className="text-center text-base font-semibold">
                {taps.length === 0
                  ? "Tap any clearly marked point on your ruler"
                  : "Now tap another point a known distance from the first"}
              </p>
            ) : isDegenerate ? (
              <p className="text-center text-sm font-semibold text-poor">
                Those two taps are too close together to calibrate from. Undo and try again.
              </p>
            ) : (
              <p className="text-center text-2xl font-bold text-good">Looks good</p>
            )}

            {isComplete && !isDegenerate && (
              <div>
                <NumericField
                  label="Real distance between your two taps"
                  value={spanRaw}
                  onChange={setSpanRaw}
                  unit="mm"
                />
                <p className="mt-1 text-xs text-white/70">
                  Doesn&rsquo;t have to be the whole ruler - e.g. if you tapped the 150mm and 230mm marks, enter
                  80.
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                disabled={zoomIndex === 0}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/30 text-lg font-bold text-white disabled:opacity-30"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="w-12 text-center text-sm text-white/80">{zoomPercent}%</span>
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/30 text-lg font-bold text-white disabled:opacity-30"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>

            <Button
              variant="secondary"
              fullWidth
              className="border-white/30 bg-white/10 text-white"
              onClick={() => setTaps((prev) => prev.slice(0, -1))}
              disabled={taps.length === 0}
            >
              Undo
            </Button>

            <Button fullWidth onClick={handleManualConfirm} disabled={!manualPixelsPerMm || isDegenerate}>
              Save Calibration
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
