import { rupiah, useCrewEventWorkspace } from './crewEventWorkspace';
export default function CrewEventPayroll() {
 const {data,loading,error}=useCrewEventWorkspace();
 if(loading)return <div className="p-6" role="status">Memuat payroll…</div>;
 if(error)return <div className="p-6" role="alert">{error}</div>;
 return <div className="p-4 sm:p-6 space-y-4"><section className="rounded-2xl bg-blue-600 p-5 text-white"><h1 className="text-2xl font-bold">Payroll Crew Event</h1><p>{data?.crew.user?.full_name}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Gaji pokok terdaftar</p><strong className="block text-3xl mt-2">{rupiah(Number(data?.crew.base_salary)||0)}</strong><p className="mt-4 text-sm text-slate-600">Perhitungan dan jumlah pembayaran ditentukan secara manual oleh tim finance. Gaji pokok di atas bukan jumlah pembayaran akhir.</p></section></div>;
}
