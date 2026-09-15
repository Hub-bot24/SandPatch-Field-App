"use client";

import { useEffect, useState } from "react";
import { useJob } from "@/hooks/useJob";
import { exportJob, getExportPreview, type ExportSummary } from "@/lib/export";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconDownload } from "@/components/icons";

export function ExportPanel() {
  const { job } = useJob();
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSummary(true);
      const preview = await getExportPreview();
      if (!cancelled) {
        setSummary(preview);
        setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleExport() {
    setExporting(true);
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const jobLabel = [job?.road, job?.contractJobNumber].filter(Boolean).join("_") || "Job";
      const result = await exportJob(jobLabel);
      setSummary(result);
      setResultMessage(`Export ready: ${result.recordCount} record(s) downloaded as a ZIP.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Export Summary</h2>
        {loadingSummary || !summary ? (
          <p className="text-ink-muted">Loading…</p>
        ) : (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dd className="text-2xl font-bold text-ink">{summary.recordCount}</dd>
              <dt className="text-xs text-ink-muted">Total</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold text-good">{summary.readyCount}</dd>
              <dt className="text-xs text-ink-muted">Ready</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold text-check">{summary.incompleteCount}</dd>
              <dt className="text-xs text-ink-muted">Incomplete</dt>
            </div>
          </dl>
        )}
      </Card>

      <p className="text-sm text-ink-muted">
        Exports a ZIP containing a CSV of every saved record and a photos folder, named
        Road_Chainage_Direction_PhotoN.jpg. Nothing is uploaded anywhere - the file downloads directly to
        this device.
      </p>

      <Button
        fullWidth
        onClick={handleExport}
        disabled={exporting || summary?.recordCount === 0}
        icon={<IconDownload className="h-5 w-5" />}
      >
        {exporting ? "Preparing export…" : "Export Job"}
      </Button>

      {summary?.recordCount === 0 && !loadingSummary && (
        <p className="text-center text-sm text-ink-muted">No records saved yet - nothing to export.</p>
      )}
      {resultMessage && <p className="text-center text-sm font-semibold text-good">{resultMessage}</p>}
      {errorMessage && <p className="text-center text-sm font-semibold text-poor">{errorMessage}</p>}
    </div>
  );
}
