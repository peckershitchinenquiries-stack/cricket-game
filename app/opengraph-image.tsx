import { ImageResponse } from 'next/og';
import { APP_NAME, APP_TAGLINE } from '@/lib/config';

export const alt = `${APP_NAME} — Daily Cricket Quiz`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DOTS = ['#4caf50', '#ffeb3b', '#ff9800', '#4caf50', '#f44336'];

/** Dynamic OG image for link previews (WhatsApp, X, iMessage…). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 110px',
          background: 'radial-gradient(circle at 50% -10%, #0f3a2a 0%, #0a1a2e 55%, #050e1a 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginRight: 80 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ width: 72, height: 16, borderRadius: 8, background: '#ffd700' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 30, height: 250, borderRadius: 15, background: '#00c853' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 112, fontWeight: 800, letterSpacing: -3 }}>
            Cricke<span style={{ color: '#00c853' }}>Tap</span>
          </div>
          <div style={{ fontSize: 36, color: '#b0bec5', marginTop: 8, maxWidth: 640 }}>{APP_TAGLINE}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 40 }}>
            {DOTS.map((c, i) => (
              <div key={i} style={{ width: 44, height: 44, borderRadius: 22, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
