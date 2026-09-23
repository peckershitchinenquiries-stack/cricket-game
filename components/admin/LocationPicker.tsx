'use client';

import { useMemo } from 'react';
import type { LatLng } from '@/types';
import { Globe } from '@/components/Globe';

/** Mini globe: tap to set the answer location. */
export function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  // Only fly to the initial value; don't chase every tap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pov = useMemo(() => (value ? { ...value, altitude: 1.4, ms: 0 } : null), []);

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-navy-950">
      <Globe
        mode="picker"
        userPin={value}
        pov={pov}
        onTap={(p) => onChange({ lat: Math.round(p.lat * 10000) / 10000, lng: Math.round(p.lng * 10000) / 10000 })}
        loadingLabel="Loading map…"
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[13px] text-mist">
        Tap to place · drag to rotate · pinch/scroll to zoom
      </p>
    </div>
  );
}
