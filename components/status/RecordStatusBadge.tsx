import type { RecordStatus } from "@/types/record";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconCheckCircle, IconAlertTriangle } from "@/components/icons";

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  if (status === "READY") {
    return (
      <StatusPill tone="good" icon={<IconCheckCircle className="h-4 w-4" />}>
        READY
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="check" icon={<IconAlertTriangle className="h-4 w-4" />}>
      INCOMPLETE
    </StatusPill>
  );
}
