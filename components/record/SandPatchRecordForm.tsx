"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONTROL_LINES,
  DIRECTIONS,
  PHOTO_NUMBERS,
  type ControlLine,
  type Direction,
  type GpsReading,
  type PhotoNumber,
  type PhotoRecord,
  type SandPatchRecord,
  type SandVolumeMl,
} from "@/types/record";
import { createRecord, getRecord, updateRecord } from "@/lib/db/recordRepository";
import { deletePhoto, deletePhotosForRecord, getPhotoMap, savePhoto } from "@/lib/db/photoRepository";
import {
  calculateAverageDiameter,
  calculateTextureDepth,
  computeRecordStatus,
  formatChainage,
} from "@/lib/calculations";
import { validateChainageInput, validateDiameterInput, validateOffsetInput } from "@/lib/validation";
import { compressImageFile } from "@/lib/images";
import { createId } from "@/lib/utils/id";
import { sandPatchMeasurementEngine } from "@/lib/measurement";
import { useJob } from "@/hooks/useJob";
import { usePhotoPreviewUrls } from "@/hooks/usePhotoPreviewUrls";
import { Button } from "@/components/ui/Button";
import { NumericField } from "@/components/ui/NumericField";
import { TextField } from "@/components/ui/TextField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Section } from "@/components/ui/Section";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ChainageDisplay } from "@/components/record/ChainageDisplay";
import { ResultsCard } from "@/components/record/ResultsCard";
import { JobDetailsFields } from "@/components/record/JobDetailsFields";
import { GpsCapture } from "@/components/gps/GpsCapture";
import { PhotoCaptureSlot } from "@/components/photo/PhotoCaptureSlot";
import { RecordStatusBadge } from "@/components/status/RecordStatusBadge";

interface FormState {
  road: string;
  contractJobNumber: string;
  lotNumber: string;
  operator: string;
  existingSurface: string;
  existingAggregateSize: string;
  proposedAggregateSize: string;
  sandVolumeMl: SandVolumeMl;
  direction: Direction | null;
  controlLine: ControlLine | null;
  notes: string;
  gps: GpsReading | null;
  chainageRaw: string;
  offsetRaw: string;
  diameter1Raw: string;
  diameter2Raw: string;
  diameter3Raw: string;
  diameter4Raw: string;
}

const EMPTY_FORM_STATE: FormState = {
  road: "",
  contractJobNumber: "",
  lotNumber: "",
  operator: "",
  existingSurface: "",
  existingAggregateSize: "",
  proposedAggregateSize: "",
  sandVolumeMl: 50,
  direction: null,
  controlLine: null,
  notes: "",
  gps: null,
  chainageRaw: "",
  offsetRaw: "",
  diameter1Raw: "",
  diameter2Raw: "",
  diameter3Raw: "",
  diameter4Raw: "",
};

export function SandPatchRecordForm({ recordId: initialRecordId }: { recordId?: string }) {
  const router = useRouter();
  const isEditMode = Boolean(initialRecordId);
  const { job } = useJob();

  const [recordId, setRecordId] = useState<string>(() => initialRecordId ?? createId());
  const [testDateTime, setTestDateTime] = useState<string>(() => new Date().toISOString());
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM_STATE);
  const [photos, setPhotos] = useState<Partial<Record<PhotoNumber, PhotoRecord>>>({});
  const previewUrls = usePhotoPreviewUrls(photos);

  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoErrors, setPhotoErrors] = useState<Partial<Record<PhotoNumber, string>>>({});
  const [busyPhoto, setBusyPhoto] = useState<PhotoNumber | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [measurementMessage, setMeasurementMessage] = useState<string | null>(null);

  const appliedJobDefaultsRef = useRef(false);
  const savedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!initialRecordId) return;
    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      const [record, photoMap] = await Promise.all([getRecord(initialRecordId), getPhotoMap(initialRecordId)]);
      if (cancelled) return;
      if (!record) {
        setLoadError("This record could not be found. It may have been deleted.");
        setLoadingExisting(false);
        return;
      }
      setForm({
        road: record.road,
        contractJobNumber: record.contractJobNumber,
        lotNumber: record.lotNumber,
        operator: record.operator,
        existingSurface: record.existingSurface,
        existingAggregateSize: record.existingAggregateSize,
        proposedAggregateSize: record.proposedAggregateSize,
        sandVolumeMl: record.sandVolumeMl,
        direction: record.direction,
        controlLine: record.controlLine,
        notes: record.notes,
        gps: record.gps,
        chainageRaw: record.chainageKm !== null ? String(record.chainageKm) : "",
        offsetRaw: record.offsetM !== null ? String(record.offsetM) : "",
        diameter1Raw: record.diameter1Mm !== null ? String(record.diameter1Mm) : "",
        diameter2Raw: record.diameter2Mm !== null ? String(record.diameter2Mm) : "",
        diameter3Raw: record.diameter3Mm !== null ? String(record.diameter3Mm) : "",
        diameter4Raw: record.diameter4Mm !== null ? String(record.diameter4Mm) : "",
      });
      setPhotos(photoMap);
      setTestDateTime(record.testDateTime);
      setExistingCreatedAt(record.createdAt);
      setLoadingExisting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRecordId]);

  // Prefill from Job Setup once, for a brand-new record only.
  useEffect(() => {
    if (isEditMode || !job || appliedJobDefaultsRef.current) return;
    appliedJobDefaultsRef.current = true;
    setForm((f) => ({
      ...f,
      road: job.road,
      contractJobNumber: job.contractJobNumber,
      lotNumber: job.lotNumber,
      operator: job.operator,
      existingAggregateSize: job.existingAggregateSize,
      proposedAggregateSize: job.proposedAggregateSize,
      sandVolumeMl: job.defaultSandVolumeMl,
    }));
  }, [isEditMode, job]);

  // A brand-new draft's photos are stored under `recordId` as soon as they're
  // taken (before Save is ever pressed), so they're never lost mid-form. If
  // the draft is abandoned (unmounted, or superseded by the next test's
  // fresh id after a successful save) without being saved, its orphaned
  // photos are purged here rather than left behind forever.
  useEffect(() => {
    if (isEditMode) return;
    const idAtMount = recordId;
    return () => {
      // savedIdsRef holds one stable Set for the component's lifetime (only
      // ever mutated via .add, never reassigned), so reading .current here
      // intentionally sees any save that happened after this effect ran -
      // that's what determines whether idAtMount's photos are orphaned.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (!savedIdsRef.current.has(idAtMount)) {
        deletePhotosForRecord(idAtMount).catch(() => {});
      }
    };
  }, [recordId, isEditMode]);

  function updateForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const chainageValidation = validateChainageInput(form.chainageRaw);
  const offsetValidation = validateOffsetInput(form.offsetRaw);
  const diameter1Validation = validateDiameterInput(form.diameter1Raw);
  const diameter2Validation = validateDiameterInput(form.diameter2Raw);
  const diameter3Validation = validateDiameterInput(form.diameter3Raw);
  const diameter4Validation = validateDiameterInput(form.diameter4Raw);

  const averageDiameterMm = calculateAverageDiameter(
    diameter1Validation.parsed,
    diameter2Validation.parsed,
    diameter3Validation.parsed,
    diameter4Validation.parsed,
  );
  const textureDepthMm = calculateTextureDepth(averageDiameterMm, form.sandVolumeMl);

  const presentPhotoNumbers = PHOTO_NUMBERS.filter((n) => Boolean(photos[n]));
  const liveStatus = computeRecordStatus(
    {
      chainageKm: chainageValidation.parsed,
      diameter1Mm: diameter1Validation.parsed,
      diameter2Mm: diameter2Validation.parsed,
      diameter3Mm: diameter3Validation.parsed,
      diameter4Mm: diameter4Validation.parsed,
    },
    presentPhotoNumbers,
  );

  async function handlePhotoCapture(photoNumber: PhotoNumber, file: File) {
    setBusyPhoto(photoNumber);
    setPhotoErrors((prev) => ({ ...prev, [photoNumber]: undefined }));
    try {
      const { blob } = await compressImageFile(file);
      const saved = await savePhoto(recordId, photoNumber, blob);
      setPhotos((prev) => ({ ...prev, [photoNumber]: saved }));
    } catch {
      setPhotoErrors((prev) => ({ ...prev, [photoNumber]: "Could not save that photo. Please try again." }));
    } finally {
      setBusyPhoto(null);
    }
  }

  async function handlePhotoRemove(photoNumber: PhotoNumber) {
    await deletePhoto(recordId, photoNumber);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[photoNumber];
      return next;
    });
  }

  function resetFormForNextTest() {
    setRecordId(createId());
    setTestDateTime(new Date().toISOString());
    setExistingCreatedAt(null);
    setPhotos({});
    setPhotoErrors({});
    setFieldErrors({});
    setForm((f) => ({
      ...EMPTY_FORM_STATE,
      road: f.road,
      contractJobNumber: f.contractJobNumber,
      lotNumber: f.lotNumber,
      operator: f.operator,
      existingSurface: f.existingSurface,
      existingAggregateSize: f.existingAggregateSize,
      proposedAggregateSize: f.proposedAggregateSize,
      sandVolumeMl: f.sandVolumeMl,
      direction: f.direction,
      controlLine: f.controlLine,
    }));
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!chainageValidation.valid) errors.chainage = chainageValidation.error ?? "Invalid chainage.";
    if (!offsetValidation.valid) errors.offset = offsetValidation.error ?? "Invalid offset.";
    if (!diameter1Validation.valid) errors.diameter1 = diameter1Validation.error ?? "Invalid diameter.";
    if (!diameter2Validation.valid) errors.diameter2 = diameter2Validation.error ?? "Invalid diameter.";
    if (!diameter3Validation.valid) errors.diameter3 = diameter3Validation.error ?? "Invalid diameter.";
    if (!diameter4Validation.valid) errors.diameter4 = diameter4Validation.error ?? "Invalid diameter.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveMessage("Fix the highlighted fields before saving.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const now = new Date().toISOString();
      const record: SandPatchRecord = {
        id: recordId,
        createdAt: existingCreatedAt ?? now,
        updatedAt: now,
        road: form.road,
        contractJobNumber: form.contractJobNumber,
        lotNumber: form.lotNumber,
        operator: form.operator,
        testDateTime,
        gps: form.gps,
        chainageKm: chainageValidation.parsed,
        offsetM: offsetValidation.parsed,
        direction: form.direction,
        controlLine: form.controlLine,
        existingSurface: form.existingSurface,
        existingAggregateSize: form.existingAggregateSize,
        proposedAggregateSize: form.proposedAggregateSize,
        sandVolumeMl: form.sandVolumeMl,
        diameter1Mm: diameter1Validation.parsed,
        diameter2Mm: diameter2Validation.parsed,
        diameter3Mm: diameter3Validation.parsed,
        diameter4Mm: diameter4Validation.parsed,
        averageDiameterMm,
        textureDepthMm,
        notes: form.notes,
        status: liveStatus,
      };

      if (isEditMode) {
        await updateRecord(record);
        savedIdsRef.current.add(recordId);
        router.push(`/records/view?id=${encodeURIComponent(recordId)}`);
      } else {
        await createRecord(record);
        savedIdsRef.current.add(recordId);
        setSaveMessage(`Saved ✓ ${record.road || "Record"} @ ${formatChainage(record.chainageKm)} km`);
        resetFormForNextTest();
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTryAutoMeasure() {
    const result = await sandPatchMeasurementEngine.measure({ recordId, photos: [] });
    setMeasurementMessage(result.message ?? null);
  }

  if (loadingExisting) {
    return <p className="p-4 text-ink-muted">Loading record…</p>;
  }
  if (loadError) {
    return (
      <div className="space-y-3 p-4">
        <p className="font-medium text-poor">{loadError}</p>
        <Button onClick={() => router.push("/records")}>Back to Records</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {saveMessage && (
        <div className="rounded-xl border-2 border-brand bg-white px-4 py-3 text-sm font-semibold text-brand-dark">
          {saveMessage}
        </div>
      )}

      <Section step={1} title="Road">
        <TextField
          label="Road"
          value={form.road}
          onChange={(v) => updateForm({ road: v })}
          placeholder="e.g. Noondoo Mungindi Road"
        />
      </Section>

      <CollapsibleSection
        title="Job Details"
        summary={
          [form.contractJobNumber, form.lotNumber && `Lot ${form.lotNumber}`, form.operator]
            .filter(Boolean)
            .join(" · ") || "Contract, lot, operator, surface, aggregate"
        }
      >
        <JobDetailsFields
          values={{
            contractJobNumber: form.contractJobNumber,
            lotNumber: form.lotNumber,
            operator: form.operator,
            existingSurface: form.existingSurface,
            existingAggregateSize: form.existingAggregateSize,
            proposedAggregateSize: form.proposedAggregateSize,
          }}
          onChange={updateForm}
        />
      </CollapsibleSection>

      <Section step={2} title="Chainage">
        <div className="space-y-2">
          <ChainageDisplay chainageKm={chainageValidation.parsed} />
          <NumericField
            label="Chainage (km)"
            value={form.chainageRaw}
            onChange={(v) => updateForm({ chainageRaw: v })}
            size="large"
            placeholder="27.080"
            error={fieldErrors.chainage}
          />
        </div>
      </Section>

      <Section step={3} title="Direction">
        <SegmentedControl
          label="Direction"
          options={DIRECTIONS}
          value={form.direction}
          onChange={(v) => updateForm({ direction: v })}
        />
      </Section>

      <Section step={4} title="Offset">
        <NumericField
          label="Offset (m)"
          value={form.offsetRaw}
          onChange={(v) => updateForm({ offsetRaw: v })}
          unit="m"
          allowNegative
          error={fieldErrors.offset}
        />
      </Section>

      <Section step={5} title="Control Line">
        <SegmentedControl
          label="Control Line"
          options={CONTROL_LINES}
          value={form.controlLine}
          onChange={(v) => updateForm({ controlLine: v })}
        />
      </Section>

      <Section step={6} title="GPS Status">
        <GpsCapture value={form.gps} onChange={(reading) => updateForm({ gps: reading })} />
      </Section>

      <Section step={7} title="Photo 1">
        <PhotoCaptureSlot
          label="Photo 1"
          previewUrl={previewUrls[1] ?? null}
          onCapture={(f) => handlePhotoCapture(1, f)}
          onRemove={() => handlePhotoRemove(1)}
          busy={busyPhoto === 1}
          error={photoErrors[1]}
        />
      </Section>
      <Section step={8} title="Diameter 1">
        <NumericField
          label="Diameter 1"
          value={form.diameter1Raw}
          onChange={(v) => updateForm({ diameter1Raw: v })}
          unit="mm"
          error={fieldErrors.diameter1}
        />
      </Section>

      <Section step={9} title="Photo 2">
        <PhotoCaptureSlot
          label="Photo 2"
          previewUrl={previewUrls[2] ?? null}
          onCapture={(f) => handlePhotoCapture(2, f)}
          onRemove={() => handlePhotoRemove(2)}
          busy={busyPhoto === 2}
          error={photoErrors[2]}
        />
      </Section>
      <Section step={10} title="Diameter 2">
        <NumericField
          label="Diameter 2"
          value={form.diameter2Raw}
          onChange={(v) => updateForm({ diameter2Raw: v })}
          unit="mm"
          error={fieldErrors.diameter2}
        />
      </Section>

      <Section step={11} title="Photo 3">
        <PhotoCaptureSlot
          label="Photo 3"
          previewUrl={previewUrls[3] ?? null}
          onCapture={(f) => handlePhotoCapture(3, f)}
          onRemove={() => handlePhotoRemove(3)}
          busy={busyPhoto === 3}
          error={photoErrors[3]}
        />
      </Section>
      <Section step={12} title="Diameter 3">
        <NumericField
          label="Diameter 3"
          value={form.diameter3Raw}
          onChange={(v) => updateForm({ diameter3Raw: v })}
          unit="mm"
          error={fieldErrors.diameter3}
        />
      </Section>

      <Section step={13} title="Photo 4">
        <PhotoCaptureSlot
          label="Photo 4"
          previewUrl={previewUrls[4] ?? null}
          onCapture={(f) => handlePhotoCapture(4, f)}
          onRemove={() => handlePhotoRemove(4)}
          busy={busyPhoto === 4}
          error={photoErrors[4]}
        />
      </Section>
      <Section step={14} title="Diameter 4">
        <NumericField
          label="Diameter 4"
          value={form.diameter4Raw}
          onChange={(v) => updateForm({ diameter4Raw: v })}
          unit="mm"
          error={fieldErrors.diameter4}
        />
      </Section>

      <Section step={15} title="Average Diameter & Texture Depth">
        <ResultsCard
          averageDiameterMm={averageDiameterMm}
          textureDepthMm={textureDepthMm}
          sandVolumeMl={form.sandVolumeMl}
          onSandVolumeChange={(v) => updateForm({ sandVolumeMl: v })}
        />
      </Section>

      <Section step={17} title="Notes">
        <TextField label="Notes" value={form.notes} onChange={(v) => updateForm({ notes: v })} multiline />
      </Section>

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleTryAutoMeasure}
          className="text-sm font-semibold text-ink-muted underline decoration-dotted underline-offset-4"
        >
          Try Auto-Measure (Version 2 preview)
        </button>
        {measurementMessage && <p className="text-sm text-ink-muted">{measurementMessage}</p>}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <span className="text-sm font-semibold text-ink-muted">Record Status</span>
        <RecordStatusBadge status={liveStatus} />
      </div>

      <Section step={18} title="Save Record">
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Record"}
        </Button>
      </Section>
    </div>
  );
}
