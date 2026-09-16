"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
import { DEFAULT_RULER_LENGTH_MM } from "@/types/job";
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
import { measurePatchFromPhoto } from "@/lib/measurement/measurePatch";
import { createRulerOcrWorker, type RulerOcrWorker } from "@/lib/measurement/ocrRuler";
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
import { TapMeasureOverlay } from "@/components/photo/TapMeasureOverlay";
import { RecordStatusBadge } from "@/components/status/RecordStatusBadge";

/** The next slot in a guided 1->2->3->4 capture run, or null once photo 4 is done. */
function nextPhotoNumber(n: PhotoNumber): PhotoNumber | null {
  if (n === 1) return 2;
  if (n === 2) return 3;
  if (n === 3) return 4;
  return null;
}

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

  // Tap-to-measure: either a standalone re-measure of an already-stored
  // photo, or one step of the guided "take all 4" run (guidedPhotoNumberRef
  // holds which slot the *next* file-input capture belongs to, since the
  // native camera picker is triggered imperatively, not through React state).
  // `autoFailed` distinguishes "automatic reading couldn't run for this
  // photo" from a deliberate "Measure from Photo" click, so the overlay can
  // say which happened rather than looking identical either way.
  const [measureState, setMeasureState] = useState<
    { photoNumber: PhotoNumber; objectUrl: string; autoFailed: boolean } | null
  >(null);
  const [guidedCaptureActive, setGuidedCaptureActive] = useState(false);
  const guidedInputRef = useRef<HTMLInputElement>(null);
  const guidedPhotoNumberRef = useRef<PhotoNumber | null>(null);
  const [autoDetectBusy, setAutoDetectBusy] = useState<PhotoNumber | null>(null);

  // One Tesseract worker per guided-capture run, shared across all 4
  // photos (see lib/measurement/ocrRuler.ts) rather than paying its
  // start-up cost four times over. Deliberately created lazily, inside
  // handleGuidedFileChange, only once a photo has actually come back from
  // the camera - never kicked off while a photo capture might still be in
  // progress. Mobile browsers can suspend or heavily throttle a page's JS
  // (including in-flight Worker/WASM start-up) while the native camera
  // app has the foreground, and starting the worker in parallel with
  // opening the camera - which this used to do, as a speed optimisation -
  // raced against exactly that, breaking automatic measurement outright on
  // at least one real phone. Null until first needed, and again once the
  // run ends (success or otherwise) or on unmount.
  const ocrWorkerRef = useRef<RulerOcrWorker | null>(null);

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

  // Revokes the tap-to-measure preview URL whenever it's replaced or the
  // overlay closes, including on unmount - mirrors usePhotoPreviewUrls.
  useEffect(() => {
    if (!measureState) return;
    const { objectUrl } = measureState;
    return () => URL.revokeObjectURL(objectUrl);
  }, [measureState]);

  // Safety net matching the object-URL cleanup pattern above: if the
  // component unmounts mid-run (e.g. navigating away) with a worker still
  // loaded, terminate it rather than leaking it silently.
  useEffect(() => {
    return () => {
      ocrWorkerRef.current?.terminate().catch(() => {});
    };
  }, []);

  function diameterPatchFor(photoNumber: PhotoNumber, valueRaw: string): Partial<FormState> {
    switch (photoNumber) {
      case 1:
        return { diameter1Raw: valueRaw };
      case 2:
        return { diameter2Raw: valueRaw };
      case 3:
        return { diameter3Raw: valueRaw };
      case 4:
        return { diameter4Raw: valueRaw };
    }
  }

  function triggerGuidedCapture(photoNumber: PhotoNumber) {
    guidedPhotoNumberRef.current = photoNumber;
    guidedInputRef.current?.click();
  }

  function startGuidedCapture() {
    setGuidedCaptureActive(true);
    triggerGuidedCapture(1);
  }

  /** Returns this run's shared OCR worker, creating it on first call. Retries on the next photo rather than giving up for the whole run if a given attempt fails - a transient hiccup on one photo shouldn't force every remaining photo into manual measurement. */
  async function ensureOcrWorker(): Promise<RulerOcrWorker | null> {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    try {
      const worker = await createRulerOcrWorker();
      ocrWorkerRef.current = worker;
      return worker;
    } catch {
      return null;
    }
  }

  async function handleGuidedFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const photoNumber = guidedPhotoNumberRef.current;
    event.target.value = "";
    if (!file || !photoNumber) return;

    // Compress + persist in the background - it never blocks measurement.
    void handlePhotoCapture(photoNumber, file);

    const worker = await ensureOcrWorker();
    if (!worker) {
      // OCR couldn't start for this photo (unusual - browser support issue,
      // or the vendored assets failed to load). Fall back to the manual
      // tap overlay for this one photo rather than silently fabricating a
      // number; its own confirm/cancel handlers advance the guided
      // sequence once the operator finishes with it.
      setMeasureState({ photoNumber, objectUrl: URL.createObjectURL(file), autoFailed: true });
      return;
    }

    setAutoDetectBusy(photoNumber);
    try {
      const result = await measurePatchFromPhoto(worker, file);
      if (result) {
        updateForm(diameterPatchFor(photoNumber, String(Math.round(result.diameterMm * 10) / 10)));
      }
      // A null result (the patch's edges weren't clear enough, or the
      // ruler's numbers couldn't be read confidently near them) leaves the
      // diameter field exactly as it was - never a fabricated number - so
      // it's still visibly empty for manual entry.
    } finally {
      setAutoDetectBusy(null);
      advanceGuidedCapture(photoNumber);
    }
  }

  function openStandaloneMeasure(photoNumber: PhotoNumber) {
    const photo = photos[photoNumber];
    if (!photo) return;
    setMeasureState({ photoNumber, objectUrl: URL.createObjectURL(photo.blob), autoFailed: false });
  }

  function advanceGuidedCapture(justFinishedPhoto: PhotoNumber) {
    if (!guidedCaptureActive) return;
    const next = nextPhotoNumber(justFinishedPhoto);
    if (next) {
      triggerGuidedCapture(next);
    } else {
      setGuidedCaptureActive(false);
      const worker = ocrWorkerRef.current;
      ocrWorkerRef.current = null;
      worker?.terminate().catch(() => {});
    }
  }

  function handleMeasureConfirm(diameterMm: number) {
    if (!measureState) return;
    const { photoNumber } = measureState;
    updateForm(diameterPatchFor(photoNumber, String(diameterMm)));
    setMeasureState(null);
    advanceGuidedCapture(photoNumber);
  }

  function handleMeasureCancel() {
    if (!measureState) return;
    const { photoNumber } = measureState;
    setMeasureState(null);
    advanceGuidedCapture(photoNumber);
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

      <Section title="Guided Capture">
        <p className="text-sm text-ink-muted">
          Take all four photos in one go - each diameter is read directly off the ruler in the shot, no
          taps and no separate calibration step, ever.
        </p>
        <p className="text-sm text-ink-muted">
          Frame each shot the way you&rsquo;d take the real reading: the ruler laid across the patch,
          running left-to-right, with its printed numbers clearly visible near both edges of the sand.
        </p>
        <p className="text-sm text-ink-muted">
          Keep the ruler evenly lit end to end - a hard shadow (often your own) across part of it, or
          glare off the metal, can make that stretch of numbers unreadable no matter how sharp the photo is.
        </p>
        <Button fullWidth onClick={startGuidedCapture} disabled={guidedCaptureActive}>
          {guidedCaptureActive
            ? autoDetectBusy
              ? `Measuring Photo ${autoDetectBusy}…`
              : "Capturing…"
            : "Take All 4 Photos"}
        </Button>
        {/*
          Guided capture is the primary field flow: standing at the patch,
          taking four fresh photos back to back, as fast as possible.
          capture="environment" jumps straight to the rear camera with no
          intermediate OS chooser - restoring that directness matters more
          here than library access does, since re-testing with an
          already-taken photo is what the four individual Photo 1-4 slots
          below (PhotoCaptureSlot, no capture attribute) are for.
        */}
        <input
          ref={guidedInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Guided capture"
          onChange={handleGuidedFileChange}
        />
      </Section>

      <Section step={7} title="Photo 1">
        <PhotoCaptureSlot
          label="Photo 1"
          previewUrl={previewUrls[1] ?? null}
          photoBlob={photos[1]?.blob ?? null}
          onCapture={(f) => handlePhotoCapture(1, f)}
          onRemove={() => handlePhotoRemove(1)}
          busy={busyPhoto === 1}
          error={photoErrors[1]}
        />
      </Section>
      <Section step={8} title="Diameter 1">
        <div className="space-y-2">
          <NumericField
            label="Diameter 1"
            value={form.diameter1Raw}
            onChange={(v) => updateForm({ diameter1Raw: v })}
            unit="mm"
            error={fieldErrors.diameter1}
          />
          {photos[1] && (
            <Button variant="secondary" fullWidth onClick={() => openStandaloneMeasure(1)}>
              Measure from Photo
            </Button>
          )}
        </div>
      </Section>

      <Section step={9} title="Photo 2">
        <PhotoCaptureSlot
          label="Photo 2"
          previewUrl={previewUrls[2] ?? null}
          photoBlob={photos[2]?.blob ?? null}
          onCapture={(f) => handlePhotoCapture(2, f)}
          onRemove={() => handlePhotoRemove(2)}
          busy={busyPhoto === 2}
          error={photoErrors[2]}
        />
      </Section>
      <Section step={10} title="Diameter 2">
        <div className="space-y-2">
          <NumericField
            label="Diameter 2"
            value={form.diameter2Raw}
            onChange={(v) => updateForm({ diameter2Raw: v })}
            unit="mm"
            error={fieldErrors.diameter2}
          />
          {photos[2] && (
            <Button variant="secondary" fullWidth onClick={() => openStandaloneMeasure(2)}>
              Measure from Photo
            </Button>
          )}
        </div>
      </Section>

      <Section step={11} title="Photo 3">
        <PhotoCaptureSlot
          label="Photo 3"
          previewUrl={previewUrls[3] ?? null}
          photoBlob={photos[3]?.blob ?? null}
          onCapture={(f) => handlePhotoCapture(3, f)}
          onRemove={() => handlePhotoRemove(3)}
          busy={busyPhoto === 3}
          error={photoErrors[3]}
        />
      </Section>
      <Section step={12} title="Diameter 3">
        <div className="space-y-2">
          <NumericField
            label="Diameter 3"
            value={form.diameter3Raw}
            onChange={(v) => updateForm({ diameter3Raw: v })}
            unit="mm"
            error={fieldErrors.diameter3}
          />
          {photos[3] && (
            <Button variant="secondary" fullWidth onClick={() => openStandaloneMeasure(3)}>
              Measure from Photo
            </Button>
          )}
        </div>
      </Section>

      <Section step={13} title="Photo 4">
        <PhotoCaptureSlot
          label="Photo 4"
          previewUrl={previewUrls[4] ?? null}
          photoBlob={photos[4]?.blob ?? null}
          onCapture={(f) => handlePhotoCapture(4, f)}
          onRemove={() => handlePhotoRemove(4)}
          busy={busyPhoto === 4}
          error={photoErrors[4]}
        />
      </Section>
      <Section step={14} title="Diameter 4">
        <div className="space-y-2">
          <NumericField
            label="Diameter 4"
            value={form.diameter4Raw}
            onChange={(v) => updateForm({ diameter4Raw: v })}
            unit="mm"
            error={fieldErrors.diameter4}
          />
          {photos[4] && (
            <Button variant="secondary" fullWidth onClick={() => openStandaloneMeasure(4)}>
              Measure from Photo
            </Button>
          )}
        </div>
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
          Try Fully-Automatic Detection (Version 2 preview)
        </button>
        <p className="text-xs text-ink-muted">
          This is different from the tap-to-measure buttons above: it would detect the sand patch edges
          itself with no taps at all, and is not implemented yet.
        </p>
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

      {measureState && (
        <TapMeasureOverlay
          photoUrl={measureState.objectUrl}
          photoLabel={`Photo ${measureState.photoNumber}`}
          note={measureState.autoFailed ? "Couldn't read this one automatically - tap instead" : undefined}
          calibrationLengthMm={job?.rulerLengthMm ?? DEFAULT_RULER_LENGTH_MM}
          onConfirm={handleMeasureConfirm}
          onCancel={handleMeasureCancel}
        />
      )}
    </div>
  );
}
