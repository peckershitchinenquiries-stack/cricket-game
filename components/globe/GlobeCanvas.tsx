'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import { MeshPhongMaterial } from 'three';
import type { LatLng } from '@/types';
import { LABEL_OPACITY, createBorderLines, createLabelMesh, disposeLayer, pickGlobePoint } from './scene-layers';

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

const COLORS = {
  ocean: '#0b2340',
  oceanEmissive: '#051326',
  atmosphere: '#00c853',
  user: '#ffd700',
  correct: '#00c853',
};

// Bundled locally (from the three-globe package) so the globe stays fully offline-capable.
const GLOBE_IMAGE_URL = '/globe/earth-day.jpg';
const BUMP_IMAGE_URL = '/globe/earth-topology.png';

const RENDERER_CONFIG = { antialias: true, alpha: true, powerPreference: 'high-performance' } as const;

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

// react-globe.gl re-applies every prop whose identity changed since the last render, and a re-applied
// accessor re-digests its whole layer. So everything passed to <GlobeGL> below is a module-level
// function or a memoised value — never an inline arrow.
function setMarkerVisibility(el: HTMLElement, visible: boolean): void {
  el.style.opacity = visible ? '1' : '0';
}

function ringColor(d: object): (t: number) => string {
  const color = (d as Ring).color;
  return (t: number) => `${color}${Math.round((1 - t) * 255).toString(16).padStart(2, '0')}`;
}

function arcColor(): string[] {
  return [COLORS.user, COLORS.correct];
}

function GlobeCanvas({
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

  const interactive = mode !== 'ambient';

  // Callbacks are read through a ref so their identity never matters to the memoised children.
  const latest = useRef({ mode, onTap, onInteract, onReady });
  useEffect(() => {
    latest.current = { mode, onTap, onInteract, onReady };
  });

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
    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const { mode: currentMode, onReady: notifyReady } = latest.current;
    const decorative = currentMode === 'ambient';

    // The small decorative globe doesn't need full retina resolution; the game globe does.
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, decorative ? 1.5 : 2));

    const controls = globe.controls();
    const radius = globe.getGlobeRadius();
    controls.minDistance = radius * 1.12;
    controls.maxDistance = radius * 6;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;
    controls.autoRotateSpeed = 0.45;
    controls.enabled = !decorative;

    globe.pointOfView({ lat: 18, lng: 60, altitude: decorative ? 2.3 : 2.2 }, 0);
    setReady(true);
    notifyReady?.();
  }, []);

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

  // Country borders: one merged line mesh instead of a polygon mesh per country.
  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe) return;
    const scene = globe.scene();
    const borders = createBorderLines();
    scene.add(borders);
    return () => {
      scene.remove(borders);
      disposeLayer(borders);
    };
  }, [ready]);

  // Country names: one merged mesh, built just after the first frame so it never delays the globe.
  // (They'd only clutter the small decorative globe, so it skips them.)
  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe || !interactive) return;
    const scene = globe.scene();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let names: ReturnType<typeof createLabelMesh> = null;

    const timer = window.setTimeout(() => {
      const layer = createLabelMesh(globe.renderer().capabilities.getMaxAnisotropy());
      if (!layer) return;
      names = layer;
      scene.add(layer);

      const start = performance.now();
      const fadeIn = (now: number) => {
        const progress = reduceMotion ? 1 : Math.min(1, (now - start) / 400);
        layer.material.opacity = LABEL_OPACITY * progress;
        if (progress < 1) raf = requestAnimationFrame(fadeIn);
      };
      raf = requestAnimationFrame(fadeIn);
    }, 50);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (names) {
        scene.remove(names);
        disposeLayer(names);
      }
    };
  }, [ready, interactive]);

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

  // Keyed by value, not object identity: a parent handing us an equal coordinate must not
  // tear down and re-drop the pin.
  const userLat = userPin?.lat;
  const userLng = userPin?.lng;
  const correctLat = correctPin?.lat;
  const correctLng = correctPin?.lng;
  const correctLabel = correctPin?.label;

  const markers = useMemo<Marker[]>(() => {
    const list: Marker[] = [];
    if (userLat !== undefined && userLng !== undefined) list.push({ kind: 'user', lat: userLat, lng: userLng });
    if (correctLat !== undefined && correctLng !== undefined) {
      list.push({ kind: 'correct', lat: correctLat, lng: correctLng, label: correctLabel });
    }
    return list;
  }, [userLat, userLng, correctLat, correctLng, correctLabel]);

  const rings = useMemo<Ring[]>(() => {
    if (correctLat !== undefined && correctLng !== undefined) {
      return [{ lat: correctLat, lng: correctLng, color: COLORS.correct }];
    }
    if (userLat !== undefined && userLng !== undefined) return [{ lat: userLat, lng: userLng, color: COLORS.user }];
    return [];
  }, [userLat, userLng, correctLat, correctLng]);

  const arcs = useMemo(
    () =>
      userLat !== undefined && userLng !== undefined && correctLat !== undefined && correctLng !== undefined
        ? [{ startLat: userLat, startLng: userLng, endLat: correctLat, endLng: correctLng }]
        : [],
    [userLat, userLng, correctLat, correctLng],
  );

  const globeOffset = useMemo<[number, number]>(
    () => [0, -Math.round(size.height * verticalOffset)],
    [size.height, verticalOffset],
  );

  // Our own tap detection: it ignores drags and pinches, and resolves the exact tap point with a single
  // ray/sphere test (the library's version raycasts every mesh in the scene).
  const gesture = useRef<{ id: number; x: number; y: number; t: number; multi: boolean } | null>(null);
  const activePointers = useRef(new Set<number>());

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) {
      if (gesture.current) gesture.current.multi = true;
    } else if (e.button === 0) {
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), multi: false };
    }
    latest.current.onInteract?.();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;

    const notifyTap = latest.current.onTap;
    const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (g.multi || moved > 10 || performance.now() - g.t > 700 || !notifyTap) return;

    const globe = globeRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!globe || !rect) return;
    const point = pickGlobePoint(globe, e.clientX - rect.left, e.clientY - rect.top, size.width, size.height);
    if (point) notifyTap(point);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (gesture.current?.id === e.pointerId) gesture.current = null;
  };

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
          globeOffset={globeOffset}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={RENDERER_CONFIG}
          globeMaterial={material}
          globeImageUrl={GLOBE_IMAGE_URL}
          bumpImageUrl={BUMP_IMAGE_URL}
          showAtmosphere
          atmosphereColor={COLORS.atmosphere}
          atmosphereAltitude={0.17}
          onGlobeReady={handleReady}
          // Hover raycasting off: taps are handled above, and it saves work every frame.
          enablePointerInteraction={false}
          // Pins
          htmlElementsData={markers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.01}
          htmlElement={createMarkerElement}
          htmlElementVisibilityModifier={setMarkerVisibility}
          htmlTransitionDuration={0}
          // Pulsing rings
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={ringColor}
          ringMaxRadius={4}
          ringPropagationSpeed={3}
          ringRepeatPeriod={900}
          ringAltitude={0.008}
          // Guess → answer arc
          arcsData={arcs}
          arcColor={arcColor}
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

export default memo(GlobeCanvas);
