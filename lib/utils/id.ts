/**
 * UUID generator. `crypto.randomUUID` covers every modern mobile browser
 * this app targets; the fallback only needs `crypto.getRandomValues`,
 * which has near-universal support, for the rare older WebView.
 */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const n = Number(c);
    const randomByte = crypto.getRandomValues(new Uint8Array(1))[0];
    return (n ^ (randomByte & (15 >> (n / 4)))).toString(16);
  });
}
