"use client";

import { useCallback, useEffect, useState } from "react";
import { getJob, saveJob } from "@/lib/db/jobRepository";
import type { Job, JobInput } from "@/types/job";

interface UseJobResult {
  job: Job | null;
  loading: boolean;
  save: (input: JobInput) => Promise<Job>;
  refresh: () => Promise<void>;
}

/** Loads the current Job Setup and exposes a save function that persists it. */
export function useJob(): UseJobResult {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getJob();
    setJob(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getJob();
      if (!cancelled) {
        setJob(current);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (input: JobInput) => {
    const saved = await saveJob(input);
    setJob(saved);
    return saved;
  }, []);

  return { job, loading, save, refresh };
}
