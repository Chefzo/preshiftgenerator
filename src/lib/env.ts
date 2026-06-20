/**
 * Tiny typed accessors over process.env so the rest of the code never reaches
 * into process.env directly and defaults live in one place.
 */

export function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => !!process.env[k]?.trim());
}
