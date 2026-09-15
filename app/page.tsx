import { Suspense } from "react";
import type { Metadata } from "next";
import { NewRecordPageClient } from "./NewRecordPageClient";

// Set as an absolute string (rather than relying on the root layout's
// title template) because Next does not apply a parent template to a
// page.tsx at the same route segment as the layout that defines it.
export const metadata: Metadata = { title: "New Test · SandPatch Field App" };

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <NewRecordPageClient />
    </Suspense>
  );
}
