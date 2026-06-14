import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UserPlus, Users, ShieldCheck,
  Bell, LogOut, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, RefreshCw, MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getPendingEmployees, approveEmployee,
  getLocationConfig, setLocationConfig,
} from '../api/api';

/* ─── Types ─── */
interface PendingEmployee {
  user_id:          string;
  name:             string;
  department:       string;
  position:         string;
  biometric_status: string;
}

/* ─── Nav — consistent with other manager pages ─── */
const NAV = [
  { icon: LayoutDashboard, label: 'Tổng quan',           path: '/dashboard'  },
  { icon: UserPlus,        label: 'Đăng ký khuôn mặt',   path: '/register'   },
  { icon: Users,           label: 'Danh sách nhân viên',  path: '/employees'  },
  { icon: ShieldCheck,     label: 'Duyệt khuôn mặt',      path: '/approve', active: true },
];

/* ─── Avatar ─── */
const AV_COLORS = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-rose-600',
];
const avColor  = (id: string) => AV_COLORS[id.charCodeAt(id.length - 1) % AV_COLORS.length];
const initials = (name: string) =>
  name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();

/* ─── Sidebar ─── */
function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-slate-100
                      flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-sm font-black text-slate-950">FaceAttend</p>
        <p className="text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">
          Bảo mật sinh trắc học
        </p>
      </div>
      <nav className="flex-1 py-4">
        {NAV.map(({ icon: Icon, label, path, active }) => (
          <button key={label} onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
                              transition-all text-left
                    ${active
                      ? 'text-blue-700 bg-blue-50 font-semibold border-r-2 border-blue-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

/* ─── Confirm Modal ─── */
function ConfirmModal({ emp, action, onClose, onConfirm }: {
  emp:       PendingEmployee;
  action:    'approved' | 'rejected';
  onClose:   () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const isApprove = action === 'approved';

  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                    bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4
                        ${isApprove ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {isApprove
            ? <CheckCircle2 size={22} className="text-emerald-500" />
            : <XCircle      size={22} className="text-red-500" />}
        </div>
        <h3 className="text-lg font-black text-slate-950 mb-1">
          {isApprove ? 'Duyệt khuôn mặt' : 'Từ chối đăng ký'}
        </h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {isApprove
            ? <>Xác nhận duyệt khuôn mặt cho{' '}
                <span className="font-semibold text-slate-700">{emp.name}</span>?
                Nhân viên này sẽ có thể chấm công ngay.</>
            : <>Từ chối đăng ký của{' '}
                <span className="font-semibold text-slate-700">{emp.name}</span>?
                Nhân viên cần chụp lại ảnh.</>}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50
                             text-sm font-semibold text-slate-600 rounded-2xl transition-all">
            Hủy
          </button>
          <button onClick={handle} disabled={loading}
                  className={`flex-1 py-3 text-white text-sm font-bold rounded-2xl
                              transition-all flex items-center justify-center gap-2
                              ${isApprove
                                ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                                : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'}`}>
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
              : isApprove
                ? <><CheckCircle2 size={14} /> Duyệt</>
                : <><XCircle size={14} /> Từ chối</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Location Config Card ─── */
function LocationConfig() {
  const [loc,     setLoc]     = useState({ lat: '', lng: '', radius: '200' });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    getLocationConfig()
      .then(r => {
        if (r.data?.lat) {
          setLoc({
            lat:    String(r.data.lat),
            lng:    String(r.data.lng),
            radius: String(r.data.radius ?? 200),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const lat = parseFloat(loc.lat);
    const lng = parseFloat(loc.lng);
    const radius = parseFloat(loc.radius);
    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      setErr('Vui lòng nhập đúng định dạng số'); return;
    }
    setSaving(true); setErr('');
    try {
      await setLocationConfig(lat, lng, radius);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setErr('Lưu thất bại, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <MapPin size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-950">Cấu hình vị trí GPS</h3>
          <p className="text-xs text-slate-400">Nhân viên phải trong bán kính này mới chấm công được</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'lat',    label: 'Vĩ độ (Latitude)',    placeholder: '10.7769' },
              { key: 'lng',    label: 'Kinh độ (Longitude)', placeholder: '106.7009' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-[10px] font-bold text-slate-400
                                  tracking-widest uppercase mb-1.5">
                  {label}
                </label>
                <input type="text"
                       value={loc[key as keyof typeof loc]}
                       onChange={e => setLoc(l => ({ ...l, [key]: e.target.value }))}
                       placeholder={placeholder}
                       className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                                  text-sm text-slate-900 placeholder-slate-300 outline-none
                                  focus:border-blue-500 focus:ring-2 focus:ring-blue-50
                                  transition-all font-mono" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400
                              tracking-widest uppercase mb-1.5">
              Bán kính cho phép (mét)
            </label>
            <input type="number" min="50" max="5000"
                   value={loc.radius}
                   onChange={e => setLoc(l => ({ ...l, radius: e.target.value }))}
                   className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                              text-sm text-slate-900 outline-none
                              focus:border-blue-500 focus:ring-2 focus:ring-blue-50
                              transition-all" />
          </div>

          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100
                            rounded-xl px-3 py-2.5 text-xs text-red-600">
              <AlertCircle size={12} /> {err}
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
                  className={`w-full py-2.5 text-sm font-bold rounded-xl transition-all
                              flex items-center justify-center gap-2
                              ${saved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white'}`}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</>
             : saved  ? <><CheckCircle2 size={14} /> Đã lưu!</>
             :           'Lưu cấu hình'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function ApproveFaces() {
  const navigate                 = useNavigate();
  const { username, logout }     = useAuth();
  const [pending,   setPending]  = useState<PendingEmployee[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState('');
  const [confirm,   setConfirm]  = useState<{ emp: PendingEmployee; action: 'approved' | 'rejected' } | null>(null);
  const [doneIds,   setDoneIds]  = useState<Set<string>>(new Set());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchPending = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getPendingEmployees();
      setPending(res.data.employees ?? []);
    } catch {
      setError('Không thể tải danh sách chờ duyệt');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (emp: PendingEmployee, action: 'approved' | 'rejected') => {
    await approveEmployee(emp.user_id, action);
    setDoneIds(s => new Set([...s, emp.user_id]));
    setPending(prev => prev.filter(e => e.user_id !== emp.user_id));
  };

  const visiblePending = pending.filter(e => !doneIds.has(e.user_id));

  return (
    <div className="flex min-h-screen bg-slate-50 font-['DM_Sans']">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-3.5
                           flex items-center justify-between sticky top-0 z-30">
          <h1 className="text-xs font-black tracking-widest uppercase text-slate-500">
            Duyệt khuôn mặt
          </h1>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg
                               hover:bg-slate-100 text-slate-500 transition-colors relative">
              <Bell size={16} />
              {visiblePending.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </button>
            <div className="relative" ref={userMenuRef}>
              <div onClick={() => setShowUserMenu(!showUserMenu)}
                   className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center
                              text-[10px] font-bold text-white cursor-pointer
                              hover:ring-2 hover:ring-blue-200 transition-all">
                {username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100
                                rounded-xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-50 mb-1">
                    <p className="text-xs font-bold text-slate-900">{username || 'Admin'}</p>
                    <p className="text-[10px] text-slate-400">Quản trị viên</p>
                  </div>
                  <button onClick={logout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm
                                     text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={14} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">

          {/* Page heading */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Duyệt đăng ký khuôn mặt</h2>
              <p className="text-xs text-slate-400 mt-1">
                Xem xét và phê duyệt ảnh sinh trắc học của nhân viên.
              </p>
            </div>
            <button onClick={fetchPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border
                               border-slate-200 hover:bg-slate-50 text-xs font-semibold
                               text-slate-600 rounded-xl transition-all">
              <RefreshCw size={12} /> Tải lại
            </button>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-[1fr_320px] gap-6 items-start">

            {/* ── Pending list ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-orange-500" />
                  <h3 className="text-sm font-black text-slate-950">Chờ duyệt</h3>
                </div>
                {visiblePending.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-xs
                                   font-bold rounded-full">
                    {visiblePending.length}
                  </span>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mx-6 my-4 flex items-center gap-3 bg-red-50 border border-red-100
                                rounded-2xl px-5 py-4 text-sm text-red-600">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* Content */}
              {loading ? (
                <div className="flex flex-col items-center py-20 text-slate-300">
                  <Loader2 size={28} className="animate-spin text-blue-500 mb-3" />
                  <p className="text-sm text-slate-400">Đang tải danh sách...</p>
                </div>
              ) : visiblePending.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-slate-300">
                  <CheckCircle2 size={32} className="text-emerald-300 mb-3" />
                  <p className="text-sm text-slate-400 font-medium">Không có yêu cầu nào đang chờ</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Tất cả đăng ký đã được xử lý
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {visiblePending.map(emp => (
                    <div key={emp.user_id}
                         className="px-6 py-4 hover:bg-slate-50/60 transition-colors group">
                      <div className="flex items-center gap-4">

                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br
                                        ${avColor(emp.user_id)} flex items-center
                                        justify-center text-white text-xs font-bold
                                        flex-shrink-0 ring-2 ring-white shadow-sm`}>
                          {initials(emp.name)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {emp.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{emp.department}</span>
                            <span className="text-slate-200">·</span>
                            <span className="text-xs text-slate-400">{emp.position}</span>
                          </div>
                          <span className="text-[10px] font-mono text-blue-600 font-bold mt-0.5 block">
                            {emp.user_id}
                          </span>
                        </div>

                        {/* Status badge */}
                        <span className="px-3 py-1 bg-orange-50 text-orange-700 border
                                         border-orange-200 text-xs font-semibold rounded-full
                                         flex items-center gap-1.5 flex-shrink-0">
                          <Clock size={10} /> Chờ duyệt
                        </span>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0
                                        opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setConfirm({ emp, action: 'rejected' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 border
                                       border-red-200 bg-red-50 hover:bg-red-100 text-red-600
                                       text-xs font-semibold rounded-lg transition-all
                                       active:scale-95">
                            <XCircle size={12} /> Từ chối
                          </button>
                          <button
                            onClick={() => setConfirm({ emp, action: 'approved' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600
                                       hover:bg-emerald-700 text-white text-xs font-semibold
                                       rounded-lg transition-all active:scale-95">
                            <CheckCircle2 size={12} /> Duyệt
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer count */}
              {!loading && (
                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">
                    <span className="text-slate-700 font-bold">{visiblePending.length}</span>
                    {' '}yêu cầu đang chờ duyệt
                  </p>
                </div>
              )}
            </div>

            {/* ── Right: GPS config ── */}
            <LocationConfig />
          </div>
        </main>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal emp={confirm.emp} action={confirm.action}
                      onClose={() => setConfirm(null)}
                      onConfirm={() => handleApprove(confirm.emp, confirm.action)} />
      )}
    </div>
  );
}