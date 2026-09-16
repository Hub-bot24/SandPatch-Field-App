#!/usr/bin/env node
// Writes lib/version.generated.json with the current git commit and build
// time, so the app can show "is this the latest build" on screen (see
// components/status/VersionBadge.tsx) without any manual version bumping.
// Runs via postinstall/predev/prebuild (package.json) - never checked into
// git itself, since a committed value would just go stale the moment
// another commit is made.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "lib", "version.generated.json");

function shortSha() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // No .git directory (e.g. a source tarball) or git isn't installed -
    // the badge falls back to showing just the build time.
    return null;
  }
}

const version = {
  sha: shortSha(),
  buildTime: new Date().toISOString(),
};

writeFileSync(outPath, JSON.stringify(version, null, 2) + "\n");
console.log(`wrote ${outPath}:`, version);
