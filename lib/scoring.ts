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

/** Curve shape constants — tuned to track GeoSports' decay (100 · 71 · 58 · 50 · 45 · 41 at 0/1k/2k/3k/4k/5k km). */
const CURVE_STEEPNESS = 0.2172;
const CURVE_SCALE_KM = 345;

/**
 * Fraction of a question's max points earned for a given distance.
 * A smooth logarithmic decay (no cliff, no flat "free" zone): a spot-on tap
 * scores full marks, and points fade gradually the further the pin lands —
 * even a wild miss on the other side of the planet still banks a little.
 */
export function scoreFraction(distanceKm: number): number {
  const d = Math.max(0, distanceKm);
  const fraction = 1 - CURVE_STEEPNESS * Math.log(1 + d / CURVE_SCALE_KM);
  return Math.min(1, Math.max(0, fraction));
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
