# SandPatch Field App

A mobile-first, installable PWA for capturing sand patch texture depth test
data in the field during road surfacing QA. Version 1 is fully offline after
first load, stores everything locally (job setup, records, photos) in
IndexedDB, and has no backend and no third-party data collection.

Diameters are captured with **automatic measurement**: there is no
calibration step anywhere, ever - every "Take All 4 Photos" run reads
each photo's own ruler and measures its own patch by itself, with no taps
and no per-test or per-job setup of any kind. This is real computer
vision (a steepest-contrast-change line scan finds the patch's edges, and
OCR reads the ruler's printed numbers right at those edges - see
"Automatic measurement" below), not a black box: every result is visible
on-screen immediately, so a bad read is never hidden, and every diameter
field stays a plain editable number in case one needs correcting by hand.
Reading each photo's ruler independently, rather than one calibration
reused across a job, means the camera doesn't need to be held at a
consistent height or distance across a whole day of testing - each of the
four photos scales itself. If a given photo's ruler numbers can't be read
confidently near its edges (poor lighting, glare, an unusual ruler),
**tap-to-measure** (tap a ruler and the patch edges directly on that one
photo) remains available as a manual fallback. A separate, larger Version
2 placeholder - full perspective correction for a ruler photographed at a
steep angle (`SandPatchMeasurementEngine`, returns `NOT_IMPLEMENTED`) -
remains deliberately unbuilt; do not build that until Version 1 is stable
in real field use.

## Main workflow

1. **Job Setup** (`/job`) - road, contract/job number, lot number, operator,
   existing/proposed aggregate size, default sand volume, and ruler length
   (the tap-to-measure fallback's calibration constant, default 300mm).
   Saved once, prefills every new record.
2. **New Test** (`/`) - the main field screen. Road, chainage, direction,
   offset, control line, GPS, four photos, four diameters, live average
   diameter + texture depth, notes, Save Record. "Take All 4 Photos" drives
   the camera through all four shots back-to-back, measuring each one
   automatically with no taps and no calibration prompt of any kind - each
   photo reads its own ruler. Each Photo/Diameter step also has its own
   "Measure from Photo" button for a manual tap-to-measure fallback, and
   every diameter field stays a plain editable number so any reading can
   always be corrected by hand. After saving, the form resets for the next
   test but keeps road/direction/control line/sand volume so a run of
   consecutive tests along a road needs minimal retyping.
3. **Records** (`/records`) - all saved records, sorted by road then
   chainage ascending. Tap a card to view, edit, or delete (with
   confirmation) a record.
4. **Export** (`/export`) - Export Job produces a ZIP: a CSV of every
   record, the populated Sand Patch lab Excel form, and a `photos/`
   folder, named `Road_Chainage_Direction_PhotoN.jpg`.

## Calculations (exact, no invented allowances)

- Average diameter = mean of the four diameter readings.
- Texture depth: `TD = (4 x V x 1000) / (pi x D^2)`, `D` = average diameter
  (mm), `V` = sand volume (50 or 100 mL). Displayed to 2 decimal places.
- No binder allowance, seal design allowance, AGPT04K allowance, or TMR
  adjustment is implemented or implied anywhere.
- Worked example: diameters 240/245/238/242 mm -> average 241.25 mm; at
  50 mL, TD ~= 1.0938 mm, displayed as **1.09 mm**. See
  `tests/calculations/textureDepth.test.ts`.

A record is **READY** only when chainage, all four diameters, and all four
photos are present; otherwise it is **INCOMPLETE** (a fully valid, savable
state - field work is often interrupted).

## Architecture

```
app/                  Routes (App Router, static export). No API routes.
components/ui/        Generic primitives (Button, NumericField, SegmentedControl, ...)
components/record/    Record form, list, card, detail view
components/gps/       GPS capture control
components/photo/     Camera capture slot, tap-to-measure overlay
components/job/       Job Setup form
components/export/    Export panel
components/status/    Status/GPS/online pills and badges
components/layout/    App shell, bottom nav
components/pwa/       Service worker registration
lib/db/               IndexedDB (via idb): schema + versioned migrations, repositories
lib/calculations/     Average diameter, texture depth, READY/INCOMPLETE, formatting
lib/gps/              Geolocation wrapper + GOOD/CHECK/POOR classification
lib/images/           Camera photo compression, photo -> grayscale pixel extraction
lib/export/           CSV, filename sanitisation/naming, ZIP, Excel lab form writer
lib/measurement/      automatic patch-edge detection + OCR ruler reading + tap-to-measure geometry (V1), engine placeholder (V2)
lib/validation/       Field validation (chainage/diameter/offset)
types/                Job, SandPatchRecord, PhotoRecord, measurement types
tests/                Vitest unit tests
public/sw.js          Hand-rolled service worker (no next-pwa/Workbox)
public/vendor/         Vendored OCR assets (Tesseract.js worker/core/trained-data) - never CDN-fetched
scripts/              Icon generation (one-off) + build-version stamping (every install/dev/build)
```

Every `SandPatchRecord` has a UUID `id`, `createdAt`, `updatedAt`. Every
`PhotoRecord` has its own UUID plus a `recordId` + `photoNumber` (1-4) -
photos are always looked up by that pair, never by array position, so
photo association can never get mixed between chainages. `averageDiameterMm`
and `textureDepthMm` are recomputed from the four diameters + sand volume on
every save (never hand-edited, never left stale). Editing a record preserves
its `id`/`createdAt` and only ever updates `updatedAt`.

**IndexedDB schema versioning**: `lib/db/schema.ts` defines `DB_VERSION` and
an additive `upgrade()` migration function. Future versions add
`if (oldVersion < N)` blocks that create/extend stores - never drop a store
or clear data.

### Automatic measurement

There is no calibration step, no stored scale, and no "hold the camera
the same way as last time" assumption anywhere in this pipeline - every
photo supplies its own scale from its own ruler, read at the exact point
each edge is found. Three pieces combine, all per photo, every time
"Take All 4 Photos" runs:

**1. Finding the patch's edges** - `lib/measurement/autoDetect.ts`'s
`detectPatchEdges()` measures the sand patch the way the real field
technique does: along one line, the same way an operator would lay a
physical ruler across the patch at a given angle - not by measuring the
size of the whole visible sand shape. That distinction matters because
the field protocol takes four separate readings at four different angles
specifically to catch a patch that isn't perfectly round; a "whole shape"
measurement would give the same answer regardless of angle and would
silently defeat the point of taking four readings at all. So detection
samples a thin horizontal band across the vertical centre of the photo
(16% of the frame's height, averaged into one brightness value per
column, which smooths out sand-grain and JPEG noise), then walks outward
from the centre on each side looking for the point of steepest brightness
change - the column-to-column jump (or, across a gradual fade, the middle
of the steepest run of change) that stands out most from the typical
change level elsewhere on that side. That steepest-change point, rather
than a single fixed brightness cutoff, is what makes this robust to a
real sand edge, which is often a gradual fade rather than a hard line.
Every result carries a `confidence` per edge (how sharply it stood out
against the background noise level) - purely informational, never a gate.

**2. Reading the ruler's numbers** - `lib/measurement/ocrRuler.ts` runs
OCR (Tesseract.js, vendored locally - see "Fully offline OCR" below) over
the same photo and returns every cleanly-recognized whole number, with
its position and confidence. One Tesseract worker is created per guided-
capture run and reused across all four photos (`createRulerOcrWorker()`),
rather than paying its start-up cost four times over - but only lazily,
the first time a photo actually needs measuring
(`components/record/SandPatchRecordForm.tsx`'s `ensureOcrWorker()`), never
in parallel with opening the camera for a shot that hasn't been taken yet.
Mobile browsers can suspend or heavily throttle a backgrounded page's
JavaScript - including in-flight Worker/WASM start-up - while a native
camera app has the foreground; starting the worker as soon as "Take All 4
Photos" was tapped, racing against exactly that hand-off, broke automatic
measurement outright on a real phone before this was caught. If a given
attempt fails, the next photo tries again rather than the whole run being
permanently stuck falling back to manual measurement.

**3. Reading each edge directly off those numbers** -
`lib/measurement/readRulerAtEdge.ts`'s `readDiameterFromEdges()` is the
step that replaces calibration entirely: for each detected edge, it finds
the two recognized ruler numbers immediately bracketing it (one on each
side, confidently recognized, on the same line as the edge) and linearly
interpolates the exact millimetre value at that pixel - the digital
equivalent of a person reading the ruler mark nearest where the patch
ends and mentally splitting the small remaining gap, rather than
computing an abstract pixels-per-mm ratio and applying it elsewhere. This
mirrors, digitally, the same problem a second ruler solves by hand at a
fuzzy patch edge - turning an inherently unclear boundary into one
specific, exact point to read. Numbers may increase or decrease
left-to-right (the ruler could be laid down either way); the
interpolation is direction-agnostic. The diameter is simply the
difference between the two edges' millimetre readings.

A result is only ever `null` - never a guess - when an edge itself isn't
clear enough to trust (a blank or fully-uniform photo), or when the
ruler's numbers can't be read confidently enough near an edge to bracket
it (the edge is beyond the ruler's legible numbers, or nothing nearby was
read confidently); the diameter field is simply left empty for manual
entry rather than a fabricated number appearing. `detectPatchEdges()`
scans a downsampled (400px) copy of the photo for speed, while OCR reads
the numbers from the original, full-resolution photo (small print needs
real resolution to stay legible) - `lib/images/grayscale.ts`'s
`blobToGrayscaleImage()` reports how much smaller that downsampled copy
is, and `lib/measurement/measurePatch.ts`'s `measurePatchFromPhoto()`
(the function that ties all three steps together for one photo) converts
the detected edges back up to the original photo's pixel space by that
same factor before matching them against the ruler numbers' positions.

Because this measures along one line rather than the whole photo, it
assumes each photo is framed the way the physical technique frames a
ruler shot: the ruler laid across the patch, running left-to-right, with
its printed numbers clearly visible near both edges of the sand (the
guided capture screen shows this reminder before every run) - see "Known
limitations" below for what happens when a photo doesn't meet that
assumption.

### Tap-to-measure (manual fallback)

`lib/measurement/tapMeasure.ts`'s `computeTapMeasurement()` is the manual
alternative when an automatic reading looks wrong: the operator taps the
two ends of a ruler laid across the sand patch (a known real-world
distance - the "Ruler Length" set in Job Setup, default 300mm) to
establish a pixels-per-mm scale, then the two patch edges along that same
line. Edge taps are projected onto the calibration axis, so a tap that's a
few pixels off the ruler's exact line still measures correctly along it.
`MIN_CALIBRATION_PIXELS` guards the one way this could go obviously wrong
(two calibration taps on the same spot) by returning `null` instead of a
wild, divide-by-near-zero number.

This is deliberately not computer vision: `components/photo/TapMeasureOverlay.tsx`
never detects anything itself, it only does the pixel-distance-to-mm
arithmetic on points a human identified, so there is no confidence score or
detection failure mode to reason about - the computed distance is always
shown before it can be confirmed, and every diameter field stays a plain
editable number afterwards. Each Photo/Diameter step's "Measure from
Photo" button opens this to re-measure a single already-taken photo by
hand, standalone from the automatic guided capture.

### Excel lab form export

`lib/export/exportData.ts`'s `buildExportDataset()` is the single source of
truth consumed by both the CSV export and `lib/export/excelExport.ts`'s
`exportToExcelTemplate()`, which populates the real lab template at
`public/templates/sand-patch-master.xlsx` and is bundled into the export
ZIP alongside the CSV as `sand_patch_lab_form.xlsx`.

The template's data area is a fixed 18 rows per sheet - a job with more
than 18 records gets one full copy of the sheet per batch of 18, all
inside the one workbook, so there is no cap on how many records an export
can hold. Only genuine input cells (road, chainage, offset, direction,
control line, the four diameters, sand volume, existing aggregate size,
notes) are ever written. The average-diameter/texture-depth formulas and
the columns that reference an external "AllowanceAdjustments" workbook are
never touched or reimplemented, per this project's rule against inventing
seal-design/allowance logic - if that external workbook isn't reachable
from wherever the exported file is opened, those cells show the same
`#N/A` the blank template itself shows, which is expected, not a bug this
app introduced.

exceljs's writer silently drops the workbook-level *registration* of that
external link (while still preserving each formula's text) on a plain
read-and-write round trip - confirmed by diffing the raw zip parts before
and after. `restoreExternalLinkRegistration()` copies the two external-link
parts back from the original template bytes and re-adds the
`workbook.xml`/`.rels`/`[Content_Types].xml` entries exceljs strips, after
exceljs finishes writing everything else.

A handful of header fields the template has no app data for (Customer, Lab
Sample No, Purchase Order/Test Request #, Project/Site Number, Existing
Pavement Surface, Sand Patch Mould ID) are left exactly as blank as the
template itself, rather than guessed - the underlying data is unaffected,
they simply have no corresponding field to draw from.

### Version 2 placeholder

`types/measurement.ts` defines the `SandPatchMeasurementEngine` interface
and `MeasurementResult` shape (diameter1-4, averageDiameter, confidence,
detectedBoundary, calibrationQuality, perspectiveCorrectionApplied,
requiresManualReview) for a future pipeline that adds full perspective
correction - accounting for a ruler photographed at a steep angle to the
camera, where the pixel-to-millimetre relationship along its length is no
longer linear. What's implemented now already reads each photo's ruler
fresh and independently (see "Automatic measurement" above) - the gap
this placeholder would close is narrower than it once was: correcting for
camera angle itself, not for camera *distance* or a shared per-job
calibration, neither of which apply anymore.
`lib/measurement/notImplementedEngine.ts` is the only implementation and
always returns `status: "NOT_IMPLEMENTED"` - it never fabricates diameters
or a boundary from a photo. The New Test screen has a "Try Fully-Automatic
Detection (Version 2 preview)" link that calls it, purely to show where
this plugs in later.

### Fully offline OCR

Automatic measurement's OCR (`lib/measurement/ocrRuler.ts`) uses
[Tesseract.js](https://github.com/naptha/tesseract.js), which by default
fetches its worker script, WASM engine, and trained-language data from a
CDN the first time it runs - unacceptable for an app that must work
offline after first load. All three are vendored into
`public/vendor/tesseract/` instead (~15MB total: the worker script, the
LSTM-only WASM core, and the full English trained-data file - the smaller
int8-quantized trained-data variant was tested and rejected because it
missed most of a real ruler's numbers that the full variant read
correctly) and added to the service worker's install-time precache list
alongside the Excel template, so automatic measurement works on the very
first offline use. Verified end-to-end with Playwright, monitoring every
network request during a full guided-capture run against real ruler
photos: zero requests left `localhost`.

## Local development

Requires Node.js 20+ (built and tested on Node 22).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Camera, GPS, and full offline/installability
require a real mobile browser (or desktop Chrome DevTools device emulation)
and, outside of `localhost`, HTTPS.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production static export (outputs to `out/`) |
| `npm start` | Serve the built `out/` folder locally (`npx serve out`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the unit test suite once (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run generate-icons` | Regenerate `public/icons/*.png` and `app/favicon.ico` |

The production build is a full static export (`output: "export"` in
`next.config.ts`) - no Node server is required to run the app; `out/` can be
served by any static file host.

### Knowing which build is running

Every screen's header shows the build's date/time and short git commit
(e.g. "16 Sep 02:35 UTC · cd15273") - the whole point is being able to
tell "is this the latest app?" at a glance, without guessing from a
screenshot. `scripts/generate-version.mjs` writes this into
`lib/version.generated.json` (gitignored - a committed value would go
stale the moment another commit is made) from the current git commit and
timestamp; it runs automatically via `postinstall`, `predev`, and
`prebuild` in `package.json`, so every real dev/build/CI path always has
a fresh, correct value with nothing to configure. If git isn't available
at build time (e.g. building from a source tarball with no `.git`
directory), the badge falls back to showing just the build time.

## Deploying to GitHub

```bash
git init                     # if not already a repo
git add .
git commit -m "SandPatch Field App v1"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## Deploying to GitHub Pages (no external account needed)

`.github/workflows/deploy-pages.yml` builds and publishes the app to GitHub
Pages automatically on every push to `main`. GitHub Pages serves a project
repository at `https://<owner>.github.io/<repo-name>/` rather than a domain
root, so the workflow passes `NEXT_PUBLIC_BASE_PATH` (auto-detected from the
repo name via `actions/configure-pages`) into the build - see `lib/config.ts`
and `next.config.ts`. Locally, or on a host that serves from the root
(Vercel, Netlify, ...), this variable is simply unset and the app behaves
exactly as if there were no subpath.

**One-time setup** (repository owner only, cannot be done via the API used
here): go to the repo's **Settings -> Pages**, and under "Build and
deployment", set **Source** to **GitHub Actions**. After that, every push to
`main` deploys automatically - the live URL appears on that same Settings
page and in the workflow run's summary.

## Deploying to Vercel (alternative)

1. Sign up/log in at vercel.com, ideally with **Continue with GitHub** using
   the account that owns this repo - no separate password needed.
2. In the Vercel dashboard: **Add New... -> Project**, import the repo.
3. Framework preset: Next.js (auto-detected). Leave `NEXT_PUBLIC_BASE_PATH`
   unset - Vercel serves from the root, so no base path is needed. No other
   environment variables are required - Version 1 has no backend.
4. Deploy. Vercel serves the static export directly; every route in this
   app is prerendered, so there is nothing else to configure.
5. Vercel deployments are HTTPS by default, which is required for
   geolocation, camera, and service worker installability outside of
   `localhost`.

The app is a static export, so it can equally be deployed to Netlify,
Cloudflare Pages, or any static host by uploading the contents of `out/`
after `npm run build` (leave `NEXT_PUBLIC_BASE_PATH` unset for any host that
serves from its own root).

## Installing on iPhone (Safari)

1. Open the deployed HTTPS URL in **Safari** (the Add to Home Screen PWA
   flow is Safari-only on iOS - it does not work from Chrome/Firefox on
   iOS, which all use Safari's engine but not its install UI).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name ("SandPatch") and tap **Add**.
5. Launch the app from the new home screen icon - it opens full-screen
   (standalone mode, no Safari address bar).

## Installing on Android (Chrome)

1. Open the deployed HTTPS URL in **Chrome**.
2. Chrome will typically show an **Install app** / **Add to Home screen**
   banner automatically; if not, tap the **⋮** menu and choose **Install
   app** (or **Add to Home screen**).
3. Confirm. The app icon appears on the home screen and app drawer, and
   launches full-screen like a native app.

## Data safety

- Nothing is uploaded anywhere. GPS, photos, measurements, and job data
  never leave the device in Version 1.
- No analytics, no tracking, no third-party network calls.
- No demo/seed data is ever inserted automatically.
- Deleting a record requires explicit confirmation and cascades to its
  photos in one transaction; nothing else is touched.
- Saving a record never silently overwrites another (`add` is used for new
  records; edits require the record to already exist and always preserve
  `id`/`createdAt`).

## Known limitations / browser-specific notes

- **iOS Safari download UX**: exporting a ZIP on iOS opens it via Safari's
  download UI (it may prompt to save to the Files app or open in a new tab)
  rather than a traditional desktop "Save As" dialog. This is a platform
  constraint, not app behavior.
- **Abandoned draft cleanup depends on a normal app close**: photos taken
  during a new (unsaved) test are stored immediately so they're never lost
  mid-form, tagged to that draft's id. If the record is never saved, they
  are cleaned up when the field/session unmounts normally (navigating away)
  or opportunistically the next time the Records list loads. A hard kill of
  the browser/app before either of those runs can leave an orphaned photo
  in local storage until the next Records list visit reclaims it - it is
  never shown as part of any record and is reclaimed automatically.
- **Camera input uses `<input capture>`**, which opens the native camera
  directly on iOS Safari and Android Chrome; some Android browsers may
  instead show a chooser (camera or gallery). Real camera hardware could
  not be exercised in this build environment - verification here used
  Playwright's file-input injection to exercise the same capture ->
  compress -> store -> preview pipeline a real photo takes.
- **Automatic measurement no longer depends on a consistent camera
  distance across a job** - this used to be a real limitation (one
  calibration reused for a whole job, so holding the phone even slightly
  differently between tests became measurement error), and no longer
  applies: every photo now reads its own ruler independently, so a phone
  held closer, farther, or at a different height from one test to the
  next - inevitable across a day of testing - causes no error.
- **Automatic measurement's accuracy still depends on real contrast,
  correct framing, and the ruler's numbers being legible near both
  edges**, not on any app-side correction: it needs the sand patch to
  actually look lighter than the surrounding pavement along the scanned
  line (a very light-coloured concrete surface, harsh shadows cutting
  across the patch, or a very washed-out/overexposed photo can all
  confuse the edge scan), and - because it measures along one horizontal
  line through the vertical centre of the photo rather than the whole
  visible shape - each photo needs to be framed with the ruler laid
  across the patch, running left-to-right, with its printed numbers
  clearly visible near both edges of the sand (the guided capture screen
  reminds the operator of this before every run). A patch that sits well
  above or below the frame's vertical centre, a shot rotated so the
  intended measuring direction runs more up-down than left-right, or a
  ruler whose numbers near one edge are obscured, blurred, or too far
  from that edge to bracket it confidently, can leave that one diameter
  unmeasured (left blank for manual entry) or, if the ruler itself isn't
  visible at all, miss the patch's edges entirely. There is no
  perspective correction for a ruler photographed at a steep angle to the
  camera. None of this is silent: every reading is shown on-screen
  immediately, and "Measure from Photo" is always available to override a
  reading, or supply one, by hand.
- **Tesseract.js's OCR is CPU-bound and single-threaded in this setup** -
  each photo's read takes a few seconds on a typical phone (longer on an
  older or lower-end device), during which the UI shows "Measuring Photo
  N…"; across all four photos in a guided-capture run this adds up to
  more total time than the single one-off calibration read a previous
  version of this app used, in exchange for not needing that calibration
  step, or its consistent-camera-distance assumption, at all. One
  Tesseract worker is reused across all four photos in a run rather than
  restarted for each one, which keeps this to roughly the cost of OCR
  itself, not repeated start-up overhead.
- **Tap-to-measure (the manual fallback) accuracy depends on the photo and
  the operator's taps**, not on any app-side correction: the ruler must
  actually be visible along the same line as the patch edges in the shot,
  the "Ruler Length" in Job Setup must match the physical ruler in hand,
  and tap precision (use the +/- zoom in the overlay) sets the achievable
  accuracy. There is no perspective correction here either.
- **Geolocation permission handling** was verified with a deterministic
  stub (denied/unavailable/timeout all map to a clear on-screen message
  and never block Save); real-device permission-prompt UX will vary
  slightly by browser but always resolves to one of those same states.
- **Offline is guaranteed only after a first online visit** actually
  fetches the app's pages/assets (the service worker also proactively
  precaches the five known routes and their JS/CSS, plus the Excel lab
  form template, at install time, so a single visit to `/` while online is
  normally enough - including for an Excel export on the very first
  offline use).
- **Static export constraints**: no server-side API routes, middleware, or
  image optimization are used or available in Version 1, by design (no
  backend is required or wanted).
