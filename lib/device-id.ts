import { STORAGE_PREFIX } from './config';
import { addDays, utcToday } from './utils';

const DEVICE_KEY = `${STORAGE_PREFIX}device_id`;
const STREAK_KEY = `${STORAGE_PREFIX}streak`;
const BEST_STREAK_KEY = `${STORAGE_PREFIX}best_streak`;
const LAST_PLAYED_KEY = `${STORAGE_PREFIX}last_played`;
const GAMES_PLAYED_KEY = `${STORAGE_PREFIX}games_played`;

export const playedKey = (date: string) => `${STORAGE_PREFIX}played_${date}`;
export const progressKey = (date: string) => `${STORAGE_PREFIX}progress_${date}`;

/** localStorage access that never throws (private mode, blocked storage, SSR). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage full or unavailable */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* unavailable */
    }
  },
  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Anonymous per-device identity, created on first visit. */
export function getDeviceId(): string {
  const existing = safeStorage.get(DEVICE_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = uuidv4();
  safeStorage.set(DEVICE_KEY, id);
  return id;
}

export interface StreakInfo {
  /** Current streak — 0 if the chain is broken. */
  current: number;
  best: number;
  gamesPlayed: number;
  lastPlayed: string | null;
  playedToday: boolean;
}

export function getStreak(today: string = utcToday()): StreakInfo {
  const lastPlayed = safeStorage.get(LAST_PLAYED_KEY);
  const stored = Number(safeStorage.get(STREAK_KEY)) || 0;
  const alive = lastPlayed === today || lastPlayed === addDays(today, -1);
  const current = alive ? stored : 0;
  return {
    current,
    best: Math.max(Number(safeStorage.get(BEST_STREAK_KEY)) || 0, current),
    gamesPlayed: Number(safeStorage.get(GAMES_PLAYED_KEY)) || 0,
    lastPlayed,
    playedToday: lastPlayed === today,
  };
}

/** Call once when a round is completed. Returns the new streak. */
export function recordPlay(date: string): StreakInfo {
  const lastPlayed = safeStorage.get(LAST_PLAYED_KEY);
  if (lastPlayed === date) return getStreak(date);

  const previous = Number(safeStorage.get(STREAK_KEY)) || 0;
  const streak = lastPlayed === addDays(date, -1) ? previous + 1 : 1;
  const best = Math.max(Number(safeStorage.get(BEST_STREAK_KEY)) || 0, streak);

  safeStorage.set(STREAK_KEY, String(streak));
  safeStorage.set(BEST_STREAK_KEY, String(best));
  safeStorage.set(LAST_PLAYED_KEY, date);
  safeStorage.set(GAMES_PLAYED_KEY, String((Number(safeStorage.get(GAMES_PLAYED_KEY)) || 0) + 1));
  return getStreak(date);
}

/** Drop per-day keys older than a week so storage doesn't grow forever. */
export function pruneOldEntries(today: string = utcToday()): void {
  try {
    const cutoff = addDays(today, -7);
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      const match = key?.match(/^cricktap_(?:played|progress)_(\d{4}-\d{2}-\d{2})$/);
      if (key && match && match[1] < cutoff) stale.push(key);
    }
    stale.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* unavailable */
  }
}
