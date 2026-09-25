import { scoreFraction } from '@/lib/scoring';

const WIDTH = 300;
const HEIGHT = 130;
const PAD_LEFT = 28;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const MAX_KM = 6000;

/** Points on the curve worth calling out — sparing on purpose, evenly spaced to avoid crowding labels. */
const CALLOUTS = [0, 2000, 4000, 6000];

const x = (km: number) => PAD_LEFT + (km / MAX_KM) * (WIDTH - PAD_LEFT - PAD_RIGHT);
const y = (fraction: number) => PAD_TOP + (1 - fraction) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

/** Small explainer chart for "How to play": shows the real scoring curve so the decay isn't a mystery. */
export function ScoringCurve() {
  const samples = Array.from({ length: 41 }, (_, i) => (i / 40) * MAX_KM);
  const path = samples
    .map((km, i) => `${i === 0 ? 'M' : 'L'} ${x(km).toFixed(1)} ${y(scoreFraction(km)).toFixed(1)}`)
    .join(' ');

  const baseline = y(0);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Chart showing points earned fall off gradually the further your pin lands from the correct spot, never dropping to zero."
      className="w-full"
    >
      {/* Baseline (0%) — hairline, recessive */}
      <line x1={PAD_LEFT} y1={baseline} x2={WIDTH - PAD_RIGHT} y2={baseline} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* The curve */}
      <path d={path} fill="none" stroke="#00c853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Callout points + direct labels */}
      {CALLOUTS.map((km) => {
        const cx = x(km);
        const cy = y(scoreFraction(km));
        const pct = Math.round(scoreFraction(km) * 100);
        const labelAbove = cy > PAD_TOP + 14;
        return (
          <g key={km}>
            <circle cx={cx} cy={cy} r="4" fill="#00c853" stroke="#0a1a2e" strokeWidth="2" />
            <text
              x={cx}
              y={labelAbove ? cy - 10 : cy + 18}
              textAnchor={km === 0 ? 'start' : km >= MAX_KM - 500 ? 'end' : 'middle'}
              className="fill-white"
              fontSize="11"
              fontWeight="600"
            >
              {pct}%
            </text>
            <text
              x={cx}
              y={baseline + 16}
              textAnchor={km === 0 ? 'start' : km >= MAX_KM - 500 ? 'end' : 'middle'}
              className="fill-mist"
              fontSize="9"
            >
              {km === 0 ? '0 km' : `${km.toLocaleString('en-US')} km`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
