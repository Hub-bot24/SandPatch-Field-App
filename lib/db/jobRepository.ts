import { getDb } from "./client";
import { JOB_SETTINGS_ID, STORE_JOB_SETTINGS } from "./schema";
import type { Job, JobInput } from "@/types/job";

export async function getJob(): Promise<Job | null> {
  const db = await getDb();
  const job = await db.get(STORE_JOB_SETTINGS, JOB_SETTINGS_ID);
  return job ?? null;
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
