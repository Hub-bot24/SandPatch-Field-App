import type { Metadata } from "next";
import { RecordsList } from "@/components/record/RecordsList";

export const metadata: Metadata = { title: "Records" };

export default function RecordsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Records</h1>
      <RecordsList />
    </div>
  );
}
