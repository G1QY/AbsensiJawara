import { t } from "../../lib/i18n";

export default function LocationPolicyNotice({ mode }: { mode?: "ASSIGNED" | "ANYWHERE" }) {
  return <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
    {t(mode === "ANYWHERE"
      ? "Absensi semua lokasi aktif. Anda dapat clock in dan clock out dari mana saja sesuai jadwal. Titik GPS dan foto tetap dicatat untuk ditinjau admin."
      : "Absensi mengikuti radius lokasi penugasan. Aktifkan GPS dan izinkan akses kamera saat clock in dan clock out.")}
  </p>;
}
