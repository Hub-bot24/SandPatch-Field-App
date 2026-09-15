"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GpsStatusPill } from "@/components/status/GpsStatusPill";
import { getCurrentGpsReading } from "@/lib/gps/geolocation";
import { classifyGpsAccuracy } from "@/lib/gps/quality";
import { formatGpsAccuracy, formatGpsCoordinate } from "@/lib/calculations/format";
import { IconMapPin } from "@/components/icons";
import type { GpsReading } from "@/types/record";

interface GpsCaptureProps {
  value: GpsReading | null;
  onChange: (reading: GpsReading) => void;
}

/** GPS capture control: button + lat/lng/accuracy + GOOD/CHECK/POOR status. Never blocks saving. */
export function GpsCapture({ value, onChange }: GpsCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setLoading(true);
    setError(null);
    const result = await getCurrentGpsReading();
    setLoading(false);
    if (result.status === "success") {
      onChange(result.reading);
    } else {
      setError(result.message);
    }
  }

  const quality = classifyGpsAccuracy(value?.accuracyM ?? null);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GpsStatusPill quality={quality} />
        <Button
          type="button"
          variant="secondary"
          onClick={handleCapture}
          disabled={loading}
          icon={<IconMapPin className="h-5 w-5" />}
        >
          {loading ? "Getting GPS…" : value ? "Update GPS" : "Get GPS"}
        </Button>
      </div>

      {value && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-sm text-ink">
          <dt className="text-ink-muted">Latitude</dt>
          <dd>{formatGpsCoordinate(value.latitude)}</dd>
          <dt className="text-ink-muted">Longitude</dt>
          <dd>{formatGpsCoordinate(value.longitude)}</dd>
          <dt className="text-ink-muted">Accuracy</dt>
          <dd>{formatGpsAccuracy(value.accuracyM)}</dd>
        </dl>
      )}

      {error && <p className="text-sm font-medium text-poor">{error}</p>}
      {!value && !error && !loading && (
        <p className="text-sm text-ink-muted">
          No GPS reading yet. You can still save this record without one.
        </p>
      )}
    </div>
  );
}
