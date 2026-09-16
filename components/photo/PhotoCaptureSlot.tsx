"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconCamera, IconShare, IconTrash } from "@/components/icons";

interface PhotoCaptureSlotProps {
  label: string;
  previewUrl: string | null;
  /** The same photo previewUrl points at, needed to share/save it - a browser can't hand a photo to the OS Photos app from a blob: URL alone. */
  photoBlob: Blob | null;
  onCapture: (file: File) => void;
  onRemove: () => void;
  busy?: boolean;
  error?: string | null;
}

/**
 * One of the four photo slots. Uses a native file input (rather than a
 * custom getUserMedia stream, which is far more reliable across mobile
 * browsers) with no `capture` attribute, so the OS shows its normal
 * "Camera or Photo Library" chooser - a field re-take still just taps
 * Camera, but a photo already on the phone (taken moments ago, sent by a
 * colleague, or needed for a retest) can be picked instead of forcing a
 * fresh shot. An earlier version set `capture="environment"` to jump
 * straight to the camera, which turned out to make already-taken photos
 * unusable for this exact slot - a real field complaint, not a
 * theoretical one.
 */
export function PhotoCaptureSlot({
  label,
  previewUrl,
  photoBlob,
  onCapture,
  onRemove,
  busy = false,
  error,
}: PhotoCaptureSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onCapture(file);
    }
    // Reset so choosing the same file again still fires a change event.
    event.target.value = "";
  }

  /**
   * A captured photo lives only in this app's own IndexedDB storage - the
   * browser never wrote it to the phone's Photos/Gallery app the way a
   * native camera app would, since no website can do that silently (an
   * OS-level restriction, not something fixable here). The Web Share
   * API's file support is the one standards-based way a website can hand
   * a file to the OS at all: this opens the normal share sheet, from
   * which "Save Image"/"Save to Photos" puts it in the gallery like any
   * other shared photo. Requires a user gesture and can't happen
   * silently - reported directly as a real blocker (a photo taken via
   * guided capture had no way out of the app except a full ZIP export).
   */
  async function handleSave() {
    setSaveError(null);
    if (!photoBlob) return;
    try {
      const file = new File([photoBlob], `sand-patch-${label.toLowerCase().replace(/\s+/g, "-")}.jpg`, {
        type: photoBlob.type || "image/jpeg",
      });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        setSaveError("Sharing photos isn't supported in this browser.");
        return;
      }
      await navigator.share({ files: [file] });
    } catch (err) {
      // The user cancelling the share sheet throws an AbortError - not a
      // real failure, so it's the one case that stays silent.
      if (err instanceof Error && err.name === "AbortError") return;
      setSaveError("Couldn't open the share sheet.");
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-ink-muted">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={label}
      />

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-neutral-bg">
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL for an IndexedDB blob, not a static asset next/image can optimize */}
          <img src={previewUrl} alt={label} className="h-48 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-black/55 p-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1 bg-white/95 text-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Retake
            </Button>
            {canShare && (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 bg-white/95 px-3 text-sm"
                onClick={handleSave}
                disabled={busy || !photoBlob}
                icon={<IconShare className="h-4 w-4" />}
                aria-label={`Save ${label} to Photos`}
              />
            )}
            <Button
              type="button"
              variant="danger"
              className="min-h-11 px-3 text-sm"
              onClick={onRemove}
              disabled={busy}
              icon={<IconTrash className="h-4 w-4" />}
            >
              Remove
            </Button>
          </div>
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
              Saving…
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-neutral-bg text-ink-muted active:bg-border disabled:opacity-50"
        >
          <IconCamera className="h-8 w-8" />
          <span className="text-sm font-semibold">{busy ? "Saving…" : "Take Photo"}</span>
        </button>
      )}
      {error && <p className="text-sm font-medium text-poor">{error}</p>}
      {saveError && <p className="text-sm font-medium text-poor">{saveError}</p>}
    </div>
  );
}
