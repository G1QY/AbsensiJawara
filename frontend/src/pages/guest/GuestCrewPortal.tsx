import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifications } from '../../lib/NotificationsContext';
import { useAuth } from '../../lib/AuthContext';
import DeviceLocationMap from '../../components/maps/DeviceLocationMap';

export interface GuestAttendanceRecord {
  occurredAt?: string;
  serverId?: string;
  id: string;
  nama: string;
  hp: string;
  jenis: 'Crew Event' | 'Crew Store' | 'Kantor';
  jenis: 'Crew Event' | 'Crew Store' | 'Kantor';
  lokasi: string;
  posisi: string;
  tipe: 'Clock In' | 'Clock Out';
  timestamp: string;
  timeShort: string;
  dateFull: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string;
  photoCode: string;
  foto: string;
  catatan: string;
  status: 'Menunggu Verifikasi Admin' | 'Disetujui' | 'Ditolak';
}

const GUEST_STORAGE_KEY = 'Jawara_guest_attendances';

export function getGuestAttendances(): GuestAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter(g => g && typeof g.id === 'string' && typeof g.nama === 'string' && typeof g.hp === 'string' && typeof g.foto === 'string' && ['Clock In', 'Clock Out'].includes(g.tipe)) : [];
  } catch {
    return [];
  }
}

export function saveGuestAttendance(record: GuestAttendanceRecord) {
  const list = getGuestAttendances();
  const updated = [record, ...list];
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function markGuestSynced(record: GuestAttendanceRecord, serverId: string) {
  try {
    const list = getGuestAttendances().map(g => g.id === record.id && g.timestamp === record.timestamp && g.foto === record.foto ? { ...g, serverId } : g);
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(list));
  } catch { /* Server remains authoritative; the original local record is not deleted. */ }
}

interface GuestOptions { stores: { id: string; name: string }[]; events: { id: string; event_name: string; event_date: string }[] }
const GUEST_API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api/guest-attendance';

// Generate random verification hash code
function generatePhotoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function GuestCrewPortal({ page, onNavigate }: { page: string; onNavigate: (page: string) => void }) {
  const { auth } = useAuth();
  const { add } = useNotifications();
  const activeTab = page === 'guest-info' ? 'jadwal' : page === 'guest-help' ? 'bantuan' : 'absen';

  // Form State
  const [nama, setNama] = useState(
    auth?.user?.full_name && !auth.user.full_name.includes('Guest Crew') ? auth.user.full_name : ''
  );
  const [hp, setHp] = useState(auth?.user?.phone || '');
  const [jenis, setJenis] = useState<'Crew Event' | 'Crew Store' | 'Kantor'>('Crew Event');
  const [jenis, setJenis] = useState<'Crew Event' | 'Crew Store' | 'Kantor'>('Crew Event');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<GuestOptions>({ stores: [], events: [] });
  const [optionsError, setOptionsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionKey = useRef(crypto.randomUUID());
  const submissionFingerprint = useRef('');
  const [posisi, setPosisi] = useState('Tenda');
  const [tipeAbsen, setTipeAbsen] = useState<'Clock In' | 'Clock Out'>('Clock In');
  const [catatan, setCatatan] = useState('');

  // GPS State
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('');
  const [locLoading, setLocLoading] = useState(false);
  const [locSource, setLocSource] = useState<'gps' | 'none'>('none');
  const [locError, setLocError] = useState('');

  // Camera & Photo State
  const [foto, setFoto] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState({
    timeShort: '',
    dateFull: '',
    timeFull: '',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Submissions
  const [submittedRecord, setSubmittedRecord] = useState<GuestAttendanceRecord | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const adminPhone = (import.meta.env.VITE_ADMIN_WHATSAPP || '6281214989974').toString().replace(/\D/g, '');

  const getLocationText = useCallback(() => {
    if (jenis === 'Kantor') {
      return locations.stores.find(s => s.id === selectedLocation)?.name || 'Kantor';
    }
    return jenis === 'Crew Store' ? locations.stores.find(s => s.id === selectedLocation)?.name || '' : locations.events.find(e => e.id === selectedLocation)?.event_name || '';
  }, [selectedLocation, jenis, locations]);
  useEffect(() => {
    let active = true;
    fetch(GUEST_API + '/options').then(async res => { if (!res.ok) throw new Error('Pilihan lokasi belum dapat dimuat. Periksa backend lalu muat ulang.'); return res.json(); }).then(data => { if (active) { if (!Array.isArray(data.stores) || !Array.isArray(data.events)) throw new Error('Respons lokasi tidak valid.'); setLocations(data); } }).catch(error => { if (active) setOptionsError(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (jenis === 'Kantor') {
      const kantor = locations.stores.find(s => s.name.toLowerCase() === 'kantor');
      setSelectedLocation(kantor?.id || '');
    } else {
      setSelectedLocation('');
    }
  }, [jenis, locations.stores]);

  // Realtime clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeShort = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace('.', ':');
      const timeFull = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') + ' WIB';
      const dateFull = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      setCurrentTimeFormatted({ timeShort, dateFull, timeFull });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Device location only; never substitute a location inferred from IP.
  const locationRequest = useRef(0);
  const addressAbort = useRef<AbortController | null>(null);

  const detectLocation = useCallback(() => {
    const requestId = ++locationRequest.current;
    addressAbort.current?.abort();
    setLat(null); setLng(null); setAccuracy(null); setAddress('');
    setLocSource('none'); setLocError(''); setLocLoading(true);
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocLoading(false);
      setLocError('Lokasi perangkat tidak tersedia. Buka melalui HTTPS dan izinkan akses lokasi.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (requestId !== locationRequest.current) return;
        const { latitude, longitude, accuracy: measuredAccuracy } = pos.coords;
        if (![latitude, longitude, measuredAccuracy].every(Number.isFinite) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || measuredAccuracy <= 0) {
          setLocLoading(false);
          setLocError('Perangkat mengirim lokasi tidak valid. Tekan Perbarui GPS.');
          return;
        }
        setLat(latitude); setLng(longitude); setAccuracy(Math.ceil(measuredAccuracy));
        // Existing API enum; the browser does not reveal its positioning sensor.
        setLocSource('gps'); setLocLoading(false);
        if (measuredAccuracy > 100) {
          setLocError('Lokasi masih kurang akurat. Aktifkan lokasi presisi, pindah ke area terbuka, lalu tekan Perbarui GPS.');
          setAddress('Alamat tidak ditampilkan karena perkiraan lokasi masih terlalu luas.');
          return;
        }
        const controller = new AbortController();
        addressAbort.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        setAddress('Mencari perkiraan alamat...');
        try {
          const params = new URLSearchParams({
            lat: String(latitude), lon: String(longitude),
            format: 'json', zoom: '18', addressdetails: '1',
          });
          const res = await fetch('https://nominatim.openstreetmap.org/reverse?' + params,
            { headers: { 'Accept-Language': 'id' }, signal: controller.signal });
          if (!res.ok) throw new Error('Address unavailable');
          const data = await res.json();
          if (requestId !== locationRequest.current) return;
          setAddress(typeof data.display_name === 'string' && data.display_name.trim()
            ? data.display_name
            : 'Alamat belum tersedia. Koordinat perangkat tetap tercatat.');
        } catch {
          if (requestId === locationRequest.current)
            setAddress('Alamat belum tersedia. Koordinat perangkat tetap tercatat.');
        } finally { window.clearTimeout(timeout); }
      },
      (error) => {
        if (requestId !== locationRequest.current) return;
        setLocLoading(false);
        setLocError(error.code === 1
          ? 'Izin lokasi ditolak. Izinkan lokasi presisi pada browser dan perangkat, lalu tekan Perbarui GPS.'
          : error.code === 2
            ? 'Lokasi perangkat belum tersedia. Aktifkan layanan lokasi dan coba di area terbuka.'
            : 'Pencarian lokasi melewati batas waktu. Aktifkan lokasi presisi lalu tekan Perbarui GPS.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    detectLocation();
    return () => { ++locationRequest.current; addressAbort.current?.abort(); };
  }, [detectLocation]);

  // Camera Management
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError('');
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { });
        }
      }, 100);
    } catch (err) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { });
          }
        }, 100);
      } catch (fallbackErr) {
        setCameraError('Kamera tidak dapat diakses. Pastikan izin kamera aktif di browser.');
        setIsCameraActive(false);
      }
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture Photo with Clean "Timemark" Style Watermark
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw Video Frame (Mirror if front camera)
    ctx.save();
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    // Generate Verification Code
    const photoCode = generatePhotoCode();
    const { timeShort, dateFull } = currentTimeFormatted;
    const locationName = getLocationText();
    const resolvedAddress = address || locationName;

    // -------------------------------------------------------------
    // Branding is not a guarantee of identity or GPS accuracy.
    // -------------------------------------------------------------
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const topPadding = Math.round(height * 0.05);
    const rightPadding = Math.round(width * 0.05);

    ctx.textAlign = 'right';
    ctx.font = `bold ${Math.round(width * 0.038)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#F59E0B'; // Amber / Gold accent
    ctx.fillText('JAWARA', width - rightPadding, topPadding);

    ctx.font = `500 ${Math.round(width * 0.022)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Bukti pengajuan absensi', width - rightPadding, topPadding + Math.round(width * 0.03));
    ctx.restore();

    // -------------------------------------------------------------
    // 2. BOTTOM LEFT WATERMARK (Timemark Style)
    // -------------------------------------------------------------
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const leftMargin = Math.round(width * 0.045);
    const bottomBase = height - Math.round(height * 0.08);

    // Pill Badge: "Absensi" (Yellow/Amber) + "07:45" (White)
    const badgeHeight = Math.max(34, Math.round(height * 0.055));
    const labelText = tipeAbsen === 'Clock In' ? 'Absensi' : 'Pulang';
    const timeText = timeShort || '12:00';

    ctx.font = `bold ${Math.round(badgeHeight * 0.52)}px system-ui, -apple-system, sans-serif`;
    const labelWidth = ctx.measureText(labelText).width + 24;
    const timeWidth = ctx.measureText(timeText).width + 28;
    const badgeWidth = labelWidth + timeWidth;
    const badgeY = bottomBase - Math.round(height * 0.22);

    // Draw Rounded Capsule Container
    const radius = 8;
    ctx.beginPath();
    ctx.roundRect(leftMargin, badgeY, badgeWidth, badgeHeight, radius);
    ctx.clip();

    // Left Half: Yellow / Amber Background
    ctx.fillStyle = tipeAbsen === 'Clock In' ? '#F59E0B' : '#EF4444';
    ctx.fillRect(leftMargin, badgeY, labelWidth, badgeHeight);

    // Right Half: White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(leftMargin + labelWidth, badgeY, timeWidth, badgeHeight);

    // Draw Label Text (Dark bold)
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(badgeHeight * 0.52)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(labelText, leftMargin + labelWidth / 2, badgeY + badgeHeight / 2);

    // Draw Time Text (Dark bold font)
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 ${Math.round(badgeHeight * 0.58)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(timeText, leftMargin + labelWidth + timeWidth / 2, badgeY + badgeHeight / 2);

    ctx.restore(); // Restore shadow

    // -------------------------------------------------------------
    // 3. DATE & MULTI-LINE ADDRESS WITH YELLOW VERTICAL ACCENT
    // -------------------------------------------------------------
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const contentStartY = badgeY + badgeHeight + 16;
    const textLeft = leftMargin + 14;
    const maxTextWidth = Math.round(width * 0.72);
    const dateFontSize = Math.round(width * 0.03);
    const addrFontSize = Math.round(width * 0.024);
    const lineHeight = Math.round(addrFontSize * 1.35);

    // Wrap address into lines
    ctx.font = `500 ${addrFontSize}px system-ui, -apple-system, sans-serif`;
    const words = resolvedAddress.split(' ');
    const addressLines: string[] = [];
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxTextWidth && currentLine) {
        addressLines.push(currentLine);
        currentLine = words[n];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) addressLines.push(currentLine);

    // Calculate total height for vertical yellow bar
    const totalTextHeight = dateFontSize + 6 + addressLines.length * lineHeight;

    // Draw Yellow Vertical Accent Bar
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(leftMargin, contentStartY, 4, totalTextHeight);

    // Draw Date Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${dateFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(dateFull, textLeft, contentStartY);

    // Draw Address Lines
    ctx.font = `500 ${addrFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    let lineY = contentStartY + dateFontSize + 6;
    for (let i = 0; i < addressLines.length; i++) {
      ctx.fillText(addressLines[i], textLeft, lineY);
      lineY += lineHeight;
    }

    // -------------------------------------------------------------
    // 4. BOTTOM FOOTER VERIFICATION CODE
    // -------------------------------------------------------------
    const footerY = lineY + 12;
    ctx.font = `500 ${Math.round(width * 0.018)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(`Kode Foto: ${photoCode}`, leftMargin, footerY);

    ctx.restore();

    // Export watermarked photo to dataUrl
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFoto(dataUrl);
    stopCamera();
  };

  // Submit Guest Attendance
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nama.trim()) {
      setFormError('Nama Lengkap wajib diisi agar admin mengenali data Anda.');
      return;
    }
    if (!hp.trim()) {
      setFormError('Nomor WhatsApp / HP wajib diisi untuk konfirmasi.');
      return;
    }
    if (lat === null || lng === null || locSource !== 'gps') { setFormError('Aktifkan GPS perangkat. Lokasi perkiraan jaringan tidak dapat digunakan untuk mengirim absensi.'); return; }
    if (!foto) {
      setFormError('Foto bukti kehadiran wajib diambil menggunakan kamera.');
      return;
    }

    const { timeShort, dateFull } = currentTimeFormatted;
    const photoCode = generatePhotoCode();

    const newRecord: GuestAttendanceRecord = {
      id: '', // Displayed only after the server returns the persisted UUID.
      nama: nama.trim(),
      hp: hp.trim(),
      jenis,
      lokasi: getLocationText() || 'Tanpa pilihan event / toko',
      posisi,
      tipe: tipeAbsen,
      timestamp: `${dateFull} • ${timeShort}`,
      timeShort,
      dateFull,
      latitude: lat,
      longitude: lng,
      accuracy,
      address: address || getLocationText(),
      photoCode,
      foto,
      catatan: catatan.trim(),
      status: 'Menunggu Verifikasi Admin',
    };

    if (submitting) return;
    setSubmitting(true);
    try {
      const fingerprint = JSON.stringify([nama, hp, jenis, selectedLocation, posisi, tipeAbsen, catatan, foto, lat, lng]);
      if (fingerprint !== submissionFingerprint.current) { submissionKey.current = crypto.randomUUID(); submissionFingerprint.current = fingerprint; }
      const form = new FormData();
      for (const [key, value] of Object.entries({ fullName: newRecord.nama, phone: newRecord.hp, crewType: jenis === 'Crew Event' ? 'CREW_EVENT' : 'CREW_STORE', locationId: selectedLocation, locationName: newRecord.lokasi, position: posisi, clockType: tipeAbsen === 'Clock In' ? 'IN' : 'OUT', latitude: lat, longitude: lng, accuracy: accuracy ?? '', address: newRecord.address, note: newRecord.catatan, locationSource: locSource, submissionKey: submissionKey.current })) form.append(key, String(value));
      form.append('photo', await (await fetch(foto)).blob(), 'guest-selfie.jpg');
      const res = await fetch(GUEST_API, { method: 'POST', headers: { 'X-Jawara-Request': '1' }, body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error(data?.message || 'Absensi belum tersimpan di server. Coba lagi.');
      setSubmittedRecord({ ...newRecord, id: data.id, occurredAt: data.occurred_at, timestamp: new Date(data.occurred_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) });
      submissionKey.current = crypto.randomUUID();
      setFoto(''); setCatatan(''); setSubmitSuccess(true);
      add('Absensi diterima server', 'Pengajuan menunggu tinjauan admin. Foto dan catatan tersimpan di server.');
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Pengiriman gagal. Coba lagi.'); }
    finally { setSubmitting(false); }
  };

  const generateWhatsAppMessage = (rec: GuestAttendanceRecord) => {
    const mapLink =
      rec.latitude && rec.longitude
        ? `https://maps.google.com/?q=${rec.latitude},${rec.longitude}`
        : 'Tidak terdeteksi';

    const text = `*KONFIRMASI ABSENSI LAPANGAN (GUEST CREW)*
------------------------------------
*ID Absensi:* ${rec.id}
*Kode Verifikasi:* ${rec.photoCode}
*Nama Crew:* ${rec.nama}
*No. WhatsApp:* ${rec.hp}
*Penugasan:* ${rec.jenis}
*Lokasi/Venue:* ${rec.lokasi}
*Posisi Tugas:* ${rec.posisi}
*Jenis Absen:* ${rec.tipe}
*Waktu:* ${rec.timestamp}
*Alamat Terdeteksi:* ${rec.address}
*Link Lokasi:* ${mapLink}
*Catatan:* ${rec.catatan}

_Foto selfie telah tersimpan di sistem._`;

    return `https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-full bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* Main Container */}
      <div className="max-w-[680px] mx-auto px-4 py-5">
        {/* Navigation Tabs */}
        <nav aria-label="Navigasi portal Guest Crew" className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 mb-5 gap-1">
          {[
            { id: 'guest-portal', label: 'Form Absensi Darurat' },
            { id: 'guest-info', label: 'Info Event Hari Ini' },
            { id: 'guest-help', label: 'Pusat Bantuan' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={page === tab.id ? 'page' : undefined}
              onClick={() => onNavigate(tab.id)}
              className={`flex-1 min-w-0 py-2.5 px-2 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${page === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* TAB 1: FORM ABSENSI */}
        {activeTab === 'absen' && (
          <div className="space-y-6">
            {submitSuccess && submittedRecord && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-bold text-emerald-950">
                        Absensi Lapangan Berhasil Dikirim
                      </h3>
                      <span className="font-mono text-xs px-2.5 py-0.5 bg-emerald-200 text-emerald-900 rounded font-semibold">
                        {submittedRecord.id}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1">
                      Data absensi <strong>{submittedRecord.nama}</strong> ({submittedRecord.tipe}) di{' '}
                      <strong>{submittedRecord.lokasi}</strong> telah diterima server dan menunggu tinjauan admin.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <a
                        href={generateWhatsAppMessage(submittedRecord)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                      >
                        Kirim Bukti ke WhatsApp Admin
                      </a>
                      <button
                        onClick={() => {
                          setSubmitSuccess(false);
                          setSubmittedRecord(null);
                        }}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                      >
                        Tutup Notifikasi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-base font-bold text-slate-900">
                  Form Input Absensi Darurat Lapangan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi data kehadiran Anda secara lengkap untuk verifikasi payroll dan kehadiran.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                {optionsError && <p role="alert" className="text-sm text-red-700">{optionsError}</p>}
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    {formError}
                  </div>
                )}

                {/* Identitas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Nama lengkap crew"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Nomor WhatsApp / HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={hp}
                      onChange={(e) => setHp(e.target.value)}
                      placeholder="081234567890"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Penugasan & Aksi */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Jenis Penugasan
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Crew Event', 'Crew Store', 'Kantor'] as const).map((t) => (
                        <div className="grid grid-cols-3 gap-2">
                          {(['Crew Event', 'Crew Store', 'Kantor'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setJenis(t)}
                              className={`py-2 px-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all text-center ${jenis === t
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                  </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Tipe Absensi
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Clock In', 'Clock Out'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTipeAbsen(t)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${tipeAbsen === t
                              ? t === 'Clock In'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-red-600 text-white border-red-600 shadow-sm'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Posisi / Tugas
                      </label>
                      <select
                        value={posisi}
                        onChange={(e) => setPosisi(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option>Tenda</option>
                        <option>FotoSnaps</option>
                        <option>Bujangan</option>
                        <option>Fotobox</option>
                        <option>Staff Kantor</option>
                      </select>
                    </div>
                  </div>

                  {/* Lokasi / Event */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      {jenis === 'Kantor' ? 'Lokasi Kantor (opsional)' : 'Lokasi Event / Toko (opsional)'}
                    </label>
                    <select
                      aria-label="Lokasi Event / Toko"
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium"
                    >
                      <option value="">
                        {jenis === 'Kantor' ? 'Tanpa pilihan lokasi kantor' : 'Tanpa pilihan event / toko'}
                      </option>
                      {(jenis === 'Crew Store'
                        ? locations.stores.map(s => ({ id: s.id, name: s.name }))
                        : jenis === 'Kantor'
                          ? (locations.stores.some(s => s.name.toLowerCase().includes('kantor'))
                            ? locations.stores.filter(s => s.name.toLowerCase().includes('kantor')).map(s => ({ id: s.id, name: s.name }))
                            : locations.stores.map(s => ({ id: s.id, name: s.name })))
                          : locations.events.map(e => ({ id: e.id, name: e.event_name }))
                      ).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  {/* Deteksi Lokasi GPS Live & Peta */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${lat !== null && lng !== null ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-blue-500 animate-pulse'
                            }`}
                        />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Deteksi Lokasi GPS & Peta
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={locLoading}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                      >
                        <svg className={`w-3.5 h-3.5 ${locLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{locLoading ? 'Mendeteksi...' : 'Perbarui GPS'}</span>
                      </button>
                    </div>

                    {lat !== null && lng !== null ? (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {lat.toFixed(6)}, {lng.toFixed(6)}
                          </span>
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Lokasi perangkat · estimasi akurasi ±{accuracy ?? 0} m
                          </span>
                        </div>
                        {locError && <p role="status" className="text-xs text-amber-700">{locError}</p>}
                        {address && (
                          <p className="text-xs text-slate-600 pt-0.5 leading-relaxed">
                            {address}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                        <p>{locLoading ? 'Mencari lokasi perangkat, maksimal 20 detik...' : locError || 'Menunggu deteksi lokasi...'}</p>
                      </div>
                    )}

                    {lat !== null && lng !== null && locSource === 'gps' && (
                      <DeviceLocationMap latitude={lat} longitude={lng} accuracy={accuracy} />
                    )}
                  </div>

                  {/* Foto Selfie (Kamera Live) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Foto Bukti Kehadiran <span className="text-red-500">*</span>
                      </label>
                    </div>

                    {/* Hidden Canvas for Watermark Processing */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Live Camera Viewfinder Modal / View */}
                    {isCameraActive ? (
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 text-white space-y-4 border border-slate-800 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleCameraFacing}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors"
                            >
                              Ganti Kamera
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300 font-semibold transition-colors"
                            >
                              Tutup
                            </button>
                          </div>
                        </div>

                        {/* Video Viewfinder Container */}
                        <div className="w-full max-w-lg mx-auto aspect-[4/3] rounded-xl overflow-hidden bg-black relative border border-slate-700 flex items-center justify-center">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                          />

                          {/* Top Right Mini Brand */}
                          <div className="absolute top-3 right-3 text-right">
                            <p className="text-xs font-bold text-amber-400 leading-none">Jawara</p>
                            <p className="text-[10px] text-white/80 mt-0.5">Bukti pengajuan absensi</p>
                          </div>

                          {/* Live Watermark Preview on Bottom Left */}
                          <div className="absolute bottom-3 left-3 text-left max-w-[85%] space-y-1">
                            <div className="inline-flex rounded overflow-hidden text-xs font-bold shadow-md">
                              <span className="bg-amber-500 text-slate-950 px-2 py-0.5">
                                {tipeAbsen === 'Clock In' ? 'Absensi' : 'Pulang'}
                              </span>
                              <span className="bg-white text-slate-950 px-2 py-0.5">
                                {currentTimeFormatted.timeShort || '12:00'}
                              </span>
                            </div>

                            <div className="border-l-2 border-amber-400 pl-2 text-white text-[11px] leading-tight">
                              <p className="font-bold">{currentTimeFormatted.dateFull}</p>
                              <p className="text-slate-200 line-clamp-2 mt-0.5">{address || getLocationText()}</p>
                            </div>
                          </div>
                        </div>

                        {/* Capture Trigger Button */}
                        <div className="max-w-lg mx-auto">
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all"
                          >
                            Ambil Gambar Sekarang
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Initial & Captured State View */
                      <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                        {foto ? (
                          <div className="space-y-3">
                            <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-slate-300 shadow-sm relative bg-black">
                              <img
                                src={foto}
                                alt="Bukti Kehadiran"
                                className="w-full h-auto object-contain max-h-[380px]"
                              />
                            </div>

                            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                              <button
                                type="button"
                                onClick={() => startCamera()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                              >
                                Ambil Ulang Foto
                              </button>
                              <button
                                type="button"
                                onClick={() => setFoto('')}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Hapus Foto
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 space-y-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                Ambil Foto Selfie di Lokasi
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                                Sistem menyematkan stempel waktu, tanggal, dan alamat lengkap secara otomatis pada foto.
                              </p>
                            </div>

                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => startCamera()}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all"
                              >
                                Buka Kamera Selfie
                              </button>
                            </div>
                          </div>
                        )}

                        {cameraError && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                            {cameraError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Catatan / Keterangan Darurat */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Recap Event & Catatan Keterangan (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Ketik keterangan jika ada kendala di lapangan..."
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Submit button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !!optionsError}
                      className="w-full py-3 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
                    >
                      {submitting ? 'Mengirim ke server...' : 'Kirim Absensi Lapangan'}
                    </button>
                  </div>
              </form>
            </div>
          </div>
        )}

        {/* Event dari sistem, tanpa jadwal atau PIC dummy */}
        {activeTab === 'jadwal' && <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200"><h3 className="font-bold text-slate-900">Event Terdaftar</h3><p className="text-sm text-slate-600">Jadwal kerja pribadi tidak ditampilkan pada mode guest. Konfirmasikan jam tugas kepada admin.</p></div>
          {optionsError && <p role="alert" className="text-red-700">{optionsError}</p>}
          {locations.events.map(ev => <div key={ev.id} className="bg-white rounded-xl p-5 border border-slate-200"><h4 className="font-semibold text-slate-900">{ev.event_name}</h4><p className="text-sm text-slate-600">Tanggal event: {ev.event_date}</p></div>)}
          {!locations.events.length && !optionsError && <p className="text-sm text-slate-600">Belum ada event aktif dari sistem.</p>}
        </div>}

        {/* TAB 4: PUSAT BANTUAN */}
        {activeTab === 'bantuan' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Pusat Bantuan & Layanan Kendala Akun
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Jika mengalami kendala kata sandi atau akun terkunci, hubungi Admin Jawara melalui kontak di bawah ini.
              </p>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-900">Helpdesk Admin Jawara</p>
                  <p className="text-xs text-blue-700">WhatsApp: 081214989974</p>
                </div>
                <a
                  href={`https://wa.me/${adminPhone}?text=${encodeURIComponent(
                    'Halo Admin Jawara, saya memerlukan bantuan reset password akun crew.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Hubungi Admin
                </a>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Petunjuk Lapangan:
                </h4>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  <li>Lakukan Clock In saat tiba di lokasi penugasan.</li>
                  <li>Ambil foto bukti kehadiran langsung melalui kamera.</li>
                  <li>Waktu dan alamat lokasi otomatis disematkan pada foto.</li>
                  <li>Setelah submit, teruskan bukti kehadiran ke WhatsApp Admin jika diperlukan.</li>
                  <li>Lakukan Clock Out setelah menyelesaikan shift/tugas.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

