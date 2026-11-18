import { useState, useCallback } from 'react';
import { t as translateUI } from '../../lib/i18n';
import CameraCapture from './CameraCapture';
import { api, ApiError } from '../../lib/apiClient';

interface DeadDevicePhotoProps {
  attendanceId: string;
  locationName?: string | null;
  onUploaded?: () => void;
}

/**
 * Tombol dan kamera untuk mengambil foto device yang mati.
 * Dipakai sebelum clock out ketika crew harus pinjam device crew lain
 * karena device aslinya mati/rusak.
 *
 * Foto dikirim ke POST /attendance/{id}/dead-device-photo.
 * Tidak memerlukan GPS karena ini foto device, bukan selfie absensi.
 */
export default function DeadDevicePhoto({ attendanceId, locationName, onUploaded }: DeadDevicePhotoProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submit = useCallback(async (photo: Blob) => {
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', photo, 'dead_device.jpg');
      form.append('note', note);
      await api.postForm(`/attendance/${attendanceId}/dead-device-photo`, form);
      setDone(true);
      setOpen(false);
      onUploaded?.();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : 'Gagal mengunggah foto device mati.');
    } finally {
      setSubmitting(false);
    }
  }, [attendanceId, note, onUploaded]);

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm font-semibold">{translateUI("Foto device mati berhasil diunggah")}</p>
        </div>
        <p className="mt-1 text-xs text-emerald-600">{translateUI("Foto tersimpan sebagai bukti. Lanjutkan clock out.")}</p>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-center gap-3">
        <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-500">{translateUI("Mengunggah foto device mati...")}</p>
      </div>
    );
  }

  if (open) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-900">{translateUI("Foto Device yang Mati")}</p>
          <p className="mt-1 text-xs text-orange-700">{translateUI("Arahkan kamera ke device yang mati sebagai bukti. Foto ini akan dilampirkan ke data absensi Anda.")}</p>
        </div>

        {error && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <label className="block text-sm text-slate-700">
          {translateUI("Catatan device mati")}
          <textarea
            maxLength={2000}
            value={note}
            onChange={e => setNote(e.target.value)}
            className="mt-1 w-full p-3 border border-slate-200 rounded-xl bg-white"
            placeholder={translateUI("Alasan device mati, misal: baterai habis, layar rusak (opsional)")}
          />
        </label>

        <CameraCapture
          accentColor="amber"
          locationName={locationName}
          facingMode="environment"
          faceGuide={false}
          activityLabel="Foto Device Mati"
          onCapture={(blob) => submit(blob)}
        />

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-600"
        >
          {translateUI("Batal")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700 hover:bg-orange-100 flex items-center justify-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      {translateUI("Foto Device Mati (Opsional)")}
    </button>
  );
}
