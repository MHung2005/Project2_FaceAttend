import { ReactNode } from 'react';

interface StatCardProps {
  icon:      ReactNode;
  label:     string;
  value:     string;
  sub:       string;
  subColor:  string;
  iconColor: string;
  iconBg:    string;
}

/**
 * StatCard — Thẻ hiển thị số liệu thống kê.
 * Trích xuất từ mảng STAT_CARDS nội tuyến trong ManagerDashboard.tsx.
 */
export function StatCard({ icon, label, value, sub, subColor, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
          {icon}
        </div>
        <span className={`text-[10px] font-bold ${subColor}`}>{sub}</span>
      </div>
      <p className="text-[10px] text-slate-400 tracking-widest uppercase mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
