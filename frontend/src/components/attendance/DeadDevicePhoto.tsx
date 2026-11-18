import { useRef, useState } from 'react';
import { t as translateUI } from '../../lib/i18n';
import { api, ApiError } from '../../lib/apiClient';

interface DeadDevicePhotoProps {
  attendanceId: string;
  locationName?: string | null;
  uploaded?: boolean;
  page?: boolean;
  onOpen?: () => void;
  onBack?: () => void;
  onUploaded?: () => void | Promise<void>;
}

export default function DeadDevicePhoto({ attendanceId, locationName, uploaded = false, page = false, onOpen, onBack, onUploaded }: DeadDevicePhotoProps) {
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
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'Gagal mengunggah foto bukti matikan device.');
      if (input.current) input.current.value = '';
    } finally {
      setSubmitting(false);
    }
  }

  if (!page) {
    if (uploaded) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">{translateUI('Foto bukti matikan device sudah tersimpan')}</span>
          </div>
          <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => void upload(e.currentTarget.files?.[0])} />
          <button type="button" onClick={() => (onOpen ? onOpen() : input.current?.click())} className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-900">
            {translateUI('Ganti Foto')}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => void upload(e.currentTarget.files?.[0])} />
        <button
          type="button"
          disabled={submitting}
          onClick={() => (onOpen ? onOpen() : input.current?.click())}
          className="w-full min-h-12 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-orange-100 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {submitting ? translateUI('Mengunggah foto bukti matikan device...') : translateUI('Foto Bukti Matikan Device')}
        </button>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-lg space-y-4 p-3 sm:p-6" aria-labelledby="dead-device-title">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">← {translateUI('Kembali ke absen')}</button>
      </div>
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <h2 id="dead-device-title" className="font-semibold text-orange-950">{translateUI('Foto Bukti Matikan Device')}</h2>
        <p className="mt-1 text-sm text-orange-800">{translateUI('Ambil foto bukti bahwa perangkat kerja (seperti photobooth, printer, tablet, atau peralatan toko) sudah dimatikan sebelum Clock Out.')}</p>
        {locationName && <p className="mt-2 text-xs text-orange-800">{translateUI('Lokasi penugasan')}: {locationName}</p>}
      </div>
      <label className="block text-sm text-slate-700">
        {translateUI('Catatan')}
        <textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3" placeholder={translateUI('Catatan kondisi perangkat yang sudah dimatikan')} />
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <input ref={input} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => void upload(e.currentTarget.files?.[0])} />
      <button type="button" disabled={submitting} onClick={() => input.current?.click()} className="min-h-14 w-full rounded-xl bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
        {submitting ? translateUI('Mengunggah foto bukti matikan device...') : translateUI('Buka kamera dan ambil foto')}
      </button>
      <p className="text-xs text-slate-500">{translateUI('Setelah foto tersimpan, Anda akan kembali ke halaman absen.')}</p>
    </section>
  );
}
