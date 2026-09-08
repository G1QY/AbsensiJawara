import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/apiClient';
import CameraCapture from './CameraCapture';

type UploadResult = { key: string; url: string; capturedAt?: string; latitude?: number; longitude?: number; distanceMeters?: number };

export default function CameraPhotoUpload({ eventId, value, onChange, onUploaded, fieldLabel = 'Foto Bukti', buttonLabel = 'Ambil foto dengan kamera', locationName, upload }: {
  eventId: string;
  value?: string;
  onChange: (key: string) => void;
  onUploaded?: (result: UploadResult) => void;
  fieldLabel?: string;
  buttonLabel?: string;
  locationName?: string | null;
  upload?: (photo: Blob) => Promise<UploadResult>;
}) {
  const [camera, setCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const localPreview = useRef('');

  useEffect(() => {
    let active = true;
    if (!value) { setPreviewUrl(''); return; }
    api.get<{url:string}>(`/crew-event/events/${eventId}/photos/url?key=${encodeURIComponent(value)}`)
      .then(result => { if (active && !localPreview.current) setPreviewUrl(result.url); })
      .catch(reason => { if (active && !localPreview.current) setError(reason instanceof Error ? reason.message : 'Preview foto tidak dapat dimuat.'); });
    return () => { active = false; };
  }, [eventId, value]);

  useEffect(() => () => { if (localPreview.current) URL.revokeObjectURL(localPreview.current); }, []);

  const saveCapture = async (photo: Blob, preview: string) => {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    localPreview.current = preview;
    setPreviewUrl(preview);
    setUploading(true);
    setError('');
    try {
      let result: UploadResult;
      if (upload) result = await upload(photo);
      else {
        const form = new FormData();
        form.append('photo', photo, 'camera.jpg');
        result = await api.postForm<UploadResult>(`/crew-event/events/${eventId}/photos`, form);
      }
      onChange(result.key);
      onUploaded?.(result);
      URL.revokeObjectURL(localPreview.current);
      localPreview.current = '';
      setPreviewUrl(result.url);
      setCamera(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Foto gagal diunggah.');
    } finally {
      setUploading(false);
    }
  };

  return <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-700">{fieldLabel}</label>
    {previewUrl ? <img src={previewUrl} alt={`Preview ${fieldLabel.toLowerCase()}`} className="h-48 w-full rounded-xl border border-slate-200 bg-slate-100 object-contain" /> : null}
    {camera ? <div className="rounded-2xl border border-slate-200 p-3">
      <CameraCapture facingMode="environment" faceGuide={false} locationName={locationName || fieldLabel} onCapture={(blob, url) => void saveCapture(blob, url)} />
      <button type="button" onClick={() => setCamera(false)} disabled={uploading} className="mt-2 w-full py-2 text-sm text-slate-500">Batal</button>
    </div> : <button type="button" onClick={() => setCamera(true)} disabled={uploading} className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-700 disabled:opacity-50">
      {uploading ? 'Mengunggah foto...' : value ? 'Ambil ulang dengan kamera' : buttonLabel}
    </button>}
    <p className="text-xs text-slate-500">Foto hanya dapat diambil langsung dari kamera. Galeri tidak tersedia.</p>
    {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}
  </div>;
}
