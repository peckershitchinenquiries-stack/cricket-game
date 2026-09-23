import { LAUNCH_DATE } from './config';

const DAY_MS = 86_400_000;

/** Today's date in UTC as YYYY-MM-DD. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Round number shown to players (#1 on launch day). */
export function roundNumberFor(date: string): number {
  return Math.max(1, daysBetween(LAUNCH_DATE, date) + 1);
}

/** Milliseconds until the next UTC midnight. */
export function msUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDistance(km: number): string {
  if (km < 1) return 'Under 1 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${formatNumber(Math.round(km))} km`;
}

export function formatDateLong(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Normalise any longitude into [-180, 180]. */
export function normalizeLng(lng: number): number {
  if (lng >= -180 && lng <= 180) return lng;
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Camera altitude (in globe radii) at which the whole globe fits the viewport,
 * given three.js's default 50° vertical field of view.
 */
export function fitGlobeAltitude(width: number, height: number, margin = 1.12, fovDeg = 50): number {
  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * (width / Math.max(1, height)));
  const limiting = Math.min(halfV, halfH);
  return Math.max(1.2, (margin / Math.sin(limiting)) - 1);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Light haptic tap where supported (Android; iOS Safari ignores it). */
export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  stadium: 'Stadium',
  world_cup: 'World Cup',
  birthplace: 'Birthplace',
  historic_match: 'Historic match',
  general: 'General',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}
