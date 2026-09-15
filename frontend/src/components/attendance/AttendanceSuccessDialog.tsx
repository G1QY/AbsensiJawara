import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../../lib/useModalHistory';
import './attendanceSuccess.css';

type Props = {
  open: boolean; name: string; clockType: string; location: string;
  timestamp: string; whatsappUrl: string; onClose: () => void;
};

export default function AttendanceSuccessDialog({ open, name, clockType, location, timestamp, whatsappUrl, onClose }: Props) {
  const titleId = useId(), descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  useModalHistory(open, onClose);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (root) root.inert = true;
    done.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = previousInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="attendance-success-overlay">
      <div ref={panel} className="attendance-success-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
          if (event.key !== 'Tab') return;
          const controls = panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
          if (!controls?.length) return;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <div className="attendance-success-icon" aria-hidden="true">
          <svg viewBox="0 0 52 52" fill="none"><circle cx="26" cy="26" r="23" /><path d="m15 26 7 7 15-15" /></svg>
        </div>
        <h2 id={titleId}>Absensi berhasil dikirim</h2>
        <p id={descriptionId}>Absensi <strong>{name}</strong> ({clockType}) telah diterima server dan menunggu tinjauan admin.</p>
        <div className="attendance-success-summary"><span>Lokasi penugasan</span><strong>{location || 'Tidak dipilih'}</strong><span>{timestamp}</span></div>
        <a className="attendance-success-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer">Kirim Bukti ke WhatsApp Admin</a>
        <button ref={done} type="button" className="attendance-success-close" onClick={onClose}>Tutup</button>
      </div>
    </div>, document.body
  );
}
