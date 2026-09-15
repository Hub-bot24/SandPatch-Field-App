import type { GpsQuality } from "@/types/record";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconCheckCircle, IconAlertTriangle, IconXCircle, IconMapPin } from "@/components/icons";

export function GpsStatusPill({ quality }: { quality: GpsQuality | null }) {
  if (quality === "GOOD") {
    return (
      <StatusPill tone="good" icon={<IconCheckCircle className="h-4 w-4" />}>
        GOOD
      </StatusPill>
    );
  }
  if (quality === "CHECK") {
    return (
      <StatusPill tone="check" icon={<IconAlertTriangle className="h-4 w-4" />}>
        CHECK
      </StatusPill>
    );
  }
  if (quality === "POOR") {
    return (
      <StatusPill tone="poor" icon={<IconXCircle className="h-4 w-4" />}>
        POOR
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="neutral" icon={<IconMapPin className="h-4 w-4" />}>
      NO GPS
    </StatusPill>
  );
}
