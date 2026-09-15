import { formatChainage } from "@/lib/calculations/format";

/** The large, always-3-decimal chainage readout required for outdoor legibility. */
export function ChainageDisplay({ chainageKm }: { chainageKm: number | null }) {
  return (
    <div className="rounded-2xl bg-navy px-4 py-3 text-center">
      <span className="block text-xs font-bold uppercase tracking-widest text-white/60">
        Chainage (km)
      </span>
      <span className="block font-mono text-5xl font-bold tabular-nums text-white">
        {formatChainage(chainageKm)}
      </span>
    </div>
  );
}
