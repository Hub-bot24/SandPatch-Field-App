import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatAverageDiameter, formatTextureDepth } from "@/lib/calculations/format";
import { SAND_VOLUMES, type SandVolumeMl } from "@/types/record";

interface ResultsCardProps {
  averageDiameterMm: number | null;
  textureDepthMm: number | null;
  sandVolumeMl: SandVolumeMl;
  onSandVolumeChange: (value: SandVolumeMl) => void;
}

/**
 * Shows the two derived values next to the one input (sand volume) that
 * affects texture depth, so the calculation stays visibly transparent -
 * nothing here is a hidden or silently-applied adjustment.
 */
export function ResultsCard({
  averageDiameterMm,
  textureDepthMm,
  sandVolumeMl,
  onSandVolumeChange,
}: ResultsCardProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-border bg-neutral-bg px-3 py-3 text-center">
          <span className="block text-xs font-bold uppercase tracking-widest text-ink-muted">
            Average Diameter
          </span>
          <span className="block font-mono text-2xl font-bold tabular-nums text-ink">
            {formatAverageDiameter(averageDiameterMm)}
          </span>
        </div>
        <div className="rounded-2xl border-2 border-brand bg-white px-3 py-3 text-center">
          <span className="block text-xs font-bold uppercase tracking-widest text-ink-muted">
            Texture Depth
          </span>
          <span className="block font-mono text-2xl font-bold tabular-nums text-brand-dark">
            {formatTextureDepth(textureDepthMm)}
          </span>
        </div>
      </div>

      <SegmentedControl
        label="Sand Volume"
        options={SAND_VOLUMES}
        value={sandVolumeMl}
        onChange={onSandVolumeChange}
        formatOption={(v) => `${v} mL`}
        columns={2}
      />
    </div>
  );
}
