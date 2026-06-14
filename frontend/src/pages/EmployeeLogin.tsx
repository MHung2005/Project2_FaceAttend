import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Shield, User, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function EmployeeLogin() {
  const { loginAsEmployee, isAuthenticated, isEmployee } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  if (isAuthenticated && isEmployee) {
    window.location.href = '/employee/checkin'; return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try   { await loginAsEmployee(username, password); }
    catch (err: any) { setError(err.response?.data?.detail || 'Sai tài khoản hoặc mật khẩu'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex font-['DM_Sans'] bg-white">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[42%] flex-col justify-between p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(145deg, #0c2340 0%, #0f3460 50%, #0a2744 100%)' }}>
        <div className="absolute inset-0 opacity-10"
             style={{
               backgroundImage: `radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%),
                                 radial-gradient(circle at 80% 20%, #06b6d4 0%, transparent 40%)`,
             }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">FaceAttend</p>
            <p className="text-emerald-300/60 text-[10px] tracking-widest uppercase mt-0.5">
              Cổng nhân viên
            </p>
          </div>
        </div>

        {/* Body text */}
        <div className="relative space-y-5">
          <h1 className="text-white font-black text-4xl leading-tight">
            Chấm công nhanh,<br />an toàn, không chạm.
          </h1>
          <p className="text-blue-200/60 text-sm leading-relaxed">
            Đăng nhập để truy cập trang chấm công khuôn mặt của bạn. Chỉ mất vài giây mỗi ngày.
          </p>
          <div className="flex gap-8 pt-4">
            {[
              { val: 'Khuôn mặt', label: 'XÁC THỰC' },
              { val: 'GPS',       label: 'ĐỊNH VỊ' },
              { val: '<2s',       label: 'NHẬN DIỆN' },
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="text-white font-bold text-sm">{val}</p>
                <p className="text-blue-300/50 text-[9px] tracking-widest mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Back to guest */}
          <button onClick={() => navigate('/')}
                  className="flex items-center gap-1.5 text-sm text-slate-400
                             hover:text-slate-700 mb-8 transition-colors group">
            <ArrowLeft size={14}
              className="group-hover:-translate-x-0.5 transition-transform" />
            Trang điểm danh khách
          </button>

          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center
                            justify-center mb-4">
              <User size={22} className="text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-950">Đăng nhập nhân viên</h2>
            <p className="text-slate-400 text-sm mt-2">
              Sử dụng tài khoản được cấp bởi quản lý.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tên đăng nhập
              </label>
              <div className="relative">
                <User size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={username} required
                       onChange={e => setUsername(e.target.value)}
                       placeholder="nhanvien01"
                       className="w-full pl-11 pr-4 py-3.5 border border-slate-200
                                  rounded-2xl text-sm text-slate-900 placeholder-slate-300
                                  focus:outline-none focus:border-emerald-500 focus:ring-4
                                  focus:ring-emerald-50 transition-all bg-white" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showPw ? 'text' : 'password'} value={password} required
                       onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••"
                       className="w-full pl-11 pr-12 py-3.5 border border-slate-200
                                  rounded-2xl text-sm text-slate-900 placeholder-slate-300
                                  focus:outline-none focus:border-emerald-500 focus:ring-4
                                  focus:ring-emerald-50 transition-all bg-white" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400
                                   hover:text-slate-700 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100
                              rounded-2xl px-4 py-3 text-sm text-red-600">
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700
                               active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400
                               text-white font-bold text-sm rounded-2xl transition-all
                               duration-200 shadow-lg shadow-emerald-100">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white
                                   rounded-full animate-spin" />
                  Đang xác thực...
                </span>
              ) : 'Đăng nhập'}
            </button>

            {/* Manager login link */}
            <p className="text-center text-sm text-slate-400 pt-2">
              Bạn là quản lý?{' '}
              <button type="button" onClick={() => navigate('/login')}
                      className="text-blue-600 font-semibold hover:underline">
                Đăng nhập tại đây
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}