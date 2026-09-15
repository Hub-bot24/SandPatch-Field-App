"use client";

import { useEffect, useState } from "react";
import { listAllRecordsSorted } from "@/lib/db/recordRepository";
import { countPhotosForRecord } from "@/lib/db/photoRepository";
import { purgeOrphanedPhotos } from "@/lib/db/maintenance";
import type { SandPatchRecord } from "@/types/record";
import { RecordCard } from "@/components/record/RecordCard";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";

export function RecordsList() {
  const [records, setRecords] = useState<SandPatchRecord[] | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Best-effort cleanup of any draft photos left behind by a killed
      // session - never touches a photo belonging to a record that exists.
      purgeOrphanedPhotos().catch(() => {});

      const sorted = await listAllRecordsSorted();
      if (cancelled) return;
      setRecords(sorted);

      const counts: Record<string, number> = {};
      await Promise.all(
        sorted.map(async (record) => {
          counts[record.id] = await countPhotosForRecord(record.id);
        }),
      );
      if (!cancelled) setPhotoCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (records === null) {
    return <p className="text-ink-muted">Loading records…</p>;
  }

  if (records.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
        <p className="text-ink-muted">No records saved yet.</p>
        <Button href="/" icon={<IconPlus className="h-5 w-5" />}>
          Start a New Test
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <RecordCard key={record.id} record={record} photoCount={photoCounts[record.id] ?? 0} />
      ))}
    </div>
  );
}
