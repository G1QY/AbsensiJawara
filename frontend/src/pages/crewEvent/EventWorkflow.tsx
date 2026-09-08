import { createContext, useState, useEffect, useCallback, useContext, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../lib/apiClient';
import AttendanceAction from '../../components/attendance/AttendanceAction';
import CameraPhotoUpload from '../../components/attendance/CameraPhotoUpload';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { CrewEventAssignment } from './crewEventWorkspace';

const TOTAL_STEPS = 15;
const steps = [
  { id: 1, label: 'Clock In', desc: 'Absensi masuk dengan GPS dan foto wajah' },
  { id: 2, label: 'Inventory Before', desc: 'Foto dan data barang sebelum event' },
  { id: 3, label: 'Transportasi Pergi', desc: 'Transportasi keberangkatan' },
  { id: 4, label: 'Setup Ready', desc: 'Foto saat tiba dan setup sudah siap' },
  { id: 5, label: 'Cek Print Sebelum Event', desc: 'Foto hasil cek print sebelum event' },
  { id: 6, label: 'Event Berlangsung', desc: 'Event sedang berjalan' },
  { id: 7, label: 'Event Selesai', desc: 'Foto kondisi saat event selesai' },
  { id: 8, label: 'Cek Print Sesudah Event', desc: 'Foto hasil cek print sesudah event' },
  { id: 9, label: 'Kuota/Orbit', desc: 'Biaya kuota dan jumlah GB' },
  { id: 10, label: 'Transportasi Pulang', desc: 'Transportasi kepulangan' },
  { id: 11, label: 'Omset Event', desc: 'Omset tunai dan transfer' },
  { id: 12, label: 'Inventory After', desc: 'Foto dan data barang setelah event' },
  { id: 13, label: 'Comparison', desc: 'Perbandingan sebelum dan setelah' },
  { id: 14, label: 'Clock Out', desc: 'Absensi pulang dengan GPS dan foto wajah' },
  { id: 15, label: 'Selesai', desc: 'Ringkasan dan laporan event' },
];

const fmt = (n: number) => 'Rp' + n.toLocaleString('id-ID');
const draftNumber = (value: string) => value === '' ? '' : Number(value);
const WorkflowEventContext = createContext('');
const WorkflowAssignmentContext = createContext('');

function getWorkflowData(eventId: string): Record<string, any> {
  void eventId;
  return {};
}

function saveWorkflowData(eventId: string, data: Record<string, any>) {
  void eventId;
  void data;
}

const eventDateText = (value?: string) => value ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '-';
const timeText = (value?: string) => value ? `${value.slice(0, 5)} WIB` : '-';
const transportValue = (data: Record<string, any>, direction: 'pergi' | 'pulang', key: string, fallback = '-') => String(data[`transportasi_${direction}_${key}`] || fallback);

// ---------- PDF Export ----------
type ReportPhoto = { label: string; key: string; dataUrl?: string };

function reportPhotoKeys(assignment: CrewEventAssignment, data: Record<string, any>): ReportPhoto[] {
  const photos: ReportPhoto[] = [];
  const add = (label: string, key?: string | null) => { if (key) photos.push({ label, key }); };
  assignment.attendance.forEach((row, index) => add(`Clock In ${row.attendance_date || index + 1}`, row.check_in_photo_url));
  (data.inventory_before_items || []).forEach((item: any, index: number) => add(`Inventory Before - ${item.nama || `Item ${index + 1}`}`, item.foto));
  add('Transportasi Pergi', data.transportasi_pergi_photo);
  assignment.members?.forEach(member=>{add(`Setup Ready - ${member.name}`,data[`setup_ready_photo_${member.id}`]);add(`Event Selesai - ${member.name}`,data[`event_finished_photo_${member.id}`]);});
  add('Setup Ready', data[`setup_ready_photo_${assignment.id}`] || data.setup_ready_photo);
  add('Cek Print Sebelum Event', data.tes_print_before_photo || data.tes_print_photo);
  add('Event Selesai', data[`event_finished_photo_${assignment.id}`] || data.event_finished_photo);
  add('Cek Print Sesudah Event', data.tes_print_after_photo);
  add('Bukti Kuota', data.kuota_nominal_photo);
  add('Transportasi Pulang', data.transportasi_pulang_photo);
  add('Bukti Omset', data.omset_nominal_photo);
  (data.inventory_after_items || []).forEach((item: any, index: number) => add(`Inventory After - ${item.nama || `Item ${index + 1}`}`, item.foto_after));
  assignment.attendance.forEach((row, index) => add(`Clock Out ${row.attendance_date || index + 1}`, row.check_out_photo_url));
  return [...new Map(photos.map(photo => [photo.key, photo])).values()];
}

async function photoDataUrl(eventId: string, key: string, photoBase='/crew-event/events') {
  const signed = await api.get<{url:string}>(`${photoBase}/${eventId}/photos/url?key=${encodeURIComponent(key)}`);
  const response = await fetch(signed.url);
  if (!response.ok) throw new Error('Salah satu foto laporan tidak dapat dimuat.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Foto laporan tidak dapat dibaca.'));
    reader.readAsDataURL(blob);
  });
}

function addPhotoPages(doc: jsPDF, photos: ReportPhoto[]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = 82;
  const boxHeight = 58;
  photos.forEach((photo, index) => {
    if (index % 4 === 0) {
      doc.addPage();
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Dokumentasi Foto', 14, 18);
    }
    const slot = index % 4;
    const x = slot % 2 === 0 ? 14 : pageWidth / 2 + 3;
    const y = 28 + Math.floor(slot / 2) * 122;
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(photo.label.slice(0, 44), x, y);
    if (!photo.dataUrl) return;
    const props = doc.getImageProperties(photo.dataUrl);
    const scale = Math.min(boxWidth / props.width, boxHeight / props.height);
    const width = props.width * scale;
    const height = props.height * scale;
    doc.addImage(photo.dataUrl, 'JPEG', x + (boxWidth - width) / 2, y + 5, width, height, undefined, 'FAST');
  });
}

async function exportEventPDF(assignment: CrewEventAssignment, data: Record<string, any> = {}, download = true, photoBase='/crew-event/events') {
  const { event } = assignment;
  const schedules = [...(assignment.event_schedules || [])].sort((a, b) => a.schedule_date.localeCompare(b.schedule_date) || a.start_time.localeCompare(b.start_time));
  const firstSchedule = schedules[0];
  const lastSchedule = schedules[schedules.length - 1];
  const startDate = firstSchedule?.schedule_date || event.event_date;
  const endDate = lastSchedule?.schedule_date || event.event_date;
  const eventPeriod = startDate === endDate ? eventDateText(startDate) : `${eventDateText(startDate)} sampai ${eventDateText(endDate)}`;
  const eventId = event.id;
  const eventName = event.event_name;
  const reportStatus = event.status;
  const photos = reportPhotoKeys(assignment, data);
  const loadedPhotos = await Promise.all(photos.map(async photo => ({ ...photo, dataUrl: await photoDataUrl(eventId, photo.key, photoBase) })));
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('FotoSnaps', 14, 18);
  doc.setFontSize(10);
  doc.text('Laporan Event', 14, 26);
  doc.setFontSize(12);
  doc.text(eventName, 14, 34);

  doc.setTextColor(0, 0, 0);
  let y = 52;

  // Event Info
  doc.setFontSize(14);
  doc.text('Informasi Event', 14, y);
  y += 8;
  doc.setFontSize(10);

  const info = [
    ['Event ID', eventId],
    ['Kode Event', event.event_code],
    ['Nama Event', eventName],
    ['Klien', event.client_name || '-'],
    ['Cabang', event.branch?.name || '-'],
    ['PIC', event.pic?.user?.full_name || '-'],
    ['Lokasi', event.event_locations?.[0]?.address || '-'],
    ['Tanggal Event', eventPeriod],
    ['Waktu Event', event.start_time&&event.end_time?`${timeText(event.start_time)} sampai ${timeText(event.end_time)}`:firstSchedule && lastSchedule ? `${timeText(firstSchedule.start_time)} sampai ${timeText(lastSchedule.end_time)}` : '-'],
    ['Jumlah Crew', `${assignment.team.length} crew`],
    ['Tanggal Export', new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
    ['Status', `${reportStatus} (${assignment.workflow.max_reached}/${TOTAL_STEPS})`],
  ];
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: info,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (schedules.length) {
    doc.setFontSize(14);
    doc.text('Jadwal Event', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Mulai', 'Selesai', 'Status']],
      body: schedules.map(schedule => [eventDateText(schedule.schedule_date), timeText(schedule.start_time), timeText(schedule.end_time), schedule.status]),
      theme: 'grid', headStyles: { fillColor: [37, 99, 235] }, margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Transportasi
  if (y > 235) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text('Transportasi', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Arah', 'Tanggal', 'Jam', 'Layanan', 'Kendaraan', 'Nominal']],
    body: [
      ['Pergi', eventDateText(data.transportasi_pergi_tanggal || startDate), timeText(data.transportasi_pergi_jam), transportValue(data, 'pergi', 'layanan', 'Lalamove'), transportValue(data, 'pergi', 'kendaraan'), fmt(Number(data.transportasi_pergi_nominal) || 0)],
      ['Pulang', eventDateText(data.transportasi_pulang_tanggal || endDate), timeText(data.transportasi_pulang_jam), transportValue(data, 'pulang', 'layanan', 'Lalamove'), transportValue(data, 'pulang', 'kendaraan'), fmt(Number(data.transportasi_pulang_nominal) || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // Ringkasan operasional
  doc.setFontSize(14);
  doc.text('Ringkasan Operasional', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Nilai']],
    body: [
      ['Cek Print Sebelum Event', data.tes_print_before_photo || data.tes_print_photo ? 'Foto tersedia' : 'Belum ada foto'],
      ['Cek Print Sesudah Event', data.tes_print_after_photo ? 'Foto tersedia' : 'Belum ada foto'],
      ['Setup Ready', (data[`setup_ready_photo_${assignment.id}`] || data.setup_ready_photo) ? 'Foto tersedia' : 'Belum ada foto'],
      ['Kondisi Event Selesai', (data[`event_finished_photo_${assignment.id}`] || data.event_finished_photo) ? 'Foto tersedia' : 'Belum ada foto'],
      ['Kuota/Orbit', `${Number(data.kuota_gb) || 0} GB, ${data.kuota_provider || 'provider belum diisi'}, ${fmt(Number(data.kuota_nominal) || 0)}`],
      ['Omset Tunai', fmt(Number(data.omset_tunai) || 0)],
      ['Omset Transfer', fmt(Number(data.omset_transfer) || 0)],
      ['Total Omset Event', fmt(Number(data.omset_nominal) || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // Inventory Comparison
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text('Perbandingan Inventory', 14, y);
  y += 6;
  const invBefore = data.inventory_before_items || [];
  const invAfter = data.inventory_after_items || [];
  const invRows = invBefore.map((item: any, i: number) => {
    const afterItem = invAfter[i] || {};
    const selisih = (afterItem.jumlah ?? item.jumlah) - item.jumlah;
    return [
      item.nama || '-',
      item.jumlah?.toString() || '0',
      (afterItem.jumlah ?? item.jumlah)?.toString() || '0',
      selisih.toString(),
      selisih === 0 ? 'Sesuai' : 'Kurang',
    ];
  });
  if (invRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Barang', 'Before', 'After', 'Selisih', 'Status']],
      body: invRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Financial Summary
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text('Rekap Keuangan', 14, y);
  y += 6;
  const omset = Number(data.omset_nominal) || (Number(data.omset_tunai) || 0) + (Number(data.omset_transfer) || 0);
  const pengeluaran = (Number(data.transportasi_pergi_nominal) || 0) + (Number(data.transportasi_pulang_nominal) || 0) + (Number(data.kuota_nominal) || 0);
  autoTable(doc, {
    startY: y,
    head: [['Keterangan', 'Jumlah']],
    body: [
      ['Total Omset', fmt(omset)],
      ['Total Pengeluaran', fmt(pengeluaran)],
      ['Nett', fmt(omset - pengeluaran)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14 },
  });

  if (loadedPhotos.length) addPhotoPages(doc, loadedPhotos);

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`FotoSnaps Report — Page ${i}/${totalPages}`, 14, doc.internal.pageSize.getHeight() - 10);
    doc.text(new Date().toLocaleString('id-ID'), pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  if (download) doc.save(`FotoSnaps_${eventId}_${eventName.replace(/\s+/g, '_')}.pdf`);
  return doc;
}

// ---------- Dual Action Buttons ----------
function StepActions({ onSave, onNext, saveLabel, nextLabel }: {
  onSave: () => void;
  onNext: () => void;
  saveLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onSave}
        className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        {saveLabel || 'Simpan'}
      </button>
      <button
        onClick={onNext}
        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
      >
        {nextLabel || 'Simpan & Lanjut'}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

function PhotoPicker({ value, onChange, label = 'Ambil foto bukti', fieldLabel = 'Foto Bukti' }: { value?: string; onChange: (key: string) => void; label?: string; fieldLabel?: string }) {
  const eventId = useContext(WorkflowEventContext);
  return <CameraPhotoUpload eventId={eventId} value={value} onChange={onChange} fieldLabel={fieldLabel} buttonLabel={label}/>;
}

// ---------- Progress Bar (clickable) ----------
function ProgressBar({ current, maxReached, onGoToStep, eventName }: {
  current: number;
  maxReached: number;
  onGoToStep: (step: number) => void;
  eventName: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Progress Workflow</h3>
          <p className="text-xs text-slate-400 mt-0.5">{eventName}</p>
        </div>
        <span className="text-2xl font-bold text-blue-600">{current}<span className="text-slate-400 text-base font-medium">/{TOTAL_STEPS}</span></span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(Math.max(current, maxReached) / TOTAL_STEPS) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>
      <label className="block sm:hidden text-sm text-slate-600">Langkah kerja<select aria-label="Pilih langkah workflow" className="mt-2 w-full rounded-xl border border-slate-200 p-3 bg-white" value={current} onChange={event=>onGoToStep(Number(event.target.value))}>{steps.map(step=><option key={step.id} value={step.id} disabled={step.id>Math.max(current,maxReached)}>{step.id}. {step.label}</option>)}</select></label>
      <div className="hidden sm:flex gap-1 overflow-x-auto pb-1">
        {steps.map(s => {
          const canClick = s.id <= maxReached || s.id <= current;
          return (
            <button
              key={s.id}
              title={s.label}
              onClick={() => canClick && onGoToStep(s.id)}
              disabled={!canClick}
              className={`flex-shrink-0 w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold transition-all ${
                s.id < current ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' :
                s.id === current ? 'bg-amber-500 text-white ring-2 ring-amber-200' :
                canClick ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer' :
                'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {s.id < current ? <CheckIcon/> : s.id}
            </button>
          );
        })}
      </div>
      <p className="hidden sm:block text-xs text-slate-500 mt-2">Pilih nomor langkah untuk navigasi</p>
    </div>
  );
}

// ---------- Step Components ----------

function StepInventoryBefore({ onSave, onNext, data, onDataChange }: {
  onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void;
}) {
  const items = data.inventory_before_items || [
    { nama: '', jumlah: 1, kategori: 'Electronic', kondisi: 'Baik' },
  ];

  const setItems = (newItems: any[]) => onDataChange({ ...data, inventory_before_items: newItems });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">Inventory Before</h3>
          <p className="text-xs text-slate-400">Input semua barang yang dibawa ke event</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item: any, i: number) => (
          <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama Barang</label>
                <input type="text" value={item.nama} onChange={e => { const n = [...items]; n[i] = { ...n[i], nama: e.target.value }; setItems(n); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Jumlah</label>
                <input type="number" min={0} value={item.jumlah ?? ''} onChange={e => { const n = [...items]; n[i] = { ...n[i], jumlah: draftNumber(e.target.value) }; setItems(n); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Kategori</label>
                <select value={item.kategori} onChange={e => { const n = [...items]; n[i] = { ...n[i], kategori: e.target.value }; setItems(n); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Electronic</option>
                  <option>Non Electronic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Kondisi</label>
                <select value={item.kondisi} onChange={e => { const n = [...items]; n[i] = { ...n[i], kondisi: e.target.value }; setItems(n); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Baik</option>
                  <option>Rusak Ringan</option>
                  <option>Rusak Berat</option>
                </select>
              </div>
            </div>
            <PhotoPicker fieldLabel="Foto Barang" label="Buka kamera" value={item.foto} onChange={key=>{const n=[...items];n[i]={...n[i],foto:key};setItems(n);}}/>
            {items.length > 1 && (
              <button onClick={() => { const n = items.filter((_: any, idx: number) => idx !== i); setItems(n); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Hapus barang ini</button>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => setItems([...items, { nama: '', jumlah: 1, kategori: 'Electronic', kondisi: 'Baik' }])} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 font-medium">
        + Tambah Barang
      </button>

      <StepActions onSave={onSave} onNext={onNext} />
    </div>
  );
}

function StepTransportasi({ type, onSave, onNext, data, onDataChange, defaultDate }: {
  type: 'pergi' | 'pulang'; onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void; defaultDate: string;
}) {
  const key = type === 'pergi' ? 'transportasi_pergi_nominal' : 'transportasi_pulang_nominal';
  const timeKey = type === 'pergi' ? 'transportasi_pergi_jam' : 'transportasi_pulang_jam';
  const dateKey = type === 'pergi' ? 'transportasi_pergi_tanggal' : 'transportasi_pulang_tanggal';
  const serviceKey = type === 'pergi' ? 'transportasi_pergi_layanan' : 'transportasi_pulang_layanan';
  const vehicleKey = type === 'pergi' ? 'transportasi_pergi_kendaraan' : 'transportasi_pulang_kendaraan';
  const nominal = data[key] ?? '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">Transportasi {type === 'pergi' ? 'Pergi' : 'Pulang'}</h3>
          <p className="text-xs text-slate-400">Catat perjalanan, kendaraan, waktu, dan biaya</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">Tanggal<input type="date" value={data[dateKey] || defaultDate} onChange={e=>onDataChange({...data,[dateKey]:e.target.value})} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></label>
          <label className="block text-sm font-medium text-slate-700">Jam {type === 'pergi' ? 'Keberangkatan' : 'Kepulangan'}<input type="time" value={data[timeKey] || ''} onChange={e => onDataChange({ ...data, [timeKey]: e.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
          <label className="block text-sm font-medium text-slate-700">Layanan<select value={data[serviceKey] || 'Lalamove'} onChange={e=>onDataChange({...data,[serviceKey]:e.target.value})} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option>Lalamove</option><option>Transportasi Online</option><option>Kendaraan Pribadi</option><option>Sewa</option><option>Lainnya</option></select></label>
          <label className="block text-sm font-medium text-slate-700">Kendaraan<select value={data[vehicleKey] || ''} onChange={e=>onDataChange({...data,[vehicleKey]:e.target.value})} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"><option value="">Pilih kendaraan</option><option>Motor</option><option>Mobil</option><option>Van atau Pickup</option><option>Truk</option><option>Lainnya</option></select></label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nominal Biaya</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">Rp</span>
            <input type="number" min={0} value={nominal} onChange={e => onDataChange({ ...data, [key]: draftNumber(e.target.value) })} placeholder="0" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <PhotoPicker fieldLabel="Foto Bukti Pembayaran" label="Buka kamera" value={data[`transportasi_${type}_photo`]} onChange={photo=>onDataChange({...data,[`transportasi_${type}_photo`]:photo})}/>
      </div>

      <StepActions onSave={onSave} onNext={onNext} />
    </div>
  );
}

function StepCheckpoint({ type, onSave, onNext, data, onDataChange, locationName }: {
  type: 'SETUP_READY' | 'EVENT_FINISHED';
  onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void; locationName: string;
}) {
  const eventId = useContext(WorkflowEventContext);
  const { getPosition } = useGeolocation();
  const assignmentId = useContext(WorkflowAssignmentContext);
  const isSetup = type === 'SETUP_READY';
  const photoKey = isSetup ? `setup_ready_photo_${assignmentId}` : `event_finished_photo_${assignmentId}`;
  const timeKey = isSetup ? `setup_ready_at_${assignmentId}` : `event_finished_at_${assignmentId}`;
  const latitudeKey = isSetup ? `setup_ready_latitude_${assignmentId}` : `event_finished_latitude_${assignmentId}`;
  const longitudeKey = isSetup ? `setup_ready_longitude_${assignmentId}` : `event_finished_longitude_${assignmentId}`;

  const upload = useCallback(async (photo: Blob) => {
    const position = await getPosition();
    const form = new FormData();
    form.append('photo', photo, `${type.toLowerCase()}.jpg`);
    form.append('latitude', String(position.latitude));
    form.append('longitude', String(position.longitude));
    return api.postForm<{key:string;url:string;capturedAt:string;latitude:number;longitude:number}>(`/crew-event/events/${eventId}/checkpoints/${type}`, form);
  }, [eventId, getPosition, type]);

  return <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isSetup ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><WorkflowIcon/></div>
      <div><h3 className="font-semibold text-slate-900">{isSetup ? 'Setup Ready' : 'Event Selesai'}</h3><p className="text-xs text-slate-500">{isSetup ? 'Ambil foto setelah tiba dan seluruh setup siap digunakan.' : 'Ambil foto kondisi lokasi setelah kegiatan berakhir.'}</p></div>
    </div>
    <CameraPhotoUpload
      eventId={eventId}
      value={data[photoKey]}
      fieldLabel={isSetup ? 'Foto Setup Ready' : 'Foto Event Selesai'}
      buttonLabel={isSetup ? 'Buka kamera dan foto setup' : 'Buka kamera dan foto kondisi akhir'}
      locationName={locationName}
      upload={upload}
      onChange={key=>onDataChange({...data,[photoKey]:key})}
      onUploaded={result=>onDataChange({...data,[photoKey]:result.key,[timeKey]:result.capturedAt,[latitudeKey]:result.latitude,[longitudeKey]:result.longitude})}
    />
    {data[timeKey] ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Tercatat pada {new Date(data[timeKey]).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p> : null}
    <StepActions onSave={onSave} onNext={onNext}/>
  </div>;
}

function StepTesPrint({ phase, onSave, onNext, data, onDataChange }: {
  phase: 'before' | 'after';
  onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void;
}) {
  const isBefore = phase === 'before';
  const key = isBefore ? 'tes_print_before_photo' : 'tes_print_after_photo';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">Cek Print {isBefore ? 'Sebelum' : 'Sesudah'} Event</h3>
          <p className="text-xs text-slate-400">Ambil foto langsung dari kamera. Jumlah kertas tidak digunakan.</p>
        </div>
      </div>
      <PhotoPicker fieldLabel={`Foto Cek Print ${isBefore ? 'Sebelum' : 'Sesudah'} Event`} label="Buka kamera" value={data[key] || (isBefore ? data.tes_print_photo : '')} onChange={photo=>onDataChange({...data,[key]:photo})}/>
      <StepActions onSave={onSave} onNext={onNext} />
    </div>
  );
}

function StepOngoing({ onSave, onNext, data, assignment, completed }: {
  onSave: () => void; onNext: () => void;
  data: any; assignment: CrewEventAssignment; completed: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const schedules = [...(assignment.event_schedules || [])].sort((a, b) => a.schedule_date.localeCompare(b.schedule_date) || a.start_time.localeCompare(b.start_time));
  const firstSchedule = schedules[0];
  const lastSchedule = schedules[schedules.length - 1];
  const attendance = assignment.attendance.find(item => item.check_in && !item.check_out) || assignment.attendance.find(item => item.check_out) || assignment.attendance[0];
  const isCancelled = assignment.event.status === 'CANCELLED';
  const isFinished = Boolean(data[`event_finished_at_${assignment.id}`] || data.event_finished_at) || completed || assignment.status === 'ENDED' || Boolean(attendance?.check_out) || ['COMPLETED', 'CANCELLED'].includes(assignment.event.status);
  useEffect(() => {
    if (isFinished || !attendance?.check_in) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attendance?.check_in, isFinished]);
  const startedAt = attendance?.check_in ? new Date(attendance.check_in).getTime() : firstSchedule ? new Date(`${firstSchedule.schedule_date}T${firstSchedule.start_time}+07:00`).getTime() : NaN;
  const checkpointEnd = data[`event_finished_at_${assignment.id}`] || data.event_finished_at;
  const endedAt = checkpointEnd ? new Date(checkpointEnd).getTime() : attendance?.check_out ? new Date(attendance.check_out).getTime() : now;
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, endedAt - startedAt) : 0;
  const duration = [Math.floor(elapsed / 3600000), Math.floor((elapsed % 3600000) / 60000), Math.floor((elapsed % 60000) / 1000)].map(value => String(value).padStart(2, '0')).join(':');
  const heading = isCancelled ? 'Event Dibatalkan' : assignment.event.status==='COMPLETED' ? 'Event Selesai' : isFinished ? 'Tugas Anda Selesai' : assignment.event.status === 'SCHEDULED' ? 'Event Terjadwal' : 'Event Sedang Berlangsung';
  const period = firstSchedule && lastSchedule ? (firstSchedule.schedule_date === lastSchedule.schedule_date ? eventDateText(firstSchedule.schedule_date) : `${eventDateText(firstSchedule.schedule_date)} – ${eventDateText(lastSchedule.schedule_date)}`) : eventDateText(assignment.event.event_date);
  const location = assignment.event.event_locations?.[0]?.address || assignment.event.branch?.name || 'Lokasi belum diisi';
  return (
    <div className="space-y-5">
      <div className="text-center py-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-amber-700"><WorkflowIcon/></span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{heading}</h3>
        <p className="text-slate-500 text-sm">{isFinished ? 'Status diambil dari data event dan absensi terbaru.' : 'Fokus pada event. Clock Out saat event selesai.'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Tanggal', val: period },
          { label: 'Waktu', val: firstSchedule && lastSchedule ? `${timeText(firstSchedule.start_time)} – ${timeText(lastSchedule.end_time)}` : 'Jadwal belum diisi' },
          { label: 'Lokasi', val: location },
          { label: 'PIC', val: assignment.event.pic?.user?.full_name || 'PIC belum ditentukan' },
          { label: 'Tim', val: `${assignment.team.length} crew` },
          { label: 'Status', val: heading.replace('Event ', '') },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="font-semibold text-slate-900 mt-0.5">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <div className="text-3xl font-mono font-bold text-amber-800 mb-1">{duration}</div>
        <p className="text-xs text-amber-600">{attendance?.check_in ? (isFinished ? 'Durasi Event Tercatat' : 'Durasi Sejak Clock In') : 'Menunggu Clock In'}</p>
      </div>

      <StepActions onSave={onSave} onNext={onNext} saveLabel="Simpan Progress" nextLabel="Lanjutkan ke Foto Event Selesai" />
    </div>
  );
}

function StepKuotaOmset({ title, onSave, onNext, data, onDataChange }: {
  title: string; onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void;
}) {
  const isQuota = title === 'Kuota/Orbit';
  const key = isQuota ? 'kuota_nominal' : 'omset_nominal';
  const omsetTunai = Number(data.omset_tunai) || (!data.omset_transfer ? Number(data.omset_nominal) || 0 : 0);
  const omsetTransfer = Number(data.omset_transfer) || 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400">Input nominal {title.toLowerCase()}</p>
        </div>
      </div>
      {isQuota ? <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">Jumlah Kuota (GB)<input type="number" min={0} step="0.1" value={data.kuota_gb ?? ''} onChange={e=>onDataChange({...data,kuota_gb:draftNumber(e.target.value)})} placeholder="Contoh: 50" className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></label>
        <label className="block text-sm font-medium text-slate-700">Provider / Perangkat<input type="text" value={data.kuota_provider || ''} onChange={e=>onDataChange({...data,kuota_provider:e.target.value})} placeholder="Contoh: Orbit Telkomsel" className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></label>
        <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Biaya Kuota</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
          <input
            type="number"
            min={0}
            value={data[key] ?? ''}
            onChange={e => onDataChange({ ...data, [key]: draftNumber(e.target.value) })}
            placeholder="0"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        </div>
      </div> : <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Tunai</label><input type="number" min={0} value={omsetTunai || ''} onChange={e=>{const tunai=Number(e.target.value);onDataChange({...data,omset_tunai:tunai,omset_nominal:tunai+omsetTransfer})}} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Transfer</label><input type="number" min={0} value={omsetTransfer || ''} onChange={e=>{const transfer=Number(e.target.value);onDataChange({...data,omset_transfer:transfer,omset_nominal:omsetTunai+transfer})}} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Total omset: <strong>{fmt(omsetTunai + omsetTransfer)}</strong></p>
      </div>}
      <PhotoPicker value={data[`${key}_photo`]} onChange={photo=>onDataChange({...data,[`${key}_photo`]:photo})}/>
      <StepActions onSave={onSave} onNext={onNext} />
    </div>
  );
}

function StepInventoryAfter({ onSave, onNext, data, onDataChange }: {
  onSave: () => void; onNext: () => void;
  data: any; onDataChange: (d: any) => void;
}) {
  const beforeItems = data.inventory_before_items || [];
  const afterItems = data.inventory_after_items || beforeItems.map((item: any) => ({
    ...item,
    jumlah: item.jumlah,
    kondisi: 'Baik',
  }));

  const setAfterItems = (items: any[]) => onDataChange({ ...data, inventory_after_items: items });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">Inventory After</h3>
          <p className="text-xs text-slate-400">Input kondisi barang setelah event</p>
        </div>
      </div>
      <div className="space-y-3">
        {afterItems.map((item: any, i: number) => {
          const beforeItem = beforeItems[i] || { jumlah: 0 };
          return (
            <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 text-sm">{item.nama}</span>
                <span className="text-xs text-slate-400">Before: <span className="font-bold text-slate-700">{beforeItem.jumlah}</span></span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Jumlah After</label>
                  <input
                    type="number"
                    min={0}
                    value={item.jumlah ?? ''}
                    onChange={e => { const n = [...afterItems]; n[i] = { ...n[i], jumlah: draftNumber(e.target.value) }; setAfterItems(n); }}
                    className={`w-full px-3 py-2 rounded-xl border text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${item.jumlah < beforeItem.jumlah ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kondisi</label>
                  <select
                    value={item.kondisi || 'Baik'}
                    onChange={e => { const n = [...afterItems]; n[i] = { ...n[i], kondisi: e.target.value }; setAfterItems(n); }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Baik</option>
                    <option>Rusak Ringan</option>
                    <option>Rusak Berat</option>
                  </select>
                </div>
              </div>
              {item.jumlah < beforeItem.jumlah && (
                <div>
                  <label className="text-xs text-red-600 mb-1 block font-medium">Alasan Selisih (wajib) *</label>
                  <input
                    type="text"
                    placeholder="Jelaskan mengapa ada selisih..."
                    value={item.alasan || ''}
                    onChange={e => { const n = [...afterItems]; n[i] = { ...n[i], alasan: e.target.value }; setAfterItems(n); }}
                    className="w-full px-3 py-2 rounded-xl border border-red-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50"
                  />
                </div>
              )}
              <PhotoPicker fieldLabel="Foto Barang Setelah Event" label="Buka kamera" value={item.foto_after} onChange={photo=>{const n=[...afterItems];n[i]={...n[i],foto_after:photo};setAfterItems(n);}}/>
            </div>
          );
        })}
      </div>
      <StepActions onSave={onSave} onNext={onNext} />
    </div>
  );
}

function StepComparison({ onSave, onNext, data }: {
  onSave: () => void; onNext: () => void;
  data: any;
}) {
  const beforeItems = data.inventory_before_items || [];
  const afterItems = data.inventory_after_items || beforeItems.map((item: any) => ({
    ...item,
    jumlah: item.jumlah,
  }));

  const comparison = beforeItems.map((item: any, i: number) => ({
    nama: item.nama,
    before: item.jumlah,
    after: afterItems[i]?.jumlah ?? item.jumlah,
    alasan: afterItems[i]?.alasan || '',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><WorkflowIcon/></div>
        <div>
          <h3 className="font-semibold text-slate-900">Perbandingan Inventory</h3>
          <p className="text-xs text-slate-400">Before vs After — cek selisih barang</p>
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Barang', 'Before', 'After', 'Selisih', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {comparison.map((item: any, i: number) => {
              const selisih = item.after - item.before;
              return (
                <tr key={i} className={selisih < 0 ? 'bg-red-50/50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.nama}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.before}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.after}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold">
                    <span className={selisih < 0 ? 'text-red-600' : 'text-emerald-600'}>{selisih > 0 ? '+' : ''}{selisih}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${selisih === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {selisih === 0 ? 'Sesuai' : 'Kurang'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {comparison.some((c: any) => c.after < c.before) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">Ada selisih inventori!</p>
          {comparison.filter((c: any) => c.after < c.before).map((c: any, i: number) => (
            <p key={i} className="text-xs text-red-600">- {c.nama}: {c.alasan || 'Belum ada alasan'}</p>
          ))}
        </div>
      )}

      <StepActions onSave={onSave} onNext={onNext} saveLabel="Simpan" nextLabel="Lanjutkan ke Clock Out" />
    </div>
  );
}

function StepFinish({ onBack, onExportPDF, onEdit, data, exporting }: {
  onBack: () => void;
  onExportPDF: () => Promise<void>;
  onEdit: () => void;
  data: any;
  exporting: boolean;
}) {
  const omset = data.omset_nominal || 0;
  const pengeluaran = (data.transportasi_pergi_nominal || 0) + (data.transportasi_pulang_nominal || 0) + (data.kuota_nominal || 0);

  return (
    <div className="text-center py-8 space-y-5">
      <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Event Selesai!</h3>
        <p className="text-slate-500">Semua step workflow telah diselesaikan.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { label: 'Omset', val: fmt(omset), color: 'emerald' },
          { label: 'Pengeluaran', val: fmt(pengeluaran), color: 'red' },
          { label: 'Kuota', val: `${Number(data.kuota_gb) || 0} GB`, color: 'blue' },
          { label: 'Selisih', val: fmt(omset - pengeluaran), color: omset - pengeluaran >= 0 ? 'emerald' : 'red' },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`font-bold text-sm mt-0.5 ${s.color === 'emerald' ? 'text-emerald-700' : s.color === 'red' ? 'text-red-600' : s.color === 'blue' ? 'text-blue-700' : 'text-slate-800'}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <button onClick={onEdit} className="px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-semibold text-blue-700">Edit Data</button>
        <button disabled={exporting} onClick={onExportPDF} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          {exporting ? 'Menyiapkan PDF…' : 'Export PDF'}
        </button>
        <button onClick={onBack} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

interface EventWorkflowProps {
  onBack: () => void;
  assignment: CrewEventAssignment;
  initialStep?: number;
}

function stepValidationError(step: number, data: Record<string, any>, assignmentId: string) {
  const before = Array.isArray(data.inventory_before_items) ? data.inventory_before_items : [];
  const after = Array.isArray(data.inventory_after_items) ? data.inventory_after_items : [];
  if (step === 2 && (!before.length || before.some(item => !String(item.nama || '').trim() || !item.foto))) return 'Isi data dan ambil foto kamera untuk setiap barang sebelum event.';
  if (step === 3 && !data.transportasi_pergi_photo) return 'Ambil foto bukti transportasi pergi.';
  if (step === 4 && !data[`setup_ready_photo_${assignmentId}`]) return 'Ambil foto setup ready di lokasi event.';
  if (step === 5 && !(data.tes_print_before_photo || data.tes_print_photo)) return 'Ambil foto cek print sebelum event.';
  if (step === 7 && !data[`event_finished_photo_${assignmentId}`]) return 'Ambil foto kondisi saat event selesai.';
  if (step === 8 && !data.tes_print_after_photo) return 'Ambil foto cek print sesudah event.';
  if (step === 9 && (!Number(data.kuota_gb) || !data.kuota_nominal_photo)) return 'Isi jumlah kuota dan ambil foto bukti kuota.';
  if (step === 10 && !data.transportasi_pulang_photo) return 'Ambil foto bukti transportasi pulang.';
  if (step === 11 && !data.omset_nominal_photo) return 'Ambil foto bukti omset event.';
  if (step === 12 && (!after.length || after.some(item => !item.foto_after))) return 'Ambil foto kamera untuk setiap barang setelah event.';
  return '';
}

export default function EventWorkflow({ onBack, assignment, initialStep = 1 }: EventWorkflowProps) {
  const eventId = assignment.event.id;
  const eventCode = assignment.event.event_code;
  const eventName = assignment.event.event_name;
  const schedules = [...(assignment.event_schedules || [])].sort((a, b) => a.schedule_date.localeCompare(b.schedule_date) || a.start_time.localeCompare(b.start_time));
  const firstEventDate = schedules[0]?.schedule_date || assignment.event.event_date;
  const lastEventDate = schedules[schedules.length - 1]?.schedule_date || assignment.event.event_date;
  const eventLocationName = assignment.event.event_locations?.[0]?.address || assignment.event.branch?.name || 'Lokasi event';
  const [workflowData, setWorkflowData] = useState<Record<string, any>>(() => getWorkflowData(eventId));
  const [saveError, setSaveError] = useState('');
  const dirty=useRef(false);
  const [revision,setRevision] = useState<string|null>(assignment.workflow.updated_at || null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = workflowData._currentStep;
    return initialStep > 1 ? initialStep : (saved || 1);
  });
  const [maxReached, setMaxReached] = useState(() => {
    return workflowData._maxReached || currentStep;
  });

  useEffect(() => {
    let active = true;
    api.get<{ data?: Record<string, any>; current_step?: number; max_reached?: number; updated_at?:string }>(`/crew-event/events/${eventId}/workflow`)
      .then(remote => {
        if (!active || !remote?.data || Object.keys(remote.data).length === 0) return;
        setWorkflowData(remote.data);
        setRevision(remote.updated_at || null);
        const sharedStep = initialStep > 1 ? initialStep : remote.current_step || 1;
        const personalStep = !assignment.attendance.some(row => row.check_in) ? 1
          : !remote.data[`setup_ready_photo_${assignment.id}`] ? 4
          : !remote.data[`event_finished_photo_${assignment.id}`] ? 7
          : !assignment.attendance.some(row => row.check_out) ? 14 : 15;
        setCurrentStep(Math.min(sharedStep, personalStep));
        setMaxReached(remote.max_reached || remote.current_step || 1);
      })
      .catch(error => { if (active) setSaveError(error instanceof Error ? error.message : 'Workflow tidak dapat dimuat.'); });
    return () => { active = false; };
  }, [eventId, initialStep]);

  useEffect(()=>{
    const remote=assignment.workflow;
    if(!remote.updated_at||saving||(revision&&Date.parse(remote.updated_at)<=Date.parse(revision)))return;
    if(dirty.current){setSaveError('Data event diperbarui anggota lain. Input Anda tetap tersimpan di layar. Muat ulang sebelum menyimpan untuk menghindari konflik.');return;}
    setWorkflowData(remote.data);setRevision(remote.updated_at);setMaxReached(remote.max_reached);
  },[assignment.workflow.updated_at,saving,revision]);

  // Persist data on change
  useEffect(() => {
    saveWorkflowData(eventId, { ...workflowData, _currentStep: currentStep, _maxReached: maxReached });
  }, [workflowData, currentStep, maxReached, eventId]);

  const updateData = useCallback((newData: Record<string, any>) => {
    dirty.current=true;setWorkflowData(newData);
  }, []);

  const persistRemote = useCallback(async (data: Record<string, any>, step: number, reached: number) => {
    const saved = await api.put<{data:Record<string,any>;current_step:number;max_reached:number;updated_at:string}>(`/crew-event/events/${eventId}/workflow`, { data, expectedUpdatedAt:revision, currentStep: step, maxReached: reached });
    dirty.current=false;setRevision(saved.updated_at);return saved;
  }, [eventId,revision]);

  const next = useCallback(async () => {
    const validationError = stepValidationError(currentStep, workflowData, assignment.id);
    if (validationError) { setSaveError(validationError); return; }
    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS);
    const reached = Math.max(maxReached, nextStep);
    setSaving(true); setSaveError('');
    try {
      const saved = await persistRemote(workflowData, nextStep, reached);
      setWorkflowData(saved.data);
      setCurrentStep(nextStep); setMaxReached(reached);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Workflow gagal disimpan.');
    } finally { setSaving(false); }
  }, [currentStep, maxReached, persistRemote, workflowData]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS && step <= Math.max(maxReached, currentStep)) {
      setCurrentStep(step);
    }
  }, [maxReached, currentStep]);

  const handleSave = useCallback(async () => {
    // Save current data and go back to dashboard
    const payload = { ...workflowData, _currentStep: currentStep, _maxReached: maxReached };
    saveWorkflowData(eventId, payload);
    setSaving(true); setSaveError('');
    try { const saved=await persistRemote(payload, currentStep, maxReached); setWorkflowData(saved.data); onBack(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Workflow gagal disimpan.'); }
    finally { setSaving(false); }
  }, [eventId, workflowData, currentStep, maxReached, onBack, persistRemote]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true); setSaveError('');
    try { const latest = await api.get<{assignments:CrewEventAssignment[]}>('/crew-event/workspace'); const fresh = latest.assignments.find(row => row.event.id === eventId) || assignment; await exportEventPDF({ ...fresh, workflow: { ...assignment.workflow, current_step: currentStep, max_reached: maxReached } }, workflowData); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'PDF gagal dibuat.'); }
    finally { setExporting(false); }
  }, [assignment, currentStep, maxReached, workflowData]);

  const renderStep = () => {
    const props = { data: workflowData, onDataChange: updateData, onSave: handleSave, onNext: next };
    switch (currentStep) {
      case 1: return <AttendanceAction mode="IN" eventId={eventId} onContinue={next} />;
      case 2: return <StepInventoryBefore {...props} />;
      case 3: return <StepTransportasi type="pergi" defaultDate={firstEventDate} {...props} />;
      case 4: return <StepCheckpoint type="SETUP_READY" locationName={eventLocationName} {...props} />;
      case 5: return <StepTesPrint phase="before" {...props} />;
      case 6: return <StepOngoing {...props} assignment={assignment} completed={maxReached >= TOTAL_STEPS} />;
      case 7: return <StepCheckpoint type="EVENT_FINISHED" locationName={eventLocationName} {...props} />;
      case 8: return <StepTesPrint phase="after" {...props} />;
      case 9: return <StepKuotaOmset title="Kuota/Orbit" {...props} />;
      case 10: return <StepTransportasi type="pulang" defaultDate={lastEventDate} {...props} />;
      case 11: return <StepKuotaOmset title="Omset Event" {...props} />;
      case 12: return <StepInventoryAfter {...props} />;
      case 13: return <StepComparison {...props} />;
      case 14: return <AttendanceAction mode="OUT" eventId={eventId} onContinue={next} />;
      case 15: return <StepFinish onBack={onBack} onExportPDF={handleExportPDF} onEdit={()=>setCurrentStep(1)} data={workflowData} exporting={exporting} />;
      default: return null;
    }
  };

  return (
    <WorkflowEventContext.Provider value={eventId}><WorkflowAssignmentContext.Provider value={assignment.id}><div className="event-workflow p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-2xl mx-auto">
      {/* Back button */}
      <button onClick={handleSave} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Simpan & Kembali
      </button>

      {/* Progress */}
      <ProgressBar
          current={currentStep}
          maxReached={maxReached}
          onGoToStep={goToStep}
          eventName={`${eventCode} • ${eventName}`}
        />

      {/* Step info */}
      {currentStep < TOTAL_STEPS && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-100">
          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{currentStep}</span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-blue-900">Step {currentStep}: {steps[currentStep - 1].label}</span>
            <p className="text-xs text-blue-600">{steps[currentStep - 1].desc}</p>
          </div>
          <span className="text-xs font-mono text-blue-500">{currentStep}/{TOTAL_STEPS}</span>
        </div>
      )}

      {/* Step content */}
      {saveError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{saveError}</div>}
      {saving && <p className="text-xs text-blue-600" role="status">Menyimpan workflow ke server…</p>}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        {renderStep()}
      </div>
    </div></WorkflowAssignmentContext.Provider></WorkflowEventContext.Provider>
  );
}

export { exportEventPDF, getWorkflowData };

function WorkflowIcon(){return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5h6m-7 4h8m-8 4h5m-7 8h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>}
function CheckIcon(){return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7"/></svg>}
