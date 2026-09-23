import type { GameResult } from '@/types';
import { APP_NAME, MAX_SCORE, SITE_DOMAIN, SITE_URL } from './config';
import { COLOR_EMOJI, COLOR_HEX } from './scoring';
import { formatNumber } from './utils';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export function buildShareText(result: GameResult): string {
  const dots = result.answers.map((a) => COLOR_EMOJI[a.color]).join('');
  return `${dots}\n${APP_NAME} #${result.round_number} — ${formatNumber(result.total_score)}/${formatNumber(
    MAX_SCORE,
  )}\nPlay: ${SITE_DOMAIN}`;
}

// Logical size 600×315 (WhatsApp/Twitter preview ratio), rendered at 2× for sharp text.
const W = 600;
const H = 315;
const SCALE = 2;

function cssFont(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function drawStumps(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const w = h * 0.11;
  const gap = h * 0.23;
  ctx.fillStyle = '#00c853';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.roundRect(x + i * gap, y + h * 0.12, w, h * 0.88, w / 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.roundRect(x - w * 0.3, y, gap + w * 0.9, h * 0.07, h * 0.035);
  ctx.roundRect(x + gap + w * 0.4, y, gap + w * 0.9, h * 0.07, h * 0.035);
  ctx.fill();
}

/** Draws the score card and returns it as a PNG blob. */
export async function renderShareImage(result: GameResult): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.scale(SCALE, SCALE);

  const display = cssFont('--font-poppins', 'system-ui, sans-serif');
  const body = cssFont('--font-inter', 'system-ui, sans-serif');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d2340');
  bg.addColorStop(1, '#050e1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, -40, 10, W / 2, -40, 380);
  glow.addColorStop(0, 'rgba(0, 200, 83, 0.28)');
  glow.addColorStop(1, 'rgba(0, 200, 83, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Faint cricket-ball seam across the card
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H + 380, 520, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.arc(W / 2, H + 392, 520, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.restore();

  // Brand (top-left)
  drawStumps(ctx, 28, 24, 26);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 20px ${display}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Crick', 62, 38);
  const crickWidth = ctx.measureText('Crick').width;
  ctx.fillStyle = '#00c853';
  ctx.fillText('Tap', 62 + crickWidth, 38);

  // Dots
  const colors = result.answers.map((a) => COLOR_HEX[a.color]);
  const r = 20;
  const spacing = 58;
  const startX = W / 2 - ((colors.length - 1) * spacing) / 2;
  colors.forEach((c, i) => {
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 18;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(startX + i * spacing, 104, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Title + score
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b0bec5';
  ctx.font = `600 22px ${display}`;
  ctx.fillText(`${APP_NAME} #${result.round_number}`, W / 2, 164);

  ctx.font = `800 54px ${display}`;
  const scoreText = formatNumber(result.total_score);
  const suffix = ` / ${formatNumber(MAX_SCORE)}`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = `600 28px ${display}`;
  const suffixW = ctx.measureText(suffix).width;
  const left = W / 2 - (scoreW + suffixW) / 2;
  ctx.textAlign = 'left';
  ctx.font = `800 54px ${display}`;
  ctx.fillStyle = '#ffd700';
  ctx.fillText(scoreText, left, 216);
  ctx.font = `600 28px ${display}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(suffix, left + scoreW, 222);

  // URL
  ctx.textAlign = 'center';
  ctx.font = `500 17px ${body}`;
  ctx.fillStyle = '#b0bec5';
  ctx.fillText(SITE_DOMAIN, W / 2, 280);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Legacy fallback for older WebViews
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Share via the Web Share API (image + text on mobile), falling back to
 * text-only share, then to copying the text to the clipboard.
 */
export async function shareResult(result: GameResult, image?: Blob | null): Promise<ShareOutcome> {
  const text = buildShareText(result);
  const title = `${APP_NAME} #${result.round_number}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (image) {
        const file = new File([image], `cricktap-${result.round_number}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text, title });
          return 'shared';
        }
      }
      await navigator.share({ text, title, url: SITE_URL });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Fall through to clipboard (e.g. NotAllowedError on desktop browsers).
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

export async function copyShareText(result: GameResult): Promise<boolean> {
  return copyText(buildShareText(result));
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
