import { useRef, useState } from 'react';
import { t as translateUI } from '../../lib/i18n';
import { api, ApiError } from '../../lib/apiClient';

interface DeadDevicePhotoProps {
  attendanceId: string;
  locationName?: string | null;
  page?: boolean;
  onOpen?: () => void;
  onBack?: () => void;
  onUploaded?: () => void | Promise<void>;
}

export default function DeadDevicePhoto({ attendanceId, locationName, page = false, onOpen, onBack, onUploaded }: DeadDevicePhotoProps) {
  const input = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Pilih file foto dari kamera.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file, file.name || 'dead_device.jpg');
      form.append('note', note);
      await api.postForm(`/attendance/${attendanceId}/dead-device-photo`, form);
      await onUploaded?.();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'Gagal mengunggah foto device mati.');
      if (input.current) input.current.value = '';
    } finally {
      setSubmitting(false);
    }
  }

  if (!page) return (
    <button type="button" onClick={onOpen} className="w-full min-h-12 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-orange-100">
      {translateUI('Foto Device Mati (Opsional)')}
    </button>
  );

  return (
    <section className="mx-auto w-full max-w-lg space-y-4 p-3 sm:p-6" aria-labelledby="dead-device-title">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">← {translateUI('Kembali ke absen')}</button>
      </div>
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <h2 id="dead-device-title" className="font-semibold text-orange-950">{translateUI('Foto Device yang Mati')}</h2>
        <p className="mt-1 text-sm text-orange-800">{translateUI('Gunakan kamera perangkat ini untuk memotret perangkat crew yang mati. Foto akan disimpan sebagai bukti tambahan, terpisah dari foto clock out.')}</p>
        {locationName && <p className="mt-2 text-xs text-orange-800">{translateUI('Lokasi penugasan')}: {locationName}</p>}
      </div>
      <label className="block text-sm text-slate-700">
        {translateUI('Catatan device mati')}
        <textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3" placeholder={translateUI('Alasan device mati, misal baterai habis atau layar rusak (opsional)')} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => void upload(e.currentTarget.files?.[0])} />
      <button type="button" disabled={submitting} onClick={() => input.current?.click()} className="min-h-14 w-full rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
        {submitting ? translateUI('Mengunggah foto device mati...') : translateUI('Buka kamera dan ambil foto')}
      </button>
      <p className="text-xs text-slate-500">{translateUI('Setelah foto tersimpan, Anda akan kembali ke halaman absen.')}</p>
    </section>
  );
}
