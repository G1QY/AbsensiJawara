import { exportToExcel, exportToPDF, type ExportRow } from '../../utils/exportUtils';

interface ExportButtonsProps {
  filename: string;
  title: string;
  subtitle: string;
  headers: string[];
  rows: ExportRow[];
  className?: string;
}

export default function ExportButtons({ filename, title, subtitle, headers, rows, className = '' }: ExportButtonsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        onClick={() => exportToExcel(filename, headers, rows)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
        Export Excel
      </button>
      <button
        onClick={() => exportToPDF(title, subtitle, headers, rows)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shadow-sm whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        Export PDF
      </button>
    </div>
  );
}
