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
