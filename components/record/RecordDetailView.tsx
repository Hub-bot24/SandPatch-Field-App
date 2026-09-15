"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteRecordCascade, getRecord } from "@/lib/db/recordRepository";
import { getPhotoMap } from "@/lib/db/photoRepository";
import { usePhotoPreviewUrls } from "@/hooks/usePhotoPreviewUrls";
import { PHOTO_NUMBERS, type PhotoNumber, type PhotoRecord, type SandPatchRecord } from "@/types/record";
import {
  formatAverageDiameter,
  formatChainage,
  formatGpsAccuracy,
  formatGpsCoordinate,
  formatTextureDepth,
} from "@/lib/calculations/format";
import { classifyGpsAccuracy } from "@/lib/gps/quality";
import { GpsStatusPill } from "@/components/status/GpsStatusPill";
import { RecordStatusBadge } from "@/components/status/RecordStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconPencil, IconTrash } from "@/components/icons";

export function RecordDetailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [record, setRecord] = useState<SandPatchRecord | null | undefined>(undefined);
  const [photos, setPhotos] = useState<Partial<Record<PhotoNumber, PhotoRecord>>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const previewUrls = usePhotoPreviewUrls(photos);

  useEffect(() => {
    // A missing id is handled by the render-time check below, not here.
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [found, photoMap] = await Promise.all([getRecord(id), getPhotoMap(id)]);
      if (cancelled) return;
      setRecord(found ?? null);
      setPhotos(photoMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteRecordCascade(id);
      router.push("/records");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (!id) {
    return (
      <div className="space-y-3">
        <p className="font-medium text-poor">No record was specified.</p>
        <Button href="/records">Back to Records</Button>
      </div>
    );
  }

  if (record === undefined) {
    return <p className="text-ink-muted">Loading record…</p>;
  }

  if (record === null) {
    return (
      <div className="space-y-3">
        <p className="font-medium text-poor">This record could not be found. It may have been deleted.</p>
        <Button href="/records">Back to Records</Button>
      </div>
    );
  }

  const gpsQuality = classifyGpsAccuracy(record.gps?.accuracyM ?? null);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-4xl font-bold tabular-nums text-navy">{formatChainage(record.chainageKm)}</p>
          <p className="text-lg font-semibold text-ink">{record.road || "Unnamed road"}</p>
        </div>
        <RecordStatusBadge status={record.status} />
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Direction</dt>
          <dd className="font-semibold text-ink">{record.direction ?? "—"}</dd>
          <dt className="text-ink-muted">Control Line</dt>
          <dd className="font-semibold text-ink">{record.controlLine ?? "—"}</dd>
          <dt className="text-ink-muted">Offset</dt>
          <dd className="font-semibold text-ink">{record.offsetM ?? "—"} m</dd>
          <dt className="text-ink-muted">Sand Volume</dt>
          <dd className="font-semibold text-ink">{record.sandVolumeMl} mL</dd>
          <dt className="text-ink-muted">Average Diameter</dt>
          <dd className="font-semibold text-ink">{formatAverageDiameter(record.averageDiameterMm)}</dd>
          <dt className="text-ink-muted">Texture Depth</dt>
          <dd className="font-semibold text-brand-dark">{formatTextureDepth(record.textureDepthMm)}</dd>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">GPS</h2>
        <div className="mb-2">
          <GpsStatusPill quality={gpsQuality} />
        </div>
        {record.gps ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm text-ink">
            <dt className="text-ink-muted">Latitude</dt>
            <dd>{formatGpsCoordinate(record.gps.latitude)}</dd>
            <dt className="text-ink-muted">Longitude</dt>
            <dd>{formatGpsCoordinate(record.gps.longitude)}</dd>
            <dt className="text-ink-muted">Accuracy</dt>
            <dd>{formatGpsAccuracy(record.gps.accuracyM)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">No GPS reading was captured for this record.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Job Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Contract / Job No.</dt>
          <dd className="font-semibold text-ink">{record.contractJobNumber || "—"}</dd>
          <dt className="text-ink-muted">Lot Number</dt>
          <dd className="font-semibold text-ink">{record.lotNumber || "—"}</dd>
          <dt className="text-ink-muted">Operator</dt>
          <dd className="font-semibold text-ink">{record.operator || "—"}</dd>
          <dt className="text-ink-muted">Existing Surface</dt>
          <dd className="font-semibold text-ink">{record.existingSurface || "—"}</dd>
          <dt className="text-ink-muted">Existing Aggregate</dt>
          <dd className="font-semibold text-ink">{record.existingAggregateSize || "—"}</dd>
          <dt className="text-ink-muted">Proposed Aggregate</dt>
          <dd className="font-semibold text-ink">{record.proposedAggregateSize || "—"}</dd>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Photos</h2>
        <div className="grid grid-cols-2 gap-2">
          {PHOTO_NUMBERS.map((n) => (
            <div key={n} className="overflow-hidden rounded-xl border border-border bg-neutral-bg">
              {previewUrls[n] ? (
                // eslint-disable-next-line @next/next/no-img-element -- object URL for an IndexedDB blob, not a static asset
                <img src={previewUrls[n]} alt={`Photo ${n}`} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center text-xs text-ink-muted">
                  No Photo {n}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {record.notes && (
        <Card>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Notes</h2>
          <p className="whitespace-pre-wrap text-ink">{record.notes}</p>
        </Card>
      )}

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted">
          <dt>Record UUID</dt>
          <dd className="truncate font-mono">{record.id}</dd>
          <dt>Created</dt>
          <dd>{new Date(record.createdAt).toLocaleString()}</dd>
          <dt>Last Updated</dt>
          <dd>{new Date(record.updatedAt).toLocaleString()}</dd>
        </dl>
      </Card>

      <div className="flex gap-3">
        <div className="flex-1">
          <Button
            href={`/?id=${encodeURIComponent(record.id)}`}
            fullWidth
            variant="secondary"
            icon={<IconPencil className="h-5 w-5" />}
          >
            Edit
          </Button>
        </div>
        <div className="flex-1">
          <Button
            fullWidth
            variant="danger"
            onClick={() => setConfirmingDelete(true)}
            icon={<IconTrash className="h-5 w-5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this record?"
        description="This permanently deletes the record and all four photos. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
