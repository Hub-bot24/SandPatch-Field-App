# SandPatch Field App

A mobile-first, installable PWA for capturing sand patch texture depth test
data in the field during road surfacing QA. Version 1 is fully offline after
first load, stores everything locally (job setup, records, photos) in
IndexedDB, and has no backend and no third-party data collection.

Do not build the Version 2 automatic ruler/sand-edge photo measurement
described below until this Version 1 is stable in real field use - it is
intentionally a placeholder (`SandPatchMeasurementEngine`) that returns
`NOT_IMPLEMENTED`.

## Main workflow

1. **Job Setup** (`/job`) - road, contract/job number, lot number, operator,
   existing/proposed aggregate size, default sand volume. Saved once,
   prefills every new record.
2. **New Test** (`/`) - the main field screen. Road, chainage, direction,
   offset, control line, GPS, four photos, four diameters, live average
   diameter + texture depth, notes, Save Record. After saving, the form
   resets for the next test but keeps road/direction/control line/sand
   volume so a run of consecutive tests along a road needs minimal retyping.
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
components/photo/     Camera capture slot
components/job/       Job Setup form
components/export/    Export panel
components/status/    Status/GPS/online pills and badges
components/layout/    App shell, bottom nav
components/pwa/       Service worker registration
lib/db/               IndexedDB (via idb): schema + versioned migrations, repositories
lib/calculations/     Average diameter, texture depth, READY/INCOMPLETE, formatting
lib/gps/              Geolocation wrapper + GOOD/CHECK/POOR classification
lib/images/           Camera photo compression (resize + re-encode to JPEG)
lib/export/           CSV, filename sanitisation/naming, ZIP, Excel lab form writer
lib/measurement/      SandPatchMeasurementEngine placeholder (Version 2)
lib/validation/       Field validation (chainage/diameter/offset)
types/                Job, SandPatchRecord, PhotoRecord, measurement types
tests/                Vitest unit tests
public/sw.js          Hand-rolled service worker (no next-pwa/Workbox)
scripts/              One-off dev utility: generates the placeholder PNG/ICO icons
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
requiresManualReview) for the future two-ruler/sand-edge computer vision
pipeline. `lib/measurement/notImplementedEngine.ts` is the only
implementation and always returns `status: "NOT_IMPLEMENTED"` - it never
fabricates diameters or a boundary from a photo. The New Test screen has a
"Try Auto-Measure (Version 2 preview)" link that calls it, purely to show
where this plugs in later.

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
