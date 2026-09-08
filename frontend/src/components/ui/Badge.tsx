type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  primary: 'bg-blue-600 text-white',
};

export default function Badge({ variant, children, size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClass} ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    'Tepat Waktu': 'success',
    'Telat': 'danger',
    'Belum Clock In': 'neutral',
    'Lembur': 'warning',
    'Selesai': 'success',
    'Aktif': 'success',
    'Non-Aktif': 'neutral',
    'Ongoing': 'info',
    'Completed': 'success',
    'Scheduled': 'primary',
    'Draft': 'neutral',
    'Sesuai': 'success',
    'Kurang': 'danger',
    'Lebih': 'warning',
    'Menunggu Review': 'warning',
    'Disetujui': 'success',
    'Ditolak': 'danger',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}
