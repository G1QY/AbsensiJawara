import { getLocale } from './i18n';
import type { DevicePosition } from './deviceLocation';
import type { AddressResult } from './geocoding';

// Wrap even unbroken place names so a portrait/mobile capture cannot clip text.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, limit: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text.replace(/\s+/g, ' ').trim()) {
    if (line && ctx.measureText(line + char).width > width) { lines.push(line.trim()); line = ''; }
    line += char;
  }
  if (line) lines.push(line.trim());
  if (lines.length > limit) {
    lines.length = limit;
    let last = lines[limit - 1];
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines[limit - 1] = last + '…';
  }
  return lines;
}

export function drawAttendanceWatermark(ctx: CanvasRenderingContext2D, capturedAt: Date,
  assignment: string | null | undefined, position?: DevicePosition, address?: AddressResult | null) {
  const { width, height } = ctx.canvas;
  const padding = Math.max(8, Math.round(width / 45));
  const timestamp = capturedAt.toLocaleString(getLocale(), {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }) + ' WIB';
  const sections: [string, number][] = [[timestamp, 2]];
  if (position) {
    sections.push([`Lokasi GPS: ${address?.address || 'Alamat belum tersedia; lihat koordinat GPS'}`, 3]);
    sections.push([`GPS saat foto: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)} (±${position.accuracy} m)`, 2]);
  }
  sections.push([`Penugasan: ${assignment || 'Belum ditetapkan'}`, 2]);
  let size = Math.max(12, Math.round(width / 40));
  let lines: string[] = [];
  do {
    ctx.font = `400 ${size}px sans-serif`;
    lines = sections.flatMap(([text, limit]) => wrap(ctx, text, width - padding * 2, limit));
    if (lines.length * size * 1.35 + padding * 2 <= height * 0.55 || size <= 6) break;
    size--;
  } while (true);
  const lineHeight = size * 1.35;
  const top = height - lines.length * lineHeight - padding * 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, top, width, height - top);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, padding, top + padding + index * lineHeight));
}
