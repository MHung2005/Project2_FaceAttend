import { ElementType } from 'react';
import { useNavigate } from 'react-router-dom';

export interface NavItem {
  icon:    ElementType;
  label:   string;
  path:    string;
  active?: boolean;
}

interface SidebarProps {
  items: NavItem[];
}

/**
 * Sidebar — Thanh điều hướng bên trái dùng chung cho các trang quản trị.
 *
 * Trích xuất từ:
 *   - Component Sidebar nội tuyến trong EmployeeDirectory.tsx (602 dòng)
 *   - Khối <aside> nội tuyến trong RegisterFace.tsx
 *
 * Nhận `items: NavItem[]` làm prop để linh hoạt cho từng trang.
 */
export function Sidebar({ items }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-slate-100
                      flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-sm font-black text-slate-950">FaceAttend</p>
        <p className="text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">
          Bảo mật sinh trắc học
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4">
        {items.map(({ icon: Icon, label, path, active }) => (
          <button
            key={label}
            onClick={() => path !== '#' && navigate(path)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
              transition-all text-left
              ${active
                ? 'text-blue-700 bg-blue-50 font-semibold border-r-2 border-blue-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
