import {t as translateUI,getLocale} from '../../lib/i18n';
import { useRef, useState, useEffect, useCallback } from 'react';
import { readDeviceLocation, type DevicePosition } from '../../lib/deviceLocation';
import { reverseAddress } from '../../lib/geocoding';
import { drawAttendanceWatermark } from '../../lib/attendanceWatermark';

interface CameraCaptureProps {
  onCapture: (blob: Blob, previewUrl: string, position?: DevicePosition) => void | Promise<void>;
  captureLocation?: boolean;
  accentColor?: 'emerald' | 'amber';
  locationName?: string | null;
  facingMode?: 'user' | 'environment';
  faceGuide?: boolean;
}

// Tailwind JIT butuh nama class LENGKAP & literal di source (tidak bisa
// di-generate dari template string `text-${x}-400`), jadi dipetakan manual.
const ACCENT_CLASSES = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-600', bg: 'bg-emerald-600' },
  amber: { text: 'text-amber-400', border: 'border-amber-500', bg: 'bg-amber-500' },
};

/**
 * Kamera live-capture ASLI lewat getUserMedia — TIDAK ada input file/upload
 * galeri sama sekali (sesuai requirement anti-fraud PRD: foto harus live,
 * bukan dari galeri). Hasil capture dikirim sebagai Blob JPEG ke parent
 * lewat onCapture, siap dimasukkan ke FormData untuk POST ke backend.
 */
export default function CameraCapture({ onCapture, accentColor = 'emerald', locationName, facingMode = 'user', faceGuide = true, captureLocation = false }: CameraCaptureProps) {
  const [activeFacing,setActiveFacing]=useState(facingMode);
  const accent = ACCENT_CLASSES[accentColor];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const captureBusy = useRef(false);
  const captureRevision = useRef(0);
  const [captureStatus, setCaptureStatus] = useState('');
  const [captureError, setCaptureError] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;setReady(false);setError('');

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode:activeFacing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        if(cancelled)return;
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Aktifkan izin kamera untuk browser ini di pengaturan perangkat.'
            : 'Tidak dapat mengakses kamera. Pastikan perangkat memiliki kamera yang berfungsi.'
        );
      }
    }

    startCamera();

    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    return () => {
      cancelled = true;
      ++captureRevision.current;
      clockInterval && clearInterval(clockInterval);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [activeFacing]);

  const handleCapture = useCallback(async () => {
    if (captureBusy.current || !ready) return;
    captureBusy.current = true;
    const revision = ++captureRevision.current;
    const current = () => revision === captureRevision.current;
    setCaptureError('');
    setCaptureStatus(captureLocation ? 'Mengambil GPS saat foto...' : 'Menyiapkan foto...');
    try {
      const position = captureLocation ? await readDeviceLocation() : undefined;
      if (!current()) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) throw new Error('Kamera belum siap. Coba ambil foto lagi.');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Foto tidak dapat diproses. Coba lagi.');
      // Freeze the frame with this GPS measurement, before the address lookup.
      const capturedAt = new Date();
      if (activeFacing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      let address = null;
      if (position) {
        setCaptureStatus('Mencari alamat GPS dan menyiapkan foto...');
        try { address = await reverseAddress(position.latitude, position.longitude, 'attendance'); }
        catch { /* The exact GPS point stays on the photo if the address service is down. */ }
      }
      if (!current()) return;
      drawAttendanceWatermark(ctx, capturedAt, locationName, position, address);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!current()) return;
      if (!blob) throw new Error('Foto tidak dapat diproses. Coba lagi.');
      const previewUrl = URL.createObjectURL(blob);
      // Attendance consumers do not retain this URL; evidence uploaders own theirs.
      try { await onCapture(blob, previewUrl, position); }
      finally { if (captureLocation) URL.revokeObjectURL(previewUrl); }
    } catch (reason) {
      if (current()) setCaptureError(reason instanceof Error ? reason.message : 'Foto gagal diambil. Coba lagi.');
    } finally {
      captureBusy.current = false;
      if (current()) setCaptureStatus('');
    }
  }, [activeFacing, captureLocation, locationName, onCapture, ready]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] relative">
        {error ? (
          <div className="w-full h-full flex items-center justify-center p-6 text-center">
            <p className="text-red-300 text-sm">{translateUI(error)}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: activeFacing === 'user' ? 'scaleX(-1)' : undefined }}
              playsInline
              muted
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <p className="text-white/60 text-sm">{translateUI("Membuka kamera...")}</p>
              </div>
            )}
            {faceGuide ? <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-44 border-2 border-white/60 rounded-full" />
            </div> : null}
            <div className="absolute top-3 left-3 bg-black/60 rounded-xl px-3 py-1.5 font-mono text-white text-xs">
              <span className={accent.text}>{translateUI("WAKTU:") + " "}</span>
              {now.toLocaleString(getLocale(), { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })} WIB
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-center">
              <p className="text-white/90 text-xs">{translateUI('Penugasan:')} {locationName || translateUI('Belum ditetapkan')}</p>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {captureLocation && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">{translateUI('Foto akan memuat lokasi GPS saat pengambilan, koordinat, akurasi, waktu, dan penugasan. Jika alamat belum tersedia, koordinat tetap dicetak pada foto.')}</p>}
      {captureError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{translateUI(captureError)}</p>}
      {captureStatus && <p role="status" className="text-center text-sm text-slate-600">{translateUI(captureStatus)}</p>}

      <div className="flex flex-col items-center gap-3"><button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" disabled={!!captureStatus} onClick={()=>setActiveFacing(value=>value==='user'?'environment':'user')}>{activeFacing==='user'?translateUI("Ganti ke kamera belakang"):translateUI("Ganti ke kamera depan")}</button>
        <button
          type="button" aria-label={translateUI("Ambil foto")}
          onClick={handleCapture}
          disabled={!ready || !!error || !!captureStatus}
          className={`w-16 h-16 rounded-full bg-white border-4 ${accent.border} flex items-center justify-center hover:scale-105 shadow-lg disabled:opacity-40 disabled:hover:scale-100 transition-transform`}
        >
          <div aria-hidden="true" className={`w-10 h-10 rounded-full ${accent.bg}`} />
        </button><p className="text-sm text-slate-600">{translateUI("Tekan tombol bulat untuk mengambil foto.")}</p>
      </div>
    </div>
  );
}
