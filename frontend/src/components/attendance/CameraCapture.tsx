import { useRef, useState, useEffect, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (blob: Blob, previewUrl: string) => void;
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
export default function CameraCapture({ onCapture, accentColor = 'emerald', locationName, facingMode = 'user', faceGuide = true }: CameraCaptureProps) {
  const [activeFacing,setActiveFacing]=useState(facingMode);
  const accent = ACCENT_CLASSES[accentColor];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      clockInterval && clearInterval(clockInterval);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [activeFacing]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const capturedAt = new Date();
    const fontSize = Math.max(16, Math.round(canvas.width / 34));
    const padding = Math.max(14, Math.round(canvas.width / 45));
    const firstLine = capturedAt.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }) + ' WIB';
    const secondLine = locationName || 'Lokasi kerja';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, canvas.height - (fontSize * 3.2), canvas.width, fontSize * 3.2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillText(firstLine, padding, canvas.height - fontSize * 1.65);
    ctx.font = `400 ${Math.max(14, fontSize - 2)}px sans-serif`;
    ctx.fillText(secondLine.slice(0, 80), padding, canvas.height - padding);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(blob, previewUrl);
    }, 'image/jpeg', 0.9);
  }, [activeFacing, locationName, onCapture]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] relative">
        {error ? (
          <div className="w-full h-full flex items-center justify-center p-6 text-center">
            <p className="text-red-300 text-sm">{error}</p>
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
                <p className="text-white/60 text-sm">Membuka kamera...</p>
              </div>
            )}
            {faceGuide ? <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-44 border-2 border-white/60 rounded-full" />
            </div> : null}
            <div className="absolute top-3 left-3 bg-black/60 rounded-xl px-3 py-1.5 font-mono text-white text-xs">
              <span className={accent.text}>WAKTU: </span>
              {now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })} WIB
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-center">
              <p className="text-white/90 text-xs">{locationName || 'Lokasi kerja'}</p>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-col items-center gap-3"><button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={()=>setActiveFacing(value=>value==='user'?'environment':'user')}>{activeFacing==='user'?'Ganti ke kamera belakang':'Ganti ke kamera depan'}</button>
        <button
          type="button" aria-label="Ambil foto"
          onClick={handleCapture}
          disabled={!ready || !!error}
          className={`w-16 h-16 rounded-full bg-white border-4 ${accent.border} flex items-center justify-center hover:scale-105 shadow-lg disabled:opacity-40 disabled:hover:scale-100 transition-transform`}
        >
          <div aria-hidden="true" className={`w-10 h-10 rounded-full ${accent.bg}`} />
        </button><p className="text-sm text-slate-600">Tekan tombol bulat untuk mengambil foto.</p>
      </div>
    </div>
  );
}
