"use client";

import { useSearchParams } from "next/navigation";
import { SandPatchRecordForm } from "@/components/record/SandPatchRecordForm";

export function NewRecordPageClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">{id ? "Edit Test" : "New Test"}</h1>
      <SandPatchRecordForm recordId={id} />
    </div>
  );
}
