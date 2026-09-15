import { TextField } from "@/components/ui/TextField";

export interface JobDetailsValues {
  contractJobNumber: string;
  lotNumber: string;
  operator: string;
  existingSurface: string;
  existingAggregateSize: string;
  proposedAggregateSize: string;
}

interface JobDetailsFieldsProps {
  values: JobDetailsValues;
  onChange: (patch: Partial<JobDetailsValues>) => void;
}

/**
 * The per-record job-level fields. These are prefilled from Job Setup and
 * rarely change test-to-test, so they live in a collapsed section on the
 * New Record screen to keep the primary field workflow fast to fill in.
 */
export function JobDetailsFields({ values, onChange }: JobDetailsFieldsProps) {
  return (
    <div className="space-y-3">
      <TextField
        label="Contract / Job Number"
        value={values.contractJobNumber}
        onChange={(v) => onChange({ contractJobNumber: v })}
      />
      <TextField label="Lot Number" value={values.lotNumber} onChange={(v) => onChange({ lotNumber: v })} />
      <TextField label="Operator" value={values.operator} onChange={(v) => onChange({ operator: v })} />
      <TextField
        label="Existing Surface Description"
        value={values.existingSurface}
        onChange={(v) => onChange({ existingSurface: v })}
      />
      <TextField
        label="Existing Aggregate Size"
        value={values.existingAggregateSize}
        onChange={(v) => onChange({ existingAggregateSize: v })}
      />
      <TextField
        label="Proposed Aggregate Size"
        value={values.proposedAggregateSize}
        onChange={(v) => onChange({ proposedAggregateSize: v })}
      />
    </div>
  );
}
