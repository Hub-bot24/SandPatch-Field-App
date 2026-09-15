import ExcelJS from "exceljs";
import JSZip from "jszip";
import { withBasePath } from "@/lib/config";
import { formatChainage } from "@/lib/calculations/format";
import type { Job } from "@/types/job";
import type { ExportRow } from "./exportData";

/**
 * Populates the real lab Sand Patch Excel template (public/templates/sand-
 * patch-master.xlsx) from the same `ExportRow[]` the CSV export uses.
 *
 * The template's data area is a fixed 18 rows per sheet (rows 16-33), so a
 * job with more than 18 records gets one full copy of the sheet per batch
 * of 18, all inside one workbook - never a second, separate file, and never
 * a silently truncated export.
 *
 * Only genuine input cells are ever written (road, chainage, offset,
 * direction, control line, the four diameters, sand volume, existing
 * aggregate size, notes). AD/AG (average diameter, texture depth) and
 * AK/AL/AM (which reference an external "AllowanceAdjustments" workbook)
 * are template formulas and are never touched or reimplemented - see the
 * project's explicit rule against inventing seal-design/allowance logic.
 */

const TEMPLATE_URL = withBasePath("/templates/sand-patch-master.xlsx");
const TEMPLATE_SHEET_NAME = "Blank  (3)";
const FIRST_DATA_ROW = 16;
const ROWS_PER_SHEET = 18;
const NOTES_ROW = 34;

// The template pre-merges chainage across two rows in its first two row
// pairs only (a layout convenience for "one chainage, two tests" - the
// remaining rows are already single independent cells). A chainage can
// have any number of associated rows in real data (one lane, two lanes, a
// shoulder), so every row always gets its own independent chainage value -
// these two pre-existing merges are undone before any data is written.
const PREMERGED_CHAINAGE_RANGES = ["N16:O17", "N18:O19"];

// exceljs's writer drops the workbook-level external link *registration*
// (xl/externalLinks/ + workbook.xml's <externalReferences> + the
// workbook.xml.rels entry) even though it preserves each formula's text -
// verified by round-tripping the template unchanged and diffing the raw
// zip. Silently losing that registration would permanently break the
// Allowance column's link even in an environment where the linked
// workbook is reachable, so it's restored from the original template
// bytes after exceljs finishes writing. See EXTERNAL_LINK_CONTENT_TYPE.
const EXTERNAL_LINK_PART = "xl/externalLinks/externalLink1.xml";
const EXTERNAL_LINK_RELS_PART = "xl/externalLinks/_rels/externalLink1.xml.rels";
const EXTERNAL_LINK_RELATIONSHIP_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink";
const EXTERNAL_LINK_CONTENT_TYPE_OVERRIDE =
  '<Override PartName="/xl/externalLinks/externalLink1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>';

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Writes a numeric-looking string as a real number (matching the template's own convention), or as plain text if it isn't one. Blank clears the cell. */
function writeNumericOrText(cell: ExcelJS.Cell, value: string): void {
  const trimmed = value.trim();
  if (trimmed === "") {
    cell.value = null;
    return;
  }
  const asNumber = Number(trimmed);
  cell.value = Number.isFinite(asNumber) ? asNumber : trimmed;
}

/**
 * Deep-copies one worksheet (values, formulas, styles, merges, column
 * widths, row heights) into a new sheet in the same workbook. exceljs has
 * no first-class "duplicate worksheet" API, so this is done cell by cell;
 * formulas that reference the external workbook (the `[1]...` tokens) are
 * copied as plain formula text and resolve correctly because the external
 * reference table itself is workbook-scoped, not worksheet-scoped.
 */
function cloneTemplateSheet(
  workbook: ExcelJS.Workbook,
  source: ExcelJS.Worksheet,
  newName: string,
): ExcelJS.Worksheet {
  const dest = workbook.addWorksheet(newName, {
    properties: { ...source.properties },
    pageSetup: { ...source.pageSetup },
  });

  // AM's formula qualifies one of its own operands with the sheet's own
  // name (e.g. `MATCH('Blank  (3)'!AK16,...)` - needed because the rest of
  // that expression already references an external workbook). Renaming a
  // worksheet does not rewrite that literal text inside other formulas, so
  // every copied formula's self-reference is repointed at the new sheet's
  // own name - otherwise every cloned sheet's Allowance column would look
  // up the *original* sheet's row instead of its own.
  const sourceSelfRef = `'${source.name}'!`;
  const destSelfRef = `'${dest.name}'!`;

  for (let c = 1; c <= source.columnCount; c++) {
    dest.getColumn(c).width = source.getColumn(c).width;
  }
  for (let r = 1; r <= source.rowCount; r++) {
    dest.getRow(r).height = source.getRow(r).height;
  }
  for (const merge of source.model.merges ?? []) {
    dest.mergeCells(merge);
  }
  for (let r = 1; r <= source.rowCount; r++) {
    const srcRow = source.getRow(r);
    const dstRow = dest.getRow(r);
    srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      if (cell.formula) {
        const rewrittenFormula = cell.formula.split(sourceSelfRef).join(destSelfRef);
        dstCell.value = { formula: rewrittenFormula };
      } else {
        dstCell.value = cell.value;
      }
      if (cell.style) {
        dstCell.style = JSON.parse(JSON.stringify(cell.style)) as typeof cell.style;
      }
      if (cell.numFmt) {
        dstCell.numFmt = cell.numFmt;
      }
    });
    dstRow.commit();
  }

  for (const range of PREMERGED_CHAINAGE_RANGES) {
    dest.unMergeCells(range);
  }

  return dest;
}

/** DD/MM/YYYY for a single shared test date, or an earliest-latest range when a sheet's batch spans more than one calendar day. Blank if no record has a date. */
function formatSampledDateRange(rows: ExportRow[]): string {
  const dates = rows
    .map((row) => row.record.testDateTime)
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => new Date(iso))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return "";

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const first = fmt(dates[0]);
  const last = fmt(dates[dates.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

function writeHeader(sheet: ExcelJS.Worksheet, job: Job | null, chunkRows: ExportRow[]): void {
  if (job) {
    writeNumericOrText(sheet.getCell("H6"), job.contractJobNumber);
    writeNumericOrText(sheet.getCell("H9"), job.existingAggregateSize);
    writeNumericOrText(sheet.getCell("H10"), job.proposedAggregateSize);
    sheet.getCell("AB8").value = job.operator || null;
  }
  const dateRange = formatSampledDateRange(chunkRows);
  sheet.getCell("AB7").value = dateRange || null;
  // No corresponding app data exists for Customer, Lab Sample No, Purchase
  // Order/Test Request #, Project/Site Number, Existing Pavement Surface,
  // or Sand Patch Mould ID - left exactly as the template has them
  // (blank) rather than guessed.
}

function writeNotes(sheet: ExcelJS.Worksheet, chunkRows: ExportRow[]): void {
  const lines = chunkRows
    .filter((row) => row.record.notes.trim() !== "")
    .map((row) => {
      const { record } = row;
      const chainage = record.chainageKm !== null ? `${formatChainage(record.chainageKm)}km` : "no chainage";
      const label = [record.road, chainage, record.direction, record.controlLine].filter(Boolean).join(" ");
      return `${label}: ${record.notes.trim()}`;
    });
  if (lines.length > 0) {
    sheet.getCell(`A${NOTES_ROW}`).value = lines.join("\n");
  }
}

function writeDataRow(sheet: ExcelJS.Worksheet, rowNumber: number, row: ExportRow): void {
  const { record } = row;

  sheet.getCell(`A${rowNumber}`).value = record.road || null;
  writeNumericOrText(sheet.getCell(`H${rowNumber}`), record.existingAggregateSize);

  const chainageCell = sheet.getCell(`N${rowNumber}`);
  chainageCell.value = record.chainageKm;
  chainageCell.numFmt = "0.000";

  sheet.getCell(`P${rowNumber}`).value = record.offsetM;
  sheet.getCell(`R${rowNumber}`).value = record.direction || null;
  sheet.getCell(`S${rowNumber}`).value = record.controlLine || null;

  sheet.getCell(`V${rowNumber}`).value = record.diameter1Mm;
  sheet.getCell(`X${rowNumber}`).value = record.diameter2Mm;
  sheet.getCell(`Z${rowNumber}`).value = record.diameter3Mm;
  sheet.getCell(`AB${rowNumber}`).value = record.diameter4Mm;

  // Overwrites the template's own `IF(offset=100,100,50)` proxy formula
  // with the app's authoritative sandVolumeMl - AG's texture-depth formula
  // reads this cell by reference either way, so this is a value swap only,
  // never a change to AD/AG/AK/AL/AM's formulas themselves.
  sheet.getCell(`U${rowNumber}`).value = record.sandVolumeMl;
}

function clearUnusedRow(sheet: ExcelJS.Worksheet, rowNumber: number): void {
  // The template's own "blank" copy carries stale sample content in the
  // per-row existing-aggregate-size cell on every row (a leftover value
  // from whatever job it was last used for, not template furniture) - any
  // row in the last, partially-filled sheet of a batch must not show that
  // leftover value next to what is otherwise a genuinely empty row.
  sheet.getCell(`H${rowNumber}`).value = null;
}

async function buildSheetForChunk(
  workbook: ExcelJS.Workbook,
  templateSheet: ExcelJS.Worksheet,
  chunkIndex: number,
  chunkRows: ExportRow[],
  job: Job | null,
): Promise<void> {
  const sheet =
    chunkIndex === 0
      ? templateSheet
      : cloneTemplateSheet(workbook, templateSheet, `Records ${chunkIndex * ROWS_PER_SHEET + 1}-${(chunkIndex + 1) * ROWS_PER_SHEET}`);

  if (chunkIndex === 0) {
    for (const range of PREMERGED_CHAINAGE_RANGES) {
      sheet.unMergeCells(range);
    }
  }

  writeHeader(sheet, job, chunkRows);

  for (let i = 0; i < ROWS_PER_SHEET; i++) {
    const rowNumber = FIRST_DATA_ROW + i;
    const row = chunkRows[i];
    if (row) {
      writeDataRow(sheet, rowNumber, row);
    } else {
      clearUnusedRow(sheet, rowNumber);
    }
  }

  writeNotes(sheet, chunkRows);
}

/** Copies the two external-link parts and re-registers them in workbook.xml/.rels/[Content_Types].xml, undoing exceljs's write-time drop of that registration (see the module doc comment above). */
async function restoreExternalLinkRegistration(outputZip: JSZip, templateBuffer: ArrayBuffer): Promise<void> {
  const templateZip = await JSZip.loadAsync(templateBuffer);
  const linkXml = templateZip.file(EXTERNAL_LINK_PART);
  const linkRelsXml = templateZip.file(EXTERNAL_LINK_RELS_PART);
  if (!linkXml || !linkRelsXml) {
    // This template has no external link to restore - nothing to do.
    return;
  }

  outputZip.file(EXTERNAL_LINK_PART, await linkXml.async("uint8array"));
  outputZip.file(EXTERNAL_LINK_RELS_PART, await linkRelsXml.async("uint8array"));

  const contentTypesFile = outputZip.file("[Content_Types].xml");
  const workbookRelsFile = outputZip.file("xl/_rels/workbook.xml.rels");
  const workbookFile = outputZip.file("xl/workbook.xml");
  if (!contentTypesFile || !workbookRelsFile || !workbookFile) {
    throw new Error("Excel export: unexpected workbook structure - missing a required part.");
  }

  const contentTypes = await contentTypesFile.async("string");
  if (!contentTypes.includes("externalLink")) {
    outputZip.file(
      "[Content_Types].xml",
      contentTypes.replace("</Types>", `${EXTERNAL_LINK_CONTENT_TYPE_OVERRIDE}</Types>`),
    );
  }

  const workbookRels = await workbookRelsFile.async("string");
  const existingIds = Array.from(workbookRels.matchAll(/Id="rId(\d+)"/g)).map((m) => Number(m[1]));
  const nextId = `rId${Math.max(0, ...existingIds) + 1}`;
  const relationshipEntry = `<Relationship Id="${nextId}" Type="${EXTERNAL_LINK_RELATIONSHIP_TYPE}" Target="externalLinks/externalLink1.xml"/>`;
  outputZip.file(
    "xl/_rels/workbook.xml.rels",
    workbookRels.replace("</Relationships>", `${relationshipEntry}</Relationships>`),
  );

  const workbookXml = await workbookFile.async("string");
  const externalReferencesNode = `<externalReferences><externalReference r:id="${nextId}"/></externalReferences>`;
  const patchedWorkbookXml = workbookXml.includes("</sheets>")
    ? workbookXml.replace("</sheets>", `</sheets>${externalReferencesNode}`)
    : workbookXml;
  outputZip.file("xl/workbook.xml", patchedWorkbookXml);
}

export async function exportToExcelTemplate(rows: ExportRow[], job: Job | null): Promise<Blob> {
  const templateResponse = await fetch(TEMPLATE_URL);
  if (!templateResponse.ok) {
    throw new Error("Could not load the Sand Patch Excel template.");
  }
  const templateBuffer = await templateResponse.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  const templateSheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME);
  if (!templateSheet) {
    throw new Error("Sand Patch Excel template is missing its data sheet.");
  }
  // Never leave a fully empty form with no rows at all - an empty job still
  // gets one blank copy of the sheet, matching what opening the template
  // directly would show.
  const chunks = rows.length > 0 ? chunk(rows, ROWS_PER_SHEET) : [[]];

  for (let i = 0; i < chunks.length; i++) {
    await buildSheetForChunk(workbook, templateSheet, i, chunks[i], job);
  }

  const outputBuffer = await workbook.xlsx.writeBuffer();
  const outputZip = await JSZip.loadAsync(outputBuffer);
  await restoreExternalLinkRegistration(outputZip, templateBuffer);

  const patchedBuffer = await outputZip.generateAsync({ type: "arraybuffer" });
  return new Blob([patchedBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
