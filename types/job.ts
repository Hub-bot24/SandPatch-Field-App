import type { SandVolumeMl } from "./record";

/**
 * Job Setup values. There is a single "current" job configuration stored
 * locally, used only to prefill new records (see JOB_SETTINGS_ID in
 * lib/db/schema.ts). It is not itself QA evidence.
 */
export interface Job {
  id: string;
  road: string;
  contractJobNumber: string;
  lotNumber: string;
  operator: string;
  existingAggregateSize: string;
  proposedAggregateSize: string;
  defaultSandVolumeMl: SandVolumeMl;
  /** Length, in mm, of the ruler used for tap-to-measure photo calibration - see lib/measurement/tapMeasure.ts. */
  rulerLengthMm: number;
  createdAt: string;
  updatedAt: string;
}

export type JobInput = Omit<Job, "id" | "createdAt" | "updatedAt">;

/** Standard steel ruler length used for sand patch testing, per the lab equipment list. */
export const DEFAULT_RULER_LENGTH_MM = 300;

export const EMPTY_JOB_INPUT: JobInput = {
  road: "",
  contractJobNumber: "",
  lotNumber: "",
  operator: "",
  existingAggregateSize: "",
  proposedAggregateSize: "",
  defaultSandVolumeMl: 50,
  rulerLengthMm: DEFAULT_RULER_LENGTH_MM,
};

/**
 * Strips id/createdAt/updatedAt so a loaded Job can be re-saved (optionally
 * with overrides) without hand-listing every other field - so a field
 * added to Job later is carried through automatically instead of silently
 * dropped by a call site nobody remembered to update.
 */
export function toJobInput(job: Job, overrides: Partial<JobInput> = {}): JobInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit them below
  const { id, createdAt, updatedAt, ...jobInput } = job;
  return { ...jobInput, ...overrides };
}
