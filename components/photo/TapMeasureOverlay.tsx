"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { computeTapMeasurement, type TapPoint } from "@/lib/measurement/tapMeasure";

interface TapMeasureOverlayProps {
  photoUrl: string;
  photoLabel: string;
  /** Real-world length, in mm, of the ruler the operator will tap the two ends of - see Job Setup. */
  calibrationLengthMm: number;
  onConfirm: (diameterMm: number) => void;
  onCancel: () => void;
}

const ZOOM_LEVELS = [100, 150, 200, 300];

const MARKER_LABELS = ["R1", "R2", "E1", "E2"];
const CALIBRATION_COLOR = "#2563eb";
const EDGE_COLOR = "#dc2626";
const MARKER_COLORS = [CALIBRATION_COLOR, CALIBRATION_COLOR, EDGE_COLOR, EDGE_COLOR];

function stepPrompt(step: number, calibrationLengthMm: number): string {
  switch (step) {
    case 0:
      return "Tap one end of your ruler";
    case 1:
      return `Tap the other end of your ruler (${calibrationLengthMm} mm mark)`;
    case 2:
      return "Tap the left edge of the sand patch";
    default:
      return "Tap the right edge of the sand patch";
  }
}

/**
 * Full-screen tap-to-measure: the operator taps two points a known
 * distance apart on a ruler visible in the photo (calibration), then the
 * two sand-patch edges along that same line. Every point is a deliberate
 * human tap - this only does the pixel-distance-to-mm arithmetic
 * (lib/measurement/tapMeasure.ts), it never detects anything itself, so
 * there is no risk of a fabricated reading. The computed value is always
 * shown before it can be confirmed, and "Skip" always falls back to plain
 * manual entry.
 */
export function TapMeasureOverlay({
  photoUrl,
  photoLabel,
  calibrationLengthMm,
  onConfirm,
  onCancel,
}: TapMeasureOverlayProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [taps, setTaps] = useState<TapPoint[]>([]);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const zoomPercent = ZOOM_LEVELS[zoomIndex];
  const isComplete = taps.length === 4;

  const result = useMemo(() => {
    if (!isComplete) return null;
    return computeTapMeasurement({
      calibrationStart: taps[0],
      calibrationEnd: taps[1],
      calibrationLengthMm,
      edgeStart: taps[2],
      edgeEnd: taps[3],
    });
  }, [taps, isComplete, calibrationLengthMm]);

  function handleImageTap(event: MouseEvent<HTMLImageElement>) {
    if (isComplete || !naturalSize) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point: TapPoint = {
      x: ((event.clientX - rect.left) / rect.width) * naturalSize.width,
      y: ((event.clientY - rect.top) / rect.height) * naturalSize.height,
    };
    setTaps((prev) => [...prev, point]);
  }

  function handleConfirm() {
    if (result) {
      onConfirm(Math.round(result.diameterMm * 10) / 10);
    }
  }

  const width = naturalSize?.width ?? 1;
  const height = naturalSize?.height ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 bg-black/80 px-4 py-3 text-white">
        <span className="text-sm font-semibold">{photoLabel}: Tap to Measure</span>
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
            alt={`${photoLabel} - tap to measure`}
            className="block w-full select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
            }}
            onClick={handleImageTap}
          />
          {!naturalSize && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Loading photo…
            </p>
          )}
          {naturalSize && taps.length >= 2 && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${width} ${height}`}
            >
              <line
                x1={taps[0].x}
                y1={taps[0].y}
                x2={taps[1].x}
                y2={taps[1].y}
                stroke={CALIBRATION_COLOR}
                strokeWidth={Math.max(2, width / 300)}
              />
              {taps.length === 4 && (
                <line
                  x1={taps[2].x}
                  y1={taps[2].y}
                  x2={taps[3].x}
                  y2={taps[3].y}
                  stroke={EDGE_COLOR}
                  strokeWidth={Math.max(2, width / 300)}
                />
              )}
            </svg>
          )}
          {naturalSize &&
            taps.map((tap, i) => (
              <div
                key={i}
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow"
                style={{
                  left: `${(tap.x / width) * 100}%`,
                  top: `${(tap.y / height) * 100}%`,
                  backgroundColor: MARKER_COLORS[i],
                }}
              >
                {MARKER_LABELS[i]}
              </div>
            ))}
        </div>
      </div>

      <div className="space-y-3 bg-black/90 px-4 py-4 text-white">
        {!isComplete ? (
          <p className="text-center text-base font-semibold">{stepPrompt(taps.length, calibrationLengthMm)}</p>
        ) : result ? (
          <p className="text-center text-2xl font-bold text-good">{result.diameterMm.toFixed(1)} mm</p>
        ) : (
          <p className="text-center text-sm font-semibold text-poor">
            Those two ruler taps are too close together to calibrate from. Undo and try again.
          </p>
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

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 border-white/30 bg-white/10 text-white"
            onClick={() => setTaps((prev) => prev.slice(0, -1))}
            disabled={taps.length === 0}
          >
            Undo
          </Button>
          <Button
            variant="secondary"
            className="flex-1 border-white/30 bg-white/10 text-white"
            onClick={() => setTaps([])}
            disabled={taps.length === 0}
          >
            Reset
          </Button>
        </div>

        <Button fullWidth onClick={handleConfirm} disabled={!result}>
          {result ? `Use ${result.diameterMm.toFixed(1)} mm` : "Use Measurement"}
        </Button>
      </div>
    </div>
  );
}
