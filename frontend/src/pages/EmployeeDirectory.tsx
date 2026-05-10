import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, UserPlus, FileText, BarChart2, Shield,
  Search, ChevronDown, Bell, Plus, LogOut,
  Pencil, Trash2, CheckCircle2, Clock,
  X, Save, Loader2, AlertCircle, Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getEmployees, deleteEmployee, updateEmployee
} from "../api/api";

/* ── Types ── */
interface Employee {
  user_id:          string;
  name:             string;
  department:       string;
  position:         string;
  biometric_status: string;
  last_attendance:  string;
}

/* ── Constants ── */
const DEPARTMENTS     = ["All Departments", "Kỹ thuật","Kinh doanh","Nhân sự"];
const BIOMETRIC_STATS = ["All Status", "Registered", "Unregistered"];

const AV_COLORS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-violet-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-rose-600",
];
const avColor = (id: string) =>
  AV_COLORS[id.charCodeAt(id.length - 1) % AV_COLORS.length];

const initials = (name: string) =>
  name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();

/* ── NAV — đồng nhất với RegisterFace ── */
const NAV = [
  { icon: LayoutDashboard, label: "Tổng quan",           path: "/dashboard"  },
  { icon: UserPlus,        label: "Đăng ký khuôn mặt",   path: "/register"   },
  { icon: Users,           label: "Danh sách nhân viên",  path: "/employees", active: true }
];

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

/** Sidebar — đồng nhất với RegisterFace */
function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-slate-100
                      flex flex-col h-screen sticky top-0">
      {/* Logo — giống RegisterFace */}
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-sm font-black text-slate-950">FaceAttend</p>
        <p className="text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">
          Bảo mật sinh trắc học
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV.map(({ icon: Icon, label, path, active }) => (
          <button key={label}
                  onClick={() => path !== "#" && navigate(path)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
                              transition-all text-left
                    ${active
                      ? "text-blue-700 bg-blue-50 font-semibold border-r-2 border-blue-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Icon size={16} className={active ? "text-blue-600" : "text-slate-400"} />
            {label}
          </button>
        ))}
      </nav>

      {/* Manual Scan → /register */}
      {/* <div className="p-4 border-t border-slate-100">
        <button onClick={() => navigate("/register")}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                           bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white
                           text-xs font-bold rounded-2xl shadow-lg shadow-blue-200
                           transition-all">
          <Plus size={14} /> Đăng ký mới
        </button>
      </div> */}
    </aside>
  );
}

/** Status Badge */
function StatusBadge({ status }: { status: string }) {
  const ok = status === "registered";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
      ${ok
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
      {ok ? <CheckCircle2 size={11} className="text-emerald-600" />
           : <Clock size={11} className="text-slate-400" />}
      {ok ? "Registered" : "Unregistered"}
    </span>
  );
}

/** Avatar */
function Avatar({ name, userId }: { name: string; userId: string }) {
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avColor(userId)}
                    flex items-center justify-center text-white text-xs font-bold
                    flex-shrink-0 ring-2 ring-white shadow-sm`}>
      {initials(name)}
    </div>
  );
}

/** Dropdown */
function Dropdown({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2.5 bg-white border border-slate-200
                         rounded-xl text-sm text-slate-700 font-medium outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-50
                         cursor-pointer transition-all hover:border-slate-300
                         shadow-sm min-w-[160px]">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={13}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

/** Edit Modal */
function EditModal({ employee, onClose, onSave }: {
  employee: Employee;
  onClose: () => void;
  onSave: (data: { name: string; department: string; position: string }) => Promise<void>;
}) {
  const [form, setForm]   = useState({
    name:       employee.name,
    department: employee.department,
    position:   employee.position,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSave = async () => {
    if (!form.name || !form.department || !form.position) {
      setError("Vui lòng điền đầy đủ thông tin"); return;
    }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch { setError("Cập nhật thất bại, vui lòng thử lại"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                    bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-950">Chỉnh sửa nhân viên</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{employee.user_id}</p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center
                             justify-center text-slate-400 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {[
            { key: "name",       label: "Họ và tên",  placeholder: "Nguyễn Văn A" },
            { key: "department", label: "Phòng ban",   placeholder: "Kỹ thuật" },
            { key: "position",   label: "Chức vụ",     placeholder: "Kỹ sư" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-slate-400
                                tracking-widest uppercase mb-1.5">
                {label}
              </label>
              <input type="text"
                     value={form[key as keyof typeof form]}
                     onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                     placeholder={placeholder}
                     className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                                text-sm text-slate-900 placeholder-slate-300 outline-none
                                focus:border-blue-500 focus:ring-2 focus:ring-blue-50
                                transition-all" />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100
                            rounded-xl px-4 py-3 text-xs text-red-600">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50
                             text-sm font-semibold text-slate-600 rounded-2xl transition-all">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                             text-white text-sm font-bold rounded-2xl transition-all
                             flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Đang lưu...</>
              : <><Save size={14} /> Lưu thay đổi</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Delete Confirm Modal */
function DeleteModal({ employee, onClose, onConfirm }: {
  employee: Employee;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                    bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-lg font-black text-slate-950 mb-1">Xóa nhân viên</h3>
        <p className="text-sm text-slate-400 mb-6">
          Bạn có chắc muốn xóa <span className="font-semibold text-slate-700">{employee.name}</span>?
          Hành động này không thể hoàn tác.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50
                             text-sm font-semibold text-slate-600 rounded-2xl transition-all">
            Hủy
          </button>
          <button onClick={handleConfirm} disabled={loading}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300
                             text-white text-sm font-bold rounded-2xl transition-all
                             flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Đang xóa...</>
              : <><Trash2 size={14} /> Xác nhận xóa</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
const PAGE_SIZE = 10;

export default function EmployeeDirectory() {
  const navigate               = useNavigate();
  const { username, logout }   = useAuth();
  const [employees, setEmps]   = useState<Employee[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState("");
  const [search, setSearch]    = useState("");
  const [dept, setDept]        = useState("All Departments");
  const [bio, setBio]          = useState("All Status");
  const [page, setPage]        = useState(1);
  const [editEmp, setEditEmp]  = useState<Employee | null>(null);
  const [delEmp, setDelEmp]    = useState<Employee | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* Fetch employees */
  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getEmployees();
      setEmps(res.data.employees ?? []);
    } catch {
      setError("Không thể tải danh sách nhân viên");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  /* Filter + paginate */
  const filtered = useMemo(() => {
    return employees.filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.user_id.toLowerCase().includes(q);
      const matchDept   = dept === "All Departments" || e.department === dept;
      const matchBio    = bio === "All Status"
        || (bio === "Registered"   && e.biometric_status === "registered")
        || (bio === "Unregistered" && e.biometric_status !== "registered");
      return matchSearch && matchDept && matchBio;
    });
  }, [employees, search, dept, bio]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* Handlers */
  const handleSaveEdit = async (data: { name: string; department: string; position: string }) => {
    if (!editEmp) return;
    await updateEmployee(editEmp.user_id, data);
    setEmps(prev => prev.map(e =>
      e.user_id === editEmp.user_id ? { ...e, ...data } : e
    ));
  };

  const handleDelete = async () => {
    if (!delEmp) return;
    await deleteEmployee(delEmp.user_id);
    setEmps(prev => prev.filter(e => e.user_id !== delEmp.user_id));
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-['DM_Sans']">

      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar — đồng nhất với RegisterFace */}
        <header className="bg-white border-b border-slate-100 px-6 py-3.5
                           flex items-center justify-between sticky top-0 z-30">
          <h1 className="text-xs font-black tracking-widest uppercase text-slate-500">
            Danh sách nhân viên
          </h1>
          <div className="flex items-center gap-3">
            {/* <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input placeholder="Tìm kiếm..."
                     className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl
                                text-xs text-slate-700 placeholder-slate-300 outline-none
                                focus:border-blue-400 transition-all w-48" />
            </div> */}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg
                               hover:bg-slate-100 text-slate-500 transition-colors relative">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
            </button>
              <div className="relative" ref={userMenuRef}>
                <div
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center
                             text-[10px] font-bold text-white cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all"
                >
                  {username?.[0]?.toUpperCase() ?? "A"}
                </div>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-150">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-xs font-bold text-slate-900">{username || "Admin"}</p>
                      <p className="text-[10px] text-slate-400">Quản trị viên</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">

          {/* Page heading */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Quản lý nhân viên
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Xem, chỉnh sửa hoặc xóa hồ sơ sinh trắc học của nhân viên.
              </p>
            </div>
            <button onClick={() => navigate("/register")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600
                               hover:bg-blue-700 active:scale-[0.97] text-white font-bold
                               text-xs rounded-xl shadow-sm shadow-blue-200 transition-all">
              <UserPlus size={14} /> Đăng ký nhân viên mới
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-100
                            rounded-2xl px-5 py-4 text-sm text-red-600">
              <AlertCircle size={16} /> {error}
              <button onClick={fetchEmployees}
                      className="ml-auto text-red-500 font-semibold hover:underline text-xs">
                Thử lại
              </button>
            </div>
          )}

          {/* Main card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

            {/* Filters */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input type="text" value={search}
                       onChange={e => { setSearch(e.target.value); setPage(1); }}
                       placeholder="Tìm theo tên, mã NV..."
                       className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200
                                  rounded-xl text-sm text-slate-800 placeholder-slate-300
                                  outline-none focus:border-blue-400 focus:ring-2
                                  focus:ring-blue-50 transition-all" />
              </div>
              <Dropdown value={dept}    onChange={v => { setDept(v);    setPage(1); }} options={DEPARTMENTS} />
              <Dropdown value={bio}     onChange={v => { setBio(v);     setPage(1); }} options={BIOMETRIC_STATS} />
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                <Loader2 size={28} className="animate-spin mb-3 text-blue-500" />
                <p className="text-sm text-slate-400">Đang tải danh sách nhân viên...</p>
              </div>
            ) : paged.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-slate-300">
                <Users size={32} className="mb-3 opacity-40" />
                <p className="text-sm text-slate-400 font-medium">Không tìm thấy nhân viên nào</p>
                <p className="text-xs text-slate-300 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      {["Nhân viên","Mã NV","Phòng ban","Trạng thái","Điểm danh cuối",""].map((h, i) => (
                        <th key={h}
                            className={`px-6 py-3 text-[10px] font-semibold text-slate-400
                                        tracking-widest uppercase
                                        ${i === 5 ? "text-right" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((emp, i) => (
                      <tr key={emp.user_id}
                          className={`border-t border-slate-50 hover:bg-blue-50/40
                                      transition-colors group
                                      ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                        {/* Employee */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={emp.name} userId={emp.user_id} />
                            <span className="font-semibold text-slate-900">{emp.name}</span>
                          </div>
                        </td>
                        {/* ID */}
                        <td className="px-6 py-4">
                          <span className="text-xs text-blue-700 tracking-wider font-bold font-mono">
                            {emp.user_id}
                          </span>
                        </td>
                        {/* Dept */}
                        <td className="px-6 py-4">
                          <span className="text-slate-500">{emp.department}</span>
                        </td>
                        {/* Status */}
                        <td className="px-6 py-4">
                          <StatusBadge status={emp.biometric_status} />
                        </td>
                        {/* Last attendance */}
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-400 font-mono tabular-nums">
                            {emp.last_attendance || "—"}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 justify-end
                                          opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditEmp(emp)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg
                                               text-slate-400 hover:text-blue-600 hover:bg-blue-50
                                               transition-all active:scale-90" title="Chỉnh sửa">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDelEmp(emp)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg
                                               text-slate-400 hover:text-red-600 hover:bg-red-50
                                               transition-all active:scale-90" title="Xóa">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer pagination */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center
                            justify-between bg-slate-50/50">
              <p className="text-xs text-slate-400 font-medium">
                Hiển thị{" "}
                <span className="text-slate-700 font-bold">{filtered.length}</span>{" "}
                /{" "}
                <span className="text-slate-700 font-bold">{employees.length}</span>{" "}
                nhân viên
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg
                                   text-xs font-semibold text-slate-600 hover:bg-slate-50
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   active:scale-95 transition-all shadow-sm">
                  Trước
                </button>
                <span className="text-xs text-slate-400 px-2">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg
                                   text-xs font-semibold text-slate-600 hover:bg-slate-50
                                   disabled:opacity-40 disabled:cursor-not-allowed
                                   active:scale-95 transition-all shadow-sm">
                  Tiếp
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {editEmp && (
        <EditModal employee={editEmp}
                   onClose={() => setEditEmp(null)}
                   onSave={handleSaveEdit} />
      )}
      {delEmp && (
        <DeleteModal employee={delEmp}
                     onClose={() => setDelEmp(null)}
                     onConfirm={handleDelete} />
      )}
    </div>
  );
}