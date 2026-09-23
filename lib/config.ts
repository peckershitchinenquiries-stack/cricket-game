/**
 * Branding and game constants. Rename the game here (and in public/manifest.json).
 */
export const APP_NAME = 'CrickTap';
export const APP_TAGLINE = '5 questions. One globe. How well do you know cricket?';
export const APP_DESCRIPTION =
  'The daily cricket geography quiz. Tap the globe to find famous grounds, birthplaces and historic matches.';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cricktap.com').replace(/\/$/, '');
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '');

/** UTC date on which round #1 is played. */
export const LAUNCH_DATE = process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-09-19';

/** Max points per question position — stakes rise through the round. */
export const QUESTION_WEIGHTS = [100, 100, 200, 300, 300] as const;
export const QUESTIONS_PER_ROUND = QUESTION_WEIGHTS.length;
export const MAX_SCORE = QUESTION_WEIGHTS.reduce((a, b) => a + b, 0);

/** Gameplay timings (ms). */
export const AUTO_CONFIRM_MS = 3000;
export const AUTO_ADVANCE_MS = 3500;

export const STORAGE_PREFIX = 'cricktap_';
