/**
 * GitHub Pages serves a project repo at /<repo-name>/ rather than the
 * domain root, so the app needs to know its own base path at build time.
 * Set via NEXT_PUBLIC_BASE_PATH in the deploy workflow; empty (root) for
 * local dev and any host that serves from the root (Vercel, Netlify, ...).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
