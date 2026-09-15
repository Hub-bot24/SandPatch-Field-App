"use client";

import { useState } from "react";
import { useJob } from "@/hooks/useJob";
import { TextField } from "@/components/ui/TextField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { SAND_VOLUMES, type SandVolumeMl } from "@/types/record";
import { EMPTY_JOB_INPUT, type JobInput } from "@/types/job";
import type { Job } from "@/types/job";

export function JobSetupForm() {
  const { job, loading, save } = useJob();
  const [form, setForm] = useState<JobInput>(EMPTY_JOB_INPUT);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize the editable draft from the loaded job the first time it
  // arrives, without an effect: React supports (and recommends) setting
  // state directly during render for exactly this "reset local state when
  // an async value changes" case - see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [syncedJob, setSyncedJob] = useState<Job | null>(null);
  if (job && job !== syncedJob) {
    setSyncedJob(job);
    setForm({
      road: job.road,
      contractJobNumber: job.contractJobNumber,
      lotNumber: job.lotNumber,
      operator: job.operator,
      existingAggregateSize: job.existingAggregateSize,
      proposedAggregateSize: job.proposedAggregateSize,
      defaultSandVolumeMl: job.defaultSandVolumeMl,
    });
  }

  function update(patch: Partial<JobInput>) {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-ink-muted">Loading job setup…</p>;
  }

  return (
    <div className="space-y-4 pb-4">
      <p className="text-sm text-ink-muted">
        These values prefill every new record so field staff type as little as possible. Each value can
        still be changed per record.
      </p>

      <TextField label="Road" value={form.road} onChange={(v) => update({ road: v })} />
      <TextField
        label="Contract / Job Number"
        value={form.contractJobNumber}
        onChange={(v) => update({ contractJobNumber: v })}
      />
      <TextField label="Lot Number" value={form.lotNumber} onChange={(v) => update({ lotNumber: v })} />
      <TextField label="Operator" value={form.operator} onChange={(v) => update({ operator: v })} />
      <TextField
        label="Existing Aggregate Size"
        value={form.existingAggregateSize}
        onChange={(v) => update({ existingAggregateSize: v })}
      />
      <TextField
        label="Proposed Aggregate Size"
        value={form.proposedAggregateSize}
        onChange={(v) => update({ proposedAggregateSize: v })}
      />
      <SegmentedControl
        label="Default Sand Volume"
        options={SAND_VOLUMES}
        value={form.defaultSandVolumeMl}
        onChange={(v: SandVolumeMl) => update({ defaultSandVolumeMl: v })}
        formatOption={(v) => `${v} mL`}
        columns={2}
      />

      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Job Setup"}
      </Button>
      {saved && <p className="text-center text-sm font-semibold text-good">Job setup saved ✓</p>}
    </div>
  );
}
