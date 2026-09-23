import type { AccuracyColor, LatLng } from '@/types';
import { QUESTION_WEIGHTS } from './config';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in km (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Geographic midpoint of two points (for framing the camera on reveal). */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng);
  const dλ = toRad(b.lng - a.lng);
  const bx = Math.cos(φ2) * Math.cos(dλ);
  const by = Math.cos(φ2) * Math.sin(dλ);
  const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.sqrt((Math.cos(φ1) + bx) ** 2 + by ** 2));
  const λ3 = λ1 + Math.atan2(by, Math.cos(φ1) + bx);
  return { lat: toDeg(φ3), lng: ((toDeg(λ3) + 540) % 360) - 180 };
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Distance where the score finally reaches zero. */
export const ZERO_SCORE_KM = 5000;

/**
 * Fraction of a question's max points earned for a given distance.
 *  0–50 km      → 100%
 *  50–200 km    → 99% → 80%
 *  200–500 km   → 80% → 50%
 *  500–1500 km  → 50% → 20%
 *  1500–5000 km → 20% → 0%
 */
export function scoreFraction(distanceKm: number): number {
  const d = Math.max(0, distanceKm);
  if (d <= 50) return 1;
  if (d <= 200) return lerp(0.99, 0.8, (d - 50) / 150);
  if (d <= 500) return lerp(0.8, 0.5, (d - 200) / 300);
  if (d <= 1500) return lerp(0.5, 0.2, (d - 500) / 1000);
  if (d <= ZERO_SCORE_KM) return lerp(0.2, 0, (d - 1500) / (ZERO_SCORE_KM - 1500));
  return 0;
}

export function accuracyColor(distanceKm: number): AccuracyColor {
  if (distanceKm <= 200) return 'green';
  if (distanceKm <= 500) return 'yellow';
  if (distanceKm <= 1500) return 'orange';
  return 'red';
}

export function maxPointsForPosition(position: number): number {
  return QUESTION_WEIGHTS[position - 1] ?? 0;
}

export function scoreAnswer(guess: LatLng, correct: LatLng, maxPoints: number) {
  const distance = haversineKm(guess, correct);
  return {
    distance_km: Math.round(distance * 10) / 10,
    points: Math.round(maxPoints * scoreFraction(distance)),
    color: accuracyColor(distance),
  };
}

export const COLOR_HEX: Record<AccuracyColor, string> = {
  green: '#4caf50',
  yellow: '#ffeb3b',
  orange: '#ff9800',
  red: '#f44336',
};

export const COLOR_EMOJI: Record<AccuracyColor, string> = {
  green: '🟢',
  yellow: '🟡',
  orange: '🟠',
  red: '🔴',
};

export const COLOR_LABEL: Record<AccuracyColor, string> = {
  green: 'Spot on',
  yellow: 'Close',
  orange: 'In the region',
  red: 'Way off',
};
