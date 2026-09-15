import { getDb } from "./client";
import { JOB_SETTINGS_ID, STORE_JOB_SETTINGS } from "./schema";
import { DEFAULT_RULER_LENGTH_MM, type Job, type JobInput } from "@/types/job";

export async function getJob(): Promise<Job | null> {
  const db = await getDb();
  const job = await db.get(STORE_JOB_SETTINGS, JOB_SETTINGS_ID);
  if (!job) return null;
  // A job saved before rulerLengthMm/pixelsPerMm existed won't have them in
  // IndexedDB - default them at the read boundary rather than requiring a
  // schema migration for what is otherwise a same-shape additive field.
  return {
    ...job,
    rulerLengthMm: job.rulerLengthMm ?? DEFAULT_RULER_LENGTH_MM,
    pixelsPerMm: job.pixelsPerMm ?? null,
  };
}

export async function saveJob(input: JobInput): Promise<Job> {
  const db = await getDb();
  const existing = await db.get(STORE_JOB_SETTINGS, JOB_SETTINGS_ID);
  const now = new Date().toISOString();
  const job: Job = {
    ...input,
    id: JOB_SETTINGS_ID,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.put(STORE_JOB_SETTINGS, job);
  return job;
}
