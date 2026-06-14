import { CheckCircle2, Clock } from 'lucide-react';

interface BadgeProps {
  /** Trạng thái sinh trắc học của nhân viên */
  status: string;
}

/**
 * Badge — Hiển thị trạng thái đăng ký sinh trắc học.
 * Trích xuất từ component StatusBadge nội tuyến trong EmployeeDirectory.tsx.
 */
export function Badge({ status }: BadgeProps) {
  const ok = status === 'registered';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
        ${ok
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
    >
      {ok
        ? <CheckCircle2 size={11} className="text-emerald-600" />
        : <Clock size={11} className="text-slate-400" />}
      {ok ? 'Registered' : 'Unregistered'}
    </span>
  );
}
