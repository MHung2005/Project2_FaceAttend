import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { LayoutDashboard, UserPlus, FileText, BarChart2,
         Shield, Search, CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registerEmployee } from '../api/api';

const NAV = [
  { icon: <LayoutDashboard size={16} />, label: 'Tổng quan',         path: '/dashboard' },
  { icon: <UserPlus size={16} />,        label: 'Đăng ký khuôn mặt',  path: '/register', active: true },
  { icon: <FileText size={16} />,        label: 'Nhật ký truy cập',    path: '#' },
  { icon: <BarChart2 size={16} />,       label: 'Phân tích người dùng',path: '#' },
  { icon: <Shield size={16} />,          label: 'Bảo mật',             path: '#' },
];

const FIELDS = [
  { key: 'user_id',    label: 'Mã nhân viên',    placeholder: 'FA-99210' },
  { key: 'department', label: 'Phòng ban',       placeholder: 'Kỹ thuật lõi', dropdown: true },
  { key: 'name',       label: 'Họ và tên',        placeholder: 'Nguyễn Văn A', full: true },
];

const GUIDANCE = [
  { label: 'Ánh sáng phù hợp', ok: true  },
  { label: 'Mắt mở rõ',        ok: true  },
  { label: 'Căn chỉnh khuôn mặt', ok: false },
];

const AI_INSIGHTS = [
  { label: 'Phát hiện khuôn mặt', val: 'CÓ',     color: 'text-green-400' },
  { label: 'Điểm nhận diện',      val: '128 điểm', color: 'text-cyan-400' },
  { label: 'Ánh sáng',            val: 'TỐI ƯU',   color: 'text-green-400' },
  { label: 'Khoảng cách',         val: '0.8m',     color: 'text-cyan-400' },
];

export default function RegisterFace() {
  const { username } = useAuth();
  const navigate     = useNavigate();
  const webcamRef    = useRef<Webcam>(null);
  const [form, setForm]         = useState({ user_id:'', department:'', name:'' });
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{type:'success'|'error'; text:string}|null>(null);
  const [captured, setCaptured] = useState<string|null>(null);
  const [camErr, setCamErr]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // reliability score animation
  const [reliability] = useState(84);
  const circum = 2 * Math.PI * 40;
  const dash   = circum - (reliability / 100) * circum;

  const handleCapture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    if (img) setCaptured(img);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!form.user_id || !form.name || !form.department) {
      setMsg({ type:'error', text:'Vui lòng điền đầy đủ thông tin' }); return;
    }
    const src = captured || webcamRef.current?.getScreenshot();
    if (!src) { setMsg({ type:'error', text:'Vui lòng chụp ảnh khuôn mặt trước' }); return; }
    setLoading(true); setMsg(null);
    try {
      const blob = await (await fetch(src)).blob();
      const fd = new FormData();
      fd.append('file', blob, 'face.jpg');
      fd.append('user_id', form.user_id);
      fd.append('name', form.name);
      fd.append('department', form.department);
      fd.append('position', 'Nhân viên');
      await registerEmployee(fd);
      setMsg({ type:'success', text:`Đăng ký thành công cho ${form.name}` });
      setForm({ user_id:'', department:'', name:'' });
      setCaptured(null);
    } catch (err: any) {
      setMsg({ type:'error', text: err.response?.data?.reason || 'Đăng ký thất bại' });
    } finally { setLoading(false); }
  }, [form, captured]);

  return (
    <div className="min-h-screen bg-slate-50 flex font-['DM_Sans']">

      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? 'w-52' : 'w-0 overflow-hidden'} flex-shrink-0
                         bg-white border-r border-slate-100 flex flex-col
                         transition-all duration-300 ease-in-out lg:w-52`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-sm font-black text-slate-950">FaceAttend</p>
          <p className="text-[9px] text-slate-400 tracking-widest uppercase mt-0.5">
            Bảo mật sinh trắc học
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {NAV.map(({ icon, label, path, active }) => (
            <button key={label}
                    onClick={() => navigate(path)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm
                                transition-all text-left
                      ${active
                        ? 'text-blue-700 bg-blue-50 font-semibold border-r-2 border-blue-600'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              {icon} {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-3.5
                           flex items-center justify-between">
          <h1 className="text-xs font-black tracking-widest uppercase text-slate-500">
            Cổng đăng ký
          </h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input placeholder="Tìm kiếm..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl
                      text-xs text-slate-700 placeholder-slate-300 outline-none
                      focus:border-blue-400 transition-all w-48" />
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center
                            text-[10px] font-bold text-white">
              {username?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 grid grid-cols-[1fr_280px] gap-5">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Form card */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950 mb-1">Đăng ký mới</h2>
              <p className="text-xs text-slate-400 mb-5">
                Đăng ký sinh trắc học cho nhân viên mới.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.filter(f => !f.full).map(({ key, label, placeholder, dropdown }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold text-slate-400
                                      tracking-widest uppercase mb-1.5">
                      {label}
                    </label>
                    <div className="relative">
                      <input type="text"
                             value={form[key as keyof typeof form]}
                             onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                             placeholder={placeholder}
                             className="w-full border border-slate-200 rounded-xl px-3 py-2.5
                                        text-sm text-slate-900 placeholder-slate-300 outline-none
                                        focus:border-blue-500 focus:ring-2 focus:ring-blue-50
                                        transition-all pr-8" />
                      {dropdown && (
                        <ChevronDown size={13}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      )}
                    </div>
                  </div>
                ))}
                {FIELDS.filter(f => f.full).map(({ key, label, placeholder }) => (
                  <div key={key} className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-400
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
              </div>
            </div>

            {/* Camera card */}
              <div className="bg-[#0e1624] rounded-3xl overflow-hidden relative"
                style={{ minHeight: 300 }}>

              {/* Success banner */}
              {msg?.type === 'success' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30
                                bg-green-500 text-white text-xs font-bold px-5 py-2
                                rounded-full flex items-center gap-1.5 animate-fade-in-up">
                  <CheckCircle2 size={13} /> {msg.text}
                </div>
              )}
              {msg?.type === 'error' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30
                                bg-red-500 text-white text-xs font-bold px-5 py-2
                                rounded-full flex items-center gap-1.5 animate-fade-in-up">
                  ⚠ {msg.text}
                </div>
              )}

              {/* Webcam or captured */}
              {captured ? (
                <img src={captured} alt="captured"
                     className="w-full h-full object-cover absolute inset-0 opacity-80" />
              ) : (
                !camErr && (
                  <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                          videoConstraints={{ width: 800, height: 500, facingMode:'user' }}
                          className="absolute inset-0 w-full h-full object-cover opacity-70"
                          onUserMediaError={() => setCamErr(true)} />
                )
              )}

              {/* Scanner frame */}
              {!captured && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-48 h-48">
                    {/* Corners */}
                    {[
                      'top-0 left-0 border-t-2 border-l-2',
                      'top-0 right-0 border-t-2 border-r-2',
                      'bottom-0 left-0 border-b-2 border-l-2',
                      'bottom-0 right-0 border-b-2 border-r-2',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-7 h-7 border-blue-400 ${cls}`} />
                    ))}
                    {/* Detection dots */}
                    {[[35,30],[65,30],[30,55],[70,55],[50,70],[35,78],[65,78]]
                      .map(([x,y],i) => (
                        <div key={i}
                             className="absolute w-1 h-1 rounded-full bg-blue-400 opacity-60"
                             style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)' }} />
                      ))}
                    {/* Laser */}
                    <div className="absolute left-0 right-0 h-px animate-scan-laser"
                         style={{
                           background:'linear-gradient(90deg,transparent,#3b82f6cc,#60a5faff,#3b82f6cc,transparent)',
                           boxShadow:'0 0 8px 2px rgba(96,165,250,0.5)',
                         }} />
                  </div>
                </div>
              )}

              {/* Bottom controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                {!captured ? (
                  <button onClick={handleCapture}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white
                                     text-xs font-semibold rounded-full transition-all
                                     shadow-lg shadow-blue-900/30 active:scale-95">
                    📸 Chụp ảnh
                  </button>
                ) : (
                  <button onClick={() => { setCaptured(null); setMsg(null); }}
                          className="px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/20
                                     text-white text-xs font-semibold rounded-full transition-all">
                    Chụp lại
                  </button>
                )}
                {captured && (
                  <button onClick={handleRegister} disabled={loading}
                          className="px-5 py-2 bg-green-500 hover:bg-green-400 text-white
                                     text-xs font-bold rounded-full transition-all
                                     shadow-lg shadow-green-900/30 active:scale-95
                                     disabled:opacity-50">
                    {loading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white
                                         rounded-full animate-spin" />
                        Đang đăng ký...
                      </span>
                    ) : '✓ Đăng ký'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* Scanning guidance */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-4">
                Hướng dẫn quét
              </p>
              <div className="space-y-3">
                {GUIDANCE.map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                                      ${ok ? 'bg-blue-50' : 'bg-slate-50'}`}>
                        {ok ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2"/>
                            <path d="M8 12l3 3 5-5" stroke="#3b82f6" strokeWidth="2"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                                  stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-700">{label}</span>
                    </div>
                    {ok ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : (
                      <Circle size={16} className="text-slate-200" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reliability score */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-4">
                Độ tin cậy
              </p>
              <div className="flex items-center justify-center my-2">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96"
                       style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="48" cy="48" r="40" stroke="#f1f5f9"
                            strokeWidth="8" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke="#3b82f6"
                            strokeWidth="8" fill="none"
                            strokeDasharray={circum} strokeDashoffset={dash}
                            strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-950">{reliability}%</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                      Tin cậy
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <span className="inline-block text-[10px] font-bold text-blue-600
                                 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
                  Đạt ngưỡng
                </span>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-[#0e1624] border border-slate-800 rounded-3xl p-5">
              <p className="text-[9px] font-black text-slate-500 tracking-widest uppercase mb-4">
                AI đánh giá
              </p>
              <div className="space-y-2.5">
                {AI_INSIGHTS.map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-bold font-mono ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}