'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { CricketLoader } from './CricketLoader';
import type { GlobeCanvasProps } from './globe/GlobeCanvas';
import { cn } from '@/lib/utils';

export type { GlobeMode, GlobePov } from './globe/GlobeCanvas';

// WebGL + three.js + country shapes are loaded lazily and only in the browser.
const GlobeCanvas = dynamic(() => import('./globe/GlobeCanvas'), { ssr: false, loading: () => null });

export interface GlobeProps extends GlobeCanvasProps {
  className?: string;
  loadingLabel?: string;
}

/** 3D globe with a cricket-ball loader shown until WebGL is ready. */
export function Globe({ className, loadingLabel = 'Rolling out the globe…', onReady, ...props }: GlobeProps) {
  const [ready, setReady] = useState(false);

  return (
    <div className={cn('relative h-full w-full', className)}>
      <div className={cn('absolute inset-0 transition-opacity duration-700', ready ? 'opacity-100' : 'opacity-0')}>
        <GlobeCanvas
          {...props}
          onReady={() => {
            setReady(true);
            onReady?.();
          }}
        />
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CricketLoader label={props.mode === 'ambient' ? undefined : loadingLabel} />
        </div>
      )}
    </div>
  );
}
