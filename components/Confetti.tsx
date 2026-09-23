'use client';

import { useState } from 'react';

const COLORS = ['#00c853', '#ffd700', '#4caf50', '#ffffff', '#5efc82', '#ff9800'];

function makePieces(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const power = 110 + Math.random() * 140;
    return {
      color: COLORS[i % COLORS.length],
      dx: `${Math.cos(angle) * power}px`,
      dy: `${Math.sin(angle) * power + 120}px`,
      rot: `${Math.random() * 720 - 360}deg`,
      delay: Math.random() * 80,
      w: 6 + Math.random() * 5,
      h: 8 + Math.random() * 8,
    };
  });
}

/** One-shot CSS confetti burst — no dependencies, transform/opacity only. */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const [bits] = useState(() => makePieces(pieces));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={
            {
              width: b.w,
              height: b.h,
              backgroundColor: b.color,
              '--dx': b.dx,
              '--dy': b.dy,
              '--rot': b.rot,
              animation: `confetti-fall 1100ms cubic-bezier(0.2, 0.7, 0.4, 1) ${b.delay}ms both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
