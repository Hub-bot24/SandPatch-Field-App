import type { Metadata } from "next";
import { ExportPanel } from "@/components/export/ExportPanel";

export const metadata: Metadata = { title: "Export" };

export default function ExportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Export Job</h1>
      <ExportPanel />
    </div>
  );
}
