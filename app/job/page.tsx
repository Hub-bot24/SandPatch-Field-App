import type { Metadata } from "next";
import { JobSetupForm } from "@/components/job/JobSetupForm";

export const metadata: Metadata = { title: "Job Setup" };

export default function JobPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Job Setup</h1>
      <JobSetupForm />
    </div>
  );
}
