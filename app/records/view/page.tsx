import { Suspense } from "react";
import type { Metadata } from "next";
import { RecordDetailView } from "@/components/record/RecordDetailView";

export const metadata: Metadata = { title: "Record" };

export default function RecordViewPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <RecordDetailView />
    </Suspense>
  );
}
