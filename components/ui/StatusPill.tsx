import type { ReactNode } from "react";

export type PillTone = "good" | "check" | "poor" | "neutral";

const TONE_CLASSES: Record<PillTone, string> = {
  good: "bg-good-bg text-good",
  check: "bg-check-bg text-check",
  poor: "bg-poor-bg text-poor",
  neutral: "bg-neutral-bg text-ink-muted",
};

export function StatusPill({
  tone,
  children,
  icon,
}: {
  tone: PillTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${TONE_CLASSES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
