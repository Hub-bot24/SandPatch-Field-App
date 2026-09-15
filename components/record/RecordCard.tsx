import Link from "next/link";
import type { SandPatchRecord } from "@/types/record";
import { formatAverageDiameter, formatChainage, formatTextureDepth } from "@/lib/calculations/format";
import { classifyGpsAccuracy } from "@/lib/gps/quality";
import { GpsStatusPill } from "@/components/status/GpsStatusPill";
import { RecordStatusBadge } from "@/components/status/RecordStatusBadge";
import { Card } from "@/components/ui/Card";

interface RecordCardProps {
  record: SandPatchRecord;
  photoCount: number;
}

export function RecordCard({ record, photoCount }: RecordCardProps) {
  const gpsQuality = classifyGpsAccuracy(record.gps?.accuracyM ?? null);

  return (
    <Link href={`/records/view?id=${encodeURIComponent(record.id)}`} className="block">
      <Card className="transition-colors active:bg-neutral-bg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-2xl font-bold tabular-nums text-navy">
              {formatChainage(record.chainageKm)}
            </p>
            <p className="truncate text-base font-semibold text-ink">{record.road || "Unnamed road"}</p>
            <p className="text-sm text-ink-muted">{record.direction ?? "No direction set"}</p>
          </div>
          <RecordStatusBadge status={record.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          <span>Avg Ø {formatAverageDiameter(record.averageDiameterMm)}</span>
          <span>TD {formatTextureDepth(record.textureDepthMm)}</span>
          <span>{photoCount}/4 photos</span>
          <GpsStatusPill quality={gpsQuality} />
        </div>
      </Card>
    </Link>
  );
}
