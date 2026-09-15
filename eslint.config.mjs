import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Convention used throughout for intentionally-unused parameters
      // required by a callback signature (e.g. idb's `upgrade`).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party assets (minified, not our code) - see
    // lib/measurement/ocrRuler.ts for what these are and why they're
    // vendored rather than fetched from a CDN.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
