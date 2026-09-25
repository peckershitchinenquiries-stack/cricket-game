'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import { geoCentroid } from 'd3-geo';
import countriesTopo from 'world-atlas/countries-110m.json';
import type { LatLng } from '@/types';

export type GlobeMode = 'ambient' | 'play' | 'picker';

/** Camera target. Omitted fields keep their current value. */
export interface GlobePov {
  lat?: number;
  lng?: number;
  altitude?: number;
  ms?: number;
}

export interface GlobeCanvasProps {
  mode: GlobeMode;
  userPin?: LatLng | null;
  correctPin?: (LatLng & { label: string }) | null;
  /** Each new object flies the camera there. */
  pov?: GlobePov | null;
  autoRotate?: boolean;
  /** Shift the globe up by this fraction of the height (to clear a bottom sheet). */
  verticalOffset?: number;
  onTap?: (point: LatLng) => void;
  /** Any pointer-down on the globe (used to pause auto-timers while the player explores). */
  onInteract?: () => void;
  onReady?: () => void;
}

interface Marker extends LatLng {
  kind: 'user' | 'correct';
  label?: string;
}

interface Ring extends LatLng {
  color: string;
}

interface CountryLabel extends LatLng {
  text: string;
}

const COLORS = {
  ocean: '#0b2340',
  oceanEmissive: '#051326',
  border: 'rgba(148, 255, 178, 0.55)',
  label: 'rgba(255, 255, 255, 0.68)',
  atmosphere: '#00c853',
  user: '#ffd700',
  correct: '#00c853',
};

// Bundled locally (from the three-globe package) so the globe stays fully offline-capable.
const GLOBE_IMAGE_URL = '/globe/earth-day.jpg';
const BUMP_IMAGE_URL = '/globe/earth-topology.png';

// Parse country shapes once per session (Antarctica dropped — it distorts badly at the pole).
let countryFeatures: Feature<Geometry>[] | null = null;
function getCountries(): Feature<Geometry>[] {
  if (!countryFeatures) {
    const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection }>;
    const fc = feature(topo, topo.objects.countries);
    countryFeatures = fc.features.filter((f) => f.id !== '010');
  }
  return countryFeatures;
}

// Country name labels, placed at each shape's centroid.
let countryLabels: CountryLabel[] | null = null;
function getCountryLabels(): CountryLabel[] {
  if (!countryLabels) {
    countryLabels = getCountries().flatMap((f) => {
      const name = f.properties?.name as string | undefined;
      if (!name) return [];
      const [lng, lat] = geoCentroid(f);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      return [{ lat, lng, text: name }];
    });
  }
  return countryLabels;
}

function pinSvg(color: string): string {
  return `<svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.1 0 13.7 0 23.9 14 36 14 36s14-12.1 14-22.3C28 6.1 21.7 0 14 0z" fill="${color}" stroke="#050e1a" stroke-width="2"/><circle cx="14" cy="13.5" r="5" fill="#050e1a"/></svg>`;
}

function createMarkerElement(d: object): HTMLElement {
  const m = d as Marker;
  const color = m.kind === 'user' ? COLORS.user : COLORS.correct;
  const root = document.createElement('div');
  root.className = 'globe-marker';
  root.style.color = color;

  const ripple = document.createElement('div');
  ripple.className = 'globe-pin-ripple';
  root.appendChild(ripple);

  const pin = document.createElement('div');
  pin.className = 'globe-pin';
  pin.innerHTML = pinSvg(color);
  if (m.kind === 'correct') pin.style.animationDelay = '350ms';
  root.appendChild(pin);

  if (m.label) {
    const label = document.createElement('div');
    label.className = 'globe-label';
    label.textContent = m.label;
    root.appendChild(label);
  }
  return root;
}

export default function GlobeCanvas({
  mode,
  userPin,
  correctPin,
  pov,
  autoRotate = false,
  verticalOffset = 0,
  onTap,
  onInteract,
  onReady,
}: GlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  const countries = useMemo(getCountries, []);
  // Labels clutter the small decorative home-screen globe — only show them where they help gameplay.
  const labels = useMemo(() => (mode === 'ambient' ? [] : getCountryLabels()), [mode]);
  const material = useMemo(
    () =>
      new MeshPhongMaterial({
        color: COLORS.ocean,
        emissive: COLORS.oceanEmissive,
        shininess: 8,
        bumpScale: 10,
      }),
    [],
  );

  // Track container size (globe canvas needs explicit pixel dimensions).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // Cap DPR: retina phones at 3x are the #1 cause of globe jank.
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const controls = globe.controls();
    const radius = globe.getGlobeRadius();
    controls.minDistance = radius * 1.12;
    controls.maxDistance = radius * 6;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;
    controls.autoRotateSpeed = 0.45;
    controls.enabled = mode !== 'ambient';

    globe.pointOfView({ lat: 18, lng: 60, altitude: mode === 'ambient' ? 2.3 : 2.2 }, 0);
    setReady(true);
    onReady?.();
  }, [mode, onReady]);

  useEffect(() => {
    const globe = globeRef.current;
    if (ready && globe) globe.controls().autoRotate = autoRotate;
  }, [autoRotate, ready]);

  useEffect(() => {
    const globe = globeRef.current;
    if (ready && globe && pov) {
      const { ms = 1200, ...target } = pov;
      globe.pointOfView(target, ms);
    }
  }, [pov, ready]);

  // Stop rendering when the tab is hidden — saves battery on phones.
  useEffect(() => {
    const onVisibility = () => {
      const globe = globeRef.current;
      if (!globe) return;
      if (document.hidden) globe.pauseAnimation();
      else globe.resumeAnimation();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const markers = useMemo<Marker[]>(() => {
    const list: Marker[] = [];
    if (userPin) list.push({ kind: 'user', ...userPin });
    if (correctPin) list.push({ kind: 'correct', lat: correctPin.lat, lng: correctPin.lng, label: correctPin.label });
    return list;
  }, [userPin, correctPin]);

  const rings = useMemo<Ring[]>(() => {
    if (correctPin) return [{ lat: correctPin.lat, lng: correctPin.lng, color: COLORS.correct }];
    if (userPin) return [{ ...userPin, color: COLORS.user }];
    return [];
  }, [userPin, correctPin]);

  const arcs = useMemo(
    () =>
      userPin && correctPin
        ? [{ startLat: userPin.lat, startLng: userPin.lng, endLat: correctPin.lat, endLng: correctPin.lng }]
        : [],
    [userPin, correctPin],
  );

  // Our own tap detection: the library's click handler resolves against a
  // throttled hover raycast, so quick taps can miss or land on a stale spot.
  // Here we project the exact tap point, and ignore drags and pinches.
  const gesture = useRef<{ id: number; x: number; y: number; t: number; multi: boolean } | null>(null);
  const activePointers = useRef(new Set<number>());

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) {
      if (gesture.current) gesture.current.multi = true;
    } else if (e.button === 0) {
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), multi: false };
    }
    onInteract?.();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;

    const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (g.multi || moved > 10 || performance.now() - g.t > 700 || !onTap) return;

    const globe = globeRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!globe || !rect) return;
    const coords = globe.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      onTap({ lat: coords.lat, lng: coords.lng });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (gesture.current?.id === e.pointerId) gesture.current = null;
  };

  const interactive = mode !== 'ambient';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ pointerEvents: interactive ? 'auto' : 'none', touchAction: interactive ? 'none' : 'auto' }}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerCancel={interactive ? handlePointerCancel : undefined}
    >
      {size.width > 0 && size.height > 0 && (
        <GlobeGL
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeOffset={[0, -Math.round(size.height * verticalOffset)]}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          globeMaterial={material}
          globeImageUrl={GLOBE_IMAGE_URL}
          bumpImageUrl={BUMP_IMAGE_URL}
          showAtmosphere
          atmosphereColor={COLORS.atmosphere}
          atmosphereAltitude={0.17}
          onGlobeReady={handleReady}
          // Hover raycasting off: taps are handled above, and it saves work every frame.
          enablePointerInteraction={false}
          // Countries — cap left transparent so the terrain texture shows through; just borders on top.
          polygonsData={countries}
          polygonCapColor={() => 'rgba(0, 0, 0, 0)'}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => COLORS.border}
          polygonAltitude={0.006}
          polygonsTransitionDuration={0}
          // Country name labels
          labelsData={labels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize={0.9}
          labelColor={() => COLORS.label}
          labelIncludeDot={false}
          labelResolution={2}
          labelAltitude={0.005}
          labelsTransitionDuration={0}
          // Pins
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.01}
          htmlElement={createMarkerElement}
          htmlElementVisibilityModifier={(el, visible) => {
            el.style.opacity = visible ? '1' : '0';
          }}
          htmlTransitionDuration={0}
          // Pulsing rings
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={(d: object) => {
            const color = (d as Ring).color;
            return (t: number) => `${color}${Math.round((1 - t) * 255).toString(16).padStart(2, '0')}`;
          }}
          ringMaxRadius={4}
          ringPropagationSpeed={3}
          ringRepeatPeriod={900}
          ringAltitude={0.008}
          // Guess → answer arc
          arcsData={arcs}
          arcColor={() => [COLORS.user, COLORS.correct]}
          arcStroke={0.7}
          arcDashLength={0.7}
          arcDashGap={0.08}
          arcDashInitialGap={1}
          arcDashAnimateTime={1800}
          arcAltitudeAutoScale={0.4}
          arcsTransitionDuration={0}
        />
      )}
    </div>
  );
}
