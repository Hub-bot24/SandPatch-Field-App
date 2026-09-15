import type { ReactNode } from "react";

export function Section({
  step,
  title,
  children,
}: {
  step?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-navy">
        {step !== undefined && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs text-white">
            {step}
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}
