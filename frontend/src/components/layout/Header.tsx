import { ReactNode, useRef, useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClickOutside } from '../../hooks/useClickOutside';

interface HeaderProps {
  /** Tiêu đề trang hiển thị bên trái header */
  title: string;
  /** Các nút hoặc phần tử bổ sung hiển thị bên phải, trước avatar */
  children?: ReactNode;
}

/**
 * Header — Thanh tiêu đề trên cùng dùng chung cho các trang quản trị có Sidebar.
 *
 * Tích hợp sẵn Profile Dropdown với chức năng đăng xuất, hợp nhất logic
 * user menu đang bị copy-paste ở RegisterFace, EmployeeDirectory và ManagerDashboard.
 */
export function Header({ title, children }: HeaderProps) {
  const { username, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setShowUserMenu(false), []);
  useClickOutside(userMenuRef, closeMenu);

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3.5
                       flex items-center justify-between sticky top-0 z-30">
      <h1 className="text-xs font-black tracking-widest uppercase text-slate-500">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Slot cho các nút tùy chỉnh theo từng trang */}
        {children}

        {/* Profile dropdown */}
        <div className="relative" ref={userMenuRef}>
          <div
            onClick={() => setShowUserMenu(v => !v)}
            className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center
                       text-[10px] font-bold text-white cursor-pointer
                       hover:ring-2 hover:ring-blue-200 transition-all"
          >
            {username?.[0]?.toUpperCase() ?? 'A'}
          </div>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100
                            rounded-xl shadow-xl py-2 z-50
                            animate-in fade-in zoom-in duration-150">
              <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <p className="text-xs font-bold text-slate-900">{username || 'Admin'}</p>
                <p className="text-[10px] text-slate-400">Quản trị viên</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2
                           text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
