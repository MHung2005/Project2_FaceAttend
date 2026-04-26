import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Shield, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ManagerLogin() {
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername]    = useState('');
  const [password, setPassword]    = useState('');
  const [showPw, setShowPw]        = useState(false);
  const [remember, setRemember]    = useState(false);
  const [error, setError]          = useState('');
  const [loading, setLoading]      = useState(false);

  if (isAuthenticated) { window.location.href = '/dashboard'; return null; }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try   { await login(username, password); }
    catch (err: any) { setError(err.response?.data?.detail || 'Sai tên đăng nhập hoặc mật khẩu'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex font-['DM_Sans'] bg-white">

      {/* ── BÊN TRÁI: Panel gradient tối ── */}
      <div className="hidden lg:flex w-[42%] flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(145deg, #0c1a3a 0%, #112158 45%, #0e2060 100%)' }}>

        {/* Nền chấm tròn */}
        <div className="absolute inset-0  "
             style={{
               backgroundImage: "url('/src/assets/screen.png')",
               backgroundSize: 'cover',
               backgroundRepeat: 'no-repeat',
               backgroundPosition: 'center',
             }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          {/* <div>
            <p className="text-white font-bold text-base leading-none">FaceAttend</p>
          </div> */}
        </div>

        {/* Tiêu đề */}
        <div className="relative space-y-5">
          <h1 className="text-white font-black text-4xl leading-tight">
            Nâng tầm doanh nghiệp với chấm công AI tương lai.
          </h1>
          <p className="text-blue-200/60 text-sm leading-relaxed">
            Trải nghiệm môi trường làm việc liền mạch, an toàn, không chạm nhờ công nghệ nhận diện sinh trắc học hàng đầu.
          </p>
          {/* Dòng chỉ số */}
          <div className="flex gap-8 pt-4">
            {[
              { val: '99.9%', label: 'CHÍNH XÁC' },
              { val: '<0.5s', label: 'NHẬN DIỆN' },
              { val: 'ISO 27001', label: 'CHỨNG NHẬN' },
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="text-white font-bold text-sm">{val}</p>
                <p className="text-blue-300/50 text-[9px] tracking-widest mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BÊN PHẢI: Form đăng nhập ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-950">Chào mừng trở lại</h2>
            <p className="text-slate-400 text-sm mt-2">
              Vui lòng nhập thông tin để truy cập bảng điều khiển.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tên đăng nhập */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tên đăng nhập/Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={username} required
                       onChange={e => setUsername(e.target.value)}
                       placeholder="ten@congty.com"
                       className="w-full pl-11 pr-4 py-3.5 border border-slate-200
                                  rounded-2xl text-sm text-slate-900 placeholder-slate-300
                                  focus:outline-none focus:border-blue-500 focus:ring-4
                                  focus:ring-blue-50 transition-all bg-white" />
              </div>
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} value={password} required
                       onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••"
                       className="w-full pl-11 pr-12 py-3.5 border border-slate-200
                                  rounded-2xl text-sm text-slate-900 placeholder-slate-300
                                  focus:outline-none focus:border-blue-500 focus:ring-4
                                  focus:ring-blue-50 transition-all bg-white" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400
                                   hover:text-slate-700 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Ghi nhớ + Quên mật khẩu */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                <input type="checkbox" checked={remember}
                       onChange={e => setRemember(e.target.checked)}
                       className="rounded border-slate-300 text-blue-600
                                  focus:ring-blue-500 w-4 h-4" />
                Ghi nhớ đăng nhập
              </label>
              <button type="button"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
                Quên mật khẩu?
              </button>
            </div>

            {/* Lỗi */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100
                              rounded-2xl px-4 py-3 text-sm text-red-600">
                ⚠ {error}
              </div>
            )}


            {/* Nút đăng nhập */}
            <button type="submit" disabled={loading}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
                               disabled:bg-slate-200 disabled:text-slate-400
                               text-white font-bold text-sm rounded-2xl
                               transition-all duration-200 shadow-lg shadow-blue-200">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white
                                   rounded-full animate-spin" />
                  Đang xác thực...
                </span>
              ) : 'Đăng nhập'}
            </button>

            {/* Nút quay lại trang checkin */}
            <button type="button" onClick={() => window.location.href = '/'}
                    className="w-full py-3 mt-2 bg-white border border-slate-200 hover:bg-slate-50
                               text-blue-600 font-semibold text-sm rounded-2xl transition-all">
              ← Quay lại trang điểm danh
            </button>

            {/* Dòng phân cách */}
            {/* <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">hoặc</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div> */}

            {/* Đăng nhập bằng khuôn mặt */}
            {/* <button type="button" onClick={() => window.location.href = '/'}
                    className="w-full py-3.5 border border-slate-200 hover:bg-slate-50
                               active:scale-[0.98] text-sm font-semibold text-slate-700
                               rounded-2xl transition-all flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#3b82f6" strokeWidth="2"/>
                  <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7"
                        stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              Đăng nhập bằng khuôn mặt
            </button> */}

            <p className="text-center text-sm text-slate-400">
              Chưa có tài khoản?{' '}
              <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                Liên hệ quản trị viên
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}